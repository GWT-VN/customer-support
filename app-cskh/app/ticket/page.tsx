import Link from 'next/link'
import { searchTickets, currentStaff } from '@/app/actions'
import { StateBadge, KhanBadge, MayThieuBadge, vnDateTime } from '@/components/TicketBadge'
import { ExportButton } from '@/components/ExportButton'

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; state?: string; khan?: string; mine?: string }>
}) {
  const { q = '', state = '', khan = '', mine = '' } = await searchParams
  const onlyKhan = khan === '1'
  const isMine = mine === '1'
  const me = isMine ? await currentStaff() : null
  const tickets =
    isMine && !me
      ? []
      : await searchTickets(q, onlyKhan ? undefined : state || undefined, onlyKhan, me?.id)

  const tabs = [
    { key: '', label: 'Tất cả' },
    { key: 'Open', label: 'Đang mở' },
    { key: 'Done', label: 'Đã xong' },
    { key: 'Cancel', label: 'Đã huỷ' },
  ]

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">Ticket CSKH</h1>
          <div className="flex gap-4">
            <Link href="/nhom-loi" className="text-sm text-slate-600 hover:text-slate-900 underline">Nhóm lỗi</Link>
            <Link href="/loi" className="text-sm text-slate-600 hover:text-slate-900 underline">Lịch thay lõi</Link>
            <Link href="/" className="text-sm text-slate-600 hover:text-slate-900 underline">Tra máy đã lắp</Link>
          </div>
        </header>

        <form className="flex gap-2">
          {state && <input type="hidden" name="state" value={state} />}
          <input
            name="q" defaultValue={q}
            placeholder="Gõ mã ticket, serial, tên khách, SĐT hoặc nội dung lỗi…"
            className="flex-1 rounded-lg border px-4 py-2.5 text-slate-900 bg-white"
          />
          <button className="rounded-lg bg-slate-900 text-white px-5 font-medium">Tìm</button>
        </form>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={`/ticket?${new URLSearchParams({ ...(q && { q }), ...(t.key && { state: t.key }) })}`}
                className={`px-3 py-1.5 rounded-lg text-sm border ${
                  !onlyKhan && !isMine && state === t.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'
                }`}
              >
                {t.label}
              </Link>
            ))}
            <Link
              href={`/ticket?${new URLSearchParams({ ...(q && { q }), khan: '1' })}`}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                onlyKhan ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-600 border-red-200'
              }`}
            >
              🔴 Khẩn
            </Link>
            <Link
              href={`/ticket?${new URLSearchParams({ ...(q && { q }), mine: '1' })}`}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                isMine ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'
              }`}
            >
              Việc của tôi
            </Link>
          </div>
          <ExportButton q={q} state={onlyKhan || isMine ? undefined : state || undefined} khan={onlyKhan} mine={isMine} />
        </div>

        <p className="text-sm text-slate-500">
          {tickets.length} ticket{tickets.length === 50 && ' (giới hạn 50 — gõ cụ thể hơn)'}
        </p>

        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Mã</th>
                <th className="text-left px-4 py-3 font-medium">Ngày</th>
                <th className="text-left px-4 py-3 font-medium">Loại</th>
                <th className="text-left px-4 py-3 font-medium">Khách</th>
                <th className="text-left px-4 py-3 font-medium">Máy</th>
                <th className="text-left px-4 py-3 font-medium">Phụ trách</th>
                <th className="text-left px-4 py-3 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tickets.map((t) => (
                <tr key={t.ticket_code} className="hover:bg-slate-50 align-top">
                  <td className="px-4 py-3">
                    <Link href={`/ticket/${t.ticket_code}`} className="font-mono text-xs text-slate-900 underline">
                      {t.ticket_code}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{vnDateTime(t.created_at)}</td>
                  <td className="px-4 py-3 text-slate-700 max-w-56">{t.ticket_type ?? '—'}</td>
                  <td className="px-4 py-3">
                    {t.customer_id ? (
                      <Link href={`/khach/${t.customer_id}`} className="text-slate-900 underline">{t.customer_name}</Link>
                    ) : (
                      <span className="text-slate-500">{t.customer_name ?? '—'}</span>
                    )}
                    {t.primary_phone && <div className="font-mono text-xs text-slate-500">{t.primary_phone}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {t.serial ? (
                      <Link href={`/may/${encodeURIComponent(t.serial)}`} className="text-slate-900 underline">
                        {t.product_name}
                      </Link>
                    ) : t.source_serial ? (
                      <MayThieuBadge t={t} />
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {t.cs_ten || t.ky_thuat_ten ? (
                      <>
                        {t.cs_ten && <div>CS: {t.cs_ten}</div>}
                        {t.ky_thuat_ten && <div>KT: {t.ky_thuat_ten}</div>}
                      </>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <KhanBadge khan={t.khan} />
                      <StateBadge state={t.state} />
                    </div>
                  </td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Không tìm thấy ticket nào.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
