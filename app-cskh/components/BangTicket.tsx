'use client'

import Link from 'next/link'
import type { Ticket, BangView } from '@/app/actions'
import { StateBadge, KhanBadge, MayThieuBadge, vnDateTime } from '@/components/TicketBadge'
import { BangTuyChinh, type CotDef } from '@/components/BangTuyChinh'

const COT: CotDef<Ticket>[] = [
  { key: 'ticket_code', nhan: 'Mã', batBuoc: true, sapXep: 'ticket_code',
    render: (t) => <Link href={`/ticket/${t.ticket_code}`} prefetch={false} className="font-mono text-xs text-slate-900 underline">{t.ticket_code}</Link> },
  { key: 'created_at', nhan: 'Ngày', sapXep: 'created_at',
    render: (t) => <span className="whitespace-nowrap text-slate-600">{vnDateTime(t.created_at)}</span> },
  { key: 'ticket_type', nhan: 'Loại', render: (t) => <span className="max-w-56 inline-block">{t.ticket_type ?? '—'}</span> },
  { key: 'customer', nhan: 'Khách', sapXep: 'customer_name', render: (t) => (
    <>
      {t.customer_id
        ? <Link href={`/khach/${t.customer_id}`} prefetch={false} className="text-slate-900 underline">{t.customer_name}</Link>
        : <span className="text-slate-500">{t.customer_name ?? '—'}</span>}
      {t.primary_phone && <div className="font-mono text-xs text-slate-500">{t.primary_phone}</div>}
    </>
  ) },
  { key: 'may', nhan: 'Máy', render: (t) => (
    t.serial
      ? <Link href={`/may/${encodeURIComponent(t.serial)}`} prefetch={false} className="text-slate-900 underline">{t.product_name}</Link>
      : t.source_serial ? <MayThieuBadge t={t} /> : <span className="text-slate-400">—</span>
  ) },
  { key: 'phu_trach', nhan: 'Phụ trách', render: (t) => (
    t.cs_ten || t.ky_thuat_ten
      ? <div className="text-xs text-slate-600">{t.cs_ten && <div>CS: {t.cs_ten}</div>}{t.ky_thuat_ten && <div>KT: {t.ky_thuat_ten}</div>}</div>
      : <span className="text-slate-300">—</span>
  ) },
  { key: 'state', nhan: 'Trạng thái', sapXep: 'state',
    render: (t) => <div className="flex items-center gap-1.5"><KhanBadge khan={t.khan} /><StateBadge state={t.state} /></div> },
]
const MAC_DINH = ['ticket_code', 'created_at', 'ticket_type', 'customer', 'may', 'phu_trach', 'state']

export function BangTicket({ rows, admin, views, congCu }: { rows: Ticket[]; admin: boolean; views: BangView[]; congCu?: React.ReactNode }) {
  return (
    <BangTuyChinh
      rows={rows} keyOf={(t) => t.ticket_code} moTaOf={(t) => `ticket ${t.ticket_code}`} nhan="ticket"
      bang="tickets" cot={COT} macDinh={MAC_DINH} sapMacDinh="created_at" views={views} admin={admin} congCu={congCu}
    />
  )
}
