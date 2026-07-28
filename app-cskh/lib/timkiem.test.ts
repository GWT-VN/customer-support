import { describe, expect, it } from 'vitest'
import { boDau, chuanHoaTuKhoa, sapXepHopLe } from './timkiem'

describe('boDau', () => {
  it('bỏ dấu tiếng Việt và về chữ thường', () => {
    expect(boDau('Nguyễn Thị Hương')).toBe('nguyen thi huong')
    expect(boDau('Hưng Yên')).toBe('hung yen')
  })

  it('chữ đ phải thành d — NFD không tách được U+0111', () => {
    expect(boDau('Đoàn Văn Đức')).toBe('doan van duc')
    expect(boDau('đ')).toBe('d')
  })

  it('chuỗi đã không dấu thì giữ nguyên', () => {
    expect(boDau('nguyen van a')).toBe('nguyen van a')
  })

  it('chuỗi rỗng và khoảng trắng', () => {
    expect(boDau('')).toBe('')
    expect(boDau('  ')).toBe('  ')
  })
})

describe('chuanHoaTuKhoa', () => {
  it('bỏ dấu, cắt khoảng trắng thừa hai đầu', () => {
    expect(chuanHoaTuKhoa('  Hương  ')).toBe('huong')
  })

  it('gộp khoảng trắng giữa các từ', () => {
    expect(chuanHoaTuKhoa('Hưng    Yên')).toBe('hung yen')
  })
})

describe('sapXepHopLe — chốt chặn injection', () => {
  const CHO_PHEP = ['install_date', 'serial', 'customer_name'] as const
  const MAC_DINH = { cot: 'install_date', tang: false }

  it('cột hợp lệ thì dùng', () => {
    expect(sapXepHopLe('serial', 'asc', CHO_PHEP, MAC_DINH))
      .toEqual({ cot: 'serial', tang: true })
  })

  it('cột LẠ bị bỏ qua, rơi về mặc định', () => {
    expect(sapXepHopLe('mat_khau', 'asc', CHO_PHEP, MAC_DINH)).toEqual(MAC_DINH)
  })

  it('chuỗi tấn công cũng rơi về mặc định', () => {
    expect(sapXepHopLe('id; drop table cs_customers', 'asc', CHO_PHEP, MAC_DINH))
      .toEqual(MAC_DINH)
  })

  it('thiếu tham số thì dùng mặc định', () => {
    expect(sapXepHopLe(undefined, undefined, CHO_PHEP, MAC_DINH)).toEqual(MAC_DINH)
  })

  it('chiều chỉ nhận asc/desc, khác đi coi như desc', () => {
    expect(sapXepHopLe('serial', 'lung tung', CHO_PHEP, MAC_DINH))
      .toEqual({ cot: 'serial', tang: false })
  })
})
