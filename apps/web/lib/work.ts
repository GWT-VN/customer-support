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

/**
 * Mốc thời gian cho nhật ký / bình luận: "14:32 hôm nay", "09:10 hôm qua",
 * "20/08 09:10". Tự ghép, KHÔNG dùng toLocaleString — bản ICU của Node và của
 * trình duyệt cho ra chuỗi khác nhau, gây lỗi hydration (đã dính một lần).
 */
export function mocThoiGian(iso: string | null | undefined, bayGio: Date = new Date()): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  const gio = `${p(d.getHours())}:${p(d.getMinutes())}`
  const n = soNgayToiHan(d, bayGio)
  if (n === 0) return `${gio} hôm nay`
  if (n === -1) return `${gio} hôm qua`
  if (n === 1) return `${gio} ngày mai`
  return `${ngayThang(d)} ${gio}`
}

const LA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Câu mô tả 1 dòng cho nhật ký. */
export function moTaNhatKy(verb: string, payload: Record<string, unknown> | null): string {
  const p = payload ?? {}
  switch (verb) {
    case 'created': return 'tạo việc'
    case 'auto_created': return 'việc được sinh tự động từ ERP'
    case 'status_changed': return `đổi trạng thái → ${NHAN_TRANG_THAI[String(p.status)] ?? p.status}`
    case 'assigned': return `gán ${p.ten ?? 'ai đó'} · ${NHAN_VAI_TRO[String(p.role)] ?? p.role}`
    case 'unassigned': return 'bỏ một người khỏi việc'
    case 'commented': return 'bình luận'
    case 'mentioned': {
      const ten = Array.isArray(p.ten) ? p.ten.filter(Boolean) : []
      return `nhắc ${ten.length ? ten.join(', ') : 'ai đó'} trong bình luận`
    }
    case 'linked':
    case 'unlinked': {
      const dau = verb === 'linked' ? 'gắn' : 'bỏ gắn'
      const ten = NHAN_LOAI_LINK[String(p.loai) as LoaiLink] ?? String(p.loai ?? '')
      const ma = String(p.ma ?? '')
      // Khách chưa có mã thì `ma` là uuid — in ra nhật ký chỉ tổ rối mắt.
      return LA_UUID.test(ma) ? `${dau} ${ten}`.trim() : `${dau} ${ten} ${ma}`.trim()
    }
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

// ── Chip gắn khách / ticket / đơn ──────────────────────────────────────────

export type LoaiLink = 'khach' | 'ticket' | 'don'

export const NHAN_LOAI_LINK: Record<LoaiLink, string> = {
  khach: 'Khách',
  ticket: 'Ticket',
  don: 'Đơn',
}

/**
 * Một liên kết ERP đã được SQL resolve sẵn nhãn.
 * `dich` nói mã khách còn sống ở bảng nào — SQL biết, giao diện thì không.
 */
export type LienKet = {
  id: number
  loai: LoaiLink
  ma: string
  /** Tên đọc từ bản ghi ĐANG SỐNG. null = mã không còn ở bảng nào. */
  nhan: string | null
  /** Tên chụp lại lúc gắn — phao cứu sinh khi mã bị khai tử sau đó. */
  nhan_luc_gan?: string | null
  phu?: string | null
  dich?: 'sales' | 'cs' | null
  khach_id?: string | null
}

/**
 * Tên hiển thị của chip, và nó có đang treo không.
 *
 * Vì sao cần: mã khách bị khai tử ÂM THẦM. Gộp khách chạy trong Google Sheet
 * (dựng lại DM_KHACH gộp hai dòng cùng SĐT, mã thua bị bỏ) — không ai bấm nút
 * xoá, không có nhật ký, không phiên nào báo. Nếu chip chỉ đọc bản ghi đang sống
 * thì hôm sau nó thành ô trống và mất luôn dấu vết việc này từng của ai.
 *
 * Phiên Sales đã xác nhận mã KHÔNG BAO GIỜ bị dùng lại (nextSeq = maxSeq + 1),
 * nên trường hợp xấu nhất là chip treo — không bao giờ là chip trỏ nhầm người.
 */
export function nhanChip(l: Pick<LienKet, 'ma' | 'nhan' | 'nhan_luc_gan'>): {
  ten: string
  treo: boolean
  giaiThich: string | null
} {
  if (l.nhan) return { ten: l.nhan, treo: false, giaiThich: null }
  return {
    ten: l.nhan_luc_gan || l.ma,
    treo: true,
    giaiThich: `Mã ${l.ma} không còn trong hệ thống (bị gộp hoặc xoá)`,
  }
}

/**
 * Chip bấm sang đâu. Route là chuyện của frontend nên tính ở đây, không bắt SQL
 * phải biết đường dẫn Next.js.
 *
 * Khách có HAI đường vì hai khu giữ khách ở hai bảng: `/sales/khach/[code]` đi
 * theo mã, còn `/khach/[id]` đi theo uuid. Đưa nhầm mã vào đường sau là 404.
 * Mã không còn ở bảng nào (khách bị gộp/xoá) thì trả null — chip vẫn hiện để
 * không mất dấu, chỉ là không bấm được.
 */
export function duongDanLink(
  l: Pick<LienKet, 'loai' | 'ma' | 'dich' | 'khach_id'>,
): string | null {
  if (l.loai === 'ticket') return `/ticket/${l.ma}`
  if (l.loai === 'don') return `/sales/don/${l.ma}`
  if (l.dich === 'sales') return `/sales/khach/${l.ma}`
  if (l.dich === 'cs' && l.khach_id) return `/khach/${l.khach_id}`
  return null
}

/** Dòng việc chỉ đủ chỗ vài chip; phần còn lại gộp thành "+n". */
export function catChip<T>(ds: readonly T[], toiDa = 2): { hien: T[]; du: number } {
  return { hien: ds.slice(0, toiDa), du: Math.max(0, ds.length - toiDa) }
}

/**
 * Vị trí mới cho thẻ vừa thả vào cột kanban.
 *
 * `work.task.sort_order` là `double precision`, cố ý: chèn bằng TRUNG ĐIỂM thì
 * luôn còn chỗ giữa hai số, không phải đánh số lại cả cột mỗi lần kéo. Đánh số
 * lại là ghi hàng chục dòng cho một thao tác kéo, và hai người kéo cùng lúc là
 * đè nhau.
 *
 * `truoc` = sort_order của thẻ ngay TRÊN chỗ thả, `sau` = thẻ ngay DƯỚI.
 * Thiếu bên nào nghĩa là thả sát đầu hoặc sát cuối cột.
 */
export function thuTuMoi(truoc?: number, sau?: number): number {
  if (truoc == null && sau == null) return 0
  if (truoc == null) return sau! - 1
  if (sau == null) return truoc + 1
  // Trùng số (data cũ đều bằng 0) thì không có khe để chèn — lùi xuống dưới
  // `truoc` một chút, thứ tự cuối cùng vẫn ổn định vì còn tiêu chí phụ là id.
  if (sau <= truoc) return truoc - 0.5
  return (truoc + sau) / 2
}

// ── Nhắc người trong bình luận (@tên) ──────────────────────────────────────

/**
 * Người dùng có đang gõ `@ai` ngay trước con trỏ không.
 *
 * Trả `null` nghĩa là không phải đang nhắc ai — đừng mở danh sách gợi ý. Ba ca
 * phải loại, nếu không danh sách bật lên loạn xạ giữa lúc gõ:
 *  · `@` nằm SAU con trỏ (người dùng quay lại sửa chỗ khác)
 *  · đã có khoảng trắng giữa `@` và con trỏ (tên đã chọn xong)
 *  · `@` dính vào chữ phía trước — đó là email, không phải nhắc người
 */
export function tokenNhac(body: string, caret: number): { tuKhoa: string; batDau: number } | null {
  const truoc = body.slice(0, caret)
  const at = truoc.lastIndexOf('@')
  if (at < 0) return null
  if (at > 0 && !/\s/.test(truoc[at - 1])) return null   // ai@gwt.vn
  const tuKhoa = truoc.slice(at + 1)
  if (/\s/.test(tuKhoa)) return null
  return { tuKhoa, batDau: at }
}

/**
 * Thay đoạn `@dangGo` bằng `@Tên ` và trả vị trí con trỏ mới.
 *
 * Không thêm dấu cách nếu ngay sau con trỏ đã có sẵn một cái — chèn giữa câu mà
 * thêm nữa là ra hai dấu cách, người dùng phải tự đi xoá.
 */
export function chenNhac(
  body: string, batDau: number, caret: number, ten: string,
): { body: string; caret: number } {
  const con = body.slice(caret)
  const themCach = !/^\s/.test(con)
  const moi = `${body.slice(0, batDau)}@${ten}${themCach ? ' ' : ''}${con}`
  return { body: moi, caret: batDau + ten.length + 2 }
}

/**
 * Cắt câu bình luận thành các mảnh để tô đậm tên được nhắc.
 *
 * CHỈ tô tên có trong `daNhac` (lấy từ `work.comment.mentions`), không tô mọi
 * chuỗi bắt đầu bằng `@`. Tô theo dấu `@` thì một câu nhắc email hay giá "@50k"
 * cũng sáng lên như người thật.
 *
 * Tên DÀI khớp trước: "Dev" và "Dev Admin" cùng có thì "@Dev Admin" phải ăn trọn,
 * không phải tô "@Dev" rồi bỏ lại chữ "Admin".
 */
export function chiaTheoNhac(
  body: string, daNhac: readonly string[],
): { text: string; nhac: boolean }[] {
  const ten = [...daNhac].filter(Boolean).sort((a, b) => b.length - a.length)
  if (ten.length === 0) return [{ text: body, nhac: false }]

  const ra: { text: string; nhac: boolean }[] = []
  let i = 0, dem = ''
  while (i < body.length) {
    const khop = body[i] === '@' ? ten.find((t) => body.startsWith(`@${t}`, i)) : undefined
    if (khop) {
      if (dem) { ra.push({ text: dem, nhac: false }); dem = '' }
      ra.push({ text: `@${khop}`, nhac: true })
      i += khop.length + 1
    } else {
      dem += body[i]; i++
    }
  }
  if (dem) ra.push({ text: dem, nhac: false })
  return ra
}
