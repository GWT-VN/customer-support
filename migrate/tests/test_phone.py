"""Test chuẩn hoá SĐT. Nguyên tắc: chỉ sửa cái CHẮC CHẮN, cái mơ hồ thì trả None + lý do."""
from migrate import parse


# ── dạng chuẩn giữ nguyên ────────────────────────────────────────────────────
def test_mobile_dung_dang_giu_nguyen():
    assert parse.normalize_phone("0938338819") == ("0938338819", None)


def test_landline_10_so_giu_nguyen():
    # 0225 = cố định Hải Phòng, 11 số -> hợp lệ
    assert parse.normalize_phone("02253782398") == ("02253782398", None)


# ── sửa được chắc chắn ───────────────────────────────────────────────────────
def test_bo_dau_cach():
    assert parse.normalize_phone("038 9599321") == ("0389599321", None)
    assert parse.normalize_phone("091 2354687") == ("0912354687", None)


def test_bo_dau_cham_gach():
    assert parse.normalize_phone("098.888.8979") == ("0988888979", None)
    assert parse.normalize_phone("098-888-8979") == ("0988888979", None)


def test_ma_quoc_gia_84_thanh_0():
    assert parse.normalize_phone("84938191188") == ("0938191188", None)
    assert parse.normalize_phone("+84938191188") == ("0938191188", None)


def test_thieu_so_0_dau_10_so():
    # Excel lưu số -> mất số 0 đầu: 937508669 (9 số, bắt đầu 9|8|7|5|3)
    assert parse.normalize_phone("937508669") == ("0937508669", None)


def test_float_tu_excel():
    assert parse.normalize_phone("965226668.0") == ("0965226668", None)


# ── KHÔNG đoán bừa — trả None + lý do ────────────────────────────────────────
def test_so_rac_toan_9():
    v, err = parse.normalize_phone("099999999")
    assert v is None and "rác" in err.lower()


def test_qua_dai_khong_doan():
    v, err = parse.normalize_phone("09488782646")
    assert v is None and err is not None


def test_rong():
    assert parse.normalize_phone("") == (None, None)
    assert parse.normalize_phone(None) == (None, None)


def test_qua_ngan():
    v, err = parse.normalize_phone("12345")
    assert v is None and err is not None


# ── raw_phone: giữ nguyên SĐT lỗi để chỉnh sau ───────────────────────────────
def test_raw_phone_giu_nguyen():
    assert parse.raw_phone("09488782646") == "09488782646"
    assert parse.raw_phone("099999999") == "099999999"


def test_raw_phone_bo_duoi_float_excel():
    assert parse.raw_phone("965226668.0") == "965226668"


def test_raw_phone_rong():
    assert parse.raw_phone(None) is None
    assert parse.raw_phone("  ") is None
