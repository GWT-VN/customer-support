import Link from 'next/link'
import { ticketThieuData, boComboThieuCon, listToFix } from '@/app/actions'
import { vnDateTime } from '@/components/TicketBadge'

export default async function CanDonPage() {
  const [tickets, boThieu, khach] = await Promise.all([
    ticketThieuData(), boComboThieuCon(), listToFix('', { moiTrang: 1 }),
  ])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        <header>
          <h1 className="text-xl font-semibold text-slate-900">Data cần dọn</h1>
          <p className="text-sm text-slate-500 mt-1">Các mục thiếu dữ liệu cần bổ sung để hồ sơ đủ.</p>
        </header>

        {/* 1. Ticket thiếu máy/khách */}
        <section className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b flex items-center justify-between">
            <span className="font-medium text-slate-800">Ticket thiếu máy / khách ({tickets.length})</span>
            <Link href="/tao-ticket" className="text-xs text-slate-500 underline">+ Tạo ticket</Link>
          </div>
          {tickets.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400">Không có ticket nào thiếu dữ liệu.</p>
          ) : (
            <ul className="divide-y text-sm max-h-96 overflow-auto">
              {tickets.map((t) => (
                <li key={t.ticket_code} className="px-4 py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/ticket/${t.ticket_code}`} prefetch={false} className="font-mono text-xs text-slate-900 underline">{t.ticket_code}</Link>
                    <span className="text-slate-400 text-xs"> · {vnDateTime(t.created_at)}</span>
                    <div className="text-xs text-slate-500 truncate">
                      {t.customer_name ?? '— chưa có khách —'}{t.source_serial ? ` · serial ${t.source_serial}` : ''}
                    </div>
                  </div>
                  <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] flex-none whitespace-nowrap">thiếu {t.thieu}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 2. Bộ combo thiếu con */}
        <section className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b font-medium text-slate-800">
            Bộ WH15A/WH30A(ECO) chưa đủ 3 thiết bị ({boThieu.length})
          </div>
          {boThieu.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400">Không có bộ nào thiếu con.</p>
          ) : (
            <ul className="divide-y text-sm max-h-96 overflow-auto">
              {boThieu.map((b) => (
                <li key={b.ma_bo} className="px-4 py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/may/${encodeURIComponent(b.ma_bo)}`} prefetch={false} className="font-mono text-xs text-slate-900 underline">{b.ma_bo}</Link>
                    <span className="text-slate-400 text-xs"> · {b.combo}</span>
                    <div className="text-xs text-slate-500 truncate">{b.customer_name ?? '—'}</div>
                  </div>
                  <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[11px] flex-none whitespace-nowrap">{b.so_con}/3 con</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 3. Khách cần dọn (link sang trang chi tiết) */}
        <section className="bg-white rounded-xl border px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <span className="font-medium text-slate-800">Khách cần dọn (thiếu SĐT / địa chỉ)</span>
            <div className="text-xs text-slate-500">{khach.tong} khách cần bổ sung thông tin liên hệ.</div>
          </div>
          <Link href="/khach" className="rounded-lg border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 whitespace-nowrap">Mở danh sách →</Link>
        </section>
      </div>
    </main>
  )
}
