import { redirect } from 'next/navigation'
import { coTheVaoCS } from '@/lib/nen-tang/gac-cong'
import { requireStaff } from '@/lib/nen-tang/phien'
import { khachDayDu } from '@/app/actions'
import { DauTrang } from '@/components/DauTrang'
import { GopKhachManHinh } from '@/components/GopKhachManHinh'

export const metadata = { title: 'Gộp khách trùng · GWT CSKH' }
export const dynamic = 'force-dynamic'

/**
 * Màn gộp 2 hồ sơ khách trùng.
 *
 * Vào thẳng từ menu (chưa chọn ai), hoặc từ nút trong trang khách với `?giu=<id>`
 * đã điền sẵn một bên — đi đường nào cũng tới cùng một chỗ so sánh.
 */
export default async function GopKhachPage({
  searchParams,
}: {
  searchParams: Promise<{ giu?: string; gop?: string }>
}) {
  await requireStaff()
  if (!(await coTheVaoCS())) redirect('/work')
  const { giu, gop } = await searchParams

  const [kGiu, kGop] = await Promise.all([
    giu ? khachDayDu(giu) : Promise.resolve(null),
    gop ? khachDayDu(gop) : Promise.resolve(null),
  ])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        <DauTrang
          tieuDe="Gộp khách trùng"
          phuDe="So sánh hai hồ sơ cạnh nhau rồi mới gộp — hồ sơ bị gộp chỉ bị ẩn, không xoá hẳn"
        />

        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          Máy, ticket, lịch bảo trì và liên hệ của hồ sơ bị gộp sẽ chuyển hết sang hồ sơ giữ.
          Trường nào hồ sơ giữ đang trống thì được lấp; trường nào <strong>cả hai đều có</strong>
          {' '}thì hồ sơ giữ thắng — bảng bên dưới nói rõ từng dòng.
        </div>

        <GopKhachManHinh giuBanDau={kGiu} gopBanDau={kGop} />
      </div>
    </main>
  )
}
