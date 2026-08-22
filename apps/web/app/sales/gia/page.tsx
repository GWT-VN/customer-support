import Link from 'next/link'
import { Suspense } from 'react'
import { OTimKiem, ThanhDangLoc } from '@/bang'
import { boDau } from '@/bang'
import { bangGiaNiemYet } from './actions'

export const metadata = { title: 'Bảng giá niêm yết · GWT Sales' }
export const dynamic = 'force-dynamic'

const vnd = new Intl.NumberFormat('vi-VN')

export default async function BangGiaPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const tatCa = await bangGiaNiemYet()
  const s = boDau((q ?? '').trim())
  const ds = s ? tatCa.filter((x) => boDau(x.ma).includes(s) || boDau(x.ten).includes(s)) : tatCa

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1000px] space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/sales/gia/chinh-sach" className="text-teal-700 hover:underline">Chính sách giá đại lý →</Link>
          <Link href="/sales/gia/doi-tac" className="text-teal-700 hover:underline">Đối tác đại lý →</Link>
        </div>

        <header>
          <h1 className="text-xl font-semibold text-slate-900">Bảng giá niêm yết</h1>
          <p className="text-sm text-slate-500">
            Gương từ Masterdata — khu Sales <b>chỉ đọc</b>. Sản phẩm chưa có giá thì không kéo về.
          </p>
        </header>

        <Suspense fallback={<div className="h-12" />}>
          <OTimKiem placeholder="Gõ mã hoặc tên sản phẩm…" />
        </Suspense>
        <ThanhDangLoc dieuKien={q ? [{ nhan: 'Tìm', giaTri: q }] : []} hienThi={ds.length} tong={tatCa.length} nhan="sản phẩm" />

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Mã nội bộ</th>
                  <th className="px-3 py-2.5 font-medium">Tên sản phẩm</th>
                  <th className="px-3 py-2.5 text-center font-medium">Thuế</th>
                  <th className="px-3 py-2.5 text-right font-medium">Giá niêm yết (gồm VAT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ds.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-10 text-center text-slate-400">Không có mã nào khớp.</td></tr>
                ) : ds.map((x) => (
                  <tr key={x.ma} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-500">{x.ma}</td>
                    <td className="px-3 py-2 text-slate-800">{x.ten}</td>
                    <td className="px-3 py-2 text-center">
                      {x.vat_loai === 'KCT' || x.vat_loai === 'KAD' ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{x.vat_loai}</span>
                      ) : (
                        <span className="text-xs text-slate-500">{x.vat_pct == null ? '—' : `${Math.round(x.vat_pct * 100)}%`}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                      {vnd.format(x.gia_vat)} ₫
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}
