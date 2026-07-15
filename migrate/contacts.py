"""Phase 0.5 — enrich khách từ 2 file Odoo/Excel.

Kết quả thực tế (2026-07-15):
  ✅ Địa chỉ: 277/293 khách — nguồn `Contact (res.partner).xlsx` (Phone + Street), khớp bằng SĐT.
  ❌ SĐT phụ: KHÔNG lấy được — xem `audit_lien_he()` bên dưới để biết vì sao.
  ❌ 11 khách thiếu SĐT: file "Theo Dõi BH" không có serial nào của họ (0/11).
"""

import re

from migrate import parse


def load_addresses(contact_rows):
    """Contact (res.partner) -> {SĐT chuẩn hoá: Street}. Bỏ SĐT lỗi/trống.

    contact_rows: list[dict] với key 'Phone', 'Street'.
    """
    out = {}
    for c in contact_rows:
        phone, err = parse.normalize_phone(c.get("Phone"))
        street = (str(c.get("Street") or "")).strip()
        if phone and not err and street:
            out[phone] = street
    return out


# "Ms Đào (giúp việc) - 0365636472" / "Anh Cường: 098 6667622" / "0362096197 - Đạt trợ lý"
_PHONE_IN_TEXT = re.compile(r"(0\d[\d\s.]{7,12}\d)")


def parse_lien_he(raw):
    """Cột "Liên hệ" của Theo Dõi BH -> (tên, SĐT) hoặc (None, None).

    Text tự do, SĐT có thể đứng trước hoặc sau tên, có dấu cách giữa các nhóm số.
    """
    if not raw:
        return None, None
    s = str(raw).replace("\n", " ").strip()
    m = _PHONE_IN_TEXT.search(s)
    if not m:
        return None, None
    phone, err = parse.normalize_phone(m.group(1))
    if err:
        return None, None
    name = s.replace(m.group(1), "").strip(" -:·,")
    return (name or None), phone


def audit_lien_he(lien_he_rows, existing_primary_phones):
    """Vì sao KHÔNG nhập SĐT phụ từ Theo Dõi BH — kiểm chứng lại bất cứ lúc nào.

    2 vấn đề chặn (phát hiện 2026-07-15):

    1. TRÙNG SĐT CHÍNH — 4/11 "SĐT phụ" thực ra đã là primary_phone của khách khác
       trong DB (Odoo lưu SĐT người liên hệ làm SĐT chính của khách). Nhập vào = nhân đôi.
         0938582202 "Jake Ngo (quản lý)"  -> đã là SĐT chính của khách "Lâm Bảo Ngọc"
         0902040880 "Mr.Lâm"              -> "Mr Lâm"
         0978713131 "A Hoàng"             -> "Nguyễn Huy Hoàng"
         0792333398 "Chị Hợp"             -> "SLP - Trung tâm Giáo dục nghề nghiệp…"

    2. KHÔNG NỐI ĐƯỢC — 7/11 còn lại thuộc khách KHÔNG có trong DB
       (Anh Tuấn Tita Art, Mrs.Thuỷ/Thành, Mr.Toàn, Ms.Linh BVIS, Anh Sơn Mượt, Anh Duy).

    3. DỮ LIỆU HỎNG — vài dòng bị kéo-thả fill trong Excel nên số tự tăng dần:
         Mrs.Thuỷ/Thành: SĐT 0865884194/195/196, giúp việc 0365636472/473/474
         Anh Cường: 098 6667622 → 6667628 (7 biến thể)
       SĐT thật không bao giờ tăng đều 1 đơn vị qua các dòng.

    Trả về danh sách (name, phone, van_de) để soi lại.
    """
    out = []
    for raw in lien_he_rows:
        name, phone = parse_lien_he(raw)
        if not phone:
            out.append((name, None, "không trích được SĐT"))
        elif phone in existing_primary_phones:
            out.append((name, phone, "TRÙNG: đã là SĐT chính của 1 khách"))
        else:
            out.append((name, phone, "không nối được vào khách nào trong DB"))
    return out
