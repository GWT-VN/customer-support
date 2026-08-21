'use client'

import type { MaintenanceDue, BangView } from '@/app/actions'
import { vnDate } from '@/components/Badge'
import { BaoTriDoneButton } from '@/components/BaoTriDoneButton'
import { BangTuyChinh, type CotDef } from '@/components/BangTuyChinh'

const SAP = 'sắp đến hạn (≤30 ngày)'
function TinhTrangBadge({ tt }: { tt: string }) {
  if (tt === 'QUÁ HẠN')
    return <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 whitespace-nowrap">Quá hạn</span>
  if (tt === SAP)
    return <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 whitespace-nowrap">Sắp đến hạn</span>
  if (tt === 'đã xong')
    return <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800 whitespace-nowrap">Đã xong</span>
  if (tt.startsWith('không rõ'))
    return <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">Không rõ</span>
  return <span className="px-2 py-0.5 rounded-full text-xs bg-sky-100 text-sky-800 whitespace-nowrap">Còn hạn</span>
}

const COT: CotDef<MaintenanceDue>[] = [
  { key: 'khach', nhan: 'Khách / công trình', batBuoc: true, sapXep: 'customer_name', render: (r) => (
    <div>
      <div className="text-slate-900">{r.customer_name ?? r.section ?? '—'}</div>
      {r.primary_phone && <div className="font-mono text-xs text-slate-500">{r.primary_phone}</div>}
      {r.customer_name && r.section && <div className="text-[10px] text-slate-400 line-clamp-1">{r.section}</div>}
      {r.chua_khop_khach && <span className="text-[10px] text-amber-600">chưa khớp khách</span>}
    </div>
  ) },
  { key: 'bo_may', nhan: 'Bộ máy · gói', render: (r) => (
    <div className="text-slate-700">{r.bo_may ?? '—'}{r.loai_goi && <div className="text-[10px] text-slate-400">{r.loai_goi}</div>}</div>
  ) },
  { key: 'lan', nhan: 'Lần', render: (r) => <span className="whitespace-nowrap text-slate-600">{r.lan_thu ?? '—'}{r.tong_lan ? `/${r.tong_lan}` : ''}</span> },
  { key: 'due_date', nhan: 'Đến hạn', sapXep: 'due_date', render: (r) => (
    <div className="whitespace-nowrap"><TinhTrangBadge tt={r.tinh_trang} /><div className="text-[10px] text-slate-400 mt-0.5">{vnDate(r.due_date)}</div></div>
  ) },
  { key: 'ghi', nhan: 'Ghi', render: (r) => <BaoTriDoneButton visitId={r.visit_id} completedAt={r.completed_at} /> },
]
const MAC_DINH = ['khach', 'bo_may', 'lan', 'due_date', 'ghi']

export function BangBaoTri({ rows, choViewChung, views, congCu }: { rows: MaintenanceDue[]; choViewChung: boolean; views: BangView[]; congCu?: React.ReactNode }) {
  return (
    <BangTuyChinh
      rows={rows} keyOf={(r) => r.visit_id}
      moTaOf={(r) => `lượt bảo trì của ${r.customer_name ?? r.section ?? 'khách chưa khớp'}`} nhan="lượt bảo trì"
      bang="maintenance" cot={COT} macDinh={MAC_DINH} sapMacDinh="due_date" views={views} choViewChung={choViewChung} congCu={congCu}
    />
  )
}
