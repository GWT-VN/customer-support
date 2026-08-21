import { describe, expect, it } from 'vitest'
import { conNoDoiMatKhau, xetLuatVao, xetLuatVaoCua, xetLuatVaoNenTang } from './vao-cua'

describe('xetLuatVao — một hàm cho mọi khu', () => {
  it("khu 'cs' cho ra ĐÚNG kết quả của xetLuatVaoCua cũ", () => {
    const ca: [string, { hoat_dong: boolean; vai_tro: string[] } | null][] = [
      ['ai@gwt.vn', null],
      ['ai@gwt.vn', { hoat_dong: true, vai_tro: ['cs'] }],
      ['ai@gwt.vn', { hoat_dong: false, vai_tro: ['cs'] }],
      ['ai@gwt.vn', { hoat_dong: true, vai_tro: ['sales'] }],
      ['ngoai@gmail.com', null],
    ]
    for (const [email, dong] of ca) {
      expect(xetLuatVao('cs', email, dong), `${email}`).toEqual(xetLuatVaoCua(email, dong))
    }
  })

  it("khu 'nen_tang' cho ra ĐÚNG kết quả của xetLuatVaoNenTang cũ", () => {
    expect(xetLuatVao('nen_tang', 'ai@gwt.vn', { hoat_dong: true, vai_tro: ['sales'] }))
      .toEqual(xetLuatVaoNenTang('ai@gwt.vn', { hoat_dong: true, vai_tro: ['sales'] }))
  })

  it('khác biệt cốt lõi: sales thuần vào được nền tảng nhưng KHÔNG vào được khu CS', () => {
    const dong = { hoat_dong: true, vai_tro: ['sales'] }
    expect(xetLuatVao('cs', 'a@gwt.vn', dong)).toEqual({ duocVao: false, lyDo: 'ngoai_cs' })
    expect(xetLuatVao('nen_tang', 'a@gwt.vn', dong)).toEqual({ duocVao: true, nguon: 'staff' })
  })

  it('7 vai trò mới: vào được nền tảng, CHƯA vào được khu CS (GĐ1 không đổi quyền)', () => {
    for (const v of ['ceo', 'kt_giam_doc', 'ctv_lap_dat', 'marketing', 'kho', 'ke_toan', 'tai_chinh']) {
      const dong = { hoat_dong: true, vai_tro: [v] }
      expect(xetLuatVao('nen_tang', 'a@gwt.vn', dong).duocVao, `${v} vào nền tảng`).toBe(true)
      expect(xetLuatVao('cs', 'a@gwt.vn', dong).duocVao, `${v} KHÔNG vào khu CS`).toBe(false)
    }
  })

  it('người bị khoá bị chặn ở MỌI khu', () => {
    const dong = { hoat_dong: false, vai_tro: ['admin'] }
    expect(xetLuatVao('cs', 'a@gwt.vn', dong)).toEqual({ duocVao: false, lyDo: 'bi_khoa' })
    expect(xetLuatVao('nen_tang', 'a@gwt.vn', dong)).toEqual({ duocVao: false, lyDo: 'bi_khoa' })
  })

  it('CTV được mời (email ngoài domain, có trong bảng, đang bật) vào được nền tảng', () => {
    expect(xetLuatVao('nen_tang', 'ctv@gmail.com', { hoat_dong: true, vai_tro: ['ctv_lap_dat'] }))
      .toEqual({ duocVao: true, nguon: 'staff' })
  })
})

describe('conNoDoiMatKhau — mật khẩu admin cấp, chưa đổi', () => {
  it('cờ bật thì còn nợ', () => {
    expect(conNoDoiMatKhau({ phai_doi_mat_khau: true })).toBe(true)
  })

  it('không có cờ, cờ tắt, hoặc không có metadata thì hết nợ', () => {
    expect(conNoDoiMatKhau({ phai_doi_mat_khau: false })).toBe(false)
    expect(conNoDoiMatKhau({})).toBe(false)
    expect(conNoDoiMatKhau(null)).toBe(false)
    expect(conNoDoiMatKhau(undefined)).toBe(false)
  })

  it('giá trị JSON lạ KHÔNG được ép thành true — nếu không luật đảo chiều', () => {
    expect(conNoDoiMatKhau({ phai_doi_mat_khau: 'true' })).toBe(false)
    expect(conNoDoiMatKhau({ phai_doi_mat_khau: 1 })).toBe(false)
    expect(conNoDoiMatKhau({ phai_doi_mat_khau: 'false' })).toBe(false)
  })
})
