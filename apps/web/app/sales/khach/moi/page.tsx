import Link from 'next/link'
import { redirect } from 'next/navigation'
import { coTheVaoSales } from '@/lib/nen-tang/gac-cong'
import { requireNhanSu } from '@/lib/nen-tang/phien'
import { CustomerForm } from '../../CustomerForm'
import { kenhChonDuoc, nhanVienChonDuoc } from '../../actions'

export const metadata = { title: 'Thêm khách · GWT Sales' }
export const dynamic = 'force-dynamic'

export default async function TaoKhachPage() {
  await requireNhanSu()
  if (!(await coTheVaoSales())) redirect('/?loi=khong_du_quyen')

  const [kenh, nhanVien] = await Promise.all([kenhChonDuoc(), nhanVienChonDuoc()])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1100px] space-y-5 p-4 sm:p-6">
        <div className="text-sm"><Link href="/sales/khach" className="text-teal-700 hover:underline">← Khách hàng</Link></div>
        <header>
          <h1 className="text-xl font-semibold text-slate-900">Thêm khách mới</h1>
          <p className="text-sm text-slate-500">App cấp mã <span className="font-mono">KA…</span> tự động khi lưu. Khách cũ <span className="font-mono">KH…</span> vẫn sửa ở Google Sheet.</p>
        </header>
        <div className="max-w-2xl"><CustomerForm mode="create" kenh={kenh} nhanVien={nhanVien} /></div>
      </div>
    </main>
  )
}
