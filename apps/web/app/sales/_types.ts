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

/** Lựa chọn dropdown — chốt theo mockup đã duyệt. */
export const FULFILL_OPTS = ['Mới', 'Xác nhận', 'Đang giao', 'Đã lắp đặt', 'Hoàn thành', 'Huỷ'] as const
export const PAYMENT_OPTS = ['Chờ cọc', 'Chờ đối soát', 'Còn nợ', 'Đã thu đủ'] as const
export const PAYMETHOD_OPTS = ['', 'Chuyển khoản', 'COD', 'Tiền mặt'] as const
