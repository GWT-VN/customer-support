import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCustomer, ticketsOfCustomer, machinesOfCustomer } from '@/app/actions'
import { CustomerEditor } from '@/components/CustomerEditor'
import { TicketList } from '@/components/TicketList'
import { WarrantyBadge, vnDate } from '@/components/Badge'

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { customer, contacts } = await getCustomer(id)
  if (!customer) notFound()
  const [tickets, machines] = await Promise.all([ticketsOfCustomer(id), machinesOfCustomer(id)])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <Link href="/" className="text-sm text-slate-600 underline">← Máy đã lắp</Link>
        <h1 className="text-xl font-semibold text-slate-900">{customer.full_name}</h1>
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
          <h2 className="font-medium text-slate-900 mb-3">Ticket của khách ({tickets.length})</h2>
          <TicketList tickets={tickets} empty="Khách này chưa có ticket nào." />
        </section>
      </div>
    </main>
  )
}
