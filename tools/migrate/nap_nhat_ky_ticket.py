"""Nhập nhật ký ticket cũ từ Odoo export -> bảng ticket_note (project mới).

Nguồn: File gốc/Hệ thống CRM/Tickets (gwt.ticket).xlsx
  Cột Notes/Create time (12) · Notes/Note (13) · Notes/Ticket (14) = nhật ký từng dòng.
  Ticket nhiều note -> nhiều dòng, mỗi dòng 1 note (Notes/Ticket luôn có mã ticket).

Chỉ chèn note cho ticket ĐÃ CÓ trong DB (ticket_note.ticket_code FK -> tickets).
Dedup theo (ticket_code, created_at, noi_dung) để chạy lại không nhân đôi.

Chạy:  .venv/bin/python -m migrate.nap_nhat_ky_ticket           # dry-run
       .venv/bin/python -m migrate.nap_nhat_ky_ticket --ghi     # ghi thật
"""

import datetime as dt
import json
import pathlib
import sys
import urllib.request

import openpyxl

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
XLSX = ROOT / "data/File gốc/Hệ thống CRM/Tickets (gwt.ticket).xlsx"


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
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if prefer:
        headers["Prefer"] = prefer
    req = urllib.request.Request(f"{url}/rest/v1/{path}", method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers=headers)
    with urllib.request.urlopen(req) as r:
        raw = r.read()
        return json.loads(raw) if raw else None


def iso(v):
    if isinstance(v, (dt.datetime, dt.date)):
        return v.isoformat()
    return str(v).strip() if v else None


def main():
    ghi = "--ghi" in sys.argv
    url, key = dest()

    # mã ticket đang có trong DB
    db_codes = set()
    off = 0
    while True:
        batch = rest(url, key, f"tickets?select=ticket_code&limit=1000&offset={off}")
        db_codes |= {r["ticket_code"] for r in batch}
        if len(batch) < 1000:
            break
        off += 1000

    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))[1:]
    wb.close()

    notes, thieu = [], {}
    for r in rows:
        code = (str(r[14]).strip() if r[14] else None)   # Notes/Ticket
        noi_dung = (str(r[13]).strip() if r[13] else None)  # Notes/Note
        when = iso(r[12])                                    # Notes/Create time
        if not code or not noi_dung:
            continue
        if code not in db_codes:
            thieu[code] = thieu.get(code, 0) + 1
            continue
        notes.append({"ticket_code": code, "noi_dung": noi_dung,
                      "created_at": when, "tac_gia": None})

    # dedup với note đã có trong DB
    existing = set()
    off = 0
    while True:
        batch = rest(url, key, f"ticket_note?select=ticket_code,created_at,noi_dung&limit=1000&offset={off}")
        for e in batch:
            existing.add((e["ticket_code"], (e["created_at"] or "")[:19], e["noi_dung"]))
        if len(batch) < 1000:
            break
        off += 1000
    moi = [n for n in notes if (n["ticket_code"], (n["created_at"] or "")[:19], n["noi_dung"]) not in existing]

    print(f"Note trong file (ticket có trong DB): {len(notes)}")
    print(f"Note MỚI cần chèn (sau dedup):       {len(moi)}")
    print(f"Ticket trong file KHÔNG có trong DB:  {len(thieu)} mã, {sum(thieu.values())} note bị bỏ")
    if thieu:
        print("  ", ", ".join(sorted(thieu)[:20]), ("…" if len(thieu) > 20 else ""))

    if not ghi:
        print("\n(dry-run — thêm --ghi để ghi thật)")
        return
    for i in range(0, len(moi), 200):
        rest(url, key, "ticket_note", method="POST", body=moi[i:i + 200], prefer="return=minimal")
    print(f"\nĐÃ CHÈN {len(moi)} note vào ticket_note.")


if __name__ == "__main__":
    main()
