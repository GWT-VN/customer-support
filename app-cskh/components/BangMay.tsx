'use client'

import Link from 'next/link'
import type { Machine, BangView } from '@/app/actions'
import { WarrantyBadge, vnDate } from '@/components/Badge'
import { BangTuyChinh, type CotDef } from '@/components/BangTuyChinh'

const COT: CotDef<Machine>[] = [
  { key: 'serial', nhan: 'Serial', batBuoc: true, sapXep: 'serial',
    render: (m) => <Link href={`/may/${encodeURIComponent(m.serial)}`} prefetch={false} className="font-mono text-xs text-slate-900 underline">{m.serial}</Link> },
  { key: 'product_name', nhan: 'Máy', sapXep: 'product_name', render: (m) => <span>{m.product_name ?? '—'}</span> },
  { key: 'customer', nhan: 'Khách', sapXep: 'customer_name', render: (m) => (
    m.customer_id
      ? <Link href={`/khach/${m.customer_id}`} prefetch={false} className="text-slate-900 underline">{m.customer_name}</Link>
      : <span className="text-slate-400">—</span>
  ) },
  { key: 'primary_phone', nhan: 'SĐT', render: (m) => <span className="font-mono text-xs">{m.primary_phone ?? <span className="text-amber-600">thiếu</span>}</span> },
  { key: 'install_date', nhan: 'Lắp', sapXep: 'install_date', render: (m) => <span className="text-slate-600">{vnDate(m.install_date)}</span> },
  { key: 'warranty', nhan: 'Bảo hành', sapXep: 'warranty_full_end', render: (m) => <WarrantyBadge m={m} /> },
]
const MAC_DINH = ['serial', 'product_name', 'customer', 'primary_phone', 'install_date', 'warranty']

export function BangMay({ rows, admin, views }: { rows: Machine[]; admin: boolean; views: BangView[] }) {
  return (
    <BangTuyChinh
      rows={rows} keyOf={(m) => m.serial} moTaOf={(m) => `máy ${m.serial}`} nhan="máy"
      bang="installed_base" cot={COT} macDinh={MAC_DINH} sapMacDinh="install_date" views={views} admin={admin}
    />
  )
}
