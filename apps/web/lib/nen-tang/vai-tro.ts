/**
 * Vai trò toàn công ty và luật sửa nhân viên — HÀM THUẦN, không đụng DB.
 *
 * Đây là chỗ DUY NHẤT quyết định ai làm được gì. Sai một luật là mở toang dữ
 * liệu khách hoặc khoá chết cả hệ thống. Mọi module (CS, Sales, Work…) dùng
 * chung file này.
 *
 * `vai_tro` là TẬP vai trò (mảng) — công ty nhỏ, một người kiêm nhiều mảng.
 * Loại trừ chỉ áp TRONG cùng bộ phận (xem apDungLoaiTruCapBac).
 *
 * Spec: docs/superpowers/specs/2026-08-20-nen-tang-tai-khoan-phan-quyen-design.md
 */

export const VAI_TRO = [
  'ceo', 'admin',
  'kt_giam_doc', 'ky_thuat', 'ctv_lap_dat',
  'cs_manager', 'cs',
  'sales_manager', 'sales',
  'marketing', 'kho', 'ke_toan', 'tai_chinh',
] as const
export type VaiTro = (typeof VAI_TRO)[number]

export type BoPhan =
  | 'dieu_hanh' | 'he_thong' | 'ky_thuat' | 'cs' | 'sales'
  | 'marketing' | 'kho' | 'ke_toan' | 'tai_chinh'

export const NHAN_BO_PHAN: Record<BoPhan, string> = {
  dieu_hanh: 'Điều hành',
  he_thong: 'Hệ thống',
  ky_thuat: 'Kỹ thuật',
  cs: 'CSKH',
  sales: 'Sales',
  marketing: 'Marketing',
  kho: 'Kho',
  ke_toan: 'Kế toán',
  tai_chinh: 'Tài chính',
}

/**
 * Hồ sơ từng vai trò.
 *
 * `capBac` càng lớn càng cao, và CHỈ so sánh trong cùng `boPhan`. Bộ phận chỉ
 * có một vai trò thì để 0 — không có gì để loại trừ.
 */
export const HO_SO_VAI_TRO: Record<VaiTro, { boPhan: BoPhan; capBac: number; nhan: string }> = {
  ceo: { boPhan: 'dieu_hanh', capBac: 0, nhan: 'CEO' },
  admin: { boPhan: 'he_thong', capBac: 0, nhan: 'Quản trị hệ thống' },
  kt_giam_doc: { boPhan: 'ky_thuat', capBac: 2, nhan: 'Giám đốc Kỹ thuật' },
  ky_thuat: { boPhan: 'ky_thuat', capBac: 1, nhan: 'Nhân viên Kỹ thuật' },
  ctv_lap_dat: { boPhan: 'ky_thuat', capBac: 0, nhan: 'CTV lắp đặt' },
  cs_manager: { boPhan: 'cs', capBac: 2, nhan: 'Trưởng CSKH' },
  cs: { boPhan: 'cs', capBac: 1, nhan: 'Nhân viên CSKH' },
  sales_manager: { boPhan: 'sales', capBac: 2, nhan: 'Trưởng Sales' },
  sales: { boPhan: 'sales', capBac: 1, nhan: 'Nhân viên Sales' },
  marketing: { boPhan: 'marketing', capBac: 0, nhan: 'Marketing' },
  kho: { boPhan: 'kho', capBac: 0, nhan: 'Kho' },
  ke_toan: { boPhan: 'ke_toan', capBac: 0, nhan: 'Kế toán' },
  tai_chinh: { boPhan: 'tai_chinh', capBac: 0, nhan: 'Tài chính' },
}

/** Nhãn tiếng Việt — sinh từ HO_SO_VAI_TRO để không bao giờ lệch nhau. */
export const NHAN_VAI_TRO: Record<VaiTro, string> = Object.fromEntries(
  VAI_TRO.map((v) => [v, HO_SO_VAI_TRO[v].nhan])
) as Record<VaiTro, string>

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
 *
 * KHÔNG áp loại trừ cấp bậc ở đây: đọc dữ liệu cũ phải trung thực, loại trừ chỉ
 * áp lúc GHI (xem apDungLoaiTruCapBac).
 */
export function chuanHoaVaiTro(v: string | string[] | null | undefined): VaiTro[] {
  const raw = v == null ? [] : Array.isArray(v) ? v : [v]
  const hopLe = raw.filter((x): x is VaiTro => typeof x === 'string' && laVaiTroHopLe(x))
  return [...new Set(hopLe)]
}

/**
 * Luật CEO chốt: trong CÙNG một bộ phận, cấp bậc loại trừ nhau — không thể vừa
 * là trưởng vừa là nhân viên của đúng mảng đó. Khác bộ phận thì kiêm thoải mái
 * (cs + sales, cs_manager + sales_manager, cs + sales_manager… đều hợp lệ).
 *
 * Cách xử lý: mỗi bộ phận chỉ giữ vai trò có capBac CAO NHẤT. Bỏ vai trò cấp
 * dưới không mất quyền nào — cấp trên đã bao trùm (cs_manager qua được mọi chỗ
 * cs qua được).
 *
 * Chỉ gọi lúc GHI (admin bấm lưu / mời người mới), KHÔNG gọi lúc đọc: dữ liệu cũ
 * còn 2 người giữ cả cs lẫn cs_manager, đọc phải ra đúng cái đang có trong DB.
 */
export function apDungLoaiTruCapBac(vaiTro: VaiTro[]): VaiTro[] {
  const caoNhat = new Map<BoPhan, VaiTro>()
  for (const v of vaiTro) {
    const { boPhan, capBac } = HO_SO_VAI_TRO[v]
    const dangGiu = caoNhat.get(boPhan)
    if (!dangGiu || capBac > HO_SO_VAI_TRO[dangGiu].capBac) caoNhat.set(boPhan, v)
  }
  const giu = new Set(caoNhat.values())
  // Trả theo thứ tự khai báo VAI_TRO để kết quả ổn định, không phụ thuộc thứ tự tick.
  return VAI_TRO.filter((v) => giu.has(v))
}

/** Có quyền admin không. Nhận chuỗi cũ HOẶC mảng mới (đọc được cả 2 thời kỳ schema). */
export function laQuyenAdmin(vaiTro: string | string[] | null | undefined): boolean {
  return chuanHoaVaiTro(vaiTro).includes('admin')
}

/**
 * Cấp QUẢN LÝ CS = admin HOẶC cs_manager. Là mức được:
 *  - DUYỆT: serial pending · yêu cầu sửa · export · khách chờ.
 *  - Nghiệp vụ CS NÂNG CAO: ghi chi phí/mục ticket · lắp/thu hồi/đổi máy · kho serial ·
 *    nhóm lỗi · xuất báo cáo · cập nhật hàng loạt · lưu view chung · trạng thái máy.
 *
 * KHÔNG gồm (vẫn CHỈ admin): quản lý nhân viên · đồng bộ catalog · nhật ký thao tác ·
 * XOÁ thông tin khách (xoá khách / duyệt yêu cầu xoá khách / xoá hàng loạt khách).
 * KHÔNG gồm sales/sales_manager — app này là nghiệp vụ CS.
 *
 * GĐ1 cố tình GIỮ NGUYÊN: 7 vai trò mới chưa có quyền gì cho tới bước ma trận.
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
 *
 * Luật này KHÔNG BAO GIỜ đi qua ma trận phân quyền (GĐ3) — tick nhầm một ô không
 * được phép khoá chết hệ thống.
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
