import Link from 'next/link'
import { redirect } from 'next/navigation'
import { coTheVaoSales } from '@/lib/nen-tang/gac-cong'
import { requireNhanSu } from '@/lib/nen-tang/phien'
import { listCatalogForPicker, listChannels } from '../../_db'
import { OrderForm } from '../../OrderForm'

export const metadata = { title: 'Tạo đơn · GWT Sales' }
export const dynamic = 'force-dynamic'

export default async function TaoDonPage() {
  await requireNhanSu()
  if (!(await coTheVaoSales())) redirect('/?loi=khong_du_quyen')
  const [catalog, channels] = await Promise.all([listCatalogForPicker(), listChannels()])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1100px] space-y-5 p-4 sm:p-6">
        <div className="text-sm"><Link href="/sales" className="text-teal-700 hover:underline">← Đơn hàng</Link></div>
        <header>
          <h1 className="text-xl font-semibold text-slate-900">Tạo đơn mới</h1>
          <p className="text-sm text-slate-500">Mã đơn sinh tự động khi lưu — <span className="font-mono">YYMMDD-{'{E/U/O}'}nnn</span></p>
        </header>
        <OrderForm catalog={catalog} channels={channels} mode="create" />
      </div>
    </main>
  )
}
