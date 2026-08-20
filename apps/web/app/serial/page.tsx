import Link from 'next/link'
import { laQuanLy } from '@/lib/supabase'
import { Suspense } from 'react'
import { searchSerialsTrang, listSerialPending, khoaTatCaSerial, catalogChon, dsTrangThai, type SerialRow, type CatalogChon } from '@/app/actions'
import type { KetQuaTrang } from '@/bang'
import { PhanTrang } from '@/bang'
import { DauTrang } from '@/components/DauTrang'
import { SerialTao } from '@/components/SerialTao'
import { SerialPendingList } from '@/components/SerialPendingList'
import { NhapKhoSerial } from '@/components/NhapKhoSerial'
import { DoiTrangThaiKho } from '@/components/DoiTrangThaiKho'
import { TrangThaiCauHinh } from '@/components/TrangThaiCauHinh'
import { KhungChon, OChonTatCa, OChonDong, ThanhDaChon } from '@/bang'

export default async function SerialPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string; trang?: string; tt?: string }>
}) {
  const { q = '', tab = '', trang: trangRaw, tt = '' } = await searchParams
  const trang = Math.max(1, Number(trangRaw) || 1)
  const laCho = tab === 'cho'
  const laNhap = tab === 'nhap'
  const laCauHinh = tab === 'cauhinh'
  const [{ rows, tong, soTrang }, pending, admin, catalog, dsTT] = await Promise.all([
    laCho || laNhap || laCauHinh
      ? Promise.resolve<KetQuaTrang<SerialRow>>({
          rows: [], tong: 0, trang: 1, soTrang: 1,
          sapXep: { cot: 'serial', tang: true, macDinh: true },
        })
      : searchSerialsTrang(q, { trang }, tt),
    listSerialPending('cho_duyet'),
    laQuanLy(),
    laNhap ? catalogChon() : Promise.resolve<CatalogChon[]>([]),
    dsTrangThai(),
  ])
  const nhanTT = (code: string) => dsTT.find((t) => t.code === code)?.nhan ?? code

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <DauTrang tieuDe="Kho serial" phuDe="Serial trong kho, đã xuất và chờ nhập" />

        <div className="flex gap-2 flex-wrap">
          <Link href="/serial"
            className={`px-3 py-1.5 rounded-lg text-sm border ${!laCho && !laNhap ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'}`}>
            Kho serial
          </Link>
          {admin && (
            <Link href="/serial?tab=nhap"
              className={`px-3 py-1.5 rounded-lg text-sm border ${laNhap ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'}`}>
              + Nhập kho
            </Link>
          )}
          <Link href="/serial?tab=cho"
            className={`px-3 py-1.5 rounded-lg text-sm border ${laCho ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-amber-700 border-amber-200'}`}>
            Chờ duyệt ({pending.length})
          </Link>
          {admin && (
            <Link href="/serial?tab=cauhinh"
              className={`px-3 py-1.5 rounded-lg text-sm border ${laCauHinh ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'}`}>
              Cấu hình trạng thái
            </Link>
          )}
        </div>

        {laCauHinh ? (
          admin ? <TrangThaiCauHinh ds={dsTT} /> : <p className="text-sm text-amber-600">Chỉ admin.</p>
        ) : laNhap ? (
          <section className="space-y-3">
            {admin ? (
              <NhapKhoSerial catalog={catalog} />
            ) : (
              <p className="text-sm text-amber-600">Chỉ admin mới nhập kho trực tiếp. Bạn có thể “Tạo serial mới (chờ duyệt)”.</p>
            )}
          </section>
        ) : laCho ? (
          <section className="space-y-3">
            <SerialTao />
            <SerialPendingList items={pending} laAdmin={admin} />
          </section>
        ) : (
          <>
            <form className="flex gap-2">
              <input name="q" defaultValue={q}
                placeholder="Gõ serial, mã nội bộ, model, mã quốc tế…"
                className="flex-1 rounded-lg border px-4 py-2.5 text-slate-900 bg-white" />
              {tt && <input type="hidden" name="tt" value={tt} />}
              <button className="rounded-lg bg-slate-900 text-white px-5 font-medium">Tìm</button>
            </form>
            <div className="flex gap-1.5 flex-wrap">
              <Link href={`/serial${q ? `?${new URLSearchParams({ q })}` : ''}`}
                className={`px-2.5 py-1 rounded-lg text-xs border ${!tt ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'}`}>
                Tất cả
              </Link>
              {dsTT.map((t) => (
                <Link key={t.code} href={`/serial?${new URLSearchParams({ ...(q && { q }), tt: t.code })}`}
                  className={`px-2.5 py-1 rounded-lg text-xs border ${tt === t.code ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'}`}>
                  {t.nhan}
                </Link>
              ))}
            </div>
            <p className="text-sm text-slate-500">
              {rows.length < tong ? `Hiện ${rows.length} trên ${tong} serial` : `${tong} serial`}
              {tt && <span className="text-slate-400"> · lọc: {nhanTT(tt)}</span>}
            </p>
            <KhungChon
              khoaTrang={rows.map((s) => s.serial)}
              tong={tong}
              bat={admin}
              thamSo={{ q, ...(tt && { tt }) }}
              layTatCaKhoa={khoaTatCaSerial}
            >
            <ThanhDaChon nhan="serial" />
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <OChonTatCa nhan="serial" />
                    <th className="text-left px-4 py-3 font-medium">Serial</th>
                    <th className="text-left px-4 py-3 font-medium">Mã nội bộ</th>
                    <th className="text-left px-4 py-3 font-medium">Model</th>
                    <th className="text-left px-4 py-3 font-medium">Trạng thái</th>
                    <th className="text-left px-4 py-3 font-medium">Tên nội bộ</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((s) => (
                    <tr key={s.serial} className="hover:bg-slate-50">
                      <OChonDong khoa={s.serial} moTa={`serial ${s.serial}`} />
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-900">{s.serial}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{s.internal_code ?? '—'}</td>
                      <td className="px-4 py-2.5 text-slate-700">{s.model ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <DoiTrangThaiKho serial={s.serial} trangThai={s.trang_thai} laAdmin={admin} ds={dsTT} />
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{s.ten_noi_bo ?? '—'}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={admin ? 6 : 5} className="px-4 py-10 text-center text-slate-400">
                        Không tìm thấy serial nào.
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
          </>
        )}
      </div>
    </main>
  )
}
