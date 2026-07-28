import type { Ticket } from '@/app/actions'

const STATE: Record<string, { label: string; cls: string }> = {
  Open:   { label: 'Đang mở',  cls: 'bg-amber-100 text-amber-800' },
  Done:   { label: 'Đã xong',  cls: 'bg-emerald-100 text-emerald-800' },
  Cancel: { label: 'Đã huỷ',   cls: 'bg-slate-100 text-slate-500' },
}

export function StateBadge({ state }: { state: string }) {
  const s = STATE[state] ?? { label: state, cls: 'bg-slate-100 text-slate-600' }
  return <span className={`px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${s.cls}`}>{s.label}</span>
}

/** Ticket ưu tiên cao (khách khó chịu / cần xử lý gấp). */
export function KhanBadge({ khan }: { khan: boolean | null | undefined }) {
  if (!khan) return null
  return (
    <span className="px-2 py-0.5 rounded-full text-xs bg-red-600 text-white whitespace-nowrap font-medium">
      🔴 Khẩn
    </span>
  )
}

/** Ticket trỏ tới serial không có trong installed_base — lỗi dữ liệu Odoo, cần nêu rõ. */
export function MayThieuBadge({ t }: { t: Ticket }) {
  if (!t.may_khong_trong_he_thong) return null
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 whitespace-nowrap"
      title={`Serial ${t.source_serial} có ticket nhưng Odoo ghi là tồn kho → máy chưa vào hệ thống. Cần gán khách trong Odoo.`}
    >
      ⚠️ Máy chưa trong hệ thống
    </span>
  )
}

export function vnDateTime(s: string | null) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric',
                                     hour: '2-digit', minute: '2-digit' })
}
