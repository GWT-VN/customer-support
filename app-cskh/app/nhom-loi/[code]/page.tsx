import Link from 'next/link'
import { notFound } from 'next/navigation'
import { issueReport, ticketsInGroup } from '@/app/actions'
import { MucDoBadge, BaoHangBadge, NguonBadge } from '@/components/NhomLoiBadge'
import { StateBadge, vnDateTime } from '@/components/TicketBadge'

export default async function NhomLoiDetail({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const [all, tickets] = await Promise.all([issueReport(false), ticketsInGroup(code)])
  const nhom = all.find((r) => r.code === code)
  if (!nhom) notFound()

  // model nào dính nhiều nhất -> bằng chứng cho công ty mẹ
  const theoModel = new Map<string, number>()
  for (const t of tickets) {
    const k = t.internal_code ?? '(chưa gắn máy)'
    theoModel.set(k, (theoModel.get(k) ?? 0) + 1)
  }
  const models = [...theoModel.entries()].sort((a, b) => b[1] - a[1])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="space-y-2">
          <Link href="/nhom-loi" className="text-sm text-slate-600 hover:text-slate-900 underline">
            ← Tất cả nhóm lỗi
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-slate-900">{nhom.ten}</h1>
            <MucDoBadge muc_do={nhom.muc_do} />
            {nhom.bao_hang && <BaoHangBadge />}
          </div>
          {nhom.mo_ta && <p className="text-sm text-slate-600 max-w-3xl">{nhom.mo_ta}</p>}
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { l: 'Ticket', v: nhom.so_ticket },
            { l: 'Đang mở', v: nhom.dang_mo, hot: nhom.dang_mo > 0 },
            { l: '90 ngày qua', v: nhom.trong_90_ngay },
            { l: 'Khách dính', v: nhom.so_khach },
            { l: 'Máy dính', v: nhom.so_may },
          ].map((s) => (
            <div key={s.l} className="bg-white rounded-xl border p-3">
              <div className="text-xs text-slate-500">{s.l}</div>
              <div className={`text-2xl font-semibold ${s.hot ? 'text-amber-700' : 'text-slate-900'}`}>{s.v}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-medium text-slate-900 mb-2">Model dính lỗi</h2>
          <div className="flex flex-wrap gap-2">
            {models.map(([m, n]) => (
              <span key={m} className="px-2 py-1 rounded-lg bg-slate-100 text-xs">
                <span className="font-mono text-slate-800">{m}</span>
                <span className="text-slate-500"> × {n}</span>
              </span>
            ))}
          </div>
          {theoModel.has('(chưa gắn máy)') && (
            <p className="text-xs text-amber-700 mt-2">
              ⚠️ {theoModel.get('(chưa gắn máy)')} ticket chưa gắn serial nên không biết model —
              báo hãng sẽ thiếu bằng chứng. Gắn serial ở trang ticket để số này chính xác.
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Ticket</th>
                <th className="text-left px-4 py-3 font-medium">Ngày</th>
                <th className="text-left px-4 py-3 font-medium">Trạng thái</th>
                <th className="text-left px-4 py-3 font-medium">Máy</th>
                <th className="text-left px-4 py-3 font-medium">Khách</th>
                <th className="text-left px-4 py-3 font-medium">Khách báo gì</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tickets.map((t) => (
                <tr key={t.ticket_code} className="hover:bg-slate-50 align-top">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link href={`/ticket/${t.ticket_code}`} className="font-mono text-xs text-slate-900 underline">
                      {t.ticket_code}
                    </Link>
                    <div className="mt-1"><NguonBadge nguon={t.nguon} /></div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{vnDateTime(t.created_at)}</td>
                  <td className="px-4 py-3"><StateBadge state={t.state} /></td>
                  <td className="px-4 py-3">
                    {t.serial ? (
                      <>
                        <Link href={`/may/${encodeURIComponent(t.serial)}`} className="text-slate-900 underline">
                          {t.product_name ?? t.internal_code}
                        </Link>
                        <div className="font-mono text-[10px] text-slate-400">{t.serial}</div>
                      </>
                    ) : (
                      <span className="text-amber-600 text-xs">chưa gắn máy</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {t.customer_id ? (
                      <Link href={`/khach/${t.customer_id}`} className="text-slate-900 underline">{t.customer_name}</Link>
                    ) : <span className="text-slate-400">—</span>}
                    <div className="font-mono text-xs text-slate-500">{t.primary_phone ?? ''}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700 max-w-md">
                    {t.description ?? <span className="text-slate-400 italic">không ghi mô tả</span>}
                    <div className="text-[10px] text-slate-400 mt-0.5">loại Odoo: {t.ticket_type ?? '—'}</div>
                  </td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Nhóm này chưa có ticket nào.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
