import { redirect } from 'next/navigation'
import { coTheVaoCS, requireStaff } from '@/lib/supabase'
import { DauTrang } from '@/components/DauTrang'
import { TaoKhachForm } from '@/components/TaoKhachForm'

export const metadata = { title: 'Tạo khách · GWT CSKH' }
export const dynamic = 'force-dynamic'

export default async function TaoKhachPage() {
  await requireStaff()
  if (!(await coTheVaoCS())) redirect('/work')

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
        <DauTrang
          tieuDe="Tạo khách mới"
          phuDe="Nhập SĐT trước — hệ thống tra xem đã có khách này chưa"
        />
        <TaoKhachForm />
      </div>
    </main>
  )
}
