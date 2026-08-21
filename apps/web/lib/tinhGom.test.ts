import { describe, it, expect } from 'vitest'
import { gomTinh, gomDanhSachTinh, cacBienThe, TINH_LOI } from './tinhGom'

describe('gomTinh', () => {
  it('gộp 3 cách viết TP.HCM đo được trên prod', () => {
    expect(gomTinh('HCM')).toBe('Hồ Chí Minh')
    expect(gomTinh('TP. Hồ Chí Minh')).toBe('Hồ Chí Minh')
    expect(gomTinh('Hồ Chí Minh')).toBe('Hồ Chí Minh')
  })
  it('gộp biến thể dấu: Hoà/Hòa, Hoá/Hóa', () => {
    expect(gomTinh('Khánh Hoà')).toBe('Khánh Hoà')
    // Khác cách bỏ dấu nhưng cùng khoá -> gomDanhSachTinh gộp làm một mục
    expect(gomDanhSachTinh(['Khánh Hòa', 'Khánh Hoà'])).toEqual(['Khánh Hòa'])
    expect(gomDanhSachTinh(['Thanh Hóa', 'Thanh Hoá'])).toEqual(['Thanh Hóa'])
  })
  it('sửa lỗi gõ đo được', () => {
    expect(gomTinh('Huê')).toBe('Huế')
    expect(gomTinh('Đà Nắng')).toBe('Đà Nẵng')
    expect(gomTinh('Đắc Lắc')).toBe('Đắk Lắk')
    expect(gomTinh('Đăk Nông')).toBe('Đắk Nông')
  })
  it('quy tên thành phố về tỉnh', () => {
    expect(gomTinh('Hạ Long')).toBe('Quảng Ninh')
    expect(gomTinh('Pleiku')).toBe('Gia Lai')
    expect(gomTinh('Đà Lạt')).toBe('Lâm Đồng')
  })
  it('giá trị rác thành một mục riêng, không lẫn vào tỉnh', () => {
    expect(gomTinh('#REF!')).toBe(TINH_LOI)
    expect(gomTinh('#N/A')).toBe(TINH_LOI)
  })
  it('rỗng -> null', () => {
    expect(gomTinh('')).toBeNull()
    expect(gomTinh(null)).toBeNull()
    expect(gomTinh('   ')).toBeNull()
  })
  it('tên cũ giữ nguyên, KHÔNG tự quy sang tỉnh mới', () => {
    // CEO chốt: cho phép cả tên cũ lẫn mới, không chuẩn hoá.
    expect(gomTinh('Hải Dương')).toBe('Hải Dương')
    expect(gomTinh('Bắc Kạn')).toBe('Bắc Kạn')
  })
})

describe('gomDanhSachTinh', () => {
  it('gộp biến thể, sắp tiếng Việt, đẩy mục lỗi xuống cuối', () => {
    expect(gomDanhSachTinh(['HCM', '#REF!', 'Đà Nẵng', 'TP. Hồ Chí Minh', 'An Giang', null, '']))
      .toEqual(['An Giang', 'Đà Nẵng', 'Hồ Chí Minh', TINH_LOI])
  })
})

describe('cacBienThe', () => {
  it('trả mọi cách viết thô của một tỉnh, để dựng .in(...)', () => {
    const raw = ['HCM', 'TP. Hồ Chí Minh', 'Hồ Chí Minh', 'An Giang', 'HCM']
    expect(cacBienThe('Hồ Chí Minh', raw).sort()).toEqual(['HCM', 'Hồ Chí Minh', 'TP. Hồ Chí Minh'])
  })
})
