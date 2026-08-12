import { describe, expect, it } from 'vitest'
import { chuanHoaVaiTro, coQuyenQuanLy, kiemTraSuaNhanVien, laQuyenAdmin, laVaiTroHopLe } from './quyen'

const NGUOI_SUA = 'admin-1'
const NGUOI_KHAC = 'nv-2'

describe('chuanHoaVaiTro — đọc được cả chuỗi cũ lẫn mảng mới', () => {
  it('chuỗi đơn (trước migration) -> mảng', () => {
    expect(chuanHoaVaiTro('admin')).toEqual(['admin'])
    expect(chuanHoaVaiTro('cs')).toEqual(['cs'])
  })
  it('mảng (sau migration) giữ nguyên, bỏ giá trị lạ + khử trùng', () => {
    expect(chuanHoaVaiTro(['cs', 'sales'])).toEqual(['cs', 'sales'])
    expect(chuanHoaVaiTro(['admin', 'superuser'])).toEqual(['admin'])
    expect(chuanHoaVaiTro(['cs', 'cs'])).toEqual(['cs'])
  })
  it('rỗng/null/undefined -> mảng rỗng', () => {
    expect(chuanHoaVaiTro(null)).toEqual([])
    expect(chuanHoaVaiTro(undefined)).toEqual([])
    expect(chuanHoaVaiTro('')).toEqual([])
    expect(chuanHoaVaiTro([])).toEqual([])
  })
})

describe('laQuyenAdmin', () => {
  it('đúng khi TẬP role chứa admin (mảng mới)', () => {
    expect(laQuyenAdmin(['admin'])).toBe(true)
    expect(laQuyenAdmin(['cs', 'admin'])).toBe(true)
    expect(laQuyenAdmin(['cs', 'sales'])).toBe(false)
    expect(laQuyenAdmin([])).toBe(false)
  })
  it('vẫn đọc được chuỗi cũ (trước migration)', () => {
    expect(laQuyenAdmin('admin')).toBe(true)
    expect(laQuyenAdmin('cs')).toBe(false)
    expect(laQuyenAdmin(null)).toBe(false)
    expect(laQuyenAdmin(undefined)).toBe(false)
    expect(laQuyenAdmin('Admin')).toBe(false) // phân biệt hoa thường, không đoán
  })
})

describe('coQuyenQuanLy — admin hoặc cs_manager', () => {
  it('đúng với admin và cs_manager (kể cả kiêm nhiệm)', () => {
    expect(coQuyenQuanLy(['admin'])).toBe(true)
    expect(coQuyenQuanLy(['cs_manager'])).toBe(true)
    expect(coQuyenQuanLy(['cs', 'cs_manager'])).toBe(true)
    expect(coQuyenQuanLy(['admin', 'sales'])).toBe(true)
    expect(coQuyenQuanLy('admin')).toBe(true) // chuỗi cũ
  })
  it('sai với cs / sales / sales_manager thường và rỗng', () => {
    expect(coQuyenQuanLy(['cs'])).toBe(false)
    expect(coQuyenQuanLy(['sales'])).toBe(false)
    expect(coQuyenQuanLy(['sales_manager'])).toBe(false) // sales_manager KHÔNG có quyền CS
    expect(coQuyenQuanLy(['sales', 'sales_manager'])).toBe(false)
    expect(coQuyenQuanLy([])).toBe(false)
    expect(coQuyenQuanLy(null)).toBe(false)
  })
})

describe('laVaiTroHopLe', () => {
  it('chấp nhận đủ 5 role, chặn role lạ', () => {
    expect(laVaiTroHopLe('admin')).toBe(true)
    expect(laVaiTroHopLe('cs')).toBe(true)
    expect(laVaiTroHopLe('cs_manager')).toBe(true)
    expect(laVaiTroHopLe('sales')).toBe(true)
    expect(laVaiTroHopLe('sales_manager')).toBe(true)
    expect(laVaiTroHopLe('superadmin')).toBe(false)
    expect(laVaiTroHopLe('')).toBe(false)
  })
})

describe('kiemTraSuaNhanVien — chống khoá chết hệ thống', () => {
  it('bẫy 1: admin tự khoá chính mình', () => {
    const r = kiemTraSuaNhanVien({
      idNguoiSua: NGUOI_SUA, idBiSua: NGUOI_SUA,
      hoatDongMoi: false, vaiTroHienTai: ['admin'], soAdminDangHoatDong: 3,
    })
    expect(r).toEqual({ ok: false, lyDo: 'Không thể tự khoá tài khoản của chính mình.' })
  })

  it('bẫy 2: admin tự bỏ quyền admin của mình', () => {
    const r = kiemTraSuaNhanVien({
      idNguoiSua: NGUOI_SUA, idBiSua: NGUOI_SUA,
      vaiTroMoi: ['cs'], vaiTroHienTai: ['admin'], soAdminDangHoatDong: 3,
    })
    expect(r.ok).toBe(false)
  })

  it('tự đổi role KHÁC nhưng VẪN còn admin thì cho phép (thêm cs_manager)', () => {
    const r = kiemTraSuaNhanVien({
      idNguoiSua: NGUOI_SUA, idBiSua: NGUOI_SUA,
      vaiTroMoi: ['admin', 'cs_manager'], vaiTroHienTai: ['admin'], soAdminDangHoatDong: 1,
    })
    expect(r).toEqual({ ok: true })
  })

  it('bẫy 3: bỏ quyền admin CUỐI CÙNG', () => {
    const r = kiemTraSuaNhanVien({
      idNguoiSua: NGUOI_SUA, idBiSua: NGUOI_KHAC,
      vaiTroMoi: ['cs'], vaiTroHienTai: ['admin'], soAdminDangHoatDong: 1,
    })
    expect(r).toEqual({
      ok: false,
      lyDo: 'Đây là admin cuối cùng — phải có ít nhất một admin hoạt động.',
    })
  })

  it('bẫy 3: khoá admin cuối cùng cũng bị chặn', () => {
    const r = kiemTraSuaNhanVien({
      idNguoiSua: NGUOI_SUA, idBiSua: NGUOI_KHAC,
      hoatDongMoi: false, vaiTroHienTai: ['admin'], soAdminDangHoatDong: 1,
    })
    expect(r.ok).toBe(false)
  })

  it('còn admin khác thì bỏ quyền admin được', () => {
    const r = kiemTraSuaNhanVien({
      idNguoiSua: NGUOI_SUA, idBiSua: NGUOI_KHAC,
      vaiTroMoi: ['cs'], vaiTroHienTai: ['admin'], soAdminDangHoatDong: 2,
    })
    expect(r).toEqual({ ok: true })
  })

  it('khoá nhân viên cs bình thường — không liên quan số admin', () => {
    const r = kiemTraSuaNhanVien({
      idNguoiSua: NGUOI_SUA, idBiSua: NGUOI_KHAC,
      hoatDongMoi: false, vaiTroHienTai: ['cs'], soAdminDangHoatDong: 1,
    })
    expect(r).toEqual({ ok: true })
  })

  it('gán thêm role cho admin cuối cùng (vẫn còn admin) thì không chặn', () => {
    const r = kiemTraSuaNhanVien({
      idNguoiSua: NGUOI_SUA, idBiSua: NGUOI_SUA,
      vaiTroMoi: ['admin', 'sales_manager'], vaiTroHienTai: ['admin'], soAdminDangHoatDong: 1,
    })
    expect(r).toEqual({ ok: true })
  })
})
