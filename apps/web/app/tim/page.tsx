import Link from 'next/link'
import { timGop } from '@/app/actions'
import { WarrantyBadge, vnDate } from '@/components/Badge'
import { StateBadge, KhanBadge, vnDateTime } from '@/components/TicketBadge'

/**
 * Một khối kết quả (máy / ticket / khách): tiêu đề kèm TỔNG SỐ THẬT, tối đa 5 dòng,
 * và link "Xem tất cả N…" khi còn dòng chưa hiện. Khối rỗng ghi rõ lý do — người dùng
 * cần phân biệt "đã tìm ở đó mà không thấy" với "không tìm ở đó" (bài học Task 5b).
 */
function Khoi({
  tieuDe,
  rongText,
  xemTatCa,
  children,
}: {
  tieuDe: string
  rongText: string
  xemTatCa: { href: string; nhan: string } | null
  children: React.ReactNode
}) {
  return (
    <section className="bg-white rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium text-slate-900">{tieuDe}</h2>
        {xemTatCa && (
          <Link href={xemTatCa.href} className="text-sm text-slate-600 underline hover:text-slate-900">
            {xemTatCa.nhan}
          </Link>
        )}
      </div>
      {children ?? <p className="text-sm text-slate-400">{rongText}</p>}
    </section>
  )
}

export default async function TimGopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = '' } = await searchParams
  const coTuKhoa = q.trim().length > 0
  const { may, ticket, khach, tongMay, tongTicket, tongKhach } = coTuKhoa
    ? await timGop(q)
    : { may: [], ticket: [], khach: [], tongMay: 0, tongTicket: 0, tongKhach: 0 }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">
            {coTuKhoa ? <>Kết quả cho &ldquo;{q}&rdquo;</> : 'Tìm kiếm'}
          </h1>
        </header>

        {!coTuKhoa ? (
          <p className="text-sm text-slate-500 bg-white rounded-xl border p-4">
            Gõ từ khoá ở ô tìm trên cùng — SĐT, tên khách, serial máy, hoặc mã ticket.
          </p>
        ) : (
          <div className="space-y-4">
            <Khoi
              tieuDe={`Máy đã lắp (${tongMay})`}
              rongText="Không có máy nào khớp."
              xemTatCa={
                tongMay > may.length
                  ? { href: `/?q=${encodeURIComponent(q)}`, nhan: `Xem tất cả ${tongMay} máy` }
                  : null
              }
            >
              {may.length > 0 && (
                <ul className="divide-y border rounded-lg">
                  {may.map((m) => (
                    <li key={m.serial} className="px-3 py-2.5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/may/${encodeURIComponent(m.serial)}`} prefetch={false} className="font-mono text-xs text-slate-900 underline">
                          {m.serial}
                        </Link>
                        <p className="text-sm text-slate-700">{m.product_name ?? '—'}</p>
                        <p className="text-xs text-slate-500">
                          {m.customer_id ? (
                            <Link href={`/khach/${m.customer_id}`} prefetch={false} className="underline">{m.customer_name}</Link>
                          ) : (m.customer_name ?? '—')}
                          {' · '}
                          {m.primary_phone ?? <span className="text-amber-600">thiếu SĐT</span>}
                          {' · lắp '}{vnDate(m.install_date)}
                        </p>
                      </div>
                      <WarrantyBadge m={m} />
                    </li>
                  ))}
                </ul>
              )}
            </Khoi>

            <Khoi
              tieuDe={`Ticket (${tongTicket})`}
              rongText="Không có ticket nào khớp."
              xemTatCa={
                tongTicket > ticket.length
                  ? { href: `/ticket?q=${encodeURIComponent(q)}`, nhan: `Xem tất cả ${tongTicket} ticket` }
                  : null
              }
            >
              {ticket.length > 0 && (
                <ul className="divide-y border rounded-lg">
                  {ticket.map((t) => (
                    <li key={t.ticket_code} className="px-3 py-2.5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/ticket/${t.ticket_code}`} prefetch={false} className="font-mono text-xs text-slate-900 underline">
                          {t.ticket_code}
                        </Link>
                        <span className="text-xs text-slate-400"> · {vnDateTime(t.created_at)}</span>
                        <p className="text-sm text-slate-700">
                          {t.customer_id ? (
                            <Link href={`/khach/${t.customer_id}`} prefetch={false} className="underline">{t.customer_name}</Link>
                          ) : (t.customer_name ?? '—')}
                          {' · '}{t.primary_phone ?? '—'}
                        </p>
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
              )}
            </Khoi>

            <Khoi
              tieuDe={`Khách hàng (${tongKhach})`}
              rongText="Không có khách nào khớp."
              // Không link "Xem tất cả": /khach là trang "Khách cần dọn dữ liệu" (lọc riêng
              // thiếu SĐT/địa chỉ, xem app/khach/page.tsx), KHÔNG phải danh sách khách chung —
              // trỏ ?q= sang đó sẽ ẩn bớt khách không "cần dọn", số hiện ra sẽ khác tongKhach
              // và phá đúng nguyên tắc "link phải nói đúng số" of Task 5b. App chưa có trang
              // danh sách khách chung nào khác để trỏ tới — xem ghi chú lệch brief trong báo cáo.
              xemTatCa={null}
            >
              {khach.length > 0 && (
                <ul className="divide-y border rounded-lg">
                  {khach.map((c) => (
                    <li key={c.id} className="px-3 py-2.5">
                      <Link href={`/khach/${c.id}`} prefetch={false} className="text-slate-900 underline font-medium">
                        {c.full_name}
                      </Link>
                      <p className="text-xs text-slate-500 font-mono">
                        {c.primary_phone ?? <span className="text-amber-600">thiếu SĐT</span>}
                        {c.province && <span className="font-sans"> · {c.province}</span>}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {tongKhach > khach.length && (
                <p className="text-xs text-slate-400 pt-1">
                  Còn {tongKhach - khach.length} khách khớp nữa — thu hẹp từ khoá để lọc bớt.
                </p>
              )}
            </Khoi>
          </div>
        )}
      </div>
    </main>
  )
}
