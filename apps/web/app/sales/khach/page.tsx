import Link from 'next/link'
import { redirect } from 'next/navigation'
import { coTheVaoSales, requireNhanSu } from '@/lib/supabase'
import { danhSachKhach } from '../actions'

export const metadata = { title: 'Khách hàng · GWT Sales' }
export const dynamic = 'force-dynamic'

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d
}

export default async function SalesKhachPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireNhanSu()
  if (!(await coTheVaoSales())) redirect('/?loi=khong_du_quyen')
  const { q } = await searchParams
  const rows = await danhSachKhach(q ?? '')

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1100px] space-y-4 p-4 sm:p-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Khách hàng</h1>
            <p className="text-sm text-slate-500">{rows.length} khách · <span className="font-mono">KH…</span> từ Sheet · <span className="font-mono">KA…</span> tạo trên app</p>
          </div>
          <Link href="/sales/khach/moi" className="rounded-lg bg-[#0e8c9a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a6771]">＋ Thêm khách</Link>
        </header>

        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Tìm tên / SĐT / mã KH…"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
          />
          <button className="rounded-lg bg-[#0e8c9a] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a6771]">Tìm</button>
        </form>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Mã KH</th>
                  <th className="px-3 py-2.5 font-medium">Tên</th>
                  <th className="px-3 py-2.5 font-medium">SĐT</th>
                  <th className="px-3 py-2.5 font-medium">Tỉnh/TP</th>
                  <th className="px-3 py-2.5 text-right font-medium">Đơn</th>
                  <th className="px-3 py-2.5 font-medium">Mua gần nhất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-slate-400">Không có khách nào khớp.</td>
                  </tr>
                ) : (
                  rows.map((c) => (
                    <tr key={c.customer_code} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs">
                        <Link href={`/sales/khach/${encodeURIComponent(c.customer_code)}`} className="text-teal-700 hover:underline">
                          {c.customer_code}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-800">
                        <Link href={`/sales/khach/${encodeURIComponent(c.customer_code)}`} className="hover:text-teal-700 hover:underline">
                          {c.name || '—'}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{c.phone || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600">{c.province || '—'}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">{c.total_orders ?? 0}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{fmtDate(c.last_order_date)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}
