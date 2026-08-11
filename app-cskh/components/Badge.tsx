import type { Machine } from '@/app/actions'
import { laMaBo } from '@/lib/danhSach'

/** Trạng thái bảo hành -> badge. Phân biệt rõ 3 ca: còn hạn / hết hạn / không tính được. */
export function WarrantyBadge({ m }: { m: Machine }) {
  // Dòng MẸ của một bộ combo (internal_code = WH15A/WH30A) không giữ BH — BH nằm ở
  // từng thiết bị con. Không kích hoạt thì hiện "Bộ (đầu hệ)" thay vì "Chưa kích hoạt"
  // để khỏi báo đỏ nhầm. (Bộ cũ còn giữ BH ở mẹ vẫn hiện trạng thái BH cho tới khi backfill.)
  if (laMaBo(m.internal_code) && !m.warranty_activated)
    return <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700" title="Bộ hệ thống — bảo hành ở từng thiết bị con">Bộ (đầu hệ)</span>
  if (!m.warranty_activated)
    return <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">Chưa kích hoạt</span>
  if (!m.co_chinh_sach_bh)
    return <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800" title="Máy chưa có số năm bảo hành trong product_warranty">Không rõ hạn</span>
  if (m.con_han_may)
    return <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800">Còn BH máy</span>
  if (m.con_han_loi)
    return <span className="px-2 py-0.5 rounded-full text-xs bg-sky-100 text-sky-800">Hết BH máy · còn BH linh kiện</span>
  return <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">Hết bảo hành</span>
}

export function vnDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
