import { describe, it, expect } from 'vitest'
import { giaGoiY, type BoiCanhGia } from './_ctkm'

const NY = { GN610: 10_000_000, CTD50: 20_000_000 }

function bc(p: Partial<BoiCanhGia> = {}): BoiCanhGia {
  return { bac: null, channel_id: 1, chinhSach: [], ctkm: null, soCtkmKhac: 0, niemYet: NY, ...p }
}

const CS_DAILY = {
  bac: 'DAI_LY' as const, internal_code: 'GN610', giam_pct: 30, gia_ban: 7_000_000,
  nhap_theo: 'GIA' as const, hieu_luc_tu: '2026-08-01', hieu_luc_den: null, trang_thai: 'ban_hanh',
}

const CTKM_20 = {
  id: 'x', ten: 'CTKM tháng 8', tu_ngay: '2026-08-01', den_ngay: '2026-08-31',
  kieu_giam: 'PCT' as const, muc_chung: 20, giam_toi_da: null, trang_thai: 'ban_hanh',
  kenh: [1], sp: {} as Record<string, number>,
}

describe('giaGoiY — giá tự bắt khi lên đơn', () => {
  it('không bậc, không chương trình -> giá niêm yết', () => {
    expect(giaGoiY(bc(), 'GN610', '2026-08-22')).toMatchObject({ gia: 10_000_000, nguon: 'NIEM_YET' })
  })

  it('có bậc -> giữ ĐÚNG số đã duyệt, không tính lại từ %', () => {
    const r = giaGoiY(bc({ bac: 'DAI_LY', chinhSach: [CS_DAILY] }), 'GN610', '2026-08-22')
    expect(r.gia).toBe(7_000_000)
    expect(r.nguon).toBe('BAC')
  })

  it('BẬC THẮNG khuyến mãi bán lẻ — đại lý không cộng dồn', () => {
    const r = giaGoiY(bc({ bac: 'DAI_LY', chinhSach: [CS_DAILY], ctkm: CTKM_20 }), 'GN610', '2026-08-22')
    expect(r.nguon).toBe('BAC')
    expect(r.gia).toBe(7_000_000)
  })

  it('khách lẻ + chương trình mức chung -> giảm theo %', () => {
    expect(giaGoiY(bc({ ctkm: CTKM_20 }), 'GN610', '2026-08-22')).toMatchObject({ gia: 8_000_000, nguon: 'CTKM' })
  })

  it('mức RIÊNG của mã thắng mức chung', () => {
    expect(giaGoiY(bc({ ctkm: { ...CTKM_20, sp: { GN610: 35 } } }), 'GN610', '2026-08-22').gia).toBe(6_500_000)
  })

  it('mức riêng 0% vẫn thắng mức chung — 0 là một mức thật', () => {
    expect(giaGoiY(bc({ ctkm: { ...CTKM_20, sp: { GN610: 0 } } }), 'GN610', '2026-08-22').gia).toBe(10_000_000)
  })

  it('chương trình CÓ liệt kê sản phẩm thì mã ngoài danh sách KHÔNG được áp', () => {
    const r = giaGoiY(bc({ ctkm: { ...CTKM_20, sp: { GN610: 35 } } }), 'CTD50', '2026-08-22')
    expect(r).toMatchObject({ nguon: 'NIEM_YET', gia: 20_000_000 })
  })

  it('ngoài khoảng hiệu lực của chính sách bậc -> rơi về niêm yết', () => {
    const cu = { ...CS_DAILY, hieu_luc_den: '2026-08-10' }
    expect(giaGoiY(bc({ bac: 'DAI_LY', chinhSach: [cu] }), 'GN610', '2026-08-22').nguon).toBe('NIEM_YET')
  })

  it('bản đã thay thế KHÔNG được áp', () => {
    const cu = { ...CS_DAILY, trang_thai: 'thay_the' }
    expect(giaGoiY(bc({ bac: 'DAI_LY', chinhSach: [cu] }), 'GN610', '2026-08-22').nguon).toBe('NIEM_YET')
  })

  it('mã chưa có giá niêm yết -> null, KHÔNG bịa số 0', () => {
    const r = giaGoiY(bc(), 'LA-MA-KHONG-CO', '2026-08-22')
    expect(r.gia).toBeNull()
    expect(r.nguon).toBe('KHONG_RO')
  })

  it('giảm số tuyệt đối và giảm-còn', () => {
    expect(giaGoiY(bc({ ctkm: { ...CTKM_20, kieu_giam: 'TIEN', muc_chung: 1_500_000 } }), 'GN610', '2026-08-22').gia).toBe(8_500_000)
    expect(giaGoiY(bc({ ctkm: { ...CTKM_20, kieu_giam: 'CON', muc_chung: 9_100_000 } }), 'GN610', '2026-08-22').gia).toBe(9_100_000)
  })
})
