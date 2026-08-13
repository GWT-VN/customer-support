/**
 * Vai trò và luật sửa nhân viên — HÀM THUẦN, không đụng DB.
 *
 * Tách riêng để test được: đây là chỗ quyết định ai làm được gì, sai một luật
 * là mở toang dữ liệu khách hoặc khoá chết cả hệ thống.
 *
 * `vai_tro` là TẬP vai trò (mảng) — 1 người giữ nhiều role cùng lúc (cty nhỏ,
 * kiêm nhiệm). Xem migration `33_staff_vai_tro_mang.sql`.
 */

export const VAI_TRO = ['admin', 'cs_manager', 'cs', 'sales_manager', 'sales', 'ky_thuat'] as const
export type VaiTro = (typeof VAI_TRO)[number]

export const NHAN_VAI_TRO: Record<VaiTro, string> = {
  admin: 'Quản trị',
  cs_manager: 'Trưởng CSKH',
  cs: 'Nhân viên CSKH',
  sales_manager: 'Trưởng Sales',
  sales: 'Nhân viên Sales',
  ky_thuat: 'Kỹ thuật',
}

export function laVaiTroHopLe(v: string): v is VaiTro {
  return (VAI_TRO as readonly string[]).includes(v)
}

/**
 * Chuẩn hoá vai_tro về MẢNG role sạch (bỏ giá trị lạ, khử trùng lặp).
 *
 * Nhận cả CHUỖI cũ ('admin') lẫn MẢNG mới (['admin','cs']) — nhờ vậy code đọc
 * được ở CẢ HAI thời kỳ schema: trước migration DB trả text, sau migration trả
 * text[]. Đây là mấu chốt để deploy code trước rồi mới áp migration mà không
 * làm sập app đang chạy.
 */
export function chuanHoaVaiTro(v: string | string[] | null | undefined): VaiTro[] {
  const raw = v == null ? [] : Array.isArray(v) ? v : [v]
  const hopLe = raw.filter((x): x is VaiTro => typeof x === 'string' && laVaiTroHopLe(x))
  return [...new Set(hopLe)]
}

/** Có quyền admin không. Nhận chuỗi cũ HOẶC mảng mới (đọc được cả 2 thời kỳ schema). */
export function laQuyenAdmin(vaiTro: string | string[] | null | undefined): boolean {
  return chuanHoaVaiTro(vaiTro).includes('admin')
}

/**
 * Cấp QUẢN LÝ CS = admin HOẶC cs_manager. Là mức được:
 *  - DUYỆT: serial pending · yêu cầu sửa · export · khách chờ.
 *  - Nghiệp vụ CS NÂNG CAO: ghi chi phí/mục ticket · lắp/thu hồi/đổi máy · kho serial ·
 *    lắp bộ · nhóm lỗi · xuất báo cáo · cập nhật hàng loạt · lưu view chung · trạng thái máy.
 *
 * KHÔNG gồm (vẫn CHỈ admin): quản lý nhân viên · đồng bộ catalog · nhật ký thao tác ·
 * XOÁ thông tin khách (xoá khách / duyệt yêu cầu xoá khách / xoá hàng loạt khách).
 * KHÔNG gồm sales/sales_manager — app này là nghiệp vụ CS.
 */
export function coQuyenQuanLy(vaiTro: string | string[] | null | undefined): boolean {
  const r = chuanHoaVaiTro(vaiTro)
  return r.includes('admin') || r.includes('cs_manager')
}

/**
 * Là kỹ thuật hiện trường (đi lắp/bảo trì/thay lõi). Vai trò HẠN CHẾ: đăng nhập
 * app nhưng chỉ xem lịch chuyến của mình, không đụng nghiệp vụ CS.
 *
 * Lưu ý: một người CÓ THỂ vừa là cs vừa là ky_thuat. laChiKyThuat() mới là
 * điều kiện để ép về giao diện rút gọn (không có role CS/quản lý nào khác).
 */
export function laKyThuat(vaiTro: string | string[] | null | undefined): boolean {
  return chuanHoaVaiTro(vaiTro).includes('ky_thuat')
}

/** CHỈ là kỹ thuật — không kiêm admin/cs/cs_manager. Dùng để ép giao diện rút gọn. */
export function laChiKyThuat(vaiTro: string | string[] | null | undefined): boolean {
  const r = chuanHoaVaiTro(vaiTro)
  return r.includes('ky_thuat') && !r.some((x) => x === 'admin' || x === 'cs' || x === 'cs_manager')
}

export type YeuCauSua = {
  /** id nhân viên đang thực hiện thao tác */
  idNguoiSua: string
  /** id nhân viên bị sửa */
  idBiSua: string
  /** TẬP vai trò mới sẽ gán (nếu thao tác này đổi role) */
  vaiTroMoi?: VaiTro[]
  hoatDongMoi?: boolean
  /** TẬP vai trò hiện tại của người bị sửa */
  vaiTroHienTai: VaiTro[]
  /** số admin đang hoạt động TRƯỚC khi sửa */
  soAdminDangHoatDong: number
}

/**
 * Ba cái bẫy khoá chết hệ thống mà luật này chặn:
 *  1. Admin tự khoá chính mình -> mất đường vào ngay lập tức
 *  2. Admin tự bỏ quyền admin của mình -> không ai cấp lại quyền được
 *  3. Bỏ admin / khoá admin CUỐI CÙNG -> không còn ai quản trị, phải sửa tay dưới DB
 *
 * "Mất quyền admin" giờ tính theo TẬP: có vaiTroMoi mà mảng đó KHÔNG chứa 'admin'.
 * Đổi role khác (thêm cs_manager, bỏ sales…) mà VẪN còn 'admin' thì không đụng luật.
 */
export function kiemTraSuaNhanVien(y: YeuCauSua): { ok: true } | { ok: false; lyDo: string } {
  const tuMinh = y.idNguoiSua === y.idBiSua
  // Có đổi role, và role mới KHÔNG còn admin.
  const boQuyenAdmin = y.vaiTroMoi !== undefined && !y.vaiTroMoi.includes('admin')
  const dangLaAdmin = y.vaiTroHienTai.includes('admin')

  if (tuMinh && y.hoatDongMoi === false) {
    return { ok: false, lyDo: 'Không thể tự khoá tài khoản của chính mình.' }
  }
  if (tuMinh && dangLaAdmin && boQuyenAdmin) {
    return { ok: false, lyDo: 'Không thể tự bỏ quyền quản trị của chính mình — nhờ admin khác làm.' }
  }

  const matQuyenAdmin = dangLaAdmin && (boQuyenAdmin || y.hoatDongMoi === false)
  if (matQuyenAdmin && y.soAdminDangHoatDong <= 1) {
    return { ok: false, lyDo: 'Đây là admin cuối cùng — phải có ít nhất một admin hoạt động.' }
  }

  return { ok: true }
}
