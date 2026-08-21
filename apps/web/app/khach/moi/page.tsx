import { redirect } from 'next/navigation'
import { coTheVaoCS } from '@/lib/nen-tang/gac-cong'
import { requireStaff } from '@/lib/nen-tang/phien'
import { kenhChon } from '@/app/actions'
import { DauTrang } from '@/components/DauTrang'
import { TaoKhachForm } from '@/components/TaoKhachForm'

export const metadata = { title: 'Tạo khách · GWT CSKH' }
export const dynamic = 'force-dynamic'

export default async function TaoKhachPage() {
  await requireStaff()
  if (!(await coTheVaoCS())) redirect('/work')
  const kenh = await kenhChon()

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
        <DauTrang
          tieuDe="Tạo khách mới"
          phuDe="Nhập SĐT trước — hệ thống tra xem đã có khách này chưa"
        />
        <TaoKhachForm kenh={kenh} />
      </div>
    </main>
  )
}
