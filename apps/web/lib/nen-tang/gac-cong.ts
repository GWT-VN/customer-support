import { redirect } from 'next/navigation'
import { layNhanVien } from './phien'
import { VAI_TRO_VAO_APP } from './vao-cua'
import { coQuyenQuanLy, laChiKyThuat, laQuyenAdmin } from './vai-tro'

/** Người đang đăng nhập có vào được KHU CS không (admin|cs|cs_manager|ky_thuat). */
export async function coTheVaoCS(): Promise<boolean> {
  const nv = await layNhanVien()
  if (!nv) return false
  return nv.vai_tro.some((r) => (VAI_TRO_VAO_APP as readonly string[]).includes(r))
}

/** Người đang đăng nhập có vào được KHU SALES không (admin|sales|sales_manager). */
export async function coTheVaoSales(): Promise<boolean> {
  const nv = await layNhanVien()
  if (!nv) return false
  return nv.vai_tro.some((r) => ['admin', 'sales', 'sales_manager'].includes(r))
}

/** Dùng cho cả chặn ở server LẪN ẩn nút trên giao diện. */
export async function laAdmin(): Promise<boolean> {
  return laQuyenAdmin((await layNhanVien())?.vai_tro)
}

/**
 * Cấp QUẢN LÝ CS = admin HOẶC cs_manager. Được duyệt + nghiệp vụ CS nâng cao.
 * Xem lib/nen-tang/vai-tro.ts:coQuyenQuanLy để biết ranh giới (XOÁ khách/nhân sự/catalog vẫn CHỈ admin).
 */
export async function laQuanLy(): Promise<boolean> {
  return coQuyenQuanLy((await layNhanVien())?.vai_tro)
}

/**
 * CHỈ là kỹ thuật (không kiêm CS/admin) — dùng để ép giao diện rút gọn: chỉ thấy
 * lịch chuyến của mình, ẩn mọi menu CS. Người kiêm cả CS lẫn kỹ thuật vẫn dùng
 * app đầy đủ như CS.
 */
export async function laChiKyThuatVien(): Promise<boolean> {
  return laChiKyThuat((await layNhanVien())?.vai_tro)
}

/**
 * Chặn TRANG chỉ dành cho admin.
 *
 * Ẩn nút trên giao diện KHÔNG phải phân quyền — ai biết đường dẫn vẫn mở được.
 * Rào thật nằm ở đây và ở từng Server Action nhạy cảm.
 */
export async function chanNeuKhongPhaiAdmin() {
  if (!(await laAdmin())) redirect('/?loi=khong_du_quyen')
}

/** Chặn TRANG dành cho cấp quản lý (admin hoặc cs_manager). */
export async function chanNeuKhongPhaiQuanLy() {
  if (!(await laQuanLy())) redirect('/?loi=khong_du_quyen')
}
