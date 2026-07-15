"""Test bộ luật soát chất lượng. Điểm cốt lõi: KHÔNG được đoán bừa địa chỉ."""
from migrate.quality import audit, fix_name_case, fix_typos, guess_province


# ── chính tả ────────────────────────────────────────────────────────────────
def test_sua_time_city():
    out, found = fix_typos("Park11 time city")
    assert out == "Park11 Times City" and len(found) == 1


def test_sua_nhieu_loi_1_luot():
    out, found = fix_typos("P0312a Tòa A Vinhome gadenia - Nam từ liêm")
    assert "Vinhomes" in out and "Gardenia" in out and len(found) == 2


def test_khong_doi_gi_thi_giu_nguyen():
    out, found = fix_typos("58 Võng Thị, Tây Hồ")
    assert out == "58 Võng Thị, Tây Hồ" and found == []


# ── suy tỉnh/TP từ địa danh CÔNG CỘNG ───────────────────────────────────────
def test_suy_tinh_tu_khu_do_thi():
    assert guess_province("Park11 Times City")[0] == "Hà Nội"
    assert guess_province("Lake2 ecopark")[0] == "Hưng Yên"
    assert guess_province("Chung cư Dlusso, Thảo Điền")[0] == "TP.HCM"


def test_suy_tinh_tu_quan_huyen():
    assert guess_province("60 lê văn thiêm, Thanh Xuân")[0] == "Hà Nội"
    assert guess_province("115 vườn lài, q12")[0] == "TP.HCM"


def test_KHONG_doan_khi_ten_duong_trung_nhieu_tinh():
    """'83 lý thường kiệt' có ở hàng chục tỉnh -> PHẢI trả None, không được đoán."""
    assert guess_province("83 lý thường kiệt") == (None, None)
    assert guess_province("275 nguyễn trãi") == (None, None)


# ── tên ─────────────────────────────────────────────────────────────────────
def test_ten_viet_hoa_het():
    assert fix_name_case("ĐOÀN THANH PHONG") == "Đoàn Thanh Phong"


def test_ten_viet_thuong_dau():
    assert fix_name_case("anh đức") == "Anh đức"


def test_KHONG_doi_ten_cong_ty():
    assert fix_name_case("CÔNG TY TNHH THIẾT KẾ RED5") is None


def test_ten_dung_roi_thi_thoi():
    assert fix_name_case("Nguyễn Trung Hiếu") is None


# ── audit tổng hợp ──────────────────────────────────────────────────────────
def test_thieu_sdt_thi_uu_tien_CAO():
    n, muc = audit({"full_name": "Anh Cường", "primary_phone": None, "needs_phone": True,
                    "address": "60 lê văn thiêm, Thanh Xuân, Hà Nội", "so_may": 1})
    assert "THIẾU SĐT" in n and muc == "CAO"


def test_thieu_dia_chi_KHONG_duoc_bia():
    n, muc = audit({"full_name": "Chị My Võ", "needs_phone": False, "address": None, "so_may": 2})
    assert "THIẾU ĐỊA CHỈ" in n and "gọi khách hỏi" in n and muc == "CAO"


def test_khach_sach_thi_note_rong():
    """Địa chỉ đủ tỉnh/TP + SĐT ok + tên ok -> KHÔNG có note."""
    n, muc = audit({"full_name": "Nguyễn Trung Hiếu", "primary_phone": "0389599321",
                    "needs_phone": False, "so_may": 1,
                    "address": "Chung Cư Stown Tham Lương, Số 102, Dương Thị Giang, Quận 12, TP. Hồ Chí Minh"})
    assert n == "" and muc == ""


def test_KHONG_nhac_tinh_TP_khi_suy_ra_duoc():
    """Suy được tỉnh/TP thì máy tự điền — không được làm nhiễu Note."""
    n, _ = audit({"full_name": "Chị Loan", "primary_phone": "0942009799", "needs_phone": False,
                  "address": "T11 p2102 Times City, Hai Bà Trưng", "so_may": 1})
    assert "tỉnh/TP" not in n


def test_may_nhieu_thi_day_uu_tien_len_CAO():
    n, muc = audit({"full_name": "X", "primary_phone": "0912345678", "needs_phone": False,
                    "address": "Q7", "so_may": 3})
    assert muc == "CAO"
