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

/** Sắp xếp tỉnh theo độ dài giảm (boDau) để khớp từ dài nhất trước.
 *  Điều này đảm bảo tính chính xác khi tìm tỉnh, đặc biệt khi danh sách có tên lồng nhau.
 */
const TINH_THEO_DO_DAI = [...TINH_VN].sort((a, b) => boDau(b).length - boDau(a).length)

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function docTinh(s: string): string | null {
  for (const t of TINH_THEO_DO_DAI) {
    // Tìm tên tỉnh với word boundary (không phải substring của từ khác).
    const pattern = new RegExp(`(?<![a-z0-9])${escapeRegex(boDau(t))}(?![a-z0-9])`, 'i')
    if (pattern.test(s)) return t
  }
  return null
}

/** WH15A/WH30A, viết tắt 15A/30A, có thể kèm ECO (liền hoặc cách).
 *  Word boundary: không phải substring của từ khác (phòng nhầm số nhà 115A, 215A).
 */
function docBoMay(s: string): string | null {
  const m = /(?<![a-z0-9])(?:wh)?\s*(15a|30a)(?:\s*eco)?(?![a-z0-9])/i.exec(s)
  if (!m) return null
  const hasEco = /eco/i.test(m[0])
  return `WH${m[1].toUpperCase()}${hasEco ? ' ECO' : ''}`
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

export type KhachUngVien = {
  id: string; ten: string; sdt: string | null
  tinh: string | null
  /** Ngày lắp SỚM NHẤT trong installed_base của khách — mốc so với ngày trong tên plan. */
  ngayLapSomNhat: string | null
}
export type PlanCanKhop = { source_customer_name: string | null; source_phone: string | null; bo_may: string | null }
export type GoiYKhach = { id: string; ten: string; sdt: string | null; diem: number; lyDo: string[] }

/** 9 số cuối để so SĐT (bỏ mã vùng/số 0 đầu, mọi ký tự không phải số). */
export function sdtChuan(s: string | null | undefined): string {
  const d = (s ?? '').replace(/\D/g, '')
  return d.length >= 9 ? d.slice(-9) : d
}

const LECH_NGAY_TOI_DA = 30          // quá 30 ngày thì coi như không liên quan
const NGAY_RAT_GAN = 7               // trong 7 ngày thì gần như chắc chắn

function soNgayLech(a: string, b: string): number {
  return Math.round(Math.abs(Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000)
}

/**
 * Xếp hạng khách khớp với 1 plan chưa map.
 *
 * Thang điểm: SĐT trùng (100) áp đảo mọi thứ vì đó là bằng chứng cứng. Còn lại
 * cộng dồn tỉnh (20) + ngày lắp gần (40 nếu ≤7 ngày, 25 nếu ≤30 ngày). KHÔNG
 * chấm theo tên vì tên plan là chuỗi thư mục ("Anh Ng") trùng với hàng chục khách.
 * Điểm 0 thì không trả về — thà không gợi ý còn hơn để CS gán nhầm khách.
 */
export function xepGoiY(plan: PlanCanKhop, dsKhach: KhachUngVien[], toiDa = 3): GoiYKhach[] {
  const manhMoi = docTenPlan(plan.source_customer_name)
  const sdtPlan = sdtChuan(plan.source_phone)
  const out: GoiYKhach[] = []

  for (const k of dsKhach) {
    let diem = 0
    const lyDo: string[] = []

    // SĐT chỉ được tính là bằng chứng cứng nếu nó đủ dài (≥9 chữ số).
    // Nếu SĐT < 9 chữ số, coi như nó không hợp lệ (dữ liệu tạm hoặc bẩn) → không so khớp.
    if (sdtPlan && sdtPlan.length >= 9 && sdtChuan(k.sdt) === sdtPlan) { diem += 100; lyDo.push('trùng SĐT') }
    if (manhMoi.tinh && k.tinh && boDau(k.tinh) === boDau(manhMoi.tinh)) {
      diem += 20; lyDo.push(`cùng tỉnh ${manhMoi.tinh}`)
    }
    if (manhMoi.ngayLap && k.ngayLapSomNhat) {
      const lech = soNgayLech(manhMoi.ngayLap, k.ngayLapSomNhat)
      if (lech <= NGAY_RAT_GAN) { diem += 40; lyDo.push(`ngày lắp lệch ${lech} ngày`) }
      else if (lech <= LECH_NGAY_TOI_DA) { diem += 25; lyDo.push(`ngày lắp lệch ${lech} ngày`) }
    }

    if (diem > 0) out.push({ id: k.id, ten: k.ten, sdt: k.sdt, diem, lyDo })
  }

  return out.sort((a, b) => b.diem - a.diem || a.ten.localeCompare(b.ten, 'vi')).slice(0, toiDa)
}

/**
 * Ngưỡng phân biệt "gợi ý đáng tin" và "gợi ý yếu". Điểm sàn không-0 hiện có
 * là 20 (chỉ cùng tỉnh) hoặc 25 (chỉ ngày lắp lệch 8-30 ngày) — MỘT tín hiệu
 * mềm duy nhất, giữa hàng chục khách cùng tỉnh thì độ tin cậy thật sự rất thấp.
 * UI trước đây vẽ mọi gợi ý (kể cả loại này) giống hệt gợi ý trùng SĐT (100
 * điểm) -> CS dễ tưởng "chắc chắn" rồi gán nhầm, phá đúng nguyên tắc "KHÔNG
 * đoán bừa" mà module này theo đuổi.
 *
 * Chọn mốc 40 = đúng điểm sàn của "ngày lắp lệch ≤7 ngày" (tín hiệu mạnh nhất
 * sau trùng SĐT) -> mọi tổ hợp từ 2 tín hiệu trở lên (vd tỉnh 20 + ngày xa 25
 * = 45) cũng rơi vào mức tin cậy cao, đúng tinh thần "2 manh mối cùng khớp thì
 * đáng tin hơn 1 manh mối". Chỉ ĐÚNG 1 tín hiệu mềm (tỉnh HOẶC ngày xa, không
 * phải cả hai) mới bị coi là yếu.
 */
export const NGUONG_TIN_CAY_THAP = 40
export function tinCayThap(diem: number): boolean {
  return diem > 0 && diem < NGUONG_TIN_CAY_THAP
}
