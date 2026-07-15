"""Test build(): rows Odoo -> customers + machines + stats."""
import datetime as dt

from migrate.odoo_serials import build

INTERNAL = {"CTS10NW", "WH30A"}
SUPPLIER = {"GTE-30A01-G": "WH30A"}


def row(**kw):
    base = {
        "Serial": None, "Customer": None, "Product name": None, "Customer/Phone": None,
        "Parent serial": None, "Warranty activated": False, "Activated date": None,
    }
    base.update(kw)
    return base


def test_bo_qua_ton_kho():
    rows = [row(Serial="S1", Customer=None), row(Serial="S2", Customer="  ")]
    customers, machines, stats = build(rows, INTERNAL, SUPPLIER)
    assert stats["ton_kho_bo_qua"] == 2
    assert stats["may_da_lap"] == 0
    assert machines == []


def test_tach_nguon_trong_ngoac():
    rows = [row(Serial="S1", Customer="Nguyễn Trung Hiếu (Shopee)")]
    customers, _, _ = build(rows, INTERNAL, SUPPLIER)
    assert customers[("name", "Nguyễn Trung Hiếu")]["source"] == "Shopee"


# ── Khoá khách = SĐT (đây là điểm cốt lõi) ──────────────────────────────────
def test_cung_ten_KHAC_sdt_thi_TACH_2_khach():
    """'Anh Sơn' ở HN và 'Anh Sơn' ở HCM là 2 người — không được gộp."""
    rows = [
        row(Serial="S1", Customer="Anh Sơn", **{"Customer/Phone": "0846361991"}),
        row(Serial="S2", Customer="Anh Sơn", **{"Customer/Phone": "0977769361"}),
    ]
    customers, machines, stats = build(rows, INTERNAL, SUPPLIER)
    assert stats["khach"] == 2
    assert {m["customer_phone"] for m in machines} == {"0846361991", "0977769361"}


def test_KHAC_ten_CUNG_sdt_thi_GOP_1_khach():
    """'Anh Dương' và 'Nguyễn Hoàng Dương' cùng SĐT = 1 người viết 2 kiểu tên."""
    rows = [
        row(Serial="S1", Customer="Anh Dương", **{"Customer/Phone": "0965226668"}),
        row(Serial="S2", Customer="Nguyễn Hoàng Dương", **{"Customer/Phone": "0965226668"}),
    ]
    customers, machines, stats = build(rows, INTERNAL, SUPPLIER)
    assert stats["khach"] == 1
    assert stats["khach_co_sdt"] == 1


def test_khong_co_sdt_thi_gop_theo_ten_va_gan_co():
    rows = [
        row(Serial="S1", Customer="Anh Vũ"),
        row(Serial="S2", Customer="Anh Vũ"),
    ]
    customers, machines, stats = build(rows, INTERNAL, SUPPLIER)
    assert stats["khach"] == 1
    assert stats["khach_thieu_sdt"] == 1
    assert customers[("name", "Anh Vũ")]["needs_phone"] is True


def test_sdt_loi_van_LUU_NGUYEN_GOC_va_gan_co_de_sua_sau():
    """User chốt: SĐT lỗi vẫn lưu như trong Odoo, gắn cờ + ghi lý do để chỉnh sau."""
    rows = [row(Serial="S1", Customer="X", **{"Customer/Phone": "099999999"})]
    customers, machines, stats = build(rows, INTERNAL, SUPPLIER)
    c = customers[("phone", "099999999")]
    assert c["primary_phone"] == "099999999"     # lưu nguyên, KHÔNG bịa cũng KHÔNG bỏ
    assert c["needs_phone"] is True              # cờ: cần sửa
    assert "rác" in c["notes"].lower()           # lý do
    assert len(stats["sdt_loi"]) == 1


def test_sdt_loi_TRUNG_NHAU_van_gop_1_khach():
    """3 máy cùng SĐT lỗi '09488782646' -> 1 khách (không nhân bản)."""
    rows = [
        row(Serial="S1", Customer="A", **{"Customer/Phone": "09488782646"}),
        row(Serial="S2", Customer="A", **{"Customer/Phone": "09488782646"}),
    ]
    customers, machines, stats = build(rows, INTERNAL, SUPPLIER)
    assert stats["khach"] == 1


def test_kho_thu_hoi_van_tao_nhu_khach():
    """User chốt: cứ tạo data này."""
    rows = [row(Serial="S1", Customer="Thu hồi GWT máy bảo hành")]
    customers, machines, stats = build(rows, INTERNAL, SUPPLIER)
    assert stats["may_da_lap"] == 1
    assert customers[("name", "Thu hồi GWT máy bảo hành")]["needs_phone"] is True


def test_resolve_ma_doi_tac():
    rows = [row(Serial="S1", Customer="A", **{"Product name": "[GTE-30A01-G] Giải pháp lọc tổng 30A"})]
    _, machines, stats = build(rows, INTERNAL, SUPPLIER)
    m = machines[0]
    assert m["internal_code"] == "WH30A"            # resolve qua supplier_code
    assert m["source_product_code"] == "GTE-30A01-G"  # giữ mã gốc để truy vết
    assert m["model_freetext"] is None               # có mã -> không cần freetext
    assert stats["ma_khong_resolve"] == {}


def test_ma_khong_resolve_thi_dung_freetext():
    rows = [row(Serial="S1", Customer="A", **{"Product name": "[LA-HOAC] Máy lạ"})]
    _, machines, stats = build(rows, INTERNAL, SUPPLIER)
    m = machines[0]
    assert m["internal_code"] is None
    assert m["model_freetext"] is not None    # check constraint cần 1 trong 2
    assert stats["ma_khong_resolve"] == {"LA-HOAC": 1}


def test_kich_hoat_va_ngay():
    rows = [row(Serial="S1", Customer="A", **{
        "Product name": "[CTS10NW] Máy",
        "Warranty activated": True,
        "Activated date": dt.datetime(2025, 1, 31),
    })]
    _, machines, stats = build(rows, INTERNAL, SUPPLIER)
    assert machines[0]["activated"] is True
    assert machines[0]["start_date"] == "2025-01-31"
    assert stats["kich_hoat_bh"] == 1


def test_parent_serial_duoc_dem():
    rows = [row(Serial="S2", Customer="A", **{"Product name": "[CTS10NW] M", "Parent serial": "S1"})]
    _, machines, stats = build(rows, INTERNAL, SUPPLIER)
    assert machines[0]["parent_serial"] == "S1"
    assert stats["co_parent"] == 1
