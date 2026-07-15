"""Test chuẩn hoá địa chỉ theo cải cách 1/7/2025 (bỏ cấp huyện, 63->34 tỉnh)."""
from migrate.diachi_2025 import dia_chi_2025, doi_ten_tinh, viet_lai


# ── viết lại: chính tả + tách số dính chữ ───────────────────────────────────
def test_tach_so_dinh_chu_park2():
    """User nêu đích danh: 'Park 2 phải viết cách ra'."""
    out, _ = viet_lai("Time city park2")
    assert out == "Times City Park 2"


def test_park9_timecity():
    out, _ = viet_lai("P091707 park9 timecity")
    assert "Park 9" in out and "Times City" in out


def test_vinhome_thanh_vinhomes():
    out, _ = viet_lai("Vinhome Star City Thanh Hóa")
    assert out == "Vinhomes Star City Thanh Hóa"


# ── đổi tên tỉnh cũ -> mới ──────────────────────────────────────────────────
def test_tinh_da_sap_nhap():
    assert doi_ten_tinh("L905 VCI - Định Trung - Vĩnh Yên - Vĩnh Phúc")[0] == "Phú Thọ"
    assert doi_ten_tinh("Yên Bái")[0] == "Lào Cai"
    assert doi_ten_tinh("Thị xã Gia Nghĩa - Tỉnh Daknong")[0] == "Lâm Đồng"


def test_tinh_khong_doi_thi_None():
    assert doi_ten_tinh("58 Võng Thị, Tây Hồ, Hà Nội") == (None, None)


# ── địa chỉ chuẩn 2025 từ khu đô thị ĐÃ TRA ─────────────────────────────────
def test_times_city():
    out, _ = dia_chi_2025("Time city park2")
    assert out == "Times City Park 2, 458 Minh Khai, phường Vĩnh Tuy, Hà Nội"


def test_star_city_thanh_hoa():
    out, why = dia_chi_2025("Vinhome Star City Thanh Hóa")
    assert "phường Hạc Thành" in out and "Thanh Hoá" in out
    assert "Đông Hải" in why      # nêu tên cũ để đối chiếu


def test_BAY_ocean_park_1_va_2_KHAC_TINH():
    """OP1 ở Hà Nội, OP2 ở Hưng Yên — nhầm là sai tỉnh."""
    op1, _ = dia_chi_2025("Tòa S203, Vinhomes OceanPark 1, Đa Tốn, Gia Lâm")
    op2, _ = dia_chi_2025("C8-18 ocean park 2")
    assert "Hà Nội" in op1 and "xã Gia Lâm" in op1
    assert "Hưng Yên" in op2 and "xã Nghĩa Trụ" in op2


def test_ocean_park_khong_ghi_so_thi_mac_dinh_OP1():
    out, _ = dia_chi_2025("Sao biển 3-10 Vinhomes Ocean Park 1")
    assert "Hà Nội" in out


def test_ecopark():
    out, _ = dia_chi_2025("Lake2 ecopark")
    assert "xã Phụng Công" in out and "Hưng Yên" in out


# ── KHÔNG đoán khi không nhận ra ────────────────────────────────────────────
def test_nha_rieng_le_thi_KHONG_doan_phuong():
    out, why = dia_chi_2025("83 lý thường kiệt")
    assert out is None and "không đoán" in why


def test_chi_doi_duoc_ten_tinh_thi_noi_ro():
    out, why = dia_chi_2025("L905 VCI - Định Trung - Vĩnh Yên - Vĩnh Phúc")
    assert out is None and "Phú Thọ" in why and "hỏi khách" in why
