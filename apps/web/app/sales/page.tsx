import Link from 'next/link'
import { redirect } from 'next/navigation'
import { coTheVaoSales } from '@/lib/nen-tang/gac-cong'
import { requireNhanSu } from '@/lib/nen-tang/phien'
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
const TABS = [
  { key: '', label: 'Tất cả' },
  { key: 'DON_POE', label: 'POE' },
  { key: 'DON_POU', label: 'POU' },
  { key: 'DON_OTHERS', label: 'Khác' },
  { key: 'DON_TANG', label: 'Tặng' },
]

export default async function SalesDonPage({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string }> }) {
  await requireNhanSu()
  if (!(await coTheVaoSales())) redirect('/?loi=khong_du_quyen')
  const { q, tab } = await searchParams
  const curTab = tab ?? ''
  const rows = await danhSachDon(q ?? '', curTab)

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1100px] space-y-4 p-4 sm:p-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Đơn hàng</h1>
            <p className="text-sm text-slate-500">{rows.length} đơn · đơn tag &ldquo;App&rdquo; = tạo trên app (sửa/xoá được)</p>
          </div>
          <Link href="/sales/don/moi" className="rounded-lg bg-[#0e8c9a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a6771]">＋ Tạo đơn</Link>
        </header>

        <form className="flex gap-2">
          <input type="hidden" name="tab" value={curTab} />
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Tìm mã đơn / tên khách / sản phẩm…"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
          />
          <button className="rounded-lg bg-[#0e8c9a] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a6771]">Tìm</button>
        </form>

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const params = new URLSearchParams()
            if (q) params.set('q', q)
            if (t.key) params.set('tab', t.key)
            const href = '/sales' + (params.toString() ? `?${params.toString()}` : '')
            const on = curTab === t.key
            return (
              <Link
                key={t.key || 'all'}
                href={href}
                className={'rounded-full border px-3 py-1.5 text-xs font-medium ' + (on ? 'border-[#0e8c9a] bg-[#0e8c9a] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300')}
              >
                {t.label}
              </Link>
            )
          })}
        </div>

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
                        <Link
                          href={`/sales/don/${encodeURIComponent(o.order_code)}`}
                          className="inline-flex items-center gap-2 font-medium text-teal-700 hover:underline"
                        >
                          {o.source_tab && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                              {TAB_LABEL[o.source_tab] ?? o.source_tab}
                            </span>
                          )}
                          {o.order_code}
                          {o.is_app && (
                            <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">App</span>
                          )}
                        </Link>
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
