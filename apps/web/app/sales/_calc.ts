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
