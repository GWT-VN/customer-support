import { describe, expect, it } from 'vitest'
import { xetLuatVaoCua } from './auth'

describe('xetLuatVaoCua', () => {
  it('luật 3: email @gwt.vn chưa có trong bảng thì được vào', () => {
    expect(xetLuatVaoCua('ai@gwt.vn', null)).toEqual({ duocVao: true, nguon: 'domain' })
  })

  it('luật 3: chữ HOA vẫn được vào (chuẩn hoá chữ thường)', () => {
    expect(xetLuatVaoCua('AI@GWT.VN', null)).toEqual({ duocVao: true, nguon: 'domain' })
  })

  it('luật 2: email ngoài domain nhưng có trong bảng và đang bật thì được vào', () => {
    expect(xetLuatVaoCua('freelancer@gmail.com', { hoat_dong: true }))
      .toEqual({ duocVao: true, nguon: 'cs_staff' })
  })

  it('luật 1 THẮNG luật 3: @gwt.vn nhưng hoat_dong=false thì bị từ chối', () => {
    expect(xetLuatVaoCua('nghi-viec@gwt.vn', { hoat_dong: false }))
      .toEqual({ duocVao: false, lyDo: 'bi_khoa' })
  })

  it('luật 4: email lạ bị từ chối', () => {
    expect(xetLuatVaoCua('nguoi-la@gmail.com', null))
      .toEqual({ duocVao: false, lyDo: 'ngoai_danh_sach' })
  })

  it('luật 4: domain giả mạo kiểu @gwt.vn.hacker.com bị từ chối', () => {
    expect(xetLuatVaoCua('ke@gwt.vn.hacker.com', null))
      .toEqual({ duocVao: false, lyDo: 'ngoai_danh_sach' })
  })

  it('luật 4: email rỗng bị từ chối', () => {
    expect(xetLuatVaoCua('', null)).toEqual({ duocVao: false, lyDo: 'ngoai_danh_sach' })
  })
})
