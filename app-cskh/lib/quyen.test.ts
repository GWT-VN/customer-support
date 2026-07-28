import { describe, expect, it } from 'vitest'
import { kiemTraSuaNhanVien, laQuyenAdmin, laVaiTroHopLe } from './quyen'

const NGUOI_SUA = 'admin-1'
const NGUOI_KHAC = 'nv-2'

describe('laQuyenAdmin', () => {
  it('chỉ đúng với vai trò admin', () => {
    expect(laQuyenAdmin('admin')).toBe(true)
    expect(laQuyenAdmin('cs')).toBe(false)
    expect(laQuyenAdmin(null)).toBe(false)
    expect(laQuyenAdmin(undefined)).toBe(false)
    expect(laQuyenAdmin('Admin')).toBe(false) // phân biệt hoa thường, không đoán
  })
})

describe('laVaiTroHopLe', () => {
  it('chặn vai trò lạ — cột vai_tro là text nên phải tự canh', () => {
    expect(laVaiTroHopLe('admin')).toBe(true)
    expect(laVaiTroHopLe('cs')).toBe(true)
    expect(laVaiTroHopLe('superadmin')).toBe(false)
    expect(laVaiTroHopLe('')).toBe(false)
  })
})

describe('kiemTraSuaNhanVien — chống khoá chết hệ thống', () => {
  it('bẫy 1: admin tự khoá chính mình', () => {
    const r = kiemTraSuaNhanVien({
      idNguoiSua: NGUOI_SUA, idBiSua: NGUOI_SUA,
      hoatDongMoi: false, vaiTroHienTai: 'admin', soAdminDangHoatDong: 3,
    })
    expect(r).toEqual({ ok: false, lyDo: 'Không thể tự khoá tài khoản của chính mình.' })
  })

  it('bẫy 2: admin tự hạ mình xuống cs', () => {
    const r = kiemTraSuaNhanVien({
      idNguoiSua: NGUOI_SUA, idBiSua: NGUOI_SUA,
      vaiTroMoi: 'cs', vaiTroHienTai: 'admin', soAdminDangHoatDong: 3,
    })
    expect(r.ok).toBe(false)
  })

  it('bẫy 3: hạ quyền admin CUỐI CÙNG', () => {
    const r = kiemTraSuaNhanVien({
      idNguoiSua: NGUOI_SUA, idBiSua: NGUOI_KHAC,
      vaiTroMoi: 'cs', vaiTroHienTai: 'admin', soAdminDangHoatDong: 1,
    })
    expect(r).toEqual({
      ok: false,
      lyDo: 'Đây là admin cuối cùng — phải có ít nhất một admin hoạt động.',
    })
  })

  it('bẫy 3: khoá admin cuối cùng cũng bị chặn', () => {
    const r = kiemTraSuaNhanVien({
      idNguoiSua: NGUOI_SUA, idBiSua: NGUOI_KHAC,
      hoatDongMoi: false, vaiTroHienTai: 'admin', soAdminDangHoatDong: 1,
    })
    expect(r.ok).toBe(false)
  })

  it('còn admin khác thì hạ quyền được', () => {
    const r = kiemTraSuaNhanVien({
      idNguoiSua: NGUOI_SUA, idBiSua: NGUOI_KHAC,
      vaiTroMoi: 'cs', vaiTroHienTai: 'admin', soAdminDangHoatDong: 2,
    })
    expect(r).toEqual({ ok: true })
  })

  it('khoá nhân viên cs bình thường — không liên quan số admin', () => {
    const r = kiemTraSuaNhanVien({
      idNguoiSua: NGUOI_SUA, idBiSua: NGUOI_KHAC,
      hoatDongMoi: false, vaiTroHienTai: 'cs', soAdminDangHoatDong: 1,
    })
    expect(r).toEqual({ ok: true })
  })

  it('tự NÂNG quyền mình lên admin thì không chặn (vốn đã là admin)', () => {
    const r = kiemTraSuaNhanVien({
      idNguoiSua: NGUOI_SUA, idBiSua: NGUOI_SUA,
      vaiTroMoi: 'admin', vaiTroHienTai: 'admin', soAdminDangHoatDong: 1,
    })
    expect(r).toEqual({ ok: true })
  })
})
