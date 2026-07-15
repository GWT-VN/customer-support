"""Test Phase 0.5 — enrich địa chỉ + parse cột "Liên hệ"."""
from migrate.contacts import load_addresses, parse_lien_he, audit_lien_he


# ── load_addresses: Contact (res.partner) -> {SĐT: địa chỉ} ─────────────────
def test_lay_dia_chi_theo_sdt():
    rows = [{"Phone": "0903458186", "Street": "Tháp 2, Sun Ancora 3 Lương Yên"}]
    assert load_addresses(rows) == {"0903458186": "Tháp 2, Sun Ancora 3 Lương Yên"}


def test_chuan_hoa_sdt_khi_lay_dia_chi():
    rows = [{"Phone": "091 2354687", "Street": "83 lý thường kiệt"}]
    assert load_addresses(rows) == {"0912354687": "83 lý thường kiệt"}


def test_bo_qua_sdt_loi_hoac_thieu_dia_chi():
    rows = [
        {"Phone": "099999999", "Street": "X"},      # SĐT rác
        {"Phone": "0903458186", "Street": "  "},    # không có địa chỉ
        {"Phone": None, "Street": "Y"},
    ]
    assert load_addresses(rows) == {}


# ── parse_lien_he: text tự do -> (tên, SĐT) ─────────────────────────────────
def test_sdt_dung_sau_ten():
    assert parse_lien_he("Ms Đào (giúp việc) - 0365636472") == ("Ms Đào (giúp việc)", "0365636472")


def test_sdt_dung_truoc_ten():
    assert parse_lien_he("0362096197 - Đạt trợ lý") == ("Đạt trợ lý", "0362096197")


def test_sdt_co_dau_cach():
    assert parse_lien_he("Anh Cường: 098 6667622") == ("Anh Cường", "0986667622")


def test_khong_co_sdt():
    assert parse_lien_he("chỉ có tên") == (None, None)
    assert parse_lien_he(None) == (None, None)


# ── audit: chứng minh vì sao KHÔNG nhập được ────────────────────────────────
def test_bao_trung_khi_sdt_da_la_khach_chinh():
    """4/11 SĐT phụ thực ra đã là primary_phone của khách khác -> nhập vào = nhân đôi."""
    r = audit_lien_he(["Jake Ngo (quản lý) 0938582202"], {"0938582202"})
    assert r[0][2].startswith("TRÙNG")


def test_bao_khong_noi_duoc_khi_sdt_la():
    r = audit_lien_he(["C Nga vợ: 0989347139"], {"0903458186"})
    assert "không nối được" in r[0][2]
