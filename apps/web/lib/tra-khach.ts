/**
 * TRA KHÁCH THEO SĐT — dùng chung cho CẢ CSKH LẪN SALES.
 *
 * CEO chốt 21/08/2026: *"Chỗ tạo khách của CSKH với Sales của 2 bên phải đọc cùng 1 chỗ: nhập
 * SĐT nếu chưa có bên Sales nhưng đã có bên CS thì vẫn là khách CŨ, dùng info khách đó, có thể
 * cho phép sửa/cập nhật thêm thông tin mới ở cả 2 bên."*
 *
 * Vì sao phải có file này thay vì mỗi khu tự tra bảng của mình: đo prod 21/08 thì **220/356**
 * khách CSKH có SĐT **chưa từng xuất hiện bên Sales**. Sales tra mỗi bảng `customers` sẽ báo
 * "khách mới" cho 220 người vốn đã có hồ sơ CSKH — rồi tạo hồ sơ thứ hai cho cùng một người.
 *
 * KHÔNG kiểm quyền ở đây: mỗi khu gác bằng quyền của khu mình rồi mới gọi vào (giống
 * `khach-lien-he.ts`). Cũng KHÔNG ghi gì — thuần đọc.
 */

import { dataClient } from './nen-tang/db'

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
}

const RONG: KetQuaTraKhach = { khop: [], cs: null, sales: null, quaSdtPhu: false }

const COT_CS =
  'id, full_name, primary_phone, address, province, customer_code, channel_id, ten_cty, mst, trang_thai'
const COT_SALES = 'customer_code, name, phone, address, province, company_invoice, tax_code'

/**
 * Tra một SĐT ở CẢ HAI bảng khách. Khớp ở đâu cũng nghĩa là **khách CŨ**.
 *
 * KHÔNG tạo gì hết — chỉ đọc. Cố ý: tra mà đã đẻ hồ sơ thì mỗi lần gõ nhầm số là một khách rác,
 * mà rác đó lại nằm đúng trong bảng hai khu dùng chung.
 */
export async function traKhachTheoSdt(sdt: string | null | undefined): Promise<KetQuaTraKhach> {
  const cuoi9 = cuoi9So(sdt)
  if (cuoi9.length < 9) return RONG   // chưa gõ đủ số thì đừng tra, tránh khớp bừa

  const db = dataClient()

  const [csChinh, saleRes, lienHe] = await Promise.all([
    db.from('cs_customers').select(COT_CS)
      .neq('trang_thai', 'da_xoa').ilike('primary_phone', `%${cuoi9}`).limit(1),

    // `phone_no0` KHÔNG phải cột sinh — nó do sync ghi, và đo prod 21/08 có **3 khách có
    // `phone` nhưng `phone_no0` rỗng**. Tra mỗi `phone_no0` là trượt đúng 3 người đó mà không
    // báo gì. Nên tra CẢ HAI: cột sẵn (nhanh, có index) HOẶC so đuôi trên `phone` (bắt phần sót).
    db.from('customers').select(COT_SALES)
      // Trong `or=()` của PostgREST, ký tự đại diện của `ilike` là **`*`**, không phải `%`.
      // Đã thử tay cả hai dạng trên PostgREST local trước khi chốt.
      .or(`phone_no0.eq.${cuoi9},phone.ilike.*${cuoi9}`).limit(1),

    // SĐT phụ của CS: người nhà, thư ký, số công ty. Khách gọi bằng số phụ vẫn là khách cũ —
    // không tra ở đây thì CS tạo trùng đúng những ca đã cẩn thận lưu nhiều số.
    db.from('customer_contacts').select('customer_id').ilike('phone', `%${cuoi9}`).limit(1),
  ])

  let cs = (csChinh.data?.[0] as HoSoCS | undefined) ?? null
  let quaSdtPhu = false

  if (!cs && lienHe.data?.length) {
    const cid = (lienHe.data[0] as { customer_id: string }).customer_id
    const { data } = await db.from('cs_customers').select(COT_CS)
      .eq('id', cid).neq('trang_thai', 'da_xoa').limit(1)
    cs = (data?.[0] as HoSoCS | undefined) ?? null
    quaSdtPhu = Boolean(cs)
  }

  const sales = (saleRes.data?.[0] as HoSoSales | undefined) ?? null

  const khop: ('cs' | 'sales')[] = []
  if (cs) khop.push('cs')
  if (sales) khop.push('sales')
  return { khop, cs, sales, quaSdtPhu }
}

/**
 * Câu nhắc cho người đang nhập. Tách khỏi hàm tra để test được và để hai khu nói **cùng một
 * câu** — cùng một tình huống mà CSKH nói một kiểu, Sales nói một kiểu thì nhân viên không tin
 * cái nào.
 */
export function nhanKetQuaTra(kq: KetQuaTraKhach): string | null {
  if (!kq.khop.length) return null
  const phu = kq.quaSdtPhu ? ' (khớp ở SĐT phụ)' : ''
  if (kq.khop.length === 2) return `Khách đã có ở CẢ hồ sơ CSKH và Sales${phu} — dùng lại, đừng tạo mới.`
  if (kq.khop[0] === 'cs') return `Khách đã có hồ sơ bên CSKH${phu} — đây là khách CŨ, dùng lại hồ sơ đó.`
  return `Khách đã có hồ sơ bên Sales${phu} — đây là khách CŨ, dùng lại hồ sơ đó.`
}
