import Link from 'next/link'
import { DieuHuong } from '@/components/DieuHuong'
import { NutQuayLai } from '@/components/NutQuayLai'
import { laAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { getTicket, groupsOfTicket, listTicketNotes, listStaff, listTicketItems, currentStaff } from '@/app/actions'
import { StateBadge, KhanBadge, vnDateTime } from '@/components/TicketBadge'
import { MucDoBadge } from '@/components/NhomLoiBadge'
import { TicketEditor } from '@/components/TicketEditor'
import { TicketNotes } from '@/components/TicketNotes'
import { TicketItems } from '@/components/TicketItems'
import { vnDate } from '@/components/Badge'

export default async function TicketPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const ma = decodeURIComponent(code)
  const [t, nhom, notes, staff, items, me] = await Promise.all([
    getTicket(ma), groupsOfTicket(ma), listTicketNotes(ma), listStaff(), listTicketItems(ma), currentStaff(),
  ])
  if (!t) notFound()

  // Tự bắt người xử lý theo tên đăng nhập: kỹ thuật → ô Kỹ thuật, còn lại → ô CS.
  const defaultCsId = me && me.vai_tro !== 'ky_thuat' ? me.id : null
  const defaultKtId = me && me.vai_tro === 'ky_thuat' ? me.id : null

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <NutQuayLai macDinh="/ticket" />
          <DieuHuong />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold text-slate-900 font-mono">{t.ticket_code}</h1>
          <KhanBadge khan={t.khan} />
          <StateBadge state={t.state} />
          <span className="text-sm text-slate-500">{vnDateTime(t.created_at)}</span>
        </div>

        {t.may_khong_trong_he_thong && (
          <p className="text-sm bg-red-50 text-red-800 rounded-lg px-3 py-2">
            ⚠️ Ticket này gắn serial <code className="font-mono text-xs">{t.source_serial}</code> nhưng
            máy <strong>không có trong hệ thống</strong> — Odoo đang ghi máy là tồn kho dù nó có ticket
            (tức đang ở nhà khách). Cần gán khách cho serial này trong Odoo rồi export lại.
          </p>
        )}

        {nhom.length > 0 && (
          <section className="bg-white rounded-xl border p-5 space-y-2">
            <h2 className="font-medium text-slate-900">Thuộc nhóm lỗi</h2>
            <div className="flex flex-wrap gap-2">
              {nhom.map((n) => (
                <Link
                  key={n.group_code}
                  href={`/nhom-loi/${n.group_code}`}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border hover:bg-slate-50"
                >
                  <span className="text-sm text-slate-900">{n.nhom_ten}</span>
                  <MucDoBadge muc_do={n.muc_do} />
                </Link>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Gom tự động từ nội dung mô tả. Xem cả cụm để biết đây là ca lẻ hay lỗi hàng loạt.
            </p>
          </section>
        )}

        <section className="bg-white rounded-xl border p-5 space-y-3">
          <h2 className="font-medium text-slate-900">Nội dung</h2>
          <div>
            <span className="text-xs text-slate-500">Loại</span>
            <p className="text-slate-900">{t.ticket_type ?? '—'}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Mô tả khách báo</span>
            <p className="text-slate-900 whitespace-pre-wrap">{t.description || '—'}</p>
          </div>
          {t.province && (
            <div>
              <span className="text-xs text-slate-500">Tỉnh/TP</span>
              <p className="text-slate-900">{t.province}</p>
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl border p-5">
          <h2 className="font-medium text-slate-900 mb-3">Khách & máy</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <dt className="text-slate-500">Khách</dt>
              <dd className="text-right">
                {t.customer_id ? (
                  <Link href={`/khach/${t.customer_id}`} prefetch={false} className="text-slate-900 underline font-medium">
                    {t.customer_name}
                  </Link>
                ) : <span className="text-slate-700">{t.customer_name ?? '—'}</span>}
                {t.primary_phone && <span className="text-slate-500 font-mono text-xs"> · {t.primary_phone}</span>}
              </dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <dt className="text-slate-500">Máy</dt>
              <dd className="text-right">
                {t.serial ? (
                  <Link href={`/may/${encodeURIComponent(t.serial)}`} prefetch={false} className="text-slate-900 underline">
                    {t.product_name}
                  </Link>
                ) : <span className="text-slate-400">—</span>}
              </dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <dt className="text-slate-500">Serial</dt>
              <dd className="font-mono text-xs text-slate-900">{t.source_serial ?? '—'}</dd>
            </div>
            {t.serial && (
              <div className="flex justify-between border-b border-slate-100 py-1.5">
                <dt className="text-slate-500">Bảo hành</dt>
                <dd className="text-right text-slate-900">
                  {t.warranty_activated
                    ? <>BH máy đến {vnDate(t.warranty_full_end)} {t.con_han_may ? '✅ còn hạn' : '🔴 hết hạn'}</>
                    : 'chưa kích hoạt'}
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className="bg-white rounded-xl border p-5">
          <h2 className="font-medium text-slate-900 mb-3">Nhật ký trao đổi</h2>
          <TicketNotes code={t.ticket_code} notes={notes} />
        </section>

        <section className="bg-white rounded-xl border p-5">
          <h2 className="font-medium text-slate-900 mb-3">Chi phí & vật tư</h2>
          <TicketItems code={t.ticket_code} items={items} choPhepSua={await laAdmin()} />
        </section>

        <section className="bg-white rounded-xl border p-5">
          <h2 className="font-medium text-slate-900 mb-3">Xử lý</h2>
          <TicketEditor
            code={t.ticket_code} state={t.state} khan={t.khan} lastNote={t.last_note}
            staff={staff} csId={t.cs_phu_trach} ktId={t.ky_thuat}
            defaultCsId={defaultCsId} defaultKtId={defaultKtId}
          />
        </section>
      </div>
    </main>
  )
}
