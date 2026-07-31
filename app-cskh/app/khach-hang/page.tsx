import Link from 'next/link'
import { Suspense } from 'react'
import { listKhachHang, khoaTatCaKhachHang, exportCuaToi } from '@/app/actions'
import { ExportKhachButton } from '@/components/ExportKhachButton'
import { OTimKiem, ThanhDangLoc, PhanTrang, TieuDeCotSapXep } from '@/bang'
import { KhungChon, OChonTatCa, OChonDong, ThanhDaChon } from '@/bang'
import { laAdmin } from '@/lib/supabase'

export default async function KhachHangPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; trang?: string; cot?: string; chieu?: string }>
}) {
  const { q = '', trang: trangRaw, cot, chieu } = await searchParams
  const trang = Math.max(1, Number(trangRaw) || 1)
  const [{ rows: list, tong, soTrang, sapXep }, admin, exportDuyet] = await Promise.all([
    listKhachHang(q, { trang, cot, chieu }),
    laAdmin(),
    exportCuaToi(),
  ])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">Khách hàng</h1>
        </header>

        <Suspense>
          <OTimKiem placeholder="Gõ tên khách, SĐT…" />
        </Suspense>

        <ThanhDangLoc
          dieuKien={q ? [{ nhan: 'Từ khoá', giaTri: q }] : []}
          hienThi={list.length}
          tong={tong}
          nhan="khách"
          sapXep={sapXep}
        />

        <ExportKhachButton q={q} daDuyet={exportDuyet} />

        <KhungChon
          khoaTrang={list.map((c) => c.id)}
          tong={tong}
          bat={admin}
          thamSo={{ q, cot, chieu }}
          layTatCaKhoa={khoaTatCaKhachHang}
        >
          <ThanhDaChon nhan="khách" />
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <Suspense>
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <OChonTatCa nhan="khách" />
                    <TieuDeCotSapXep cot="full_name" nhan="Khách" chieuMacDinh="asc" dangMacDinh />
                    <th className="text-left px-4 py-3 font-medium">SĐT</th>
                    <th className="text-left px-4 py-3 font-medium">Địa chỉ</th>
                    <TieuDeCotSapXep cot="province" nhan="Tỉnh/TP" chieuMacDinh="asc" />
                    <th className="text-right px-4 py-3 font-medium">Máy</th>
                  </tr>
                </thead>
              </Suspense>
              <tbody className="divide-y">
                {list.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 align-top">
                    <OChonDong khoa={c.id} moTa={`khách ${c.full_name}`} />
                    <td className="px-4 py-3">
                      <Link href={`/khach/${c.id}`} prefetch={false} className="text-slate-900 underline font-medium">
                        {c.full_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">
                      {c.primary_phone ?? <span className="text-amber-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.address ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{c.province ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{c.machines}</td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr><td colSpan={admin ? 6 : 5} className="px-4 py-10 text-center text-slate-400">Không tìm thấy khách nào.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </KhungChon>

        <Suspense>
          <PhanTrang trang={trang} soTrang={soTrang} />
        </Suspense>
      </div>
    </main>
  )
}
