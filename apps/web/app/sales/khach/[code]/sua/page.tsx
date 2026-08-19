import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { coTheVaoSales, requireNhanSu } from '@/lib/supabase'
import { getCustomerForEdit, isAppCustomer } from '../../../_db'
import { CustomerForm } from '../../../CustomerForm'

export const metadata = { title: 'Sửa khách · GWT Sales' }
export const dynamic = 'force-dynamic'

export default async function SuaKhachPage({ params }: { params: Promise<{ code: string }> }) {
  await requireNhanSu()
  if (!(await coTheVaoSales())) redirect('/?loi=khong_du_quyen')
  const { code } = await params
  const customerCode = decodeURIComponent(code)
  // Khách từ Sheet (KH…) không sửa ở app — đá về trang xem.
  if (!isAppCustomer(customerCode)) redirect(`/sales/khach/${encodeURIComponent(customerCode)}`)
  const initial = await getCustomerForEdit(customerCode)
  if (!initial) notFound()

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1100px] space-y-5 p-4 sm:p-6">
        <div className="text-sm"><Link href={`/sales/khach/${encodeURIComponent(customerCode)}`} className="text-teal-700 hover:underline">← Hồ sơ khách</Link></div>
        <header>
          <h1 className="text-xl font-semibold text-slate-900">Sửa khách <span className="font-mono">{customerCode}</span></h1>
        </header>
        <CustomerForm mode="edit" customerCode={customerCode} initial={initial} />
      </div>
    </main>
  )
}
