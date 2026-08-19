/**
 * Logic thuần của khu Work — KHÔNG đụng DB, KHÔNG React, để test được bằng vitest.
 *
 * Chỗ dễ sai nhất là "hôm nay / tuần này": so sánh phải theo NGÀY ở múi giờ người
 * dùng, không phải theo mốc thời gian. Một việc hạn 23:00 hôm nay vẫn là "Hôm nay",
 * còn 00:30 ngày mai thì không. Vì vậy mọi so sánh đều quy về mốc 00:00 địa phương.
 */

export type NhomHan = 'qua_han' | 'hom_nay' | 'tuan_nay' | 'sap_toi' | 'khong_han'

export const NHAN_NHOM: Record<NhomHan, string> = {
  qua_han: 'Quá hạn',
  hom_nay: 'Hôm nay',
  tuan_nay: 'Tuần này',
  sap_toi: 'Sắp tới',
  khong_han: 'Không có hạn',
}

/** Thứ tự hiển thị — việc gấp nằm trên. */
export const THU_TU_NHOM: NhomHan[] = ['qua_han', 'hom_nay', 'tuan_nay', 'sap_toi', 'khong_han']

/** Mốc 00:00 địa phương của một ngày. */
function dauNgay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Số ngày lệch giữa hạn và hôm nay (âm = đã qua). */
export function soNgayToiHan(due: string | Date, bayGio: Date = new Date()): number {
  const d = typeof due === 'string' ? new Date(due) : due
  return Math.round((dauNgay(d) - dauNgay(bayGio)) / 86_400_000)
}

/**
 * Xếp một việc vào nhóm theo hạn.
 * "Tuần này" = trong 7 ngày tới kể từ mai (không gồm hôm nay, đã có nhóm riêng).
 */
export function nhomTheoHan(due: string | null | undefined, bayGio: Date = new Date()): NhomHan {
  if (!due) return 'khong_han'
  const n = soNgayToiHan(due, bayGio)
  if (n < 0) return 'qua_han'
  if (n === 0) return 'hom_nay'
  if (n <= 7) return 'tuan_nay'
  return 'sap_toi'
}

/**
 * "dd/mm" tự ghép, KHÔNG dùng toLocaleDateString: bản ICU của Node và của trình
 * duyệt cho ra dấu ngăn khác nhau ("05-10" vs "05/10") ⇒ server render một đằng,
 * client một nẻo, sinh lỗi hydration rất khó truy.
 */
export function ngayThang(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}`
}

/** Nhãn ngắn cạnh tên việc: "Quá hạn 3 ngày", "Hôm nay", "12/09"… */
export function nhanHan(due: string | null | undefined, bayGio: Date = new Date()): string {
  if (!due) return ''
  const n = soNgayToiHan(due, bayGio)
  const ngay = ngayThang(due)
  if (n < -1) return `Quá hạn ${Math.abs(n)} ngày`
  if (n === -1) return 'Quá hạn hôm qua'
  if (n === 0) return 'Hôm nay'
  if (n === 1) return 'Ngày mai'
  if (n <= 7) return `${n} ngày nữa`
  return ngay
}

/** Gom danh sách việc thành các nhóm theo hạn, giữ nguyên thứ tự trong từng nhóm. */
export function gomTheoHan<T extends { due_at: string | null }>(
  ds: readonly T[],
  bayGio: Date = new Date(),
): { nhom: NhomHan; nhan: string; viec: T[] }[] {
  const gio: Record<NhomHan, T[]> = {
    qua_han: [], hom_nay: [], tuan_nay: [], sap_toi: [], khong_han: [],
  }
  for (const v of ds) gio[nhomTheoHan(v.due_at, bayGio)].push(v)
  return THU_TU_NHOM
    .filter((k) => gio[k].length > 0)
    .map((k) => ({ nhom: k, nhan: NHAN_NHOM[k], viec: gio[k] }))
}

// ── Nhãn dùng chung ─────────────────────────────────────────────────────────
export const TRANG_THAI = [
  { v: 'todo', nhan: 'Cần làm' },
  { v: 'doing', nhan: 'Đang làm' },
  { v: 'blocked', nhan: 'Bị chặn' },
  { v: 'review', nhan: 'Chờ duyệt' },
  { v: 'done', nhan: 'Xong' },
] as const

export type TrangThai = (typeof TRANG_THAI)[number]['v']

export const NHAN_TRANG_THAI: Record<string, string> =
  Object.fromEntries(TRANG_THAI.map((s) => [s.v, s.nhan]))

export const VAI_TRO = [
  { v: 'owner', nhan: 'Phụ trách' },
  { v: 'doer', nhan: 'Cùng làm' },
  { v: 'reviewer', nhan: 'Nghiệm thu' },
  { v: 'watcher', nhan: 'Theo dõi' },
] as const

export const NHAN_VAI_TRO: Record<string, string> =
  Object.fromEntries(VAI_TRO.map((r) => [r.v, r.nhan]))

export const NHAN_UU_TIEN: Record<number, string> =
  { 1: 'P1 · Khẩn', 2: 'P2 · Cao', 3: 'P3 · Thường', 4: 'P4 · Thấp' }

export const MAU_UU_TIEN: Record<number, string> =
  { 1: 'bg-red-500', 2: 'bg-amber-500', 3: 'bg-indigo-500', 4: 'bg-slate-300' }

/** Chữ tắt cho avatar tròn: "Nguyễn Văn A" -> "NA". */
export function chuTat(ten: string | null | undefined): string {
  const tu = (ten ?? '').trim().split(/\s+/).filter(Boolean)
  if (tu.length === 0) return '?'
  if (tu.length === 1) return tu[0].slice(0, 2).toUpperCase()
  return (tu[0][0] + tu[tu.length - 1][0]).toUpperCase()
}

/**
 * Ô datetime-local -> ISO. Trình duyệt trả "2026-08-20T17:00" theo giờ ĐỊA PHƯƠNG;
 * new Date() hiểu đúng như vậy, nên chỉ cần đổi sang ISO.
 */
export function isoTuOInput(v: string): string | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** ISO -> giá trị cho ô datetime-local (giờ địa phương, không có 'Z'). */
export function inputTuIso(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Câu mô tả 1 dòng cho nhật ký. */
export function moTaNhatKy(verb: string, payload: Record<string, unknown> | null): string {
  const p = payload ?? {}
  switch (verb) {
    case 'created': return 'tạo việc'
    case 'status_changed': return `đổi trạng thái → ${NHAN_TRANG_THAI[String(p.status)] ?? p.status}`
    case 'assigned': return `gán ${p.ten ?? 'ai đó'} · ${NHAN_VAI_TRO[String(p.role)] ?? p.role}`
    case 'unassigned': return 'bỏ một người khỏi việc'
    case 'commented': return 'bình luận'
    case 'updated': {
      const phan: string[] = []
      if (p.title != null) phan.push('tiêu đề')
      if (p.priority != null) phan.push('ưu tiên')
      if (p.due_at != null) phan.push('hạn')
      if (p.team_id != null) phan.push('team')
      if (p.visibility != null) phan.push('phạm vi xem')
      return phan.length ? `sửa ${phan.join(', ')}` : 'sửa việc'
    }
    default: return verb
  }
}
