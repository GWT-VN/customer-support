import { describe, it, expect } from 'vitest'
import { deriveSourceTab, phoneChuan, lineAmount, isMaintenance, yymmdd, nextSeqCode } from './_calc'

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
