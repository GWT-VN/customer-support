import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { chiTietCtkm, nguonChoForm, quyenCtkm } from '../actions'
import { CtkmForm } from '../CtkmForm'

export const metadata = { title: 'Sửa chương trình · GWT Sales' }
export const dynamic = 'force-dynamic'

export default async function SuaCtkmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const quyen = await quyenCtkm()
  if (!quyen.soan) redirect('/sales/ctkm?loi=khong_du_quyen')
  const [ct, nguon] = await Promise.all([chiTietCtkm(id), nguonChoForm()])
  if (!ct) notFound()

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[900px] space-y-4 p-4 sm:p-6">
        <div className="text-sm"><Link href="/sales/ctkm" className="text-teal-700 hover:underline">← Chương trình khuyến mãi</Link></div>
        <header>
          <h1 className="text-xl font-semibold text-slate-900">{ct.ten}</h1>
          <p className="text-sm text-slate-500">
            Sửa xong chương trình quay về <b>bản nháp</b> và phải duyệt lại — người soạn không tự đẩy thay đổi lên đơn đang chạy.
          </p>
        </header>
        <CtkmForm kenhDs={nguon.kenh} spDs={nguon.sp} initial={ct} coQuyenDuyet={quyen.duyet} />
      </div>
    </main>
  )
}
