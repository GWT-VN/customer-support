import { describe, it, expect } from 'vitest'
import { deriveSourceTab, phoneChuan, lineAmount, isMaintenance, yymmdd, nextSeqCode, tachVat, tongDon, chuanVat, tinhKhuyenMai } from './_calc'

describe('deriveSourceTab', () => {
  it('POE thắng khi có dòng POE', () => {
    expect(deriveSourceTab([{ category_l2: 'POE' }, { category_l2: 'POU' }])).toBe('DON_POE')
  })
  it('POU khi không có POE', () => {
    expect(deriveSourceTab([{ category_l2: 'POU Filters' }])).toBe('DON_POU')
  })
  it('OTHERS khi không POE/POU', () => {
    expect(deriveSourceTab([{ category_l2: 'Dịch vụ' }, { category_l2: null }])).toBe('DON_OTHERS')
  })
})

describe('phoneChuan', () => {
  // Số giả trong test (không phải khách thật). pii-ok
  it('9 số -> thêm 0 đầu', () => expect(phoneChuan('900000012')).toBe('0900000012')) // pii-ok
  it('10 số có 0 -> giữ', () => expect(phoneChuan('0900000012')).toBe('0900000012')) // pii-ok
  it('lọc ký tự lạ', () => expect(phoneChuan('09 00-000.012')).toBe('0900000012')) // pii-ok
  it('rỗng -> null', () => { expect(phoneChuan('')).toBeNull(); expect(phoneChuan(null)).toBeNull() })
})

describe('lineAmount', () => {
  it('tính qty*price làm tròn', () => expect(lineAmount(3, 16500, false)).toBe(49500))
  it('dòng quà = 0', () => expect(lineAmount(2, 500000, true)).toBe(0))
})

describe('isMaintenance', () => {
  it('DVBT (mọi hoa/thường) = true', () => {
    expect(isMaintenance('DVBT')).toBe(true)
    expect(isMaintenance('dvbt')).toBe(true)
  })
  it('mã khác = false', () => expect(isMaintenance('WH15A')).toBe(false))
})

describe('yymmdd', () => {
  it('YYYY-MM-DD -> YYMMDD', () => expect(yymmdd('2026-08-19')).toBe('260819'))
})

describe('nextSeqCode', () => {
  it('lấy max + 1, pad 3', () => {
    expect(nextSeqCode(['260819-E001', '260819-E003'], '260819-E')).toBe('260819-E004')
  })
  it('danh sách rỗng -> 001', () => {
    expect(nextSeqCode([], '260819-U')).toBe('260819-U001')
  })
  it('bỏ qua mã không khớp tiền tố', () => {
    expect(nextSeqCode(['260819-E001', '260818-E009', null], '260819-E')).toBe('260819-E002')
  })
  it('mã khách KA pad 5', () => {
    expect(nextSeqCode(['KA00007'], 'KA', 5)).toBe('KA00008')
  })
})

describe('tachVat', () => {
  it('vat_pct là PHÂN SỐ 0.08, không phải 8', () => {
    expect(tachVat(1080000, 0.08)).toEqual({ net: 1000000, vat: 80000 })
  })
  it('vat_pct = 0 -> không VAT', () => {
    expect(tachVat(500000, 0)).toEqual({ net: 500000, vat: 0 })
  })
  it('vat_pct null -> coi như không VAT, không đoán', () => {
    expect(tachVat(500000, null)).toEqual({ net: 500000, vat: 0 })
  })
  it('net + vat luôn bằng đúng tiền sau VAT (không rơi đồng lẻ)', () => {
    const r = tachVat(333333, 0.08)
    expect(r.net + r.vat).toBe(333333)
  })
  it('tiền 0 -> 0', () => expect(tachVat(0, 0.08)).toEqual({ net: 0, vat: 0 }))
})

describe('tongDon', () => {
  it('ưu tiên amount_net có sẵn (đơn từ Sheet)', () => {
    expect(tongDon([{ amount_vat: 1080000, amount_net: 1000000, vat_pct: 0.08 }]))
      .toEqual({ net: 1000000, vat: 80000, sauVat: 1080000 })
  })
  it('thiếu amount_net thì suy từ vat_pct (đơn app)', () => {
    expect(tongDon([{ amount_vat: 1080000, amount_net: null, vat_pct: 0.08 }]))
      .toEqual({ net: 1000000, vat: 80000, sauVat: 1080000 })
  })
  it('cộng nhiều dòng, trộn cả hai kiểu', () => {
    expect(tongDon([
      { amount_vat: 1080000, amount_net: 1000000, vat_pct: 0.08 },
      { amount_vat: 500000, amount_net: null, vat_pct: 0 },
    ])).toEqual({ net: 1500000, vat: 80000, sauVat: 1580000 })
  })
  it('đơn rỗng -> tất cả 0', () => expect(tongDon([])).toEqual({ net: 0, vat: 0, sauVat: 0 }))
})

describe('chuanVat — chấp cả hai cách ghi', () => {
  it('phân số giữ nguyên', () => {
    expect(chuanVat(0.08)).toBe(0.08)
    expect(chuanVat(0.1)).toBe(0.1)
    expect(chuanVat(0)).toBe(0)
  })
  it('phần trăm quy về phân số — hết lỗi 800%', () => {
    expect(chuanVat(8)).toBe(0.08)
    expect(chuanVat(10)).toBe(0.1)
    expect(chuanVat(5)).toBe(0.05)
  })
  it('rỗng/không hợp lệ -> null, không đoán', () => {
    expect(chuanVat(null)).toBeNull()
    expect(chuanVat(undefined)).toBeNull()
    expect(chuanVat(-1)).toBeNull()
  })
  it('tachVat cho KẾT QUẢ NHƯ NHAU dù ghi 8 hay 0.08', () => {
    expect(tachVat(1080000, 8)).toEqual(tachVat(1080000, 0.08))
    expect(tachVat(1080000, 8)).toEqual({ net: 1000000, vat: 80000 })
  })
})

describe('tinhKhuyenMai', () => {
  it('đơn thật: CTS20NG niêm yết 39.950.000, bán 32.000.000 -> KM 7.950.000', () => {
    expect(tinhKhuyenMai(39950000, 1, 32000000, false)).toBe(7950000)
  })
  it('nhân theo số lượng', () => {
    expect(tinhKhuyenMai(1000000, 3, 2700000, false)).toBe(300000)
  })
  it('bán ĐÚNG giá niêm yết -> 0', () => {
    expect(tinhKhuyenMai(1000000, 2, 2000000, false)).toBe(0)
  })
  it('bán CAO hơn niêm yết -> số âm, không giấu', () => {
    expect(tinhKhuyenMai(1000000, 1, 1200000, false)).toBe(-200000)
  })
  it('chưa có giá niêm yết -> null, KHÔNG bịa số 0', () => {
    expect(tinhKhuyenMai(null, 1, 32000000, false)).toBeNull()
    expect(tinhKhuyenMai(0, 1, 32000000, false)).toBeNull()
  })
  it('dòng QUÀ -> null, vì hiệu số bằng nguyên giá niêm yết sẽ như giảm giá khổng lồ', () => {
    expect(tinhKhuyenMai(39950000, 1, 0, true)).toBeNull()
  })
})
