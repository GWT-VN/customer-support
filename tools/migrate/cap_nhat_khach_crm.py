"""Cập nhật nội dung khách theo file CRM mới nhất -> cs_customers (project mới).

Nguồn: File gốc/Hệ thống CRM/Contact (res.partner).xlsx
  Name(0) Email(1) Phone(2) Street(3) State(4) + Products/* (dòng phụ, bỏ qua).

Khớp khách theo SĐT CHUẨN HOÁ (KHÔNG theo tên — bài học "2 khách tên Yến").
Địa chỉ + tỉnh: lấy theo file mới (user chốt "cập nhật theo file mới nhất").
Tên khác nhau: CHỈ báo cáo, không tự ghi đè (tránh đè bản sửa tay).

Chạy:  .venv/bin/python -m migrate.cap_nhat_khach_crm          # dry-run
       .venv/bin/python -m migrate.cap_nhat_khach_crm --ghi    # ghi thật
"""

import json
import pathlib
import re
import sys
import urllib.parse
import urllib.request

import openpyxl

from migrate.parse import normalize_phone

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
XLSX = ROOT / "data/File gốc/Hệ thống CRM/Contact (res.partner).xlsx"


def dest():
    env = {}
    for line in (ROOT / "migrate/.env.migrate").read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    url, key = env["DEST_URL"], env["DEST_SERVICE_KEY"]
    assert "bwzmqfbcgouhvhoslmmm" in url, "DEST phải là project mới"
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


def clean_tinh(v):
    if not v:
        return None
    t = re.sub(r"\s*\(VN\)\s*$", "", str(v).strip())
    t = re.sub(r"^(TP\.?|Thành phố|Tỉnh)\s+", "", t, flags=re.I)
    return t.strip() or None


def main():
    ghi = "--ghi" in sys.argv
    url, key = dest()

    # đọc file: gom khách (dòng có Name)
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))[1:]
    wb.close()

    by_phone, sdt_loi, khong_sdt = {}, [], 0
    for r in rows:
        if not r[0]:
            continue  # dòng sản phẩm phụ
        ten = str(r[0]).strip()
        sdt, err = normalize_phone(r[2])
        if not r[2]:
            khong_sdt += 1
            continue
        if err:
            sdt_loi.append((ten, str(r[2])))
            continue
        by_phone[sdt] = {"ten": ten, "dia_chi": (str(r[3]).strip() if r[3] else None),
                         "tinh": clean_tinh(r[4])}

    # khách trong DB
    db = []
    off = 0
    while True:
        b = rest(url, key, f"cs_customers?select=id,primary_phone,full_name,address,province&limit=1000&offset={off}")
        db += b
        if len(b) < 1000:
            break
        off += 1000
    db_by_phone = {c["primary_phone"]: c for c in db if c["primary_phone"]}

    updates, ten_khac, khach_moi = [], [], []
    dc_fill = dc_change = tinh_fill = tinh_change = 0
    for sdt, f in by_phone.items():
        c = db_by_phone.get(sdt)
        if not c:
            khach_moi.append((f["ten"], sdt))
            continue
        patch = {}
        if f["dia_chi"] and f["dia_chi"] != c["address"]:
            patch["address"] = f["dia_chi"]
            if c["address"]:
                dc_change += 1
            else:
                dc_fill += 1
        if f["tinh"] and f["tinh"] != c["province"]:
            patch["province"] = f["tinh"]
            if c["province"]:
                tinh_change += 1
            else:
                tinh_fill += 1
        if f["ten"] and f["ten"] != c["full_name"]:
            ten_khac.append((c["full_name"], f["ten"], sdt))
        if patch:
            updates.append((c["id"], patch))

    print(f"Khách trong file có SĐT hợp lệ: {len(by_phone)}  (không SĐT {khong_sdt}, SĐT lỗi {len(sdt_loi)})")
    print(f"Khớp DB theo SĐT → cập nhật: {len(updates)} khách")
    print(f"  Địa chỉ: điền mới {dc_fill} · đổi giá trị cũ {dc_change}")
    print(f"  Tỉnh   : điền mới {tinh_fill} · đổi giá trị cũ {tinh_change}")
    print(f"Tên khác nhau (CHỈ báo cáo, không đổi): {len(ten_khac)}")
    for db_ten, f_ten, sdt in ten_khac[:15]:
        print(f"    {sdt}: DB “{db_ten}”  ≠  file “{f_ten}”")
    print(f"Khách trong file KHÔNG có trong DB (SĐT mới): {len(khach_moi)}")
    if sdt_loi:
        print(f"SĐT lỗi trong file: {len(sdt_loi)} (bỏ qua)")

    if not ghi:
        print("\n(dry-run — thêm --ghi để ghi thật)")
        return
    for cid, patch in updates:
        rest(url, key, f"cs_customers?id=eq.{cid}", method="PATCH", body=patch, prefer="return=minimal")
    print(f"\nĐÃ CẬP NHẬT {len(updates)} khách (địa chỉ/tỉnh).")


if __name__ == "__main__":
    main()
