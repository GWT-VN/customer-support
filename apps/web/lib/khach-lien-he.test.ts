import { describe, expect, it } from 'vitest'
import { chuanHoaLoaiDiaChi, chuanHoaVaiTro, dangLuuSdtPhu, LOAI_DIA_CHI, VAI_TRO_LIEN_HE } from './khach-lien-he'

describe('chuanHoaLoaiDiaChi', () => {
  it('giữ nguyên 4 loại hợp lệ', () => {
    for (const l of LOAI_DIA_CHI) expect(chuanHoaLoaiDiaChi(l)).toBe(l)
  })

  it('giá trị lạ -> khac, KHÔNG ném lỗi (thà xếp nhầm nhóm còn hơn mất địa chỉ khách)', () => {
    expect(chuanHoaLoaiDiaChi('van_phong')).toBe('khac')
    expect(chuanHoaLoaiDiaChi('NHA')).toBe('khac')   // phân biệt hoa/thường, đúng giá trị DB
    expect(chuanHoaLoaiDiaChi('')).toBe('khac')
    expect(chuanHoaLoaiDiaChi(null)).toBe('khac')
    expect(chuanHoaLoaiDiaChi(undefined)).toBe('khac')
  })

  it('bỏ khoảng trắng thừa', () => {
    expect(chuanHoaLoaiDiaChi('  lap_dat  ')).toBe('lap_dat')
  })
})

describe('dangLuuSdtPhu', () => {
  it('số di động hợp lệ -> chuẩn hoá về 0xxxxxxxxx, khớp dạng primary_phone', () => {
    // Số BỊA (dãy liên tiếp 1-8), không phải khách thật — cửa quét PII không tự biết nên đánh dấu.
    expect(dangLuuSdtPhu('0912345678')).toBe('0912345678')     // pii-ok
    expect(dangLuuSdtPhu('84912345678')).toBe('0912345678')    // pii-ok
    expect(dangLuuSdtPhu('912345678')).toBe('0912345678')      // pii-ok
    expect(dangLuuSdtPhu('091 234 5678')).toBe('0912345678')   // pii-ok
    expect(dangLuuSdtPhu('091-234-5678')).toBe('0912345678')   // pii-ok
  })

  it('số KHÔNG hợp lệ giữ NGUYÊN như người dùng gõ — không được nuốt liên hệ thật', () => {
    expect(dangLuuSdtPhu('024 3773 1234 máy lẻ 12')).toBe('024 3773 1234 máy lẻ 12')
    expect(dangLuuSdtPhu('+65 6123 4567')).toBe('+65 6123 4567')
    expect(dangLuuSdtPhu('gọi qua lễ tân')).toBe('gọi qua lễ tân')
  })

  it('rỗng -> null', () => {
    expect(dangLuuSdtPhu('')).toBeNull()
    expect(dangLuuSdtPhu('   ')).toBeNull()
    expect(dangLuuSdtPhu(null)).toBeNull()
    expect(dangLuuSdtPhu(undefined)).toBeNull()
  })
})

describe('chuanHoaVaiTro', () => {
  it('giữ nguyên đúng 5 vai trò DB nhận', () => {
    for (const v of VAI_TRO_LIEN_HE) expect(chuanHoaVaiTro(v)).toBe(v)
  })

  // Đây là LỖI THẬT đã làm tính năng SĐT phụ không chạy nổi lần nào trên production:
  // app gửi 'khac' (bắt chước customer_addresses.loai vốn tiếng Việt), còn
  // customer_contacts_role_check chỉ nhận 5 giá trị tiếng Anh ⇒ DB chối, không ai biết.
  it("'khac' — giá trị app cũ gửi — phải về 'other', không được lọt xuống DB", () => {
    expect(chuanHoaVaiTro('khac')).toBe('other')
    expect(VAI_TRO_LIEN_HE).not.toContain('khac')
  })

  it('giá trị lạ khác cũng về other, không ném lỗi (thà xếp nhầm nhóm còn hơn mất số khách)', () => {
    expect(chuanHoaVaiTro('chu_nha')).toBe('other')
    expect(chuanHoaVaiTro('OWNER')).toBe('other')   // phân biệt hoa/thường, đúng như DB
  })

  it('trống -> null: không có vai trò khác với vai trò "khác"', () => {
    expect(chuanHoaVaiTro('')).toBeNull()
    expect(chuanHoaVaiTro('   ')).toBeNull()
    expect(chuanHoaVaiTro(null)).toBeNull()
    expect(chuanHoaVaiTro(undefined)).toBeNull()
  })

  it('bỏ khoảng trắng thừa', () => {
    expect(chuanHoaVaiTro('  helper  ')).toBe('helper')
  })
})
