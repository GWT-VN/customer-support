import Link from 'next/link'
import { DieuHuong } from '@/components/DieuHuong'
import { laAdmin } from '@/lib/supabase'
import { searchSerials, listSerialPending } from '@/app/actions'
import { SerialTao } from '@/components/SerialTao'
import { SerialPendingList } from '@/components/SerialPendingList'
import { KhungChon, OChonTatCa, OChonDong, ThanhDaChon } from '@/components/ChonDong'

export default async function SerialPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>
}) {
  const { q = '', tab = '' } = await searchParams
  const laCho = tab === 'cho'
  const [rows, pending, admin] = await Promise.all([
    laCho ? Promise.resolve([]) : searchSerials(q),
    listSerialPending('cho_duyet'),
    laAdmin(),
  ])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">Kho serial</h1>
          <DieuHuong />
        </header>

        <div className="flex gap-2 flex-wrap">
          <Link href="/serial"
            className={`px-3 py-1.5 rounded-lg text-sm border ${!laCho ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'}`}>
            Kho serial
          </Link>
          <Link href="/serial?tab=cho"
            className={`px-3 py-1.5 rounded-lg text-sm border ${laCho ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-amber-700 border-amber-200'}`}>
            Chờ duyệt ({pending.length})
          </Link>
        </div>

        {laCho ? (
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
              <button className="rounded-lg bg-slate-900 text-white px-5 font-medium">Tìm</button>
            </form>
            <p className="text-sm text-slate-500">{rows.length} serial{rows.length === 50 && ' (giới hạn 50 — gõ cụ thể hơn)'}</p>
            <KhungChon khoaTrang={rows.map((s) => s.serial)} bat={admin}>
            <ThanhDaChon nhan="serial" />
            <div className="bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <OChonTatCa nhan="serial" />
                    <th className="text-left px-4 py-3 font-medium">Serial</th>
                    <th className="text-left px-4 py-3 font-medium">Mã nội bộ</th>
                    <th className="text-left px-4 py-3 font-medium">Model</th>
                    <th className="text-left px-4 py-3 font-medium">Mã quốc tế</th>
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
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{s.ma_quoc_te ?? '—'}</td>
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
          </>
        )}
      </div>
    </main>
  )
}
