import { describe, it, expect } from 'vitest'
import { giaSauGiam, mucApDung, conHieuLuc, ctkmChoDon, giaTheoBac, capGiaVaPct } from './_ctkm'

describe('giaSauGiam — ba kiểu giảm CEO chốt 21/08', () => {
  it('PCT: CTS20 niêm yết 39.950.000 giảm 12% -> 35.156.000', () => {
    expect(giaSauGiam('PCT', 39950000, 12)).toBe(35156000)
  })
  it('TIEN: giảm thẳng 5 triệu', () => {
    expect(giaSauGiam('TIEN', 39950000, 5000000)).toBe(34950000)
  })
  it('CON: "giảm còn 29.900.000" -> đúng 29.900.000, KHÔNG phụ thuộc giá niêm yết', () => {
    expect(giaSauGiam('CON', 39950000, 29900000)).toBe(29900000)
    expect(giaSauGiam('CON', 249950000, 29900000)).toBe(29900000)
  })
  it('trần giảm tối đa chặn được mức % quá tay', () => {
    // 12% của 249.950.000 = 29.994.000, nhưng trần 6.000.000
    expect(giaSauGiam('PCT', 249950000, 12, 6000000)).toBe(243950000)
  })
  it('trần chỉ áp khi vượt, không tự cộng thêm', () => {
    expect(giaSauGiam('PCT', 10000000, 10, 6000000)).toBe(9000000)
  })
  it('không bao giờ trả số âm', () => {
    expect(giaSauGiam('TIEN', 1000000, 5000000)).toBe(0)
    expect(giaSauGiam('CON', 1000000, -5)).toBe(0)
  })
  it('mức rỗng -> giữ nguyên giá niêm yết, KHÔNG đoán', () => {
    expect(giaSauGiam('PCT', 39950000, null)).toBe(39950000)
    expect(giaSauGiam('TIEN', 39950000, undefined)).toBe(39950000)
  })
})

describe('mucApDung — mức riêng thắng mức chung', () => {
  it('có mức riêng thì dùng mức riêng', () => expect(mucApDung(15, 12)).toBe(15))
  it('không có mức riêng thì rơi về mức chung', () => expect(mucApDung(null, 12)).toBe(12))
  it('mức riêng = 0 vẫn là một lựa chọn thật, không rơi về mức chung', () => {
    expect(mucApDung(0, 12)).toBe(0)
  })
  it('cả hai rỗng -> null', () => expect(mucApDung(null, null)).toBeNull())
})

describe('conHieuLuc', () => {
  it('trong khoảng', () => expect(conHieuLuc('2026-09-15', '2026-09-01', '2026-09-30')).toBe(true))
  it('đúng ngày đầu và ngày cuối đều tính là trong', () => {
    expect(conHieuLuc('2026-09-01', '2026-09-01', '2026-09-30')).toBe(true)
    expect(conHieuLuc('2026-09-30', '2026-09-01', '2026-09-30')).toBe(true)
  })
  it('ngoài khoảng', () => {
    expect(conHieuLuc('2026-08-31', '2026-09-01', '2026-09-30')).toBe(false)
    expect(conHieuLuc('2026-10-01', '2026-09-01', '2026-09-30')).toBe(false)
  })
  it('để trống ngày kết thúc = vô thời hạn', () => {
    expect(conHieuLuc('2030-01-01', '2026-09-01', null)).toBe(true)
  })
})

const CT = (p: Partial<Parameters<typeof ctkmChoDon>[0][number]> = {}) => ({
  id: 'x', ten: 'CT', tu_ngay: '2026-09-01', den_ngay: '2026-09-30',
  kieu_giam: 'PCT' as const, muc_chung: 10, giam_toi_da: null,
  trang_thai: 'ban_hanh', kenh: [88], ...p,
})

