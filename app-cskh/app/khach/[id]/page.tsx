import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCustomer, ticketsOfCustomer } from '@/app/actions'
import { CustomerEditor } from '@/components/CustomerEditor'
import { TicketList } from '@/components/TicketList'

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { customer, contacts } = await getCustomer(id)
  if (!customer) notFound()
  const tickets = await ticketsOfCustomer(id)

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <Link href="/" className="text-sm text-slate-600 underline">← Tra cứu</Link>
        <h1 className="text-xl font-semibold text-slate-900">{customer.full_name}</h1>
        <CustomerEditor customer={customer} contacts={contacts} />

        <section className="bg-white rounded-xl border p-5">
          <h2 className="font-medium text-slate-900 mb-3">Ticket của khách ({tickets.length})</h2>
          <TicketList tickets={tickets} empty="Khách này chưa có ticket nào." />
        </section>
      </div>
    </main>
  )
}
