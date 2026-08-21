// Kiểu dùng chung cho form ghi + server action khu Sales.

export type CatalogPick = {
  internal_code: string
  name: string
  category_l1: string | null
  category_l2: string | null
  ma_cu: string | null // mã cũ (search)
  ma_doitac: string | null // mã đối tác/kho (search)
  /** VAT theo mã — form tự điền khi chọn sản phẩm. null = chưa xếp loại (mục chi phí). */
  vat_pct: number | null
  vat_loai: 'VAT' | 'KCT' | 'KAD' | null
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
  vat_loai: 'VAT' | 'KCT' | 'KAD' | null
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
 * Lựa chọn VAT. Mỗi mục mang HAI thứ: thuế suất (`pct`, dạng PHÂN SỐ) và LOẠI (`loai`).
 *
 * Vì sao phải có `loai` riêng: `0%`, `KCT`, `KAD` đều ra tiền thuế **bằng 0** nhưng là
 * BA nhóm khác nhau khi in hoá đơn và gom báo cáo — CEO chốt 21/08/2026:
 *   VAT = chịu thuế (0 / 8 / 10%)
 *   KCT = KHÔNG CHỊU THUẾ  — muối (MUOIAD, MUOIDUC, MUOIRE)
 *   KAD = KHÔNG ÁP DỤNG    — bình gas sparkling (GASDEN*, GASXANH*)
 * Cột `vat_pct` là SỐ nên không chứa được chữ; đó là lý do sinh ra cột `vat_loai`.
 *
 * ⚠️ Thuế suất lưu PHÂN SỐ (0.08), khớp Google Sheet. Không có mức 5%.
 */
export type VatLoai = 'VAT' | 'KCT' | 'KAD'

export type VatOpt = { ma: string; nhan: string; pct: number | null; loai: VatLoai | null }

export const VAT_OPTS: VatOpt[] = [
  { ma: '', nhan: '—', pct: null, loai: null },
  { ma: 'VAT:0', nhan: '0%', pct: 0, loai: 'VAT' },
  { ma: 'VAT:0.08', nhan: '8%', pct: 0.08, loai: 'VAT' },
  { ma: 'VAT:0.1', nhan: '10%', pct: 0.1, loai: 'VAT' },
  { ma: 'KCT', nhan: 'KCT', pct: 0, loai: 'KCT' },
  { ma: 'KAD', nhan: 'KAD', pct: 0, loai: 'KAD' },
]

/** Khoá dropdown từ cặp (pct, loai) đang lưu. */
export function maVat(pct: number | null | undefined, loai: VatLoai | null | undefined): string {
  if (loai === 'KCT' || loai === 'KAD') return loai
  if (pct == null) return ''
  const p = Number(pct) > 1 ? Number(pct) / 100 : Number(pct)
  return VAT_OPTS.find((v) => v.loai === 'VAT' && v.pct === p)?.ma ?? ''
}

/** Nhãn hiển thị cho một dòng đơn: 'KCT' · 'KAD' · '8%' · '—'. */
export function nhanVat(pct: number | null | undefined, loai: VatLoai | null | undefined): string {
  if (loai === 'KCT' || loai === 'KAD') return loai
  if (pct == null) return '—'
  const p = Number(pct) > 1 ? Number(pct) / 100 : Number(pct)
  return `${Math.round(p * 100)}%`
}
