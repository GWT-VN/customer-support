"""Di trú export Odoo -> Supabase (customers + installed_base + warranty).

Chạy DRY-RUN (chỉ in thống kê, không sinh SQL):
    .venv/bin/python -m migrate.odoo_serials "Hệ thống CRM/GWT Serial (gwt.serial).xlsx" --catalog catalog.json

Sinh SQL để nạp:
    .venv/bin/python -m migrate.odoo_serials <xlsx> --catalog catalog.json --emit-sql out.sql

⚠️ SQL sinh ra CHỨA TÊN KHÁCH (dữ liệu cá nhân) -> KHÔNG commit vào git.
   catalog.json = {"internal": [...], "supplier": {"mã đối tác": "mã nội bộ"}}
   (dump từ Supabase; tách rời để module này test được mà không cần nối DB.)
"""

import json
import sys

import openpyxl

from migrate import parse


def load_rows(xlsx_path):
    """Đọc sheet đầu -> list[dict] theo header dòng 1, bỏ dòng rỗng."""
    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    header = [str(h).strip() for h in rows[0]]
    out = []
    for r in rows[1:]:
        if not any(v is not None and str(v).strip() for v in r):
            continue
        out.append(dict(zip(header, r)))
    return out


def customer_key(phone, name):
    """Khoá gộp khách: ưu tiên SĐT (khoá thật). Không có SĐT -> theo tên (tạm, needs_phone)."""
    return ("phone", phone) if phone else ("name", name)


def build(rows, internal_codes, supplier_map):
    """Biến rows Odoo -> (customers, machines, stats). Thuần tuý, không đụng DB.

    Khoá khách = SĐT (Customer/Phone). Máy không có SĐT -> gộp tạm theo tên + needs_phone=true.
    """
    customers = {}   # key -> {"full_name","source","primary_phone","needs_phone"}
    machines = []
    stats = {
        "tong_dong": len(rows),
        "ton_kho_bo_qua": 0,
        "khong_phai_khach": 0,
        "may_da_lap": 0,
        "khach": 0,
        "khach_co_sdt": 0,
        "khach_thieu_sdt": 0,
        "kich_hoat_bh": 0,
        "co_parent": 0,
        "ma_khong_resolve": {},
        "sdt_loi": {},
    }

    for r in rows:
        if parse.is_stock(r):
            stats["ton_kho_bo_qua"] += 1
            continue

        serial = r["Serial"].strip()
        name, source = parse.split_source(r["Customer"])

        phone, err = parse.normalize_phone(r.get("Customer/Phone"))
        note = None
        if err:
            # User chốt 2026-07-15: SĐT lỗi VẪN lưu nguyên như Odoo, gắn cờ + ghi lý do, chỉnh sau.
            stats["sdt_loi"][err] = stats["sdt_loi"].get(err, 0) + 1
            phone = parse.raw_phone(r.get("Customer/Phone"))
            note = "SĐT cần sửa: " + err

        key = customer_key(phone, name)
        if key not in customers:
            customers[key] = {
                "full_name": name,
                "source": source,
                "primary_phone": phone,
                # cờ = thiếu SĐT HOẶC SĐT sai dạng -> cần người xử lý
                "needs_phone": phone is None or note is not None,
                "notes": note,
            }

        raw = parse.extract_code(r.get("Product name"))
        code = parse.resolve_internal_code(raw, internal_codes, supplier_map)
        if raw and not code:
            stats["ma_khong_resolve"][raw] = stats["ma_khong_resolve"].get(raw, 0) + 1

        parent = (r.get("Parent serial") or "").strip() or None
        if parent:
            stats["co_parent"] += 1
        activated = parse.is_activated(r.get("Warranty activated"))
        if activated:
            stats["kich_hoat_bh"] += 1

        machines.append({
            "serial": serial,
            "internal_code": code,
            "source_product_code": raw,
            # chỉ dùng freetext khi KHÔNG resolve được mã (check constraint yêu cầu 1 trong 2)
            "model_freetext": None if code else (r.get("Product name") or raw or "(không rõ)"),
            "customer_key": key,
            "customer_name": name,
            "customer_phone": phone,
            "parent_serial": parent,
            "activated": activated,
            "start_date": parse.to_date(r.get("Activated date")),
        })

    stats["may_da_lap"] = len(machines)
    stats["khach"] = len(customers)
    stats["khach_co_sdt"] = sum(1 for c in customers.values() if c["primary_phone"])
    stats["khach_thieu_sdt"] = sum(1 for c in customers.values() if not c["primary_phone"])
    return customers, machines, stats


def _q(v):
    if v is None:
        return "null"
    return "'" + str(v).replace("'", "''") + "'"


