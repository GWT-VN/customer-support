import { redirect } from 'next/navigation'
import { coTheVaoSales, requireNhanSu } from '@/lib/supabase'
import { danhSachDon } from './actions'

export const metadata = { title: 'Đơn hàng · GWT Sales' }
export const dynamic = 'force-dynamic'

const vnd = new Intl.NumberFormat('vi-VN')
const fmtVnd = (n: number) => (n ? vnd.format(Math.round(n)) + ' ₫' : '—')
function fmtDate(d: string | null): string {
  if (!d) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d
}
const TAB_LABEL: Record<string, string> = { DON_POE: 'POE', DON_POU: 'POU', DON_OTHERS: 'Khác', DON_TANG: 'Tặng' }

export default async function SalesDonPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireNhanSu()
  if (!(await coTheVaoSales())) redirect('/?loi=khong_du_quyen')
  const { q } = await searchParams
  const rows = await danhSachDon(q ?? '')

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1100px] space-y-4 p-4 sm:p-6">
        <header>
          <h1 className="text-xl font-semibold text-slate-900">Đơn hàng</h1>
          <p className="text-sm text-slate-500">{rows.length} đơn gần nhất · đơn tag &ldquo;App&rdquo; = tạo trên app</p>
        </header>

        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Tìm mã đơn / tên khách / sản phẩm…"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
          />
          <button className="rounded-lg bg-[#0e8c9a] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a6771]">Tìm</button>
        </form>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Mã đơn</th>
                  <th className="px-3 py-2.5 font-medium">Ngày</th>
                  <th className="px-3 py-2.5 font-medium">Khách</th>
                  <th className="px-3 py-2.5 font-medium">Tình trạng</th>
                  <th className="px-3 py-2.5 font-medium">Thanh toán</th>
                  <th className="px-3 py-2.5 text-right font-medium">Tổng (VAT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-slate-400">Không có đơn nào khớp.</td>
                  </tr>
                ) : (
                  rows.map((o) => (
                    <tr key={o.order_code} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className="inline-flex items-center gap-2 font-medium text-teal-700">
                          {o.source_tab && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                              {TAB_LABEL[o.source_tab] ?? o.source_tab}
                            </span>
                          )}
                          {o.order_code}
                          {o.is_app && (
                            <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">App</span>
                          )}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{fmtDate(o.order_date)}</td>
                      <td className="px-3 py-2.5 text-slate-700">
                        {o.customer_name || '—'}
                        {o.province ? <span className="block text-xs text-slate-400">{o.province}</span> : null}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{o.fulfillment_status || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600">{o.payment_status || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium text-slate-900">{fmtVnd(o.total_vat)}</td>
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
