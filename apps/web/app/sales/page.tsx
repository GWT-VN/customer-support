import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { coTheVaoSales, requireNhanSu } from '@/lib/supabase'
import { BoLocChon, BoLocGoiY, LocNgay, OTimKiem, ThanhDangLoc } from '@/bang'
import { danhSachDon, kenhChiTietTrongDon, kenhTrongDon, spTrongDon } from './actions'
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

type ThamSo = {
  q?: string; tab?: string
  // Tên tham số lọc ngày theo chuẩn TOÀN APP — xem docs/CHUAN-FILTER.md.
  ngtu?: string; ngden?: string
  tt?: string; tp?: string; kenh?: string; kenh2?: string; sp?: string
}

export default async function SalesDonPage({ searchParams }: { searchParams: Promise<ThamSo> }) {
  await requireNhanSu()
  if (!(await coTheVaoSales())) redirect('/?loi=khong_du_quyen')
  const sp0 = await searchParams
  const { q, ngtu, ngden, tt, tp, kenh, kenh2, sp } = sp0
  const curTab = sp0.tab ?? ''
  const [rows, kenhOpts, kenhCtOpts, spOpts] = await Promise.all([
    danhSachDon(q ?? '', curTab, { ngtu, ngden, tt, tp, kenh, kenh2, sp }),
    kenhTrongDon(),
    kenhChiTietTrongDon(),
    spTrongDon(),
  ])
  // Chọn kênh cấp 1 rồi thì cấp 2 chỉ hiện chi tiết THUỘC kênh đó — đỡ phải cuộn qua
  // chi tiết của kênh khác. Chưa chọn cấp 1 thì hiện tất cả.
  const kenh2Opts = (kenh ? kenhCtOpts.filter((k) => k.kenh === kenh) : kenhCtOpts)
    .map((k) => ({ giaTri: k.chiTiet, nhan: kenh ? k.chiTiet : `${k.chiTiet} (${k.kenh || '—'})` }))

  const dieuKien = [
    ngtu || ngden ? { nhan: 'Ngày', giaTri: `${ngtu || '…'} → ${ngden || '…'}` } : null,
    tt ? { nhan: 'Tình trạng', giaTri: tt } : null,
    tp ? { nhan: 'Thanh toán', giaTri: tp } : null,
    kenh ? { nhan: 'Kênh', giaTri: kenh } : null,
    kenh2 ? { nhan: 'Kênh chi tiết', giaTri: kenh2 } : null,
    sp ? { nhan: 'Sản phẩm', giaTri: sp } : null,
  ].filter(Boolean) as { nhan: string; giaTri: string }[]

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

        {/* Mọi component dưới đây đọc useSearchParams -> BẮT BUỘC bọc Suspense,
            thiếu là `next build` fail chứ không phải cảnh báo. */}
        <Suspense fallback={<div className="h-24" />}>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <OTimKiem placeholder="Tìm mã đơn / tên khách / sản phẩm…" />
            <div className="flex flex-wrap items-center gap-2">
              <LocNgay nhan="Ngày đơn" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <BoLocChon param="tt" nhan="Tình trạng" tuyChon={FULFILL_OPTS.map((o) => ({ giaTri: o, nhan: o }))} />
              <BoLocChon param="tp" nhan="Thanh toán" tuyChon={PAYMENT_OPTS.map((o) => ({ giaTri: o, nhan: o }))} />
              <BoLocChon param="kenh" nhan="Kênh" tuyChon={kenhOpts.map((o) => ({ giaTri: o, nhan: o }))} />
              <BoLocChon param="kenh2" nhan="Kênh chi tiết" tuyChon={kenh2Opts} />
              {/* Sản phẩm dùng ô GÕ-ĐỂ-GỢI-Ý: danh mục quá dài để cuộn tay. Gõ mã hoặc tên đều ra. */}
              <BoLocGoiY param="sp" nhan="Sản phẩm" tuyChon={spOpts.map((o) => ({ giaTri: o.ma, nhan: o.ten }))} />
            </div>
          </div>
        </Suspense>

        <ThanhDangLoc dieuKien={dieuKien} hienThi={rows.length} tong={rows.length} nhan="đơn" />

        {sp && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Đang lọc theo sản phẩm <b>{sp}</b> — cột <b>Tổng</b> chỉ cộng các dòng khớp sản phẩm này,
            không phải tổng cả đơn.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const params = new URLSearchParams()
            for (const [k, v] of Object.entries(sp0)) if (k !== 'tab' && v) params.set(k, v)
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
