// Kiểu dùng chung cho form ghi + server action khu Sales.

export type CatalogPick = {
  internal_code: string
  name: string
  category_l1: string | null
  category_l2: string | null
  ma_cu: string | null // mã cũ (search)
  ma_doitac: string | null // mã đối tác/kho (search)
}

export type ChannelOpt = {
  id: number
  channel_l1: string | null
  channel_l2: string | null
}

export type NewOrderItem = {
  internal_code: string
  product_name: string
  category_l1: string | null
  category_l2: string | null
  quantity: number
  unit_price_vat: number
  is_gift: boolean
  vat_pct: number | null
  note: string | null
}

export type NewOrderInput = {
  customer_code: string | null
  phone: string | null
  customer_name: string | null
  address: string | null
  province: string | null
  order_date: string // YYYY-MM-DD
  channel_id: number | null
  partner_order_code: string | null
  status: string | null
  payment_status: string | null
  payment_method: string | null
  shipping_code: string | null
  install_date: string | null // YYYY-MM-DD
  note: string | null
  items: NewOrderItem[]
}

export type OrderFormInitial = NewOrderInput

export type CustomerInput = {
  name: string | null
  phone: string | null
  address: string | null
  province: string | null
  company_invoice: string | null
  tax_code: string | null
  note: string | null
}

export type CustomerHit = {
  customer_code: string
  name: string | null
  phone: string | null
  phone_chuan: string | null
  province: string | null
  province_moi: string | null
}

/**
 * Lựa chọn dropdown — CHÉP ĐÚNG hằng `TTHANG` / `TTTIEN` trong
 * `Sales Tracking/apps-script/Code.gs:120-122`, là nguồn chân lý của Google Sheet.
 *
 * ⚠️ Lệch hai danh sách này là lọc ra thiếu đơn mà không ai biết. Bản cũ (6 tình trạng
 * hàng / 4 thanh toán) thiếu 'Chuẩn bị hàng', 'Đã giao chờ lắp', 'Hoàn hàng', 'Đã cọc',
 * và ghi 'Hoàn thành' trong khi dữ liệu thật là 'Hoàn thành (Không lắp)'.
 * Đo prod 21/08: 'Hoàn thành (Không lắp)' 280 dòng · 'Đã giao chờ lắp' 53 · 'Đã cọc' 61.
 * Sửa danh mục ở Sheet thì phải sửa cả ở đây.
 */
export const FULFILL_OPTS = ['Mới', 'Xác nhận', 'Chuẩn bị hàng', 'Đang giao', 'Đã giao chờ lắp',
  'Đã lắp đặt', 'Hoàn thành (Không lắp)', 'Hoàn hàng', 'Huỷ'] as const
export const PAYMENT_OPTS = ['Chờ cọc', 'Đã cọc', 'Chờ đối soát', 'Còn nợ', 'Đã thu đủ'] as const
export const PAYMETHOD_OPTS = ['', 'Chuyển khoản', 'COD', 'Tiền mặt'] as const

/**
 * Thuế suất VAT lưu dạng PHÂN SỐ (0.08 = 8%) — khớp đúng cách Google Sheet lưu.
 *
 * ⚠️ Đừng đổi sang phần trăm. Đo prod 21/08/2026: 810 dòng `sales_order_lines` đang là
 * phân số. Trước đây ô này là input số nhãn "VAT%" nên người dùng gõ 8 -> lưu 8, lệch
 * đúng 100 lần so với đơn từ Sheet. Dropdown chặn luôn lỗi gõ tay đó.
 */
export const VAT_OPTS: { nhan: string; giaTri: number | null }[] = [
  { nhan: '—', giaTri: null },
  { nhan: '0%', giaTri: 0 },
  { nhan: '5%', giaTri: 0.05 },
  { nhan: '8%', giaTri: 0.08 },
  { nhan: '10%', giaTri: 0.1 },
]
