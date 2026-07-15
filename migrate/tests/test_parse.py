"""Test logic parse export Odoo. Chạy: python3 -m pytest migrate/tests/ -v"""
import datetime as dt

from migrate import parse


# ── split_source: tách nguồn trong ngoặc khỏi tên khách ──────────────────────
def test_split_source_with_paren():
    assert parse.split_source("Nguyễn Trung Hiếu (Shopee)") == ("Nguyễn Trung Hiếu", "Shopee")


def test_split_source_no_paren():
    assert parse.split_source("Bùi Thu Hà") == ("Bùi Thu Hà", None)


def test_split_source_strips_whitespace():
    assert parse.split_source("  Mr. Cao Chung  ") == ("Mr. Cao Chung", None)


def test_split_source_paren_inside_name_keeps_last():
    # chỉ ngoặc ở CUỐI mới là nguồn
    assert parse.split_source("Anh Vũ (Times City) (Lazada)") == ("Anh Vũ (Times City)", "Lazada")


def test_split_source_empty():
    assert parse.split_source("") == ("", None)
    assert parse.split_source(None) == ("", None)


# ── extract_code: lấy [MÃ] khỏi Product name ─────────────────────────────────
def test_extract_code():
    assert parse.extract_code("[GTUN-5800EN-G] Máy lọc nước GE GN620") == "GTUN-5800EN-G"


def test_extract_code_whole_house():
    assert parse.extract_code("[GTE-30A01-G] Giải pháp lọc tổng đầu nguồn GE 30A") == "GTE-30A01-G"


def test_extract_code_none_when_no_bracket():
    assert parse.extract_code("Máy không mã") is None
    assert parse.extract_code("") is None
    assert parse.extract_code(None) is None


# ── resolve_internal_code: mã nội bộ HOẶC mã đối tác -> mã nội bộ ────────────
def test_resolve_direct_internal():
    assert parse.resolve_internal_code("CTS10NW", {"CTS10NW"}, {}) == "CTS10NW"


def test_resolve_via_supplier_code():
    # Odoo dùng mã hãng GTE-30A01-G -> mã nội bộ WH30A
    assert parse.resolve_internal_code("GTE-30A01-G", {"WH30A"}, {"GTE-30A01-G": "WH30A"}) == "WH30A"


def test_resolve_internal_wins_over_supplier():
    # cùng chuỗi vừa là mã nội bộ vừa là mã đối tác -> ưu tiên mã nội bộ
    assert parse.resolve_internal_code("X", {"X"}, {"X": "Y"}) == "X"


def test_resolve_unknown_returns_none():
    assert parse.resolve_internal_code("KHONG-CO", {"CTS10NW"}, {}) is None
    assert parse.resolve_internal_code(None, {"CTS10NW"}, {}) is None


# ── is_activated: cột "Warranty activated" của Odoo ──────────────────────────
def test_is_activated_truthy():
    for v in (True, "True", "true", 1, "TRUE"):
        assert parse.is_activated(v) is True, v


def test_is_activated_falsy():
    for v in (False, "False", "false", 0, None, ""):
        assert parse.is_activated(v) is False, v


# ── to_date: "Activated date" -> YYYY-MM-DD ──────────────────────────────────
def test_to_date_from_datetime():
    assert parse.to_date(dt.datetime(2025, 1, 31, 10, 30)) == "2025-01-31"


def test_to_date_from_date():
    assert parse.to_date(dt.date(2024, 6, 15)) == "2024-06-15"


def test_to_date_from_string():
    assert parse.to_date("2025-01-31 00:00:00") == "2025-01-31"


def test_to_date_none():
    assert parse.to_date(None) is None
    assert parse.to_date("") is None


# ── is_stock: serial chưa gắn khách = tồn kho, không đưa vào installed_base ──
def test_is_stock_no_customer():
    assert parse.is_stock({"Serial": "ABC123", "Customer": None}) is True
    assert parse.is_stock({"Serial": "ABC123", "Customer": "   "}) is True


def test_is_stock_has_customer():
    assert parse.is_stock({"Serial": "ABC123", "Customer": "Anh Vũ"}) is False


def test_is_stock_no_serial_is_skipped_too():
    assert parse.is_stock({"Serial": None, "Customer": "Anh Vũ"}) is True
