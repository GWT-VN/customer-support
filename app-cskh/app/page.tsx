import Link from 'next/link'
import { Suspense } from 'react'
import { DieuHuong } from '@/components/DieuHuong'
import { searchMachines } from './actions'
import { WarrantyBadge, vnDate } from '@/components/Badge'
import { OTimKiem } from '@/components/OTimKiem'
import { ThanhDangLoc } from '@/components/ThanhDangLoc'
import { PhanTrang } from '@/components/PhanTrang'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; trang?: string }>
}) {
  const { q = '', trang: trangRaw } = await searchParams
  const trang = Math.max(1, Number(trangRaw) || 1)
  const { rows: machines, tong, soTrang } = await searchMachines(q, { trang })

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">Máy đã lắp</h1>
          <DieuHuong />
        </header>

        <Suspense>
          <OTimKiem placeholder="Gõ SĐT, serial hoặc tên khách…" />
        </Suspense>

        <ThanhDangLoc
          dieuKien={q ? [{ nhan: 'Từ khoá', giaTri: q }] : []}
          hienThi={machines.length}
          tong={tong}
          nhan="máy"
        />

        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Serial</th>
                <th className="text-left px-4 py-3 font-medium">Máy</th>
                <th className="text-left px-4 py-3 font-medium">Khách</th>
                <th className="text-left px-4 py-3 font-medium">SĐT</th>
                <th className="text-left px-4 py-3 font-medium">Lắp</th>
                <th className="text-left px-4 py-3 font-medium">Bảo hành</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {machines.map((m) => (
                <tr key={m.serial} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/may/${encodeURIComponent(m.serial)}`} prefetch={false} className="font-mono text-xs text-slate-900 underline">
                      {m.serial}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{m.product_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    {m.customer_id ? (
                      <Link href={`/khach/${m.customer_id}`} prefetch={false} className="text-slate-900 underline">{m.customer_name}</Link>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">
                    {m.primary_phone ?? <span className="text-amber-600">thiếu</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{vnDate(m.install_date)}</td>
                  <td className="px-4 py-3"><WarrantyBadge m={m} /></td>
                </tr>
              ))}
              {machines.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Không tìm thấy máy nào.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <Suspense>
          <PhanTrang trang={trang} soTrang={soTrang} />
        </Suspense>
      </div>
    </main>
  )
}
