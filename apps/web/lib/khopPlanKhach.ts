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

/**
 * Đọc TÊN KHÁCH gợi ý từ chuỗi thư mục Asana, vd "23A Anh Minh (khách cũ)"
 * hay "05B Chị Hoa - lắp thêm 2 giàn" -> "Anh Minh" / "Chị Hoa".
 *
 * Khác với docTenPlan (đọc source_customer_name để dò tỉnh/bộ máy/ngày), hàm
 * này đọc source_folder — field này KHÔNG chứa tỉnh hay ngày (đo thực tế trên
 * dữ liệu sản xuất: 0/79 plan có), chỉ có tiền tố số thứ tự Asana rồi đến tên
 * khách, đôi khi kèm ghi chú trong ngoặc hoặc phần mô tả sau dấu gạch ngang.
 * Bỏ tiền tố + ghi chú để phần còn lại là tên có thể so với cs_customers.full_name.
 */
export function docTenTuThuMuc(folder: string | null | undefined): string | null {
  const raw = (folder ?? '').trim()
  if (!raw) return null
  // Tiền tố Asana: số thứ tự + chữ cái tuỳ chọn (23A, 05B, 7...), có thể kèm dấu nối.
  let s = raw.replace(/^\d+[A-Za-z]?[\s._-]*/, '')
  // Ghi chú trong ngoặc không phải tên khách -> bỏ ("khách cũ", "lắp lại"...).
  s = s.replace(/\([^)]*\)/g, ' ')
  // Phần sau dấu gạch ngang là mô tả thêm ("- lắp thêm 2 giàn"), không phải tên.
  s = s.split(/[-–—]/)[0]
  s = s.replace(/\s+/g, ' ').trim()
  return s || null
}

export type KhachUngVien = {
  id: string; ten: string; sdt: string | null
  tinh: string | null
  /** Ngày lắp SỚM NHẤT trong installed_base của khách — mốc so với ngày trong tên plan. */
  ngayLapSomNhat: string | null
}
export type PlanCanKhop = {
  source_customer_name: string | null; source_phone: string | null; bo_may: string | null
  /** Chuỗi thư mục Asana gốc — nguồn duy nhất có tên khách (xem docTenTuThuMuc). */
  source_folder: string | null
}
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

// Tên trích từ thư mục phải còn lại ít nhất chừng này ký tự (bỏ dấu, bỏ khoảng
// trắng) mới được coi là đủ đặc trưng để so khớp. Đo trên dữ liệu thật: các
// tiền tố xưng hô một mình ("Anh", "Chị", "Cô"...) dài 3 chữ cái và collide với
// rất nhiều khách — cho khớp theo chúng thì đúng là "đoán bừa" mà module này
// cấm. 5 ký tự loại được các tiền tố xưng hô đơn lẻ (Anh=3, Chị=3, Cô=2, Chú=3,
// Bác=3) mà vẫn giữ được tên 2 chữ ngắn nhất kiểu "Anh Hà" (AnhHa=5).
const DO_DAI_TEN_TOI_THIEU = 5

function tenKhongDauKhongCach(s: string): string {
  return boDau(s).trim().replace(/\s+/g, '')
}

/**
 * Xếp hạng khách khớp với 1 plan chưa map.
 *
 * Thang điểm: SĐT trùng (100) áp đảo mọi thứ vì đó là bằng chứng cứng. Tên
 * đọc từ source_folder (xem docTenTuThuMuc) là tín hiệu MẠNH THỨ NHÌ — đo
 * thực tế 23 plan không SĐT: 7/23 khớp đúng-một-khách, 4/23 khớp nhiều khách
 * cùng tên (mơ hồ). Khớp tên chính xác & DUY NHẤT MỘT khách (60) nằm trên
 * ngưỡng tin cậy thấp; nếu CÙNG tên đó khớp NHIỀU khách thì hạ xuống mức yếu
 * (15) — vẫn đưa ra để CS chọn nhưng không được vẽ như gợi ý chắc chắn, vì
 * bản thân việc trùng tên nhiều khách LÀ bằng chứng mơ hồ, không phải bằng
 * chứng mạnh. Khớp một phần (tên plan là tiền tố/hậu tố của tên khách) yếu
 * hơn khớp chính xác (10), vì đây gần như luôn là do tên bị cắt bớt trong
 * thư mục chứ không chắc chắn cùng một người.
 *
 * Ngoài ra vẫn cộng dồn tỉnh (20) + ngày lắp gần (40 nếu ≤7 ngày, 25 nếu ≤30
 * ngày) đọc từ source_customer_name (xem docTenPlan) — tín hiệu này đo được
 * là 0/79 plan sản xuất có, giữ lại phòng khi dữ liệu Asana thay đổi format.
 * Điểm 0 thì không trả về — thà không gợi ý còn hơn để CS gán nhầm khách.
 */
export function xepGoiY(plan: PlanCanKhop, dsKhach: KhachUngVien[], toiDa = 3): GoiYKhach[] {
  const manhMoi = docTenPlan(plan.source_customer_name)
  const sdtPlan = sdtChuan(plan.source_phone)

  const tenPlanGoc = docTenTuThuMuc(plan.source_folder)
  const tenPlanChuan = tenPlanGoc ? tenKhongDauKhongCach(tenPlanGoc) : null
  const tenHopLe = !!tenPlanChuan && tenPlanChuan.length >= DO_DAI_TEN_TOI_THIEU

  // Đếm trước số khách trùng tên CHÍNH XÁC với plan, để phát hiện trường hợp
  // mơ hồ (nhiều khách cùng tên) — xepGoiY nhận cả danh sách nên biết được.
  let soKhachTrungTenChinhXac = 0
  if (tenHopLe) {
    for (const k of dsKhach) {
      if (tenKhongDauKhongCach(k.ten) === tenPlanChuan) soKhachTrungTenChinhXac++
    }
  }

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
    if (tenHopLe) {
      const tenKhachChuan = tenKhongDauKhongCach(k.ten)
      if (tenKhachChuan === tenPlanChuan) {
        if (soKhachTrungTenChinhXac > 1) {
          diem += 15; lyDo.push(`trùng tên "${tenPlanGoc}" (nhiều khách cùng tên, kiểm tra kỹ)`)
        } else {
          diem += 60; lyDo.push(`trùng tên "${tenPlanGoc}"`)
        }
      } else if (tenKhachChuan.startsWith(tenPlanChuan!) || tenPlanChuan!.startsWith(tenKhachChuan)) {
        diem += 10; lyDo.push(`tên gần giống "${tenPlanGoc}"`)
      }
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
 *
 * Cùng logic áp cho tên đọc từ source_folder: khớp tên chính xác & DUY NHẤT
 * một khách (60) vượt mốc 40 -> tin cậy cao. Nhưng nếu CÙNG tên đó khớp NHIỀU
 * khách (15) hoặc chỉ khớp một phần (10) thì đây chính là dạng "chỉ 1 tín hiệu
 * yếu" -> nằm dưới mốc, hiện amber "gợi ý yếu, kiểm tra kỹ" thay vì trông như
 * gợi ý chắc chắn.
 */
export const NGUONG_TIN_CAY_THAP = 40
export function tinCayThap(diem: number): boolean {
  return diem > 0 && diem < NGUONG_TIN_CAY_THAP
}