def emit_sql_compact(customers, machines):
    """Sinh SQL gọn bằng json_to_recordset (payload JSON 1 lần, DB tự bung).

    Gọn hơn ~3x so với emit_sql() và dễ đọc hơn. ⚠️ chứa tên khách -> KHÔNG commit.
    Khoá ngắn: n=name s=source p=phone q=needs_phone o=notes
               r=serial c=internal_code g=source_product_code f=freetext d=install_date
    """
    cj = json.dumps([
        {"n": c["full_name"], "s": c["source"], "p": c["primary_phone"],
         "q": c["needs_phone"], "o": c.get("notes")}
        for c in customers.values()
    ], ensure_ascii=False, separators=(",", ":"))

    mj = json.dumps([
        {"r": m["serial"], "c": m["internal_code"], "g": m["source_product_code"],
         "f": m["model_freetext"], "p": m["customer_phone"], "n": m["customer_name"],
         "d": m["start_date"], "t": m["parent_serial"], "a": m["activated"]}
        for m in machines
    ], ensure_ascii=False, separators=(",", ":"))

    return f"""begin;

-- 1) KHÁCH — khoá primary_phone. Thiếu/lỗi SĐT -> needs_phone=true (+ notes lý do).
insert into public.customers (full_name, source, primary_phone, needs_phone, notes)
select n, s, p, q, o
from json_to_recordset({_q(cj)}::json)
     as x(n text, s text, p text, q boolean, o text)
on conflict (primary_phone) do update set full_name = excluded.full_name;

-- 2) MÁY ĐÃ LẮP — nối khách qua SĐT; không có SĐT thì theo tên (chỉ khách primary_phone is null).
insert into public.installed_base
  (serial, internal_code, source_product_code, model_freetext, customer_id, install_date)
select m.r, m.c, m.g, m.f,
       coalesce(
         (select id from public.customers c where c.primary_phone = m.p),
         (select id from public.customers c where c.full_name = m.n and c.primary_phone is null limit 1)
       ),
       m.d::date
from json_to_recordset({_q(mj)}::json)
     as m(r text, c text, g text, f text, p text, n text, d text, t text, a boolean)
on conflict (serial) do update set
  internal_code       = excluded.internal_code,
  source_product_code = excluded.source_product_code,
  model_freetext      = excluded.model_freetext,
  customer_id         = excluded.customer_id,
  install_date        = excluded.install_date;

commit;"""


def emit_sql(customers, machines):
    """Sinh SQL nạp (dạng dài, từng dòng). ⚠️ chứa tên khách -> không commit."""
    out = ["begin;"]

    # 1) customers — khoá primary_phone (unique). Khách thiếu SĐT -> needs_phone=true.
    vals = ",\n".join(
        "  (%s, %s, %s, %s, %s)" % (_q(c["full_name"]), _q(c["source"]), _q(c["primary_phone"]),
                                    "true" if c["needs_phone"] else "false", _q(c.get("notes")))
        for c in customers.values()
    )
    out.append(
        "insert into public.customers (full_name, source, primary_phone, needs_phone, notes) values\n"
        + vals + "\non conflict (primary_phone) do update set full_name=excluded.full_name;"
    )

    # 2) installed_base — lượt 1, CHƯA gắn parent_serial (cha có thể chưa tồn tại).
    #    Nối khách qua SĐT nếu có; không thì theo tên (chỉ khách needs_phone).
    def cust_lookup(m):
        if m["customer_phone"]:
            return "(select id from public.customers where primary_phone=%s)" % _q(m["customer_phone"])
        return ("(select id from public.customers where full_name=%s and primary_phone is null limit 1)"
                % _q(m["customer_name"]))

    vals = ",\n".join(
        "  (%s, %s, %s, %s, %s, %s)"
        % (_q(m["serial"]), _q(m["internal_code"]), _q(m["source_product_code"]),
           _q(m["model_freetext"]), cust_lookup(m), _q(m["start_date"]))
        for m in machines
    )
    out.append(
        "insert into public.installed_base\n"
        "  (serial, internal_code, source_product_code, model_freetext, customer_id, install_date) values\n"
        + vals + "\non conflict (serial) do update set\n"
        "  internal_code=excluded.internal_code,\n"
        "  source_product_code=excluded.source_product_code,\n"
        "  model_freetext=excluded.model_freetext,\n"
        "  customer_id=excluded.customer_id,\n"
        "  install_date=excluded.install_date;"
    )

    # 3) lượt 2 — parent_serial (giờ mọi serial đã tồn tại)
    for m in machines:
        if m["parent_serial"]:
            out.append(
                "update public.installed_base set parent_serial=%s where serial=%s "
                "and exists (select 1 from public.installed_base p where p.serial=%s);"
                % (_q(m["parent_serial"]), _q(m["serial"]), _q(m["parent_serial"]))
            )

    # 4) kích hoạt bảo hành
    for m in machines:
        if m["activated"]:
            start = _q(m["start_date"]) + "::date" if m["start_date"] else "current_date"
            out.append("select public.activate_warranty(%s, %s);" % (_q(m["serial"]), start))

    out.append("commit;")
    return "\n".join(out)


def main(argv):
    xlsx = argv[1]
    catalog = json.load(open(argv[argv.index("--catalog") + 1], encoding="utf-8"))
    internal_codes = set(catalog["internal"])
    supplier_map = catalog["supplier"]

    rows = load_rows(xlsx)
    customers, machines, stats = build(rows, internal_codes, supplier_map)

    print("=== THỐNG KÊ DI TRÚ (dry-run) ===")
    for k, v in stats.items():
        if k != "ma_khong_resolve":
            print(f"  {k:20} {v}")
    bad = stats["ma_khong_resolve"]
    print(f"  {'ma_khong_resolve':20} {len(bad)} mã" + (f" -> {bad}" if bad else " ✅"))

    if "--emit-sql" in argv:
        path = argv[argv.index("--emit-sql") + 1]
        open(path, "w", encoding="utf-8").write(emit_sql(customers, machines))
        print(f"\n⚠️  SQL (CHỨA TÊN KHÁCH) -> {path} — KHÔNG commit file này.")
    return 0 if not bad else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
