"""Test chuẩn hoá SĐT. Nguyên tắc: chỉ sửa cái CHẮC CHẮN, cái mơ hồ thì trả None + lý do."""
from migrate import parse


# ── dạng chuẩn giữ nguyên ────────────────────────────────────────────────────
def test_mobile_dung_dang_giu_nguyen():
    assert parse.normalize_phone("0900000019") == ("0900000019", None)


def test_landline_10_so_giu_nguyen():
    # 0225 = cố định Hải Phòng, 11 số -> hợp lệ
    assert parse.normalize_phone("02000000020") == ("02000000020", None)


# ── sửa được chắc chắn ───────────────────────────────────────────────────────
def test_bo_dau_cach():
    assert parse.normalize_phone("0900000021") == ("0900000021", None)
    assert parse.normalize_phone("0900000017") == ("0900000017", None)


def test_bo_dau_cham_gach():
    assert parse.normalize_phone("0900000022") == ("0900000022", None)
    assert parse.normalize_phone("0900000022") == ("0900000022", None)


def test_ma_quoc_gia_84_thanh_0():
    assert parse.normalize_phone("84900000023") == ("0900000023", None)
    assert parse.normalize_phone("+84900000023") == ("0900000023", None)


def test_thieu_so_0_dau_10_so():
    # Excel lưu số -> mất số 0 đầu: 900000024 (9 số, bắt đầu 9|8|7|5|3)
    assert parse.normalize_phone("900000024") == ("0900000024", None)


def test_float_tu_excel():
    assert parse.normalize_phone("900000001.0") == ("0900000001", None)


# ── KHÔNG đoán bừa — trả None + lý do ────────────────────────────────────────
def test_so_rac_toan_9():
    v, err = parse.normalize_phone("099999999")
    assert v is None and "rác" in err.lower()


def test_qua_dai_khong_doan():
    v, err = parse.normalize_phone("09000000015")
    assert v is None and err is not None


def test_rong():
    assert parse.normalize_phone("") == (None, None)
    assert parse.normalize_phone(None) == (None, None)


def test_qua_ngan():
    v, err = parse.normalize_phone("12345")
    assert v is None and err is not None


# ── raw_phone: giữ nguyên SĐT lỗi để chỉnh sau ───────────────────────────────
def test_raw_phone_giu_nguyen():
    assert parse.raw_phone("09000000015") == "09000000015"
    assert parse.raw_phone("099999999") == "099999999"


def test_raw_phone_bo_duoi_float_excel():
    assert parse.raw_phone("900000001.0") == "900000001"


def test_raw_phone_rong():
    assert parse.raw_phone(None) is None
    assert parse.raw_phone("  ") is None
