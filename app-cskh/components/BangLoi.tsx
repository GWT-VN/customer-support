'use client'

import Link from 'next/link'
import type { CoreDue, BangView } from '@/app/actions'
import { vnDate } from '@/components/Badge'
import { ThayLoiButton } from '@/components/ThayLoiButton'
import { BangTuyChinh, type CotDef } from '@/components/BangTuyChinh'

const SAP = 'sắp đến hạn (≤30 ngày)'
function HanBadge({ tt, ngay }: { tt: string; ngay: number | null }) {
  if (tt === 'QUÁ HẠN')
    return <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 whitespace-nowrap">Quá {Math.abs(ngay ?? 0)} ngày</span>
  if (tt === SAP)
    return <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 whitespace-nowrap">Còn {ngay} ngày</span>
  if (tt.startsWith('không rõ'))
    return <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">Không rõ</span>
  return <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800 whitespace-nowrap">Còn {ngay} ngày</span>
}

const COT: CotDef<CoreDue>[] = [
  { key: 'khach', nhan: 'Khách', batBuoc: true, sapXep: 'customer_name', render: (r) => (
    <div>
      {r.customer_id
        ? <Link href={`/khach/${r.customer_id}`} prefetch={false} className="text-slate-900 underline">{r.customer_name}</Link>
        : <span className="text-slate-400">—</span>}
      <div className="font-mono text-xs text-slate-500">{r.primary_phone ?? <span className="text-amber-600">thiếu SĐT</span>}</div>
    </div>
  ) },
  { key: 'may', nhan: 'Máy', sapXep: 'serial', render: (r) => (
    <div>
      <Link href={`/may/${encodeURIComponent(r.serial)}`} prefetch={false} className="text-slate-900 underline">{r.product_name}</Link>
      <div className="font-mono text-[10px] text-slate-400">{r.serial}</div>
    </div>
  ) },
  { key: 'loi', nhan: 'Lõi cần thay', render: (r) => (
    <div><div className="font-mono text-xs text-slate-900">{r.filter_code}</div><div className="text-xs text-slate-500">{r.filter_name}</div></div>
  ) },
  { key: 'chu_ky', nhan: 'Chu kỳ', render: (r) => <span className="whitespace-nowrap text-slate-600">{r.chu_ky_raw}</span> },
  { key: 'moc_tinh', nhan: 'Mốc tính', render: (r) => (
    <div className="whitespace-nowrap text-slate-600">{vnDate(r.moc_tinh)}
      <div className="text-[10px] text-slate-400">{r.lan_thay_gan_nhat ? 'lần thay gần nhất' : 'ngày lắp (chưa có log thay)'}</div>
    </div>
  ) },
  { key: 'han_som', nhan: 'Đến hạn', sapXep: 'han_som', render: (r) => (
    <div className="whitespace-nowrap"><HanBadge tt={r.tinh_trang} ngay={r.con_bao_nhieu_ngay} /><div className="text-[10px] text-slate-400 mt-0.5">{vnDate(r.han_som)}</div></div>
  ) },
  { key: 'ghi', nhan: 'Ghi log', render: (r) => <ThayLoiButton serial={r.serial} filterCode={r.filter_code} filterName={r.filter_name} compact /> },
]
const MAC_DINH = ['khach', 'may', 'loi', 'chu_ky', 'moc_tinh', 'han_som', 'ghi']

export function BangLoi({ rows, admin, views, congCu }: { rows: CoreDue[]; admin: boolean; views: BangView[]; congCu?: React.ReactNode }) {
  return (
    <BangTuyChinh
      rows={rows} keyOf={(r) => `${r.serial}-${r.filter_code}`}
      moTaOf={(r) => `lõi ${r.filter_code} của máy ${r.serial}`} nhan="dòng lõi"
      bang="core" cot={COT} macDinh={MAC_DINH} sapMacDinh="han_som" views={views} admin={admin} congCu={congCu}
    />
  )
}
