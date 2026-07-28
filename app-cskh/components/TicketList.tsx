import Link from 'next/link'
import type { Ticket } from '@/app/actions'
import { StateBadge, KhanBadge, vnDateTime } from '@/components/TicketBadge'

/** Danh sách ticket rút gọn — nhúng vào trang máy / trang khách. */
export function TicketList({ tickets, empty }: { tickets: Ticket[]; empty: string }) {
  if (tickets.length === 0) return <p className="text-sm text-slate-400">{empty}</p>
  return (
    <ul className="divide-y border rounded-lg">
      {tickets.map((t) => (
        <li key={t.ticket_code} className="px-3 py-2.5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/ticket/${t.ticket_code}`} prefetch={false} className="font-mono text-xs text-slate-900 underline">
              {t.ticket_code}
            </Link>
            <span className="text-xs text-slate-400"> · {vnDateTime(t.created_at)}</span>
            <p className="text-sm text-slate-700">{t.ticket_type}</p>
            {t.description && (
              <p className="text-xs text-slate-500 line-clamp-2">{t.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-none">
            <KhanBadge khan={t.khan} />
            <StateBadge state={t.state} />
          </div>
        </li>
      ))}
    </ul>
  )
}
