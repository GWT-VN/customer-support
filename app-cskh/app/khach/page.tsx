import Link from 'next/link'
import { Suspense } from 'react'
import { listToFix, khoaTatCaKhach } from '@/app/actions'
import { OTimKiem } from '@/bang'
import { ThanhDangLoc } from '@/bang'
import { PhanTrang } from '@/bang'
import { TieuDeCotSapXep } from '@/bang'
import { laAdmin } from '@/lib/supabase'
import { KhungChon, OChonTatCa, OChonDong, ThanhDaChon } from '@/bang'

export default async function ToFixPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; trang?: string; cot?: string; chieu?: string }>
}) {
  const { q = '', trang: trangRaw, cot, chieu } = await searchParams
  const trang = Math.max(1, Number(trangRaw) || 1)
  const [{ rows: list, tong, soTrang, sapXep }, admin] = await Promise.all([
    listToFix(q, { trang, cot, chieu }),
    laAdmin(),
  ])
  // Chỉ tính trên trang hiện tại — tong ở trên là tổng số khách cần dọn thật.
  const thieuSdt = list.filter((c) => c.needs_phone)
  const thieuDiaChi = list.filter((c) => !c.address)

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        {/* KHÔNG có link lui: đây là trang danh sách cấp một, có mặt trong menu —
            không phải trang con của "Máy đã lắp". Nút lui chỉ dành cho trang chi tiết. */}
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">Khách cần dọn dữ liệu</h1>
        </header>

        <Suspense>
          <OTimKiem placeholder="Gõ tên khách, SĐT…" />
        </Suspense>

        <ThanhDangLoc
          dieuKien={q ? [{ nhan: 'Từ khoá', giaTri: q }] : []}
          hienThi={list.length}
          tong={tong}
          nhan="khách cần dọn"
          sapXep={sapXep}
        />

        <p className="text-sm text-slate-500">
          Trên trang này: {thieuSdt.length} thiếu/lỗi SĐT · {thieuDiaChi.length} thiếu địa chỉ.
          Di trú từ Odoo không lấp được — phải sửa tay. Bấm tên khách để sửa.
        </p>

        <KhungChon
          khoaTrang={list.map((c) => c.id)}
          tong={tong}
          bat={admin}
          thamSo={{ q, cot, chieu }}
          layTatCaKhoa={khoaTatCaKhach}
        >
        <ThanhDaChon nhan="khách" />
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <Suspense>
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <OChonTatCa nhan="khách" />
                  <TieuDeCotSapXep cot="full_name" nhan="Khách" chieuMacDinh="asc" dangMacDinh />
                  <th className="text-left px-4 py-3 font-medium">Máy</th>
                  <th className="text-left px-4 py-3 font-medium">SĐT</th>
                  <th className="text-left px-4 py-3 font-medium">Địa chỉ</th>
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
                    {c.notes && <p className="text-xs text-amber-700 mt-0.5 max-w-md">{c.notes}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.machines}</td>
                  <td className="px-4 py-3">
                    {c.needs_phone ? (
                      c.primary_phone ? (
                        <span className="font-mono text-xs text-amber-700">{c.primary_phone} ⚠️</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">thiếu</span>
                      )
                    ) : (
                      <span className="font-mono text-xs text-slate-600">{c.primary_phone}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.address ? (
                      <span className="text-slate-600 text-xs">{c.address.slice(0, 45)}…</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">thiếu</span>
                    )}
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={admin ? 5 : 4} className="px-4 py-10 text-center text-slate-400">
                    Không còn gì để dọn. 🎉
                  </td>
                </tr>
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
