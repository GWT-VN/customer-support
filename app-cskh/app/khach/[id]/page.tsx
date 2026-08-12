import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCustomer, ticketsOfCustomer, machinesOfCustomer, kenhChon, baoTriCuaKhach } from '@/app/actions'
import { CustomerEditor } from '@/components/CustomerEditor'
import { GanKenh } from '@/components/GanKenh'
import { TicketList } from '@/components/TicketList'
import { WarrantyBadge, vnDate } from '@/components/Badge'
import { NutQuayLai } from '@/components/NutQuayLai'

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { customer, contacts } = await getCustomer(id)
  if (!customer) notFound()
  const [tickets, machines, kenh, baoTri] = await Promise.all([
    ticketsOfCustomer(id), machinesOfCustomer(id), kenhChon(), baoTriCuaKhach(id),
  ])
  const btDaXong = baoTri.filter((v) => v.completed_at).length

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <NutQuayLai macDinh="/" />
        </div>
        <h1 className="text-xl font-semibold text-slate-900">{customer.full_name}</h1>

        <section className="bg-white rounded-xl border p-5">
          <h2 className="font-medium text-slate-900 mb-1">Kênh / đối tác</h2>
          <p className="text-xs text-slate-400 mb-2">Đại lý/KTS/KOL quản lý khách này (taxonomy chung với Sales).</p>
          <GanKenh customerId={customer.id} channelId={customer.channel_id} kenh={kenh} />
        </section>

        <CustomerEditor customer={customer} contacts={contacts} />

        <section className="bg-white rounded-xl border p-5">
          <h2 className="font-medium text-slate-900 mb-3">Máy đã lắp ({machines.length})</h2>
          {machines.length === 0 ? (
            <p className="text-sm text-slate-400">Khách này chưa có máy nào trong hệ thống.</p>
          ) : (
            <ul className="divide-y border rounded-lg">
              {machines.map((m) => (
                <li key={m.serial} className="px-3 py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/may/${encodeURIComponent(m.serial)}`} prefetch={false} className="text-slate-900 underline">
                      {m.product_name ?? m.serial}
                    </Link>
                    <div className="font-mono text-xs text-slate-400">{m.serial}</div>
                    <div className="text-xs text-slate-500">Lắp: {vnDate(m.install_date)}</div>
                  </div>
                  <WarrantyBadge m={m} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-xl border p-5">
          <h2 className="font-medium text-slate-900 mb-3">Lịch bảo trì ({btDaXong}/{baoTri.length} đã làm)</h2>
          {baoTri.length === 0 ? (
            <p className="text-sm text-slate-400">Khách này chưa có lịch bảo trì.</p>
          ) : (
            <ul className="divide-y border rounded-lg text-sm">
              {baoTri.map((v) => (
                <li key={v.visit_id} className="px-3 py-2 flex items-center justify-between gap-3">
                  <span className="text-slate-700">
                    <span className="text-slate-400">Lần {v.lan_thu ?? '?'}</span> · {vnDate(v.due_date)}
                    {v.bo_may && <span className="text-slate-400"> · {v.bo_may}</span>}
                  </span>
                  {v.completed_at
                    ? <span className="text-xs text-emerald-700">✓ đã làm {vnDate(v.completed_at.slice(0, 10))}</span>
                    : <span className="text-xs text-amber-600">chưa làm</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-xl border p-5">
          <h2 className="font-medium text-slate-900 mb-3">Ticket của khách ({tickets.length})</h2>
          <TicketList tickets={tickets} empty="Khách này chưa có ticket nào." />
        </section>
      </div>
    </main>
  )
}
