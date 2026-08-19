"""Test Phase 0.5 — enrich địa chỉ + parse cột "Liên hệ"."""
from migrate.contacts import load_addresses, parse_lien_he, audit_lien_he


# ── load_addresses: Contact (res.partner) -> {SĐT: địa chỉ} ─────────────────
def test_lay_dia_chi_theo_sdt():
    rows = [{"Phone": "0900000016", "Street": "<địa chỉ>"}]
    assert load_addresses(rows) == {"0900000016": "<địa chỉ>"}


def test_chuan_hoa_sdt_khi_lay_dia_chi():
    rows = [{"Phone": "0900000017", "Street": "<địa chỉ>"}]
    assert load_addresses(rows) == {"0900000017": "<địa chỉ>"}


def test_bo_qua_sdt_loi_hoac_thieu_dia_chi():
    rows = [
        {"Phone": "099999999", "Street": "X"},      # SĐT rác
        {"Phone": "0900000016", "Street": "  "},    # không có địa chỉ
        {"Phone": None, "Street": "Y"},
    ]
    assert load_addresses(rows) == {}


# ── parse_lien_he: text tự do -> (tên, SĐT) ─────────────────────────────────
def test_sdt_dung_sau_ten():
    assert parse_lien_he("Người liên hệ B - 0900000006") == ("Người liên hệ B", "0900000006")


def test_sdt_dung_truoc_ten():
    assert parse_lien_he("0900000007 - Người liên hệ C") == ("Người liên hệ C", "0900000007")


def test_sdt_co_dau_cach():
    assert parse_lien_he("Người liên hệ D: 0900000005") == ("Người liên hệ D", "0900000005")


def test_khong_co_sdt():
    assert parse_lien_he("chỉ có tên") == (None, None)
    assert parse_lien_he(None) == (None, None)


# ── audit: chứng minh vì sao KHÔNG nhập được ────────────────────────────────
def test_bao_trung_khi_sdt_da_la_khach_chinh():
    """4/11 SĐT phụ thực ra đã là primary_phone của khách khác -> nhập vào = nhân đôi."""
    r = audit_lien_he(["Người liên hệ A 0900000008"], {"0900000008"})
    assert r[0][2].startswith("TRÙNG")


def test_bao_khong_noi_duoc_khi_sdt_la():
    r = audit_lien_he(["Người liên hệ E: 0900000018"], {"0900000016"})
    assert "không nối được" in r[0][2]
