import Link from 'next/link'
import { redirect } from 'next/navigation'
import { coTheVaoCS, laChiKyThuatVien } from '@/lib/nen-tang/gac-cong'
import { requireStaff } from '@/lib/nen-tang/phien'
import { listKhachChoDuyet } from '@/app/actions'
import { DauTrang } from '@/components/DauTrang'
import { soLieuTongQuan, type SoLieuTongQuan } from './actions'

export const metadata = { title: 'Tổng quan · GWT CSKH' }
export const dynamic = 'force-dynamic'

/**
 * Bốn ô số mở đầu khu CSKH. Trước đây vào CSKH là rơi thẳng vào bảng 2.400 máy —
 * đúng dữ liệu nhưng không trả lời câu "hôm nay tôi phải làm gì".
 *
 * Mỗi ô là một LINK sang đúng trang đang đếm, để con số không thành ngõ cụt.
 */
const O: { khoa: keyof SoLieuTongQuan; nhan: string; href: string; mau: string }[] = [
  { khoa: 'bhChoDuyet', nhan: 'BH chờ duyệt', href: '/dang-ky-bh', mau: 'bg-red-500' },
  { khoa: 'ticketMo', nhan: 'Ticket đang mở', href: '/ticket?state=Open', mau: 'bg-amber-500' },
  { khoa: 'baoTriCanLam', nhan: 'Bảo trì cần làm', href: '/bao-tri', mau: 'bg-[#0e8c9a]' },
  { khoa: 'canDon', nhan: 'Data cần dọn', href: '/khach', mau: 'bg-slate-400' },
]

export default async function TongQuanPage() {
  await requireStaff()
  if (await laChiKyThuatVien()) redirect('/ky-thuat/cua-toi')
  if (!(await coTheVaoCS())) redirect('/work')

  const [so, choDuyet] = await Promise.all([soLieuTongQuan(), listKhachChoDuyet()])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <DauTrang tieuDe="Tổng quan CSKH" phuDe="Việc cần chạm hôm nay" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {O.map((o) => (
            <Link
              key={o.khoa}
              href={o.href}
              prefetch={false}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <span className={`w-[7px] h-[7px] rounded-full ${o.mau}`} />
                {o.nhan}
              </div>
              <div className="mt-1.5 text-[26px] font-bold tracking-tight tabular-nums text-slate-900">
                {so[o.khoa].toLocaleString('vi-VN')}
              </div>
            </Link>
          ))}
        </div>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <h2 className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-900">
            Bảo hành chờ duyệt ({choDuyet.length})
          </h2>
          {choDuyet.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Không có hồ sơ nào chờ duyệt.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {choDuyet.slice(0, 5).map((k) => (
                <li key={k.id} className="px-4 py-3 text-sm text-slate-700">
                  <span className="font-medium">{k.full_name}</span>
                  {k.primary_phone && (
                    <span className="font-mono text-xs text-slate-500"> · {k.primary_phone}</span>
                  )}
                  {k.province && <span className="text-xs text-slate-400"> · {k.province}</span>}
                </li>
              ))}
            </ul>
          )}
          <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50">
            <Link
              href="/dang-ky-bh"
              prefetch={false}
              className="text-sm font-medium text-[#0a6771] hover:underline"
            >
              Xem tất cả →
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
