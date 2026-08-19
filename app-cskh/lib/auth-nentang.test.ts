import { describe, it, expect } from 'vitest'
import { xetLuatVaoNenTang } from './auth'

/**
 * Cổng NỀN TẢNG (khu /work) — rộng hơn cổng CS: mọi nhân sự đang hoạt động vào được,
 * KHÔNG cần vai trò CS. Luật khoá người nghỉ việc vẫn giữ.
 */
describe('xetLuatVaoNenTang', () => {
  it('nhân sự Sales đang hoạt động → vào được (không cần vai trò CS)', () => {
    expect(xetLuatVaoNenTang('sale@gwt.vn', { hoat_dong: true, vai_tro: ['sales'] })).toEqual({
      duocVao: true,
      nguon: 'staff',
    })
  })

  it('bị khoá (hoat_dong=false) → chặn kể cả @gwt.vn', () => {
    expect(xetLuatVaoNenTang('x@gwt.vn', { hoat_dong: false, vai_tro: ['sales'] })).toEqual({
      duocVao: false,
      lyDo: 'bi_khoa',
    })
  })

  it('nhân sự hoạt động nhưng vai_tro rỗng vẫn vào nền tảng', () => {
    expect(xetLuatVaoNenTang('a@gwt.vn', { hoat_dong: true, vai_tro: [] })).toEqual({
      duocVao: true,
      nguon: 'staff',
    })
  })

  it('@gwt.vn chưa có hồ sơ → chờ duyệt', () => {
    expect(xetLuatVaoNenTang('moi@gwt.vn', null)).toEqual({ duocVao: false, lyDo: 'cho_duyet' })
  })

  it('ngoài domain, không hồ sơ → ngoài danh sách', () => {
    expect(xetLuatVaoNenTang('ke@gmail.com', null)).toEqual({ duocVao: false, lyDo: 'ngoai_danh_sach' })
  })
})
