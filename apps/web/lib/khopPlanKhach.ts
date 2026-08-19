/**
 * Đọc manh mối khách từ TÊN THƯ MỤC của plan bảo trì nhập từ Asana.
 *
 * Vì sao cần: plan nhập từ Asana phần lớn KHÔNG có SĐT (chỉ 25/48 có), mà gợi ý
 * khách cũ chỉ dò theo SĐT nên 23 plan không có gợi ý nào — CS phải mò tay trong
 * hơn 400 khách. Nhưng chính cái tên đã chứa sẵn thông tin để khớp, ví dụ
 * "Anh Ng_30A_Hà Tĩnh_Lắp 23/08/2025" -> tỉnh Hà Tĩnh, bộ WH30A, lắp 23/08/2025.
 *
 * Nguyên tắc: KHÔNG đoán bừa. Không chắc thì trả null để phần chấm điểm bỏ qua
 * tiêu chí đó, thà không gợi ý còn hơn gợi ý sai rồi CS gán nhầm khách.
 */
import { boDau } from '../bang/timkiem'
import { TINH_VN } from './tinh'

export type ManhMoiPlan = { tinh: string | null; boMay: string | null; ngayLap: string | null }

/** Tỉnh dài đứng trước để "Hà Nội" không nuốt mất "Hà Nam"… khi so chuỗi con. */
const TINH_THEO_DO_DAI = [...TINH_VN].sort((a, b) => boDau(b).length - boDau(a).length)

function docTinh(s: string): string | null {
  for (const t of TINH_THEO_DO_DAI) if (s.includes(boDau(t))) return t
  return null
}

/** WH15A/WH30A, viết tắt 15A/30A, có thể kèm ECO (liền hoặc cách). */
function docBoMay(s: string): string | null {
  const m = /(?:wh)?\s*(15a|30a)\s*(eco)?/.exec(s)
  if (!m) return null
  return `WH${m[1].toUpperCase()}${m[2] ? ' ECO' : ''}`
}

/** d/m/yyyy hoặc d-m-yyyy. Ngày vô lý -> null (không sinh ngày sai). */
function docNgay(s: string): string | null {
  const m = /(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(s)
  if (!m) return null
  const d = +m[1], mo = +m[2], y = +m[3]
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return dt.toISOString().slice(0, 10)
}

export function docTenPlan(ten: string | null | undefined): ManhMoiPlan {
  const raw = (ten ?? '').trim()
  if (!raw) return { tinh: null, boMay: null, ngayLap: null }
  const s = boDau(raw)
  return { tinh: docTinh(s), boMay: docBoMay(s), ngayLap: docNgay(raw) }
}
