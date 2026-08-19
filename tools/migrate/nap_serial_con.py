"""Nạp serial CON của bộ lọc tổng từ export Odoo vào installed_base.

Logic Odoo (user chốt 2026-07-16): bộ WH15A/WH30A gồm 3 thiết bị con; Odoo tự sinh
serial mẹ gắn khách + kích hoạt BH, serial con gắn mẹ nhưng KHÔNG kích hoạt riêng.
=> Con vào installed_base với: parent_serial = mẹ · customer_id + install_date kế thừa mẹ ·
   KHÔNG tạo dòng warranty (view v_installed_base/v_tickets tự hiển thị BH theo mẹ).

Chỉ nạp con có MẸ đang nằm trong installed_base (mẹ tồn kho -> con cũng tồn kho, bỏ).

Chạy:  .venv/bin/python -m migrate.nap_serial_con            # dry-run, chỉ in
       .venv/bin/python -m migrate.nap_serial_con --ghi      # ghi thật vào DB
"""

import json
import pathlib
import sys
import urllib.parse
import urllib.request

import openpyxl

from migrate import parse

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
XLSX = ROOT / "Hệ thống CRM/GWT Serial (gwt.serial) (3).xlsx"


def sb():
    env = dict(l.strip().split("=", 1) for l in (ROOT / "apps/web/.env.local").read_text().splitlines()
               if l.strip() and not l.startswith("#") and "=" in l)
    return env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]


def get(url, key, p):
    p = urllib.parse.quote(p, safe='?&=,.*"')
    req = urllib.request.Request(f"{url}/rest/v1/{p}",
                                 headers={"apikey": key, "Authorization": f"Bearer {key}"})
    return json.load(urllib.request.urlopen(req))


def post(url, key, table, rows):
    req = urllib.request.Request(
        f"{url}/rest/v1/{table}?on_conflict=serial",
        data=json.dumps(rows).encode(),
        headers={"apikey": key, "Authorization": f"Bearer {key}",
                 "Content-Type": "application/json",
                 "Prefer": "resolution=ignore-duplicates,return=minimal"},
        method="POST")
    urllib.request.urlopen(req)


def main():
    ghi = "--ghi" in sys.argv
    url, key = sb()

    internal = {r["Mã nội bộ"] for r in get(url, key, 'catalog_item?select="Mã nội bộ"&limit=1000')}
    supplier = {r["Mã đối tác"]: r["Mã nội bộ"] for r in
                get(url, key, 'supplier_code?select="Mã đối tác","Mã nội bộ"&limit=1000')}
    ib = {r["serial"]: r for r in
          get(url, key, "installed_base?select=serial,customer_id,install_date,channel_source&limit=2000")}

    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    rows = list(wb.worksheets[0].iter_rows(values_only=True))
    hdr = [str(h).strip() for h in rows[0]]
    data = [dict(zip(hdr, r)) for r in rows[1:]]

    them, bo_me_ton_kho, da_co, khong_ma = [], 0, 0, []
    for r in data:
        serial = str(r.get("Serial") or "").strip()
        parent = str(r.get("Parent serial") or "").strip()
        if not serial or not parent or (r.get("Customer") or ""):
            continue                      # không phải "con mồ côi khách"
        if serial in ib:
            da_co += 1
            continue
        me = ib.get(parent)
        if not me:
            bo_me_ton_kho += 1            # cả bộ còn tồn kho
            continue
        raw = parse.extract_code(r.get("Product name") or "")
        code = parse.resolve_internal_code(raw, internal, supplier)
        if not code:
            khong_ma.append((serial, raw))
        them.append({
            "serial": serial,
            "internal_code": code,
            "source_product_code": raw,
            "model_freetext": None if code else (raw or r.get("Product name")),
            "customer_id": me["customer_id"],
            "parent_serial": parent,
            "install_date": me["install_date"],
            "channel_source": me.get("channel_source"),
        })

    print(f"Con sẽ nạp: {len(them)} · mẹ tồn kho (bỏ): {bo_me_ton_kho} · đã có sẵn: {da_co}")
    if khong_ma:
        print("⚠️ KHÔNG resolve được mã:", khong_ma)
    for t in them[:5]:
        print("  vd:", t["serial"], "->", t["internal_code"], "| mẹ", t["parent_serial"])

    if not ghi:
        print("(dry-run — thêm --ghi để ghi thật)")
        return
    for i in range(0, len(them), 100):
        post(url, key, "installed_base", them[i:i + 100])
    print(f"ĐÃ GHI {len(them)} serial con vào installed_base.")


if __name__ == "__main__":
    main()
