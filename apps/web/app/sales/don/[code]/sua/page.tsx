import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { coTheVaoSales } from '@/lib/nen-tang/gac-cong'
import { requireNhanSu } from '@/lib/nen-tang/phien'
import { getOrderForEdit, listCatalogForPicker, listChannels } from '../../../_db'
import { OrderForm } from '../../../OrderForm'

export const metadata = { title: 'Sửa đơn · GWT Sales' }
export const dynamic = 'force-dynamic'

export default async function SuaDonPage({ params }: { params: Promise<{ code: string }> }) {
  await requireNhanSu()
  if (!(await coTheVaoSales())) redirect('/?loi=khong_du_quyen')
  const { code } = await params
  const orderCode = decodeURIComponent(code)
  const [initial, catalog, channels] = await Promise.all([
    getOrderForEdit(orderCode),
    listCatalogForPicker(),
    listChannels(),
  ])
  if (!initial) notFound() // đơn từ Google Sheet không sửa ở app

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1100px] space-y-5 p-4 sm:p-6">
        <div className="text-sm"><Link href={`/sales/don/${encodeURIComponent(orderCode)}`} className="text-teal-700 hover:underline">← Chi tiết đơn</Link></div>
        <header>
          <h1 className="text-xl font-semibold text-slate-900">Sửa đơn <span className="font-mono">{orderCode}</span></h1>
          <p className="text-sm text-slate-500">Lưu sẽ thay toàn bộ dòng sản phẩm bằng nội dung bên dưới.</p>
        </header>
        <OrderForm catalog={catalog} channels={channels} mode="edit" orderCode={orderCode} initial={initial} />
      </div>
    </main>
  )
}
