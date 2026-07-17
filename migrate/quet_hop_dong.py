"""Quét hợp đồng POE -> gói bảo trì mỗi khách, đối chiếu với file thống kê tay.

NGUỒN SỰ THẬT = HỢP ĐỒNG (user chốt 2026-07-16). File thống kê tay chỉ để đối chiếu.

CÔNG THỨC (suy từ hợp đồng thật, đã kiểm chứng nhiều ca):
    tổng lần bảo trì = số năm × (12 ÷ chu kỳ tháng)
  vd  "01 năm dịch vụ bảo trì định kỳ 5 sao (3 tháng/lần)" -> 1 × 4 = 4 lần
      "01 năm ... (6 tháng/lần)"  -> 1 × 2 = 2  (Chị Nhung Vũ, Anh Tuấn Anh Tây Mỗ)
      "02 năm ... (6 tháng/lần)"  -> 2 × 2 = 4  (Chị Liên)
      "03 năm ... (3 tháng/lần)"  -> 3 × 4 = 12 (Chị Trang Bùi Park City)
      "10 năm ... (3 tháng/lần)"  -> 10 × 4 = 40 (Sixdo = Anh Huy Cận)

⚠️ Hợp đồng MÂU THUẪN NỘI BỘ: nhiều file vừa ghi "Bảo trì bảo dưỡng 4 lần/năm"
   (điều khoản bảo hành, copy cứng) vừa ghi "(6 tháng/lần)" (= 2 lần/năm).
   -> CHỈ tin dòng "N năm dịch vụ bảo trì định kỳ ... (M tháng/lần)"; dòng "4 lần/năm"
      là template, KHÔNG dùng để tính.

⚠️ macOS lưu tên file dạng Unicode NFD -> phải normalize NFC trước khi so tên.

Chạy:  .venv/bin/python -m migrate.quet_hop_dong
"""

import pathlib
import re
import unicodedata
import zipfile
from datetime import date

import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

ROOT = pathlib.Path(__file__).resolve().parent.parent
POE = ROOT / "Các khách lọc tổng POE"
THONG_KE = ROOT / "Lịch bảo trì - Lịch kĩ thuật/GWT - Lịch bảo trì - Asana.xlsx"
TODAY = date(2026, 7, 16)
OUT = ROOT / f"GWT_goi_bao_tri_tu_hop_dong_{TODAY.isoformat()}.xlsx"

SO_CHU = {"một": 1, "hai": 2, "ba": 3, "bốn": 4, "năm": 5, "mười": 10}


def nfc(s):
    return unicodedata.normalize("NFC", str(s or ""))


def khong_dau(s):
    # ⚠️ "đ"/"Đ" (U+0111/U+0110) KHÔNG decompose được bằng NFD -> phải thay tay TRƯỚC,
    #    nếu không "hợp đồng" -> "hop ong" và mọi so khớp tên file đều trượt.
    s = nfc(s).lower().replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s)).strip()


# ── Đọc file ─────────────────────────────────────────────────────────────────
def doc_docx(p):
    try:
        with zipfile.ZipFile(p) as z:
            xml = z.read("word/document.xml").decode("utf8", "ignore")
    except Exception:
        return ""
    return re.sub(r"<[^>]+>", "", re.sub(r"</w:p>", "\n", xml))


def doc_xlsx(p):
    try:
        wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
    except Exception:
        return ""
    out = []
    for ws in wb.worksheets:
        for r in ws.iter_rows(values_only=True):
            out += [str(v) for v in r if v is not None and str(v).strip()]
    return "\n".join(out)


def doc_file(p):
    s = p.suffix.lower()
    if s == ".docx":
        return doc_docx(p)
    if s == ".xlsx":
        return doc_xlsx(p)
    return ""            # .doc cũ / .pdf -> không đọc được, sẽ liệt kê riêng


# ── Trích điều khoản bảo trì ─────────────────────────────────────────────────
# Bắt CẢ CỤM trong 1 câu để không nhặt nhầm "6 tháng/lần" của điều khoản khác.
# ⚠️ Số năm phải ĐỨNG SÁT "năm" (chỉ cho phép chú thích trong ngoặc, vd "03 (ba) năm").
#    Bản trước dùng [^)\n]{0,10} tham lam -> với "1 ⇥ 03 năm dịch vụ bảo trì" nó bắt "1"
#    (số thứ tự dòng) rồi nuốt "03" vào phần đệm -> Trang Bùi ra 4 lần thay vì 12.
RE_GOI = re.compile(
    r"(\d{1,2}|một|hai|ba|bốn|năm|mười)\s*(?:\([^)\n]{0,12}\))?\s*năm\s+dịch vụ bảo trì"
    r"[^(\n]{0,40}\(\s*(\d{1,2})\s*tháng\s*/\s*lần\s*\)",
    re.I,
)
RE_NAM_ONLY = re.compile(
    r"(\d{1,2}|một|hai|ba|bốn|năm|mười)\s*(?:\([^)\n]{0,12}\))?\s*năm\s+dịch vụ bảo trì", re.I)
