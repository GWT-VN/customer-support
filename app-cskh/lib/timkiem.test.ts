import { describe, expect, it } from 'vitest'
import { antoanChoOr, boDau, chuanHoaTuKhoa, sapXepHopLe } from './timkiem'
import { COT_MAY, COT_TICKET, COT_LOI, COT_KHACH } from './danhSach'

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

describe('sapXepHopLe — ?cot=mat_khau trên URL thật (Task 5, bấm tiêu đề cột)', () => {
  // Bằng chứng cụ thể: gõ tay ?cot=mat_khau lên bất kỳ trang liệt kê nào cũng KHÔNG
  // vỡ trang — mat_khau không nằm trong whitelist thật của trang đó nên sapXepHopLe()
  // lặng lẽ rơi về đúng mặc định của trang, y hệt như chưa từng có ?cot= trên URL.
  it('COT_MAY (trang "/") bỏ qua mat_khau, rơi về mặc định install_date desc', () => {
    const macDinh = { cot: 'install_date', tang: false }
    expect(sapXepHopLe('mat_khau', 'asc', COT_MAY, macDinh)).toEqual(macDinh)
  })

  it('COT_TICKET (trang "/ticket") bỏ qua mat_khau, rơi về mặc định created_at desc', () => {
    const macDinh = { cot: 'created_at', tang: false }
    expect(sapXepHopLe('mat_khau', 'asc', COT_TICKET, macDinh)).toEqual(macDinh)
  })

  it('COT_LOI (trang "/loi") bỏ qua mat_khau, rơi về mặc định han_som asc', () => {
    const macDinh = { cot: 'han_som', tang: true }
    expect(sapXepHopLe('mat_khau', 'desc', COT_LOI, macDinh)).toEqual(macDinh)
  })

  it('COT_KHACH (trang "/khach") bỏ qua mat_khau, rơi về mặc định full_name asc', () => {
    const macDinh = { cot: 'full_name', tang: true }
    expect(sapXepHopLe('mat_khau', 'desc', COT_KHACH, macDinh)).toEqual(macDinh)
  })
})

describe('antoanChoOr — chốt chặn phá cú pháp .or() của PostgREST', () => {
  it('bỏ ký tự phá cú pháp .or() của PostgREST', () => {
    expect(antoanChoOr('a,b(c)%d')).toBe('a b c d')
  })

  it('gộp khoảng trắng phát sinh sau khi bỏ ký tự, cắt hai đầu', () => {
    expect(antoanChoOr('  a,,b((c))  ')).toBe('a b c')
  })

  it('chuỗi không có ký tự nguy hiểm thì giữ nguyên', () => {
    expect(antoanChoOr('huong')).toBe('huong')
  })

  it('chuỗi rỗng vẫn trả về rỗng', () => {
    expect(antoanChoOr('')).toBe('')
  })
})
