/**
 * Vai trò và luật sửa nhân viên — HÀM THUẦN, không đụng DB.
 *
 * Tách riêng để test được: đây là chỗ quyết định ai làm được gì, sai một luật
 * là mở toang dữ liệu khách hoặc khoá chết cả hệ thống.
 */

export const VAI_TRO = ['admin', 'cs'] as const
export type VaiTro = (typeof VAI_TRO)[number]

export const NHAN_VAI_TRO: Record<VaiTro, string> = {
  admin: 'Quản trị',
  cs: 'Nhân viên CSKH',
}

export function laVaiTroHopLe(v: string): v is VaiTro {
  return (VAI_TRO as readonly string[]).includes(v)
}

/** Người này có quyền admin không. Dùng chung cho cả chặn server lẫn ẩn nút. */
export function laQuyenAdmin(vaiTro: string | null | undefined): boolean {
  return vaiTro === 'admin'
}

export type YeuCauSua = {
  /** id nhân viên đang thực hiện thao tác */
  idNguoiSua: string
  /** id nhân viên bị sửa */
  idBiSua: string
  vaiTroMoi?: VaiTro
  hoatDongMoi?: boolean
  /** vai trò hiện tại của người bị sửa */
  vaiTroHienTai: string
  /** số admin đang hoạt động TRƯỚC khi sửa */
  soAdminDangHoatDong: number
}

/**
 * Ba cái bẫy khoá chết hệ thống mà luật này chặn:
 *  1. Admin tự khoá chính mình -> mất đường vào ngay lập tức
 *  2. Admin tự hạ mình xuống cs -> không ai cấp lại quyền được
 *  3. Hạ/khoá admin CUỐI CÙNG -> không còn ai quản trị, phải sửa tay dưới DB
 */
export function kiemTraSuaNhanVien(y: YeuCauSua): { ok: true } | { ok: false; lyDo: string } {
  const tuMinh = y.idNguoiSua === y.idBiSua

  if (tuMinh && y.hoatDongMoi === false) {
    return { ok: false, lyDo: 'Không thể tự khoá tài khoản của chính mình.' }
  }
  if (tuMinh && y.vaiTroMoi === 'cs') {
    return { ok: false, lyDo: 'Không thể tự hạ quyền của chính mình — nhờ admin khác làm.' }
  }

  const dangLaAdmin = laQuyenAdmin(y.vaiTroHienTai)
  const matQuyenAdmin = dangLaAdmin && (y.vaiTroMoi === 'cs' || y.hoatDongMoi === false)
  if (matQuyenAdmin && y.soAdminDangHoatDong <= 1) {
    return { ok: false, lyDo: 'Đây là admin cuối cùng — phải có ít nhất một admin hoạt động.' }
  }

  return { ok: true }
}
