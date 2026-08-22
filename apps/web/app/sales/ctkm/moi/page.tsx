import Link from 'next/link'
import { redirect } from 'next/navigation'
import { nguonChoForm, quyenCtkm } from '../actions'
import { CtkmForm } from '../CtkmForm'

export const metadata = { title: 'Tạo chương trình · GWT Sales' }
export const dynamic = 'force-dynamic'

export default async function TaoCtkmPage() {
  const quyen = await quyenCtkm()
  if (!quyen.soan) redirect('/sales/ctkm?loi=khong_du_quyen')
  const nguon = await nguonChoForm()

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[900px] space-y-4 p-4 sm:p-6">
        <div className="text-sm"><Link href="/sales/ctkm" className="text-teal-700 hover:underline">← Chương trình khuyến mãi</Link></div>
        <header>
          <h1 className="text-xl font-semibold text-slate-900">Tạo chương trình khuyến mãi</h1>
          <p className="text-sm text-slate-500">Lưu xong là <b>bản nháp</b> — chưa áp cho đơn nào cho tới khi được ban hành.</p>
        </header>
        <CtkmForm kenhDs={nguon.kenh} spDs={nguon.sp} coQuyenDuyet={quyen.duyet} />
      </div>
    </main>
  )
}
