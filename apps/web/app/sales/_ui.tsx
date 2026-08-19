// Helper hiển thị + badge dùng chung cho khu Sales. Thuần trình bày (render ở server).
import type { ReactNode } from 'react'

const vnd = new Intl.NumberFormat('vi-VN')

export function fmtVnd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return vnd.format(Math.round(Number(n))) + ' ₫'
}

export function fmtQty(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return vnd.format(Number(n))
}

/** order_date lưu 'YYYY-MM-DD' → hiển thị dd/MM/yyyy, không lệch múi giờ. */
export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  const dt = new Date(d)
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('vi-VN')
}

/** SĐT có thể mất số 0 đầu (lưu dạng số) → thêm lại khi thấy 9 chữ số. */
export function fmtPhone(raw: string | null | undefined): string {
  if (!raw) return '—'
  let s = String(raw).trim()
  if (/^\d{9}$/.test(s)) s = '0' + s
  return s
}

const TAB: Record<string, { nhan: string; lop: string }> = {
  DON_POE: { nhan: 'POE', lop: 'bg-teal-100 text-teal-700' },
  DON_POU: { nhan: 'POU', lop: 'bg-cyan-100 text-cyan-700' },
  DON_OTHERS: { nhan: 'Khác', lop: 'bg-slate-100 text-slate-600' },
  DON_TANG: { nhan: 'Tặng', lop: 'bg-amber-100 text-amber-700' },
}

export function TabBadge({ tab }: { tab: string | null }) {
  const t = (tab && TAB[tab]) || { nhan: tab || '—', lop: 'bg-slate-100 text-slate-500' }
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${t.lop}`}>{t.nhan}</span>
}

/** Badge trạng thái chung: tô màu theo từ khoá, không cần bảng cứng. */
export function StatusBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-slate-400">—</span>
  const v = value.toLowerCase()
  let lop = 'bg-slate-100 text-slate-600'
  if (/(đã thu|đủ|hoàn thành|xong|đã giao|done|active|kích hoạt)/.test(v)) lop = 'bg-emerald-100 text-emerald-700'
  else if (/(chờ|đối soát|pending|xử lý|open|mới)/.test(v)) lop = 'bg-amber-100 text-amber-700'
  else if (/(huỷ|hủy|lỗi|cancel|từ chối)/.test(v)) lop = 'bg-rose-100 text-rose-700'
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${lop}`}>{value}</span>
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value == null || value === '' ? '—' : value}</dd>
    </div>
  )
}
