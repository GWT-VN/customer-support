import Link from 'next/link'
import { searchMachines } from './actions'
import { WarrantyBadge, vnDate } from '@/components/Badge'

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams
  const machines = await searchMachines(q)

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">Máy đã lắp</h1>
          <div className="flex gap-4">
            <Link href="/loi" className="text-sm text-slate-600 hover:text-slate-900 underline">
              Lịch thay lõi
            </Link>
            <Link href="/ticket" className="text-sm text-slate-600 hover:text-slate-900 underline">
              Ticket
            </Link>
            <Link href="/khach" className="text-sm text-slate-600 hover:text-slate-900 underline">
              Khách cần dọn dữ liệu
            </Link>
          </div>
        </header>

        <form className="flex gap-2">
          <input
            name="q" defaultValue={q}
            placeholder="Gõ SĐT, serial hoặc tên khách…"
            className="flex-1 rounded-lg border px-4 py-2.5 text-slate-900 bg-white"
          />
          <button className="rounded-lg bg-slate-900 text-white px-5 font-medium">Tìm</button>
        </form>

        <p className="text-sm text-slate-500">
          {q ? `${machines.length} kết quả cho “${q}”` : `${machines.length} máy lắp gần nhất`}
          {machines.length === 50 && ' (giới hạn 50 — gõ cụ thể hơn để thu hẹp)'}
        </p>

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
                    <Link href={`/may/${encodeURIComponent(m.serial)}`} className="font-mono text-xs text-slate-900 underline">
                      {m.serial}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{m.product_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    {m.customer_id ? (
                      <Link href={`/khach/${m.customer_id}`} className="text-slate-900 underline">{m.customer_name}</Link>
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
      </div>
    </main>
  )
}
