import Link from 'next/link'
import { danhSachDoiTac, lichSuBac } from '../actions'
import { quyenCtkm } from '../../ctkm/actions'
import { GanBac } from './GanBac'

export const metadata = { title: 'Đối tác đại lý · GWT Sales' }
export const dynamic = 'force-dynamic'

export default async function DoiTacPage() {
  const [ds, lichSu, quyen] = await Promise.all([danhSachDoiTac(), lichSuBac(), quyenCtkm()])
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1000px] space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/sales/gia" className="text-teal-700 hover:underline">← Bảng giá niêm yết</Link>
          <Link href="/sales/gia/chinh-sach" className="text-teal-700 hover:underline">Chính sách giá đại lý →</Link>
        </div>
        <header>
          <h1 className="text-xl font-semibold text-slate-900">Đối tác đại lý</h1>
          <p className="text-sm text-slate-500">
            Chỉ đối tác có bậc mới nằm ở đây. Khách không gán bậc mặc định là <b>khách lẻ</b>,
            hưởng khuyến mãi theo <b>kênh của đơn</b>.
          </p>
        </header>
        <GanBac ds={ds} lichSu={lichSu} coQuyenSoan={quyen.soan} />
      </div>
    </main>
  )
}
