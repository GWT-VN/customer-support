// Hàm THUẦN cho khu Sales — không đụng DB, test được. Dùng chung cho form + server.

/** Nguồn đơn suy từ danh mục cấp 2 của các dòng sản phẩm. */
export function deriveSourceTab(
  items: { category_l2: string | null }[]
): 'DON_POE' | 'DON_POU' | 'DON_OTHERS' {
  const cats = items.map((i) => (i.category_l2 ?? '').toUpperCase())
  if (cats.some((c) => c.includes('POE'))) return 'DON_POE'
  if (cats.some((c) => c.includes('POU'))) return 'DON_POU'
  return 'DON_OTHERS'
}

/** Chữ cái trong mã đơn theo nguồn. */
export const TAB_LETTER: Record<string, string> = {
  DON_POE: 'E',
  DON_POU: 'U',
  DON_OTHERS: 'O',
  DON_TANG: 'T',
}

/**
 * Chuẩn hoá SĐT khớp ĐÚNG cột generated `phone_chuan`:
 * 9 số -> thêm 0 đầu; 10 số có 0 đầu -> giữ; còn lại giữ nguyên chữ số.
 */
export function phoneChuan(p: string | null | undefined): string | null {
  if (!p) return null
  const d = String(p).replace(/\D/g, '')
  if (!d) return null
  if (d.length === 9) return '0' + d
  if (d.length === 10 && d[0] === '0') return d
  return d
}

/** Thành tiền 1 dòng (đồng, làm tròn). Dòng quà = 0. */
export function lineAmount(qty: number, price: number, isGift: boolean): number {
  return isGift ? 0 : Math.round((Number(qty) || 0) * (Number(price) || 0))
}

/** DVBT = mã bảo trì duy nhất → đánh dấu dòng bảo trì. */
export function isMaintenance(internalCode: string | null | undefined): boolean {
  return (internalCode || '').toUpperCase() === 'DVBT'
}

/** YYYY-MM-DD -> YYMMDD (cho tiền tố mã đơn). */
export function yymmdd(isoDate: string): string {
  return isoDate.slice(2).replace(/-/g, '')
}

/**
 * Sinh mã kế tiếp từ danh sách mã đã có + tiền tố.
 * VD nextSeqCode(['260819-E001','260819-E003'], '260819-E') -> '260819-E004'.
 */
export function nextSeqCode(existing: Array<string | null | undefined>, prefix: string, pad = 3): string {
  const re = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d+)$')
  let max = 0
  for (const c of existing) {
    const m = re.exec(c ?? '')
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return prefix + String(max + 1).padStart(pad, '0')
}

/**
 * Quy thuế suất VAT về dạng PHÂN SỐ, chấp được cả hai cách ghi.
 *
 * Vì sao cần: Google Sheet lưu phân số (`0.08`), nhưng ô nhập cũ của app ghi nhãn
 * "VAT%" nên người dùng gõ `8`. Hai cách ghi cùng tồn tại trong dữ liệu cũ, và nếu
 * đem `8` đi nhân 100 để hiển thị thì ra **800%** — đúng lỗi CEO báo 21/08.
 *
 * Luật: giá trị > 1 hiểu là PHẦN TRĂM (8 -> 0.08); ≤ 1 hiểu là PHÂN SỐ (0.08 giữ nguyên).
 * Không có thuế suất thực tế nào vừa hợp lệ ở cả hai cách hiểu, nên luật này không nhập nhằng.
 */
export function chuanVat(v: number | null | undefined): number | null {
  if (v == null || v === '' as unknown as number) return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return null
  return n > 1 ? n / 100 : n
}

/**
 * Tách tiền TRƯỚC VAT và tiền VAT từ tiền SAU VAT.
 *
 * ⚠️ `vatPct` là PHÂN SỐ: 0.08 = 8%. Đây là cách Google Sheet lưu — đo trên production
 * 21/08/2026: 699/810 dòng `sales_order_lines` có vat_pct = 0.08, và 696/699 dòng khớp
 * công thức `amount_net * (1 + vat_pct)`. Dùng `1 + p/100` là sai đúng 100 lần.
 *
 * null hoặc 0 -> coi như không VAT. KHÔNG đoán thuế suất thay người nhập.
 */
export function tachVat(
  amountVat: number | null | undefined,
  vatPct: number | null | undefined
): { net: number; vat: number } {
  const sau = Math.round(Number(amountVat) || 0)
  const p = chuanVat(vatPct) ?? 0
  if (p <= 0) return { net: sau, vat: 0 }
  const net = Math.round(sau / (1 + p))
  // Trừ ngược thay vì tính riêng, để net + vat LUÔN khớp đúng tiền sau VAT —
  // làm tròn hai đầu độc lập sẽ lệch 1 đồng và tổng hoá đơn không cân.
  return { net, vat: sau - net }
}

/**
 * Tổng một đơn: { trước VAT, tiền VAT, sau VAT }.
 * Có `amount_net` (đơn từ Sheet) thì dùng thẳng; không có (đơn tạo trên app,
 * `sales_order_items` không lưu giá trước VAT) thì suy từ `vat_pct`.
 */
export function tongDon(
  lines: Array<{ amount_vat: number | null; amount_net: number | null; vat_pct: number | null }>
): { net: number; vat: number; sauVat: number } {
  let net = 0
  let sauVat = 0
  for (const l of lines) {
    const sau = Math.round(Number(l.amount_vat) || 0)
    sauVat += sau
    net += l.amount_net != null ? Math.round(Number(l.amount_net)) : tachVat(sau, l.vat_pct).net
  }
  return { net, vat: sauVat - net, sauVat }
}

/**
 * Khuyến mãi của MỘT dòng = (giá niêm yết × SL) − thành tiền thực bán.
 * Cả hai vế đều là tiền ĐÃ GỒM VAT nên trừ thẳng được.
 *
 * Trả `null` khi KHÔNG tính được hoặc không có nghĩa:
 *  - chưa có giá niêm yết cho mã đó (mới phủ 37/53 mã đang bán) -> đừng bịa số 0;
 *  - dòng QUÀ: thành tiền = 0 nên hiệu số bằng nguyên giá niêm yết, hiện ra sẽ như một
 *    khoản giảm giá khổng lồ. Quà là chuyện riêng, theo dõi ở cột Tặng.
 *
 * Số ÂM (bán cao hơn niêm yết) vẫn trả về nguyên: đó là thông tin thật, không giấu.
 */
export function tinhKhuyenMai(
  giaNiemYet: number | null | undefined,
  qty: number | null | undefined,
  amountVat: number | null | undefined,
  isGift: boolean
): number | null {
  if (isGift) return null
  const gia = Number(giaNiemYet) || 0
  if (!giaNiemYet || gia <= 0) return null
  const sl = Number(qty) || 0
  const thuc = Math.round(Number(amountVat) || 0)
  return Math.round(gia * sl) - thuc
}
