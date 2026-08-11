import { describe, it, expect } from 'vitest'
import { phanTichBangSerial, chuanNgayNhap } from './danhSach'

describe('chuanNgayNhap', () => {
  it('nhận ISO, dd/mm/yyyy, dd-mm-yyyy, năm 2 số', () => {
    expect(chuanNgayNhap('2026-08-05')).toBe('2026-08-05')
    expect(chuanNgayNhap('5/8/2026')).toBe('2026-08-05')
    expect(chuanNgayNhap('05-08-2026')).toBe('2026-08-05')
    expect(chuanNgayNhap('5/8/26')).toBe('2026-08-05')
  })
  it('bỏ giá trị rỗng/sai', () => {
    expect(chuanNgayNhap('')).toBeNull()
    expect(chuanNgayNhap(null)).toBeNull()
    expect(chuanNgayNhap('linh tinh')).toBeNull()
    expect(chuanNgayNhap('45/13/2026')).toBeNull()
  })
})

describe('phanTichBangSerial', () => {
  it('tách Serial | PO | Ngày theo Tab/phẩy', () => {
    const r = phanTichBangSerial('S1\tPO-1\t05/08/2026\nS2,PO-2,2026-08-06')
    expect(r).toEqual([
      { serial: 'S1', po: 'PO-1', ngay: '2026-08-05' },
      { serial: 'S2', po: 'PO-2', ngay: '2026-08-06' },
    ])
  })
  it('serial-only vẫn chạy, ngày sai -> null', () => {
    const r = phanTichBangSerial('S1\nS2\tPO-2\txx')
    expect(r).toEqual([
      { serial: 'S1', po: null, ngay: null },
      { serial: 'S2', po: 'PO-2', ngay: null },
    ])
  })
  it('bỏ dòng trống + dòng tiêu đề', () => {
    const r = phanTichBangSerial('Serial\tPO\tNgày\n\nS1\tPO-1\t')
    expect(r).toEqual([{ serial: 'S1', po: 'PO-1', ngay: null }])
  })
})
