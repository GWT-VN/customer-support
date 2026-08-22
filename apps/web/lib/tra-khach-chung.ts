/**
 * TRA KHÁCH — phần THUẦN, không đụng DB.
 *
 * Tách khỏi `tra-khach.ts` vì file kia import `dataClient` (chỉ chạy trên server). Component
 * chạy ở TRÌNH DUYỆT mà import nhầm file kia thì **`next build` vỡ** — `tsc` và `vitest` đều
 * KHÔNG bắt được, chỉ build mới bắt. Đã dính đúng lỗi đó 22/08/2026.
 *
 * ⇒ Kiểu dữ liệu + hàm thuần ở ĐÂY (client dùng được); phần chạm DB ở `tra-khach.ts`.
 */

/**
 * Rút 9 SỐ CUỐI để so khớp. Đây là khoá so DUY NHẤT của file này.
 *
 * KHÔNG dùng `chuanHoaSdt()` (CS) hay `phoneChuan()` (Sales): hai khu có hai hàm chuẩn hoá
 * khác nhau, và `phoneChuan()` **cố ý bám cột sinh `customers.phone_chuan`**. Hàm tra mà chuẩn
 * hoá lệch một trong hai là **tra ra rỗng nhưng KHÔNG báo lỗi** — đúng loại bẫy đã trả giá với
 * `khong_dau()` hôm nay. 9 số cuối thì không phụ thuộc bên nào viết `+84`, `0`, hay dấu cách.
 */
export function cuoi9So(raw: string | null | undefined): string {
  const so = (raw ?? '').replace(/\D/g, '')
  return so.length >= 9 ? so.slice(-9) : so
}

export type HoSoCS = {
  id: string
  full_name: string
  primary_phone: string | null
  address: string | null
  province: string | null
  customer_code: string | null
  /** Mã khách hệ mới KH-YYMM-NNNN. CEO chốt 22/08: chỉ hiện ở hồ sơ khách. */
  ma_kh: string | null
  channel_id: number | null
  ten_cty: string | null
  mst: string | null
  trang_thai: string | null
}

export type HoSoSales = {
  customer_code: string | null
  name: string | null
  phone: string | null
  address: string | null
  province: string | null
  company_invoice: string | null
  tax_code: string | null
}

export type KetQuaTraKhach = {
  /** Khớp ở bảng nào. Rỗng = khách MỚI thật. */
  khop: ('cs' | 'sales')[]
  cs: HoSoCS | null
  sales: HoSoSales | null
  /** Khớp nhờ SĐT PHỤ (customer_contacts) chứ không phải SĐT chính — UI nên nói rõ cho người nhập. */
  quaSdtPhu: boolean
  /**
   * Một SĐT ra NHIỀU hồ sơ ở cùng một bảng — tức dữ liệu đang có hồ sơ trùng.
   * PHẢI nói ra, không được lặng lẽ chọn hộ: đo prod 22/08 có 5 người bị tạo trùng hồ sơ bên
   * Sales (Google Sheet ăn mất số 0 đầu SĐT), trong đó hồ sơ "mất số 0" có **0 lịch sử mua**.
   * Chọn nhầm hồ sơ rỗng thì nhân viên nhìn thấy khách trắng trơn và tưởng là khách mới.
   */
  nhieuHoSo: boolean
}

/**
 * Câu nhắc cho người đang nhập. Tách khỏi hàm tra để test được và để hai khu nói **cùng một
 * câu** — cùng một tình huống mà CSKH nói một kiểu, Sales nói một kiểu thì nhân viên không tin
 * cái nào.
 */
export function nhanKetQuaTra(kq: KetQuaTraKhach): string | null {
  if (!kq.khop.length) return null
  const phu = kq.quaSdtPhu ? ' (khớp ở SĐT phụ)' : ''
  if (kq.nhieuHoSo) {
    return `⚠️ SĐT này đang có NHIỀU hồ sơ${phu} — đã hiện hồ sơ có đơn. Kiểm rồi gộp lại, đừng tạo thêm.`
  }
  if (kq.khop.length === 2) return `Khách đã có ở CẢ hồ sơ CSKH và Sales${phu} — dùng lại, đừng tạo mới.`
  if (kq.khop[0] === 'cs') return `Khách đã có hồ sơ bên CSKH${phu} — đây là khách CŨ, dùng lại hồ sơ đó.`
  return `Khách đã có hồ sơ bên Sales${phu} — đây là khách CŨ, dùng lại hồ sơ đó.`
}