describe('ctkmChoDon', () => {
  it('khớp ngày + kênh + đã ban hành', () => {
    const r = ctkmChoDon([CT()], '2026-09-15', 88)
    expect(r.chon?.id).toBe('x')
  })
  it('BẢN NHÁP không bao giờ áp', () => {
    expect(ctkmChoDon([CT({ trang_thai: 'nhap' })], '2026-09-15', 88).chon).toBeNull()
  })
  it('sai kênh thì không áp', () => {
    expect(ctkmChoDon([CT()], '2026-09-15', 89).chon).toBeNull()
  })
  it('đơn không có kênh thì không áp', () => {
    expect(ctkmChoDon([CT()], '2026-09-15', null).chon).toBeNull()
  })
  it('nhiều chương trình khớp -> lấy cái GIẢM SÂU NHẤT, trả phần còn lại để báo người dùng', () => {
    const it10 = CT({ id: 'a', muc_chung: 10 })
    const it20 = CT({ id: 'b', muc_chung: 20 })
    const r = ctkmChoDon([it10, it20], '2026-09-15', 88)
    expect(r.chon?.id).toBe('b')
    expect(r.khac.map((c) => c.id)).toEqual(['a'])
  })
})

const CS = (p: Partial<Parameters<typeof giaTheoBac>[0][number]> = {}) => ({
  bac: 'DAI_LY' as const, internal_code: 'CTS20NG', giam_pct: 30, gia_ban: null,
  nhap_theo: 'PCT' as const, hieu_luc_tu: '2026-03-01', hieu_luc_den: null,
  trang_thai: 'ban_hanh', ...p,
})

describe('giaTheoBac', () => {
  it('gõ theo % -> tính từ giá niêm yết', () => {
    expect(giaTheoBac([CS()], 'DAI_LY', 'CTS20NG', 39950000, '2026-09-15')).toBe(27965000)
  })
  it('gõ theo GIÁ -> dùng đúng số đã duyệt, không tính lại từ %', () => {
    // WH15A giá NPP 112.000.000 — tính từ % sẽ ra 111.988.900, lệch mất 11.100đ
    const cs = CS({ bac: 'NPP', internal_code: 'WH15A', nhap_theo: 'GIA', gia_ban: 112000000, giam_pct: 37.8 })
    expect(giaTheoBac([cs], 'NPP', 'WH15A', 179950000, '2026-09-15')).toBe(112000000)
  })
  it('bản chưa ban hành thì bỏ qua', () => {
    expect(giaTheoBac([CS({ trang_thai: 'nhap' })], 'DAI_LY', 'CTS20NG', 39950000, '2026-09-15')).toBeNull()
  })
  it('nhiều bản cùng hiệu lực -> lấy bản MỚI NHẤT', () => {
    const cu = CS({ giam_pct: 20, hieu_luc_tu: '2026-01-01' })
    const moi = CS({ giam_pct: 30, hieu_luc_tu: '2026-03-01' })
    expect(giaTheoBac([cu, moi], 'DAI_LY', 'CTS20NG', 39950000, '2026-09-15')).toBe(27965000)
  })
  it('không có chính sách khớp -> null', () => {
    expect(giaTheoBac([CS()], 'NPP', 'CTS20NG', 39950000, '2026-09-15')).toBeNull()
  })
  it('đơn CŨ hơn ngày hiệu lực thì không ăn chính sách mới', () => {
    expect(giaTheoBac([CS()], 'DAI_LY', 'CTS20NG', 39950000, '2026-02-01')).toBeNull()
  })
})

describe('capGiaVaPct — điền một ô, ô kia tự tính', () => {
  it('gõ % ra giá', () => {
    expect(capGiaVaPct(16950000, 'PCT', 50)).toEqual({ pct: 50, gia: 8475000 })
  })
  it('gõ giá ra %, làm tròn 1 chữ số thập phân', () => {
    expect(capGiaVaPct(179950000, 'GIA', 112000000)).toEqual({ pct: 37.8, gia: 112000000 })
  })
  it('giá niêm yết 0 hoặc rỗng -> không tính bừa', () => {
    expect(capGiaVaPct(null, 'PCT', 50)).toEqual({ pct: null, gia: null })
    expect(capGiaVaPct(0, 'GIA', 100)).toEqual({ pct: null, gia: null })
  })
})
