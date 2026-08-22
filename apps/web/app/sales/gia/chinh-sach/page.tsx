import Link from 'next/link'
import { chinhSachGia, lichSuChinhSach } from '../actions'
import { quyenCtkm } from '../../ctkm/actions'
import { BangChinhSach } from '../BangChinhSach'

export const metadata = { title: 'Chính sách giá đại lý · GWT Sales' }
export const dynamic = 'force-dynamic'

export default async function ChinhSachPage() {
  const [ds, lichSu, quyen] = await Promise.all([chinhSachGia(), lichSuChinhSach(), quyenCtkm()])
  const daDat = ds.filter((d) => d.bac.NPP || d.bac.DAI_LY || d.bac.GIOI_THIEU).length

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1100px] space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/sales/gia" className="text-teal-700 hover:underline">← Bảng giá niêm yết</Link>
          <Link href="/sales/gia/doi-tac" className="text-teal-700 hover:underline">Đối tác đại lý →</Link>
        </div>

        <header>
          <h1 className="text-xl font-semibold text-slate-900">Chính sách giá đại lý</h1>
          <p className="text-sm text-slate-500">
            Giá theo bậc đối tác. Đã đặt cho <b>{daDat}</b>/{ds.length} sản phẩm.
            Khách không được gán bậc là <b>khách lẻ</b> — hưởng khuyến mãi theo kênh, không dùng bảng này.
          </p>
        </header>

        {!quyen.soan && (
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
            Bạn chỉ xem được. Sửa chính sách cần quyền soạn.
          </p>
        )}

        <BangChinhSach ds={ds} lichSu={lichSu} coQuyenSoan={quyen.soan} />

        <p className="text-xs text-slate-500">
          📌 <b>Rebate 5% cuối quý</b> (USH10 · CTS10 · CTD50 · CTS20, tổng mua quý vượt 140 triệu)
          <b> không</b> trừ vào đơn — chỉ tổng hợp ở báo cáo cuối quý, vì phải hết quý mới chốt được.
        </p>
      </div>
    </main>
  )
}
