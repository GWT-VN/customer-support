"""Nạp 467 task Asana (lịch bảo trì thật) vào maintenance_visit.

Nguồn: "Lịch bảo trì - Lịch kĩ thuật/GWT-Lịch bảo trì - Theo dõi quản lý.xlsx"
(export Asana, sheet "GWT - Lịch bảo trì", header ở dòng 3).

Khớp plan_id: THẬN TRỌNG — chỉ gắn khi tin cậy cao (bộ máy khớp + đủ từ khoá tên trùng),
theo đúng bài học "2 khách tên Yến" (khớp tên lỏng lẻo -> sai người). Section không khớp
chắc -> để plan_id NULL, giữ nguyên section để CSKH tự soi (không đoán).

Chạy:  .venv/bin/python -m migrate.nap_maintenance_visit          # dry-run
       .venv/bin/python -m migrate.nap_maintenance_visit --ghi    # ghi thật
"""

import json
import pathlib
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from datetime import datetime

import openpyxl

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASANA = ROOT / "Lịch bảo trì - Lịch kĩ thuật/GWT-Lịch bảo trì - Theo dõi quản lý.xlsx"

BO_QUA = {"anh", "chi", "co", "chu", "mr", "mrs", "ms", "ong", "ba", "khach",
          "hn", "hcm", "tp", "q1", "q2", "q7", "q9", "q12", "lap", "eco"}


def nfc(s):
    return unicodedata.normalize("NFC", str(s or ""))


def khong_dau(s):
    s = nfc(s).lower().replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s)).strip()


def tu_khoa(s):
    # Bỏ tiền tố số thứ tự thư mục ("43. Anh An Phạm..." -> "Anh An Phạm...") — nếu không,
    # "43" bị tính thành từ khoá, làm loãng mẫu số và tụt điểm khớp (ca "An Phạm" 0.67 < 0.7).
    s = re.sub(r"^\d+\.\s*", "", nfc(s))
    return set(khong_dau(s).split()) - BO_QUA


def bo_may_tu(s):
    """WH15A/WH30A -> {15a} hoặc {30a} để so khớp cột bo_may DB ('WH15A ECO' -> {15a})."""
    m = re.search(r"(15|30)\s*a", khong_dau(s))
    return {m.group(1) + "a"} if m else set()


RE_LAN_THU = re.compile(r"BT\s*(\d+)", re.I)


def sb():
    env = dict(l.strip().split("=", 1) for l in (ROOT / "app-cskh/.env.local").read_text().splitlines()
               if l.strip() and not l.startswith("#") and "=" in l)
    return env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]


def get(url, key, path):
    path = urllib.parse.quote(path, safe='?&=,.*"')
    r = urllib.request.Request(f"{url}/rest/v1/{path}", headers={"apikey": key, "Authorization": f"Bearer {key}"})
    return json.load(urllib.request.urlopen(r))


def post(url, key, table, rows):
    r = urllib.request.Request(
        f"{url}/rest/v1/{table}",
        data=json.dumps(rows).encode(), method="POST",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
                 "Prefer": "return=minimal,resolution=merge-duplicates"})
    urllib.request.urlopen(r)


def doc_thanks():
    wb = openpyxl.load_workbook(ASANA, data_only=True)
    rows = [r for r in wb["GWT - Lịch bảo trì"].iter_rows(values_only=True)]
    hdr = [str(h).strip() if h else "" for h in rows[2]]
    I = {h: i for i, h in enumerate(hdr)}
    return [dict(zip(hdr, r)) for r in rows[3:] if r[0]], I


def main():
    ghi = "--ghi" in sys.argv
    url, key = sb()

    plans = get(url, key, "maintenance_plan?select=id,source_folder,bo_may")
    plan_idx = [(p["id"], tu_khoa(p["source_folder"]), bo_may_tu(p.get("bo_may") or "")) for p in plans]

    data, I = doc_thanks()
    print(f"Đọc {len(data)} task Asana")

    them, khop, khong_khop = [], 0, 0
    for d in data:
        name = str(d["Name"] or "")
        section = str(d["Section/Column"] or "")
        m = RE_LAN_THU.search(name)
        lan_thu = int(m.group(1)) if m else None

        # khớp thận trọng: cần TRÙNG bộ máy (nếu section có ghi) + đủ từ khoá tên
        tu_sec = tu_khoa(section)
        bo_sec = bo_may_tu(section)
        best_id, best_score = None, 0.0
        for pid, tu_plan, bo_plan in plan_idx:
            if not tu_sec or not tu_plan:
                continue
            if bo_sec and bo_plan and bo_sec != bo_plan:
                continue                                   # bộ máy khác hẳn -> loại ngay
            chung = tu_sec & tu_plan
            diem = len(chung) / min(len(tu_sec), len(tu_plan))
            if len(chung) >= 2 and diem >= 0.7 and diem > best_score:
                best_id, best_score = pid, diem
        if best_id:
            khop += 1
        else:
            khong_khop += 1

        due = d.get("Due Date")
        done = d.get("Completed At")
        them.append({
            "plan_id": best_id,
            "asana_task_id": str(d["Task ID"]),
            "section": section or None,
            "ten_task": name or None,
            "lan_thu": lan_thu,
            "due_date": due.date().isoformat() if isinstance(due, datetime) else None,
            "completed_at": done.isoformat() if isinstance(done, datetime) else None,
        })

    print(f"\n═══ {len(them)} lượt bảo trì sẽ nạp ═══")
    print(f"  Khớp được plan_id (tin cậy cao) : {khop}")
    print(f"  Chưa khớp (giữ section để soi)  : {khong_khop}")
    print(f"  Đã xong (có Completed At)       : {sum(1 for t in them if t['completed_at'])}")
    print(f"  Có Due Date                     : {sum(1 for t in them if t['due_date'])}")

    if not ghi:
        print("\n(dry-run — thêm --ghi để ghi thật)")
        return
    for i in range(0, len(them), 100):
        post(url, key, "maintenance_visit", them[i:i + 100])
    print(f"\nĐÃ GHI {len(them)} lượt vào maintenance_visit.")


if __name__ == "__main__":
    main()
