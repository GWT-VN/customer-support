import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCustomer } from '@/app/actions'
import { CustomerEditor } from '@/components/CustomerEditor'

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { customer, contacts } = await getCustomer(id)
  if (!customer) notFound()

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <Link href="/" className="text-sm text-slate-600 underline">← Tra cứu</Link>
        <h1 className="text-xl font-semibold text-slate-900">{customer.full_name}</h1>
        <CustomerEditor customer={customer} contacts={contacts} />
      </div>
    </main>
  )
}
