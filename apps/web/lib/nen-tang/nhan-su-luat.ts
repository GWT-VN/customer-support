/**
 * Hằng số + luật THUẦN của quản lý nhân sự — không đụng DB, test được.
 *
 * Tách khỏi nhan-su.ts vì file đó có 'use server', mà file 'use server' chỉ được
 * export hàm async.
 */
import {
  apDungLoaiTruCapBac, chuanHoaVaiTro, laVaiTroHopLe, type VaiTro,
} from './vai-tro'
import { chuanHoaEmail } from './vao-cua'

export const KHONG_DU_QUYEN = 'Chỉ quản trị mới làm được việc này.'

export type Staff = { id: string; ten: string; vai_tro: VaiTro[]; email: string | null }

/** Chuẩn hoá 1 dòng staff thô về Staff — vai_tro coerce về MẢNG (đọc cả chuỗi cũ lẫn text[] mới). */
export function toStaff(r: { id: string; ten: string; vai_tro: unknown; email: string | null }): Staff {
  return { id: r.id, ten: r.ten, email: r.email, vai_tro: chuanHoaVaiTro(r.vai_tro as string | string[] | null) }
}

/**
 * Chuẩn hoá TẬP vai trò TRƯỚC KHI GHI.
 *
 * Ba việc: chặn vai trò lạ (client gửi gì cũng không tin), khử trùng lặp, và áp
 * luật loại trừ cấp bậc trong cùng bộ phận. `undefined` = thao tác này không đổi
 * vai trò (ví dụ chỉ bật/tắt hoạt động).
 *
 * Chỉ áp lúc GHI. Lúc ĐỌC vẫn trung thực với DB — hiện còn 2 người giữ cả cs lẫn
 * cs_manager từ trước, họ sẽ tự được dọn ở lần admin bấm lưu kế tiếp.
 */
export function chuanBiVaiTroDeGhi(
  vaiTro: string[] | undefined
): { ok: true; vaiTro: VaiTro[] | undefined } | { ok: false; lyDo: string } {
  if (vaiTro === undefined) return { ok: true, vaiTro: undefined }
  if (!vaiTro.every(laVaiTroHopLe)) return { ok: false, lyDo: 'Vai trò không hợp lệ.' }
  return { ok: true, vaiTro: apDungLoaiTruCapBac(chuanHoaVaiTro(vaiTro)) }
}

/**
 * Luật lời mời — hàm THUẦN, test được.
 *
 * Vì sao chặn mời thẳng vào 'admin': lời mời là đường DUY NHẤT đưa email ngoài
 * @gwt.vn vào hệ thống. Gõ nhầm một ký tự mà lại kèm quyền quản trị thì người lạ
 * cầm chìa khoá. Mời trước (quyền thấp), admin gán quyền sau ở bảng bên dưới.
 */
export function kiemTraLoiMoi(
  email: string,
  vaiTro: string[]
): { ok: true; email: string; vaiTro: VaiTro[] } | { ok: false; lyDo: string } {
  const e = chuanHoaEmail(email)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(e)) return { ok: false, lyDo: 'Email không hợp lệ.' }
  if (vaiTro.length === 0) return { ok: false, lyDo: 'Phải chọn ít nhất một vai trò.' }
  if (vaiTro.includes('admin')) {
    return { ok: false, lyDo: 'Không mời thẳng vào quyền quản trị. Mời trước, gán quyền sau.' }
  }
  const kq = chuanBiVaiTroDeGhi(vaiTro)
  if (!kq.ok) return { ok: false, lyDo: kq.lyDo }
  return { ok: true, email: e, vaiTro: kq.vaiTro ?? [] }
}
