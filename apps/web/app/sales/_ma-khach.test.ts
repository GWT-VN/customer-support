import { describe, it, expect } from 'vitest'
import { cuoi9, maDaCap, type DongCoMa } from './_ma-khach'

const CS: DongCoMa[] = [
  { sdt: '0900000001', ma_kh: 'KH-2607-0020' },
  { sdt: '+84900000002', ma_kh: 'KH-2607-0021' },
]
const SALES: DongCoMa[] = [
  { sdt: '900000001', ma_kh: 'KH-2608-0110' },   // cùng người với dòng CS đầu, mã LỆCH
  { sdt: '0900000003', ma_kh: 'KH-2608-0111' },
]

describe('cuoi9', () => {
  it('cắt 9 số cuối, bỏ mọi cách viết', () => {
    expect(cuoi9('0900000001')).toBe('900000001')
    expect(cuoi9('+84 900 000 001')).toBe('900000001')
    expect(cuoi9('900000001')).toBe('900000001')
  })
  it('số ngắn hơn 9 chữ số coi như không tra được', () => {
    expect(cuoi9('94412012')).toBe('')
    expect(cuoi9('')).toBe('')
    expect(cuoi9(null)).toBe('')
  })
})

describe('maDaCap', () => {
  it('SĐT đã có bên CSKH -> DÙNG LẠI mã đó, không cấp mã mới', () => {
    expect(maDaCap(CS, SALES, '0900000001')).toBe('KH-2607-0020')
  })

  it('khớp được dù hai bên viết SĐT khác kiểu (+84 / 0 / thiếu số 0)', () => {
    expect(maDaCap(CS, SALES, '0900000002')).toBe('KH-2607-0021')
    expect(maDaCap(CS, SALES, '900000002')).toBe('KH-2607-0021')
  })

  it('hai bên LỆCH mã -> lấy bên CSKH, vì cs_customers.ma_kh mới có ràng buộc duy nhất', () => {
    expect(maDaCap(CS, SALES, '900000001')).toBe('KH-2607-0020')
  })

  it('chỉ có bên Sales -> lấy mã bên Sales', () => {
    expect(maDaCap(CS, SALES, '0900000003')).toBe('KH-2608-0111')
  })

  it('người mới -> null để gọi cap_ma_kh()', () => {
    expect(maDaCap(CS, SALES, '0900000009')).toBeNull()
  })

  it('không có SĐT -> null (không dedupe được, đành cấp mã mới)', () => {
    expect(maDaCap(CS, SALES, null)).toBeNull()
    expect(maDaCap(CS, SALES, '')).toBeNull()
  })

  it('bỏ qua dòng chưa có mã thay vì trả null', () => {
    const cs: DongCoMa[] = [{ sdt: '0900000001', ma_kh: null }]
    expect(maDaCap(cs, SALES, '0900000001')).toBe('KH-2608-0110')
  })
})
