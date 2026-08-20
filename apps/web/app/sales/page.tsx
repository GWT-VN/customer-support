import Link from 'next/link'
import { redirect } from 'next/navigation'
import { coTheVaoSales, requireNhanSu } from '@/lib/supabase'
import { danhSachDon } from './actions'
import { FULFILL_OPTS, PAYMENT_OPTS } from './_types'

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

export default async function SalesDonPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string; tab?: string; tu?: string; den?: string
    tt?: string | string[]; tp?: string | string[]; ttx?: string; tpx?: string
  }>
}) {
  await requireNhanSu()
  if (!(await coTheVaoSales())) redirect('/?loi=khong_du_quyen')
  const sp = await searchParams
  const q = sp.q
  const curTab = sp.tab ?? ''
  const tu = sp.tu ?? ''
  const den = sp.den ?? ''
  const asArr = (v?: string | string[]) => (Array.isArray(v) ? v : v ? [v] : [])
  const ttArr = asArr(sp.tt)
  const tpArr = asArr(sp.tp)
  const ttEx = sp.ttx === '1'
  const tpEx = sp.tpx === '1'
  const rows = await danhSachDon(q ?? '', curTab, { tu, den, tt: ttArr, tp: tpArr, ttEx, tpEx })

  // preset khoảng thời gian (tính ở server component — new Date OK)
  const now = new Date()
  const isoD = (d: Date) => d.toISOString().slice(0, 10)
  const today = isoD(now)
  const thang1 = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const dow = (now.getDay() + 6) % 7 // Thứ 2 = 0
  const monday = isoD(new Date(now.getTime() - dow * 864e5))
  function presetHref(from: string) {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (curTab) p.set('tab', curTab)
    p.set('tu', from)
    p.set('den', today)
    ttArr.forEach((v) => p.append('tt', v))
    tpArr.forEach((v) => p.append('tp', v))
    if (ttEx) p.set('ttx', '1')
    if (tpEx) p.set('tpx', '1')
    return `/sales?${p.toString()}`
  }
  const presets = [
    { label: 'Hôm nay', from: today },
    { label: 'Tuần này', from: monday },
    { label: 'Tháng này', from: thang1 },
    { label: '30 ngày', from: isoD(new Date(now.getTime() - 30 * 864e5)) },
  ]
  const coLoc = !!(tu || den || ttArr.length || tpArr.length)

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
          <input type="hidden" name="tu" value={tu} />
          <input type="hidden" name="den" value={den} />
          {ttArr.map((v) => <input key={v} type="hidden" name="tt" value={v} />)}
          {tpArr.map((v) => <input key={v} type="hidden" name="tp" value={v} />)}
          {ttEx && <input type="hidden" name="ttx" value="1" />}
          {tpEx && <input type="hidden" name="tpx" value="1" />}
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

        <form className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <input type="hidden" name="q" value={q ?? ''} />
          <input type="hidden" name="tab" value={curTab} />
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-slate-500">Từ ngày
              <input type="date" name="tu" defaultValue={tu} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-800" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-500">Đến ngày
              <input type="date" name="den" defaultValue={den} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-800" />
            </label>
            <span className="ml-auto flex items-center gap-1.5">
              {presets.map((p) => (
                <Link key={p.label} href={presetHref(p.from)} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:border-slate-300">{p.label}</Link>
              ))}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-100 pt-2.5">
            <span className="mr-1 text-xs font-medium text-slate-500">Tình trạng:</span>
            {FULFILL_OPTS.map((o) => (
              <label key={o} className="flex items-center gap-1 text-xs text-slate-700">
                <input type="checkbox" name="tt" value={o} defaultChecked={ttArr.includes(o)} className="accent-[#0e8c9a]" /> {o}
              </label>
            ))}
            <label className="flex items-center gap-1 text-xs font-medium text-rose-600" title="Chọn hết TRỪ các mục tick">
              <input type="checkbox" name="ttx" value="1" defaultChecked={ttEx} className="accent-rose-500" /> loại trừ
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="mr-1 text-xs font-medium text-slate-500">Thanh toán:</span>
            {PAYMENT_OPTS.map((o) => (
              <label key={o} className="flex items-center gap-1 text-xs text-slate-700">
                <input type="checkbox" name="tp" value={o} defaultChecked={tpArr.includes(o)} className="accent-[#0e8c9a]" /> {o}
              </label>
            ))}
            <label className="flex items-center gap-1 text-xs font-medium text-rose-600" title="Chọn hết TRỪ các mục tick">
              <input type="checkbox" name="tpx" value="1" defaultChecked={tpEx} className="accent-rose-500" /> loại trừ
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-white hover:bg-slate-900">Lọc</button>
            {coLoc && <Link href={curTab ? `/sales?tab=${curTab}` : '/sales'} className="text-xs text-slate-500 hover:underline">Xoá lọc</Link>}
          </div>
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
