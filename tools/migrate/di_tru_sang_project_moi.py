"""Di trú CSKH: GWT-Masterdata -> GWT-SalesTracking (project mới).

Gồm 2 phần:
  A. MIRROR 6 bảng catalog (read model) — truncate + reload từ Masterdata.
  B. DI TRÚ 10 bảng CSKH — tôn trọng thứ tự FK + self-FK (installed_base mẹ trước con).

⚠️ Nguồn (Masterdata) có RLS 0 policy trên bảng CSKH -> phải đọc bằng SERVICE_ROLE.
⚠️ KHÔNG dùng apps/web/.env.local cho DEST (file đó sắp đổi ở cutover). DEST truyền
   qua biến môi trường DEST_URL + DEST_SERVICE_KEY.

Chạy:
  # dry-run (chỉ đếm, không ghi)
  DEST_URL=https://bwzmqfbcgouhvhoslmmm.supabase.co DEST_SERVICE_KEY=... \
    .venv/bin/python -m migrate.di_tru_sang_project_moi
  # ghi thật
  DEST_URL=... DEST_SERVICE_KEY=... .venv/bin/python -m migrate.di_tru_sang_project_moi --ghi

SOURCE (Masterdata) lấy từ apps/web/.env.local (hiện đang trỏ Masterdata).
"""

import json
import os
import pathlib
import sys
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent

# 6 bảng gương catalog — mirror (truncate + reload). Không FK với nhau.
CATALOG = ["catalog_item", "supplier_code", "catalog_category",
           "product_bundle", "product_filter", "product_warranty"]

# Bảng nguồn (Masterdata) -> tên đích (project mới) khi KHÁC tên. Còn lại giữ nguyên.
SRC_TO_DST = {"customers": "cs_customers"}

# 10 bảng CSKH theo THỨ TỰ FK (mỗi phần tử: bảng hoặc (bảng, filter) cho installed_base 2 lượt)
CSKH_ORDER = [
    "customers",
    "customer_contacts",
    ("installed_base", "parent_serial=is.null"),      # bộ mẹ + máy lẻ trước
    ("installed_base", "parent_serial=not.is.null"),  # serial con sau (trỏ mẹ đã có)
    "warranty",
    "tickets",
    "filter_replacement",
    "maintenance_plan",
    "maintenance_visit",
    "issue_group",
    "issue_override",
]


def load_source():
    env = {}
    for line in (ROOT / "apps/web/.env.local").read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    url = env["NEXT_PUBLIC_SUPABASE_URL"]
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    # chốt chặn: SOURCE phải là Masterdata (tránh chạy nhầm sau cutover)
    if "qynpywysgltspmgnhhga" not in url:
        sys.exit(f"❌ SOURCE không phải Masterdata ({url}). Dừng để tránh di trú nhầm chiều.")
    return url, key


def rest(url, key, path, method="GET", body=None, prefer=None):
    p = urllib.parse.quote(path, safe='?&=,.*"')
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if prefer:
        headers["Prefer"] = prefer
    req = urllib.request.Request(f"{url}/rest/v1/{p}", method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers=headers)
    with urllib.request.urlopen(req) as r:
        raw = r.read()
        return json.loads(raw) if raw else None


def doc_het(url, key, table, flt=None):
    rows, off = [], 0
    while True:
        sep = "&" if "?" in (flt or "") else ("?" if flt else "?")
        q = f"{table}?{flt+'&' if flt else ''}limit=1000&offset={off}"
        batch = rest(url, key, q)
        rows += batch
        if len(batch) < 1000:
            return rows
        off += 1000


def ghi_lo(url, key, table, rows):
    """Ghi theo lô 200 dòng. resolution=merge-duplicates để chạy lại không vỡ."""
    for i in range(0, len(rows), 200):
        rest(url, key, table, method="POST", body=rows[i:i + 200],
             prefer="return=minimal,resolution=merge-duplicates")


def main():
    ghi = "--ghi" in sys.argv
    src_url, src_key = load_source()
    # DEST từ file gitignored migrate/.env.migrate (không đưa service_role qua chat),
    # fallback biến môi trường.
    dst_url = os.environ.get("DEST_URL")
    dst_key = os.environ.get("DEST_SERVICE_KEY")
    envf = ROOT / "migrate/.env.migrate"
    if envf.exists():
        for line in envf.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                if k.strip() == "DEST_URL": dst_url = dst_url or v.strip()
                if k.strip() == "DEST_SERVICE_KEY": dst_key = dst_key or v.strip()
    if not dst_url or not dst_key:
        sys.exit("❌ Thiếu DEST. Tạo file migrate/.env.migrate với 2 dòng:\n"
                 "   DEST_URL=https://bwzmqfbcgouhvhoslmmm.supabase.co\n"
                 "   DEST_SERVICE_KEY=<service_role key của GWT-SalesTracking>")
    if "qynpywysgltspmgnhhga" in dst_url:
        sys.exit("❌ DEST trùng Masterdata — nguy hiểm. Dừng.")

    print(f"SOURCE: {src_url}\nDEST  : {dst_url}\n{'='*60}")

    # ── A. MIRROR CATALOG (truncate + reload) ────────────────────────────────
    print("\n── A. Mirror 6 bảng catalog ──")
    for t in CATALOG:
        rows = doc_het(src_url, src_key, t)
        print(f"  {t:20} nguồn {len(rows):4} dòng", end="")
        if ghi:
            # truncate bằng delete-all (PostgREST không có truncate; dùng filter luôn đúng)
            rest(dst_url, dst_key, f"{t}?id=not.is.null" if t in ("product_bundle", "product_filter")
                 else f'{t}?"Mã nội bộ"=not.is.null' if t in ("catalog_item",)
                 else f'{t}?"Mã đối tác"=not.is.null' if t == "supplier_code"
                 else f'{t}?"Mã danh mục"=not.is.null' if t == "catalog_category"
                 else f"{t}?internal_code=not.is.null",
                 method="DELETE", prefer="return=minimal")
            ghi_lo(dst_url, dst_key, t, rows)
            got = rest(dst_url, dst_key, f"{t}?select=count", prefer="count=exact")
            print(f"  -> đích {got[0]['count'] if got else '?'}")
        else:
            print("  (dry-run)")

    # ── B. DI TRÚ 10 BẢNG CSKH ───────────────────────────────────────────────
    print("\n── B. Di trú 10 bảng CSKH ──")
    for item in CSKH_ORDER:
        t, flt = item if isinstance(item, tuple) else (item, None)
        dst_t = SRC_TO_DST.get(t, t)
        rows = doc_het(src_url, src_key, t, flt)
        label = f"{t}" + (f" -> {dst_t}" if dst_t != t else "") + (f" [{flt}]" if flt else "")
        print(f"  {label:42} nguồn {len(rows):4}", end="")
        if ghi:
            ghi_lo(dst_url, dst_key, dst_t, rows)
            print("  -> đã ghi")
        else:
            print("  (dry-run)")

    if ghi:
        print(f"\n{'='*60}\n✓ Di trú xong. Chạy verify_di_tru để đối chiếu 2 project.")
    else:
        print(f"\n{'='*60}\n(dry-run — thêm --ghi để ghi thật)")


if __name__ == "__main__":
    main()