RE_CK_ONLY = re.compile(r"\(\s*(\d{1,2})\s*tháng\s*/\s*lần\s*\)", re.I)
RE_BO = re.compile(r"WH\s*(15|30)\s*A(\s*ECO)?", re.I)


def so(v):
    v = str(v).strip().lower()
    return int(v) if v.isdigit() else SO_CHU.get(v)


def trich(txt):
    """-> (số năm, chu kỳ tháng, cách lấy) hoặc (None, None, lý do)"""
    m = RE_GOI.search(txt)
    if m:
        return so(m.group(1)), int(m.group(2)), "đủ cụm"
    n = RE_NAM_ONLY.search(txt)
    c = RE_CK_ONLY.search(txt)
    if n and c:
        return so(n.group(1)), int(c.group(1)), "ghép rời (kiểm tra lại)"
    if n:
        return so(n.group(1)), None, "chỉ có số năm"
    if c:
        return None, int(c.group(1)), "chỉ có chu kỳ"
    return None, None, "không thấy điều khoản"


def bo_may(txt, ten_file):
    m = RE_BO.search(ten_file) or RE_BO.search(txt)
    if not m:
        return ""
    return f"WH{m.group(1)}A" + (" ECO" if m.group(2) else "")


# ── File thống kê tay (để đối chiếu) ─────────────────────────────────────────
def doc_thong_ke():
    wb = openpyxl.load_workbook(THONG_KE, data_only=True)
    rows = [r for r in wb["Tổng hợp bảo trì"].iter_rows(values_only=True)]
    hdr = [str(h).strip() if h else "" for h in rows[0]]
    i = {h: n for n, h in enumerate(hdr) if h}
    out = []
    for r in rows[1:]:
        ten = r[i["KHÁCH HÀNG"]]
        v = r[i["SỐ LẦN BẢO TRÌ"]]
        if not ten or v is None:
            continue
        # Excel đã đổi "3/4" -> date(2026,4,3): day = đã xong, month = tổng
        if hasattr(v, "month"):
            xong, tong = v.day, v.month
        else:
            m = re.match(r"\s*(\d+)\s*/\s*(\d+)", str(v))
            if not m:
                out.append((nfc(ten), None, None, str(v)))   # "0/10 năm"
                continue
            xong, tong = int(m.group(1)), int(m.group(2))
        out.append((nfc(ten), xong, tong, str(v)))
    return out


