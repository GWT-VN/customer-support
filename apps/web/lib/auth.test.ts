import { describe, expect, it } from 'vitest'
import { xetLuatVaoCua } from './auth'

describe('xetLuatVaoCua', () => {
  it('luật 3 (C1): email @gwt.vn chưa có trong bảng thì CHỜ DUYỆT, không tự vào', () => {
    expect(xetLuatVaoCua('ai@gwt.vn', null)).toEqual({ duocVao: false, lyDo: 'cho_duyet' })
  })

  it('luật 3 (C1): chữ HOA cũng chờ duyệt (chuẩn hoá chữ thường)', () => {
    expect(xetLuatVaoCua('AI@GWT.VN', null)).toEqual({ duocVao: false, lyDo: 'cho_duyet' })
  })

  it('luật 1: @gwt.vn đã duyệt (đang bật + có vai trò CS) thì được vào', () => {
    expect(xetLuatVaoCua('ai@gwt.vn', { hoat_dong: true, vai_tro: ['cs'] }))
      .toEqual({ duocVao: true, nguon: 'staff' })
  })

  it('luật 2: email ngoài domain nhưng có trong bảng, đang bật + vai trò CS thì được vào', () => {
    expect(xetLuatVaoCua('freelancer@gmail.com', { hoat_dong: true, vai_tro: ['cs'] }))
      .toEqual({ duocVao: true, nguon: 'staff' })
  })

  it('admin và cs_manager cũng vào được', () => {
    expect(xetLuatVaoCua('a@gwt.vn', { hoat_dong: true, vai_tro: ['admin'] }).duocVao).toBe(true)
    expect(xetLuatVaoCua('b@gwt.vn', { hoat_dong: true, vai_tro: ['cs_manager'] }).duocVao).toBe(true)
  })

  it('luật 1 THẮNG luật 3: @gwt.vn nhưng hoat_dong=false thì bị từ chối', () => {
    expect(xetLuatVaoCua('nghi-viec@gwt.vn', { hoat_dong: false, vai_tro: ['cs'] }))
      .toEqual({ duocVao: false, lyDo: 'bi_khoa' })
  })

  it('KỸ THUẬT: email ngoài, đang bật + vai trò ky_thuat thì được vào cửa', () => {
    expect(xetLuatVaoCua('tho@gmail.com', { hoat_dong: true, vai_tro: ['ky_thuat'] }))
      .toEqual({ duocVao: true, nguon: 'staff' })
  })

  it('KỸ THUẬT bị khoá thì vẫn chặn', () => {
    expect(xetLuatVaoCua('tho@gmail.com', { hoat_dong: false, vai_tro: ['ky_thuat'] }))
      .toEqual({ duocVao: false, lyDo: 'bi_khoa' })
  })

  it('CHẶN SALES: đang bật nhưng chỉ có vai trò sales/sales_manager -> ngoai_cs', () => {
    expect(xetLuatVaoCua('sale@gwt.vn', { hoat_dong: true, vai_tro: ['sales'] }))
      .toEqual({ duocVao: false, lyDo: 'ngoai_cs' })
    expect(xetLuatVaoCua('lead@gwt.vn', { hoat_dong: true, vai_tro: ['sales', 'sales_manager'] }))
      .toEqual({ duocVao: false, lyDo: 'ngoai_cs' })
  })

  it('CHẶN: đang bật nhưng CHƯA gán vai trò nào -> ngoai_cs', () => {
    expect(xetLuatVaoCua('moi@gwt.vn', { hoat_dong: true, vai_tro: [] }))
      .toEqual({ duocVao: false, lyDo: 'ngoai_cs' })
  })

  it('KIÊM NHIỆM: có cả sales lẫn cs thì VẪN vào được (vì có vai trò CS)', () => {
    expect(xetLuatVaoCua('kiem@gwt.vn', { hoat_dong: true, vai_tro: ['sales', 'cs'] }))
      .toEqual({ duocVao: true, nguon: 'staff' })
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
