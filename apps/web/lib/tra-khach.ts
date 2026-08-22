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
import { cuoi9So, type HoSoCS, type HoSoSales, type KetQuaTraKhach } from './tra-khach-chung'

// Re-export để chỗ gọi cũ không phải đổi đường import. Component CHẠY Ở TRÌNH DUYỆT thì phải
// import thẳng từ './tra-khach-chung' — import qua file này là kéo `dataClient` vào bundle
// trình duyệt và `next build` vỡ.
export * from './tra-khach-chung'

const RONG: KetQuaTraKhach = { khop: [], cs: null, sales: null, quaSdtPhu: false, nhieuHoSo: false }

const COT_CS =
  'id, full_name, primary_phone, address, province, customer_code, ma_kh, channel_id, ten_cty, mst, trang_thai'
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
    // limit(2) chứ không limit(1): cần BIẾT có nhiều hồ sơ hay không để còn cảnh báo.
    db.from('cs_customers').select(COT_CS)
      .neq('trang_thai', 'da_xoa').ilike('primary_phone', `%${cuoi9}`).limit(2),

    // `phone_no0` KHÔNG phải cột sinh — nó do sync ghi, và đo prod 21/08 có **3 khách có
    // `phone` nhưng `phone_no0` rỗng**. Tra mỗi `phone_no0` là trượt đúng 3 người đó mà không
    // báo gì. Nên tra CẢ HAI: cột sẵn (nhanh, có index) HOẶC so đuôi trên `phone` (bắt phần sót).
    db.from('customers').select(COT_SALES)
      // Trong `or=()` của PostgREST, ký tự đại diện của `ilike` là **`*`**, không phải `%`.
      // Đã thử tay cả hai dạng trên PostgREST local trước khi chốt.
      .or(`phone_no0.eq.${cuoi9},phone.ilike.*${cuoi9}`)
      // Trùng hồ sơ thì lấy hồ sơ CÓ ĐƠN trước. Hồ sơ rác (mất số 0 đầu SĐT) có total_orders
      // rỗng/0; lấy trúng nó là nhân viên thấy khách cũ mà hồ sơ trắng trơn.
      .order('total_orders', { ascending: false, nullsFirst: false })
      .limit(2),

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
  const nhieuHoSo = (csChinh.data?.length ?? 0) > 1 || (saleRes.data?.length ?? 0) > 1

  const khop: ('cs' | 'sales')[] = []
  if (cs) khop.push('cs')
  if (sales) khop.push('sales')
  return { khop, cs, sales, quaSdtPhu, nhieuHoSo }
}