def main():
    thong_ke = doc_thong_ke()
    tk_index = [(khong_dau(t), t, x, tg, raw) for t, x, tg, raw in thong_ke]

    # ⚠️ CHỈ thư mục KHÁCH = con trực tiếp của "2025/2026 - Khách lẻ lọc tổng" (100 cái).
    #    rglob("*") trả 144 -> gồm cả thư mục con ("01. Chi phí đầu ra"...) -> nhân bản khách.
    khach_dirs = sorted([q for p in POE.iterdir() if p.is_dir()
                         for q in p.iterdir() if q.is_dir()])

    ket_qua, khong_doc_duoc = [], []
    for d in khach_dirs:
        # file có thể nằm trong thư mục con -> rglob, nhưng chỉ trong phạm vi 1 khách
        files = [p for p in d.rglob("*") if p.is_file() and not p.name.startswith("~$")]
        if not files:
            continue
        # ưu tiên: hợp đồng > biên bản xác nhận > báo giá (user chốt thứ tự này)
        def uu_tien(p):
            n = khong_dau(p.name)
            if "hop dong" in n or "hdmb" in n: return 0
            if "bien ban" in n: return 1
            if "bao gia" in n: return 2
            return 3

        nam = ck = None
        cach = nguon = ""
        bo = ""
        for p in sorted(files, key=uu_tien):
            txt = doc_file(p)
            if not txt:
                continue
            n2, c2, cach2 = trich(txt)
            if n2 or c2:
                nam, ck, cach, nguon = n2, c2, cach2, nfc(p.name)
                bo = bo_may(txt, nfc(p.name))
                break
        if not nguon:
            # có file hợp đồng nhưng không đọc được (.doc/.pdf)?
            kho = [nfc(p.name) for p in files
                   if p.suffix.lower() in (".doc", ".pdf") and
                   ("hop dong" in khong_dau(p.name) or "bien ban" in khong_dau(p.name))]
            if kho:
                khong_doc_duoc.append((nfc(d.name), kho))

        tong = nam * (12 // ck) if (nam and ck and 12 % ck == 0) else None

        # khớp với file thống kê theo tên thư mục.
        # ⚠️ Bản trước chỉ cần 2 từ chung -> "Anh Hiếu Park City" khớp nhầm "Chị Trang Bùi
        #    Park City" (chung "park","city"). Nay loại từ ĐỊA DANH/xưng hô rồi mới so,
        #    và bắt buộc trùng >=1 từ TÊN RIÊNG + tỉ lệ trùng cao. Không chắc -> để trống.
        BO_QUA = {"anh", "chi", "co", "chu", "mr", "mrs", "ms", "ong", "ba", "khach",
                  "park", "city", "ecopark", "vinhomes", "vin", "ciputra", "gamuda",
                  "times", "royal", "ocean", "hcm", "hn", "ha", "noi", "eco", "15a", "30a",
                  "wh15a", "wh30a", "poe", "t11", "t12", "q2", "q7", "q9", "q12", "nha"}
        dn = re.sub(r"^\d+\s*", "", khong_dau(d.name))
        b = set(dn.split()) - BO_QUA
        hit, best = None, 0.0
        for tkd, ten, xong, tg, raw in tk_index:
            a = set(tkd.split()) - BO_QUA
            if not a or not b:
                continue
            chung = a & b
            diem = len(chung) / min(len(a), len(b))
            if len(chung) >= 2 and diem >= 0.6 and diem > best:
                hit, best = (ten, xong, tg, raw), diem

        lech = ""
        if hit and tong and hit[2] and tong != hit[2]:
            lech = f"LỆCH: hợp đồng {tong} ≠ thống kê {hit[2]}"
        ket_qua.append([
            nfc(d.name), bo, nam, ck, tong,
            hit[0] if hit else "", hit[2] if hit else None, hit[3] if hit else "",
            lech, cach, nguon,
        ])

    # ── Excel ────────────────────────────────────────────────────────────────
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    HEAD = PatternFill("solid", fgColor="1F4E79")
    DO = PatternFill("solid", fgColor="FFC7CE")
    VANG = PatternFill("solid", fgColor="FFEB9C")

    ws = wb.create_sheet("GÓI BẢO TRÌ TỪ HỢP ĐỒNG")
    cols = ["Thư mục hợp đồng", "Bộ", "Số năm (HĐ)", "Chu kỳ tháng (HĐ)", "→ TỔNG LẦN (tính)",
            "Khách (file thống kê)", "Gói (thống kê)", "Ô gốc", "ĐỐI CHIẾU", "Cách lấy", "File nguồn"]
    ws.append(cols)
    for j in range(1, len(cols) + 1):
        c = ws.cell(row=1, column=j)
        c.font = Font(bold=True, color="FFFFFF"); c.fill = HEAD
        c.alignment = Alignment(wrap_text=True, vertical="center")
    for r in sorted(ket_qua, key=lambda x: (not x[8], x[0])):   # lệch lên đầu
        ws.append(r)
        i = ws.max_row
        fill = DO if r[8] else (VANG if not r[4] else None)
        for j in range(1, len(cols) + 1):
            cell = ws.cell(row=i, column=j)
            cell.alignment = Alignment(wrap_text=True, vertical="top")
            if fill: cell.fill = fill
    for j, w in enumerate([42, 10, 11, 13, 14, 26, 11, 10, 34, 18, 40], 1):
        ws.column_dimensions[get_column_letter(j)].width = w
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(cols))}{ws.max_row}"

    if khong_doc_duoc:
        ws2 = wb.create_sheet("KHÔNG ĐỌC ĐƯỢC")
        ws2.append(["Thư mục", "File (.doc cũ / .pdf — cần convert sang .docx)"])
        for j in (1, 2):
            c = ws2.cell(row=1, column=j); c.font = Font(bold=True, color="FFFFFF"); c.fill = HEAD
        for d, fs in khong_doc_duoc:
            ws2.append([d, " · ".join(fs)])
        ws2.column_dimensions["A"].width = 44
        ws2.column_dimensions["B"].width = 80

    wb.save(OUT)

    co_goi = [r for r in ket_qua if r[4]]
    lech = [r for r in ket_qua if r[8]]
    print(f"✓ {OUT.name}\n")
    print(f"  Thư mục khách quét   : {len(ket_qua)}")
    print(f"  Đọc ra gói bảo trì   : {len(co_goi)}")
    print(f"  Không rõ gói         : {len(ket_qua) - len(co_goi)}")
    print(f"  File .doc/.pdf kẹt   : {len(khong_doc_duoc)}")
    print(f"  ⚠️ LỆCH thống kê     : {len(lech)}")
    from collections import Counter
    print("\n  Phân bố gói (theo hợp đồng):")
    for (n, c, t), k in sorted(Counter((r[2], r[3], r[4]) for r in co_goi).items(),
                              key=lambda x: -x[1]):
        print(f"    {k:3} khách: {n} năm × {c} tháng/lần → gói {t} lần")
    if lech:
        print("\n  Các ca LỆCH (user quyết sau):")
        for r in lech:
            print(f"    {r[0][:40]:42} HĐ {r[4]:>2} ≠ thống kê {r[6]:>2}  ({r[5]})")


if __name__ == "__main__":
    main()
