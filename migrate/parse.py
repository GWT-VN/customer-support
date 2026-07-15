"""Parse export Odoo `GWT Serial (gwt.serial).xlsx`.

Cột export: Activated date, Customer, Expired date, Parent serial,
            Product name, Serial, Warranty activated.
Odoo KHÔNG có SĐT -> khách tạo ra gắn needs_phone=true, điền ở Phase 0.5.
Odoo nhập theo MÃ ĐỐI TÁC (mã hãng) -> resolve về mã nội bộ qua supplier_code.
"""

import datetime as dt
import re

# Nguồn nằm trong ngoặc ở CUỐI tên: "Nguyễn Trung Hiếu (Shopee)"
_PAREN = re.compile(r"^(.*)\s*\(([^()]+)\)\s*$")
# Mã nằm trong ngoặc vuông đầu Product name: "[GTUN-5800EN-G] Máy lọc nước..."
_BRACKET = re.compile(r"\[([^\]]+)\]")

_TRUE = {True, 1, "true", "True", "TRUE", "1"}


def split_source(customer_raw):
    """"Nguyễn Trung Hiếu (Shopee)" -> ("Nguyễn Trung Hiếu", "Shopee")."""
    s = (customer_raw or "").strip()
    m = _PAREN.match(s)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return s, None


def extract_code(product_name):
    """"[GTE-30A01-G] Giải pháp lọc tổng..." -> "GTE-30A01-G"."""
    if not product_name:
        return None
    m = _BRACKET.search(str(product_name))
    return m.group(1).strip() if m else None


def resolve_internal_code(raw_code, internal_codes, supplier_map):
    """Mã trên export có thể là mã nội bộ HOẶC mã đối tác/kho (Odoo nhập theo mã hãng).

    internal_codes: set các "Mã nội bộ" của catalog_item
    supplier_map:   dict {"Mã đối tác": "Mã nội bộ"} từ supplier_code
    """
    if not raw_code:
        return None
    if raw_code in internal_codes:
        return raw_code
    return supplier_map.get(raw_code)


def is_activated(v):
    """Cột "Warranty activated" của Odoo -> bool."""
    return v in _TRUE


def to_date(v):
    """Bất kỳ kiểu ngày nào -> 'YYYY-MM-DD' (hoặc None)."""
    if v is None or v == "":
        return None
    if isinstance(v, dt.datetime):
        return v.date().isoformat()
    if isinstance(v, dt.date):
        return v.isoformat()
    return str(v)[:10]


def is_stock(row):
    """True = tồn kho (chưa gắn khách) hoặc thiếu serial -> KHÔNG vào installed_base."""
    return not (row.get("Serial") or "").strip() or not (row.get("Customer") or "").strip()


# ── SĐT ─────────────────────────────────────────────────────────────────────
# Đầu số di động VN sau số 0: 3, 5, 7, 8, 9. Cố định: 02x (10-11 số).
_MOBILE = re.compile(r"^0[35789]\d{8}$")
_LANDLINE = re.compile(r"^02\d{8,9}$")


def raw_phone(raw):
    """SĐT không chuẩn hoá được -> giữ NGUYÊN giá trị Odoo (chỉ bỏ .0 của Excel + trim).

    Dùng khi normalize_phone trả lỗi: user muốn lưu lại để chỉnh tay sau, không bỏ mất.
    """
    if raw is None or str(raw).strip() == "":
        return None
    s = str(raw).strip()
    return s[:-2] if s.endswith(".0") else s


def normalize_phone(raw):
    """SĐT thô -> ('0xxxxxxxxx', None) hoặc (None, 'lý do').

    CHỈ sửa cái chắc chắn (dấu cách/chấm, mã 84, mất số 0 đầu, đuôi .0 của Excel).
    Cái mơ hồ (quá dài/ngắn, số rác) -> trả None + lý do để người xử lý, KHÔNG đoán bừa.
    """
    if raw is None or str(raw).strip() == "":
        return None, None

    s = str(raw).strip()
    if s.endswith(".0"):          # Excel lưu dạng số -> "965226668.0"
        s = s[:-2]
    s = re.sub(r"[\s.\-()]", "", s)   # bỏ dấu cách, chấm, gạch, ngoặc

    if s.startswith("+84"):
        s = "0" + s[3:]
    elif s.startswith("84") and len(s) == 11:
        s = "0" + s[2:]

    if len(s) == 9 and s[0] in "35789":   # mất số 0 đầu
        s = "0" + s

    if not s.isdigit():
        return None, f"chứa ký tự lạ: {raw!r}"
    if len(set(s.lstrip("0"))) == 1:      # 099999999, 0000000000...
        return None, f"số rác (toàn 1 chữ số lặp): {raw!r}"
    if _MOBILE.match(s) or _LANDLINE.match(s):
        return s, None
    return None, f"không đúng dạng SĐT VN ({len(s)} số): {raw!r}"
