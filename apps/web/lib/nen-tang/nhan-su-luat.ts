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

/* ─────────────────────────── XOÁ NHÂN SỰ ─────────────────────────── */

/**
 * Một chỗ trong DB còn trỏ vào staff.id — đọc từ hàm nen_tang_dem_tham_chieu_staff.
 * `bang` là tên đầy đủ kể cả schema, ví dụ 'work.task'.
 */
export type ThamChieuStaff = { bang: string; cot: string; so_dong: number }

/**
 * Bảng chỉ chứa LOG / thông báo / cấu hình cá nhân — xoá kèm cũng không mất dữ
 * liệu nghiệp vụ nào, nên KHÔNG được chặn nút xoá.
 *
 * Không có danh sách này thì nút xoá gần như vô dụng: chỉ cần người bị mời nhầm
 * mở app đúng một lần là nhat_ky_lech_quyen có dòng, và admin không hiểu vì sao
 * "người chưa làm gì" lại bị báo là đã có dữ liệu.
 */
const BANG_BO_QUA = new Set([
  'nhat_ky_lech_quyen',   // nhật ký lệch quyền — dữ liệu đo đạc, không phải việc
  'work.notification',    // thông báo chưa đọc
  'work.staff_channel',   // kênh nhận thông báo của chính họ
])

/** Tên bảng thô -> tiếng Việt, để câu từ chối đọc được. Thiếu thì dùng tên thô. */
const NHAN_BANG: Record<string, string> = {
  tickets: 'ticket',
  'work.task': 'việc đã tạo',
  'work.task_assignee': 'việc được giao',
  'work.comment': 'bình luận trong việc',
  'work.activity': 'dòng nhật ký việc',
  'work.attachment': 'tệp đính kèm',
  'work.project': 'dự án phụ trách',
  'work.auto_rule': 'luật tự sinh việc',
  'work.team_member': 'chân thành viên nhóm',
}

/**
 * Những tham chiếu THỰC SỰ chặn xoá, gộp theo bảng.
 *
 * Gộp vì một bảng có thể trỏ vào staff bằng nhiều cột (tickets có cả cs_phu_trach
 * lẫn ky_thuat) — admin không cần biết tên cột, chỉ cần biết "còn 3 ticket".
 */
export function locThamChieuChan(ds: ThamChieuStaff[]): { bang: string; so_dong: number }[] {
  const gop = new Map<string, number>()
  for (const t of ds) {
    if (BANG_BO_QUA.has(t.bang) || t.so_dong <= 0) continue
    gop.set(t.bang, (gop.get(t.bang) ?? 0) + t.so_dong)
  }
  return [...gop.entries()].map(([bang, so_dong]) => ({ bang, so_dong }))
}

/** "3 ticket, 2 việc được giao" — phần đuôi của câu từ chối. */
export function moTaThamChieu(ds: { bang: string; so_dong: number }[]): string {
  return ds.map((t) => `${t.so_dong} ${NHAN_BANG[t.bang] ?? t.bang}`).join(', ')
}

/**
 * Luật xoá hẳn một nhân sự — hàm THUẦN, test được.
 *
 * Xoá chỉ dành cho ĐÚNG một ca: mời nhầm email, người đó chưa làm gì. Mọi ca
 * khác phải KHOÁ, vì staff.id bị 12 bảng khác trỏ vào và 5 khoá ngoại là CASCADE
 * — xoá thẳng là âm thầm cuốn theo phân công việc mà không ai biết.
 */
export function kiemTraXoaNhanSu(p: {
  idNguoiXoa: string
  idBiXoa: string
  vaiTroBiXoa: VaiTro[]
  thamChieu: ThamChieuStaff[]
}): { ok: true } | { ok: false; lyDo: string } {
  if (p.idNguoiXoa === p.idBiXoa) {
    return { ok: false, lyDo: 'Không tự xoá tài khoản của chính mình.' }
  }
  if (p.vaiTroBiXoa.includes('admin')) {
    return {
      ok: false,
      lyDo: 'Người này còn vai trò Quản trị toàn quyền. Bỏ vai trò đó trước rồi mới xoá được.',
    }
  }
  const chan = locThamChieuChan(p.thamChieu)
  if (chan.length > 0) {
    return {
      ok: false,
      lyDo: `Không xoá được: người này đã có ${moTaThamChieu(chan)} trong hệ thống. `
        + 'Xoá là mất luôn những thứ đó. Người nghỉ việc thì bấm KHOÁ.',
    }
  }
  return { ok: true }
}

/* ─────────────────────── MẬT KHẨU BAN ĐẦU ─────────────────────── */

/**
 * Bảng chữ cái CỐ TÌNH bỏ 0/o/1/l/i — admin phải đọc mật khẩu này cho người khác
 * qua Zalo hoặc điện thoại, nhầm một ký tự là gọi lại hỏi.
 */
const CHU_CAI = 'abcdefghjkmnpqrstuvwxyz23456789'

/**
 * Mật khẩu ban đầu cho người vừa được mời — dạng `Gwt-a7kd-9m2p-x4qr`.
 *
 * Chia nhóm 4 để đọc/gõ được. Đây là mật khẩu DÙNG MỘT LẦN: hệ thống bắt đổi
 * ngay lần đăng nhập đầu, nên admin chỉ biết nó trong khoảng thời gian đó.
 */
export function sinhMatKhauBanDau(): string {
  const bytes = new Uint32Array(12)
  crypto.getRandomValues(bytes)
  const kytu = [...bytes].map((n) => CHU_CAI[n % CHU_CAI.length])
  return `Gwt-${kytu.slice(0, 4).join('')}-${kytu.slice(4, 8).join('')}-${kytu.slice(8, 12).join('')}`
}
