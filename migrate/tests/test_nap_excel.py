"""Test validator của nap_excel_sua — nguyên tắc: chỉ nhận data ĐÚNG, sai là từ chối kèm lý do."""

from datetime import date, datetime

from migrate.nap_excel_sua import is_checked, normalize_phone, parse_chu_ky, parse_date_cell


# ── SĐT ──────────────────────────────────────────────────────────────────────
def test_phone_chuan():
    assert normalize_phone("0965226668") == ("0965226668", None)

def test_phone_excel_nuot_so_0_dau():
    # Excel đổi text -> số: mất 0 đầu, thêm .0
    assert normalize_phone("965226668.0") == ("0965226668", None)
    assert normalize_phone(965226668) == ("0965226668", None)

def test_phone_co_khoang_trang_cham():
    assert normalize_phone("098 666.7622") == ("0986667622", None)

def test_phone_dau_84():
    assert normalize_phone("+84965226668") == ("0965226668", None)
    assert normalize_phone("84965226668") == ("0965226668", None)

def test_phone_tu_choi_chu():
    p, err = normalize_phone("09xy123")
    assert p is None and "ký tự lạ" in err

def test_phone_tu_choi_qua_ngan():
    p, err = normalize_phone("12345")
    assert p is None and err

def test_phone_tu_choi_rong():
    assert normalize_phone(None)[1] == "rỗng"


# ── Ngày ─────────────────────────────────────────────────────────────────────
def test_date_iso():
    assert parse_date_cell("2026-01-15") == (date(2026, 1, 15), None)

def test_date_vn():
    assert parse_date_cell("15/01/2026") == (date(2026, 1, 15), None)

def test_date_excel_native():
    assert parse_date_cell(datetime(2026, 1, 15, 10, 30)) == (date(2026, 1, 15), None)
    assert parse_date_cell(date(2026, 1, 15)) == (date(2026, 1, 15), None)

def test_date_tu_choi():
    d, err = parse_date_cell("hôm qua")
    assert d is None and "không đọc được" in err


# ── Chu kỳ lõi ───────────────────────────────────────────────────────────────
def test_chu_ky_don():
    assert parse_chu_ky("12") == (12, 12, None)

def test_chu_ky_khoang():
    assert parse_chu_ky("12-24") == (12, 24, None)
    assert parse_chu_ky("24 - 48 tháng") == (24, 48, None)

def test_chu_ky_tu_choi_nguoc():
    a, b, err = parse_chu_ky("24-12")
    assert err and "vô lý" in err

def test_chu_ky_tu_choi_chu():
    assert parse_chu_ky("một năm")[2]


# ── Checkbox ─────────────────────────────────────────────────────────────────
def test_checked():
    assert is_checked("x") and is_checked("X") and is_checked("✔") and is_checked("có")
    assert not is_checked(None) and not is_checked("") and not is_checked("không")
