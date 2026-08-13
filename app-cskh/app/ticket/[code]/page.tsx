import Link from 'next/link'
import { NutQuayLai } from '@/components/NutQuayLai'
import { laQuanLy } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { getTicket, groupsOfTicket, listTicketNotes, listStaff, listTicketItems, currentStaff, listCatalogItems, ticketTypes, nhomLoiChon, listMedia } from '@/app/actions'
import { DinhKemMedia } from '@/components/DinhKemMedia'
import { StateBadge, KhanBadge, vnDateTime } from '@/components/TicketBadge'
import { MucDoBadge } from '@/components/NhomLoiBadge'
import { TicketEditor } from '@/components/TicketEditor'
import { TicketNotes } from '@/components/TicketNotes'
import { TicketItems } from '@/components/TicketItems'
import { GanNhomLoi } from '@/components/GanNhomLoi'
import { NhanViecButton } from '@/components/NhanViecButton'
import { vnDate } from '@/components/Badge'

export default async function TicketPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const ma = decodeURIComponent(code)
  const [t, nhom, notes, staff, items, me, catalog, loaiList, nhomList, admin, media] = await Promise.all([
    getTicket(ma), groupsOfTicket(ma), listTicketNotes(ma), listStaff(), listTicketItems(ma), currentStaff(),
    listCatalogItems(), ticketTypes(), nhomLoiChon(), laQuanLy(), listMedia('ticket', ma),
  ])
  if (!t) notFound()

  // Tự điền người xử lý = người đang đăng nhập vào ô CS (bộ role hiện tại không
  // có vai trò kỹ thuật riêng; ô Kỹ thuật để trống, chọn tay khi cần).
  const defaultCsId = me?.id ?? null
  const defaultKtId = null

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <NutQuayLai macDinh="/ticket" />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold text-slate-900 font-mono">{t.ticket_code}</h1>
          <KhanBadge khan={t.khan} />
          <StateBadge state={t.state} />
          <span className="text-sm text-slate-500">{vnDateTime(t.created_at)}</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Phụ trách:</span>
          {t.cs_ten ? (
            <span className="text-slate-900">{t.cs_ten}</span>
          ) : (
            <span className="text-amber-600">chưa gán</span>
          )}
          {!t.cs_phu_trach && <NhanViecButton code={t.ticket_code} />}
        </div>

        {t.may_khong_trong_he_thong && (
          <p className="text-sm bg-red-50 text-red-800 rounded-lg px-3 py-2">
            ⚠️ Ticket này gắn serial <code className="font-mono text-xs">{t.source_serial}</code> nhưng
            máy <strong>không có trong hệ thống</strong> — Odoo đang ghi máy là tồn kho dù nó có ticket
            (tức đang ở nhà khách). Cần gán khách cho serial này trong Odoo rồi export lại.
          </p>
        )}

        {/* Nội dung + xử lý gộp một khối: mặc định XEM, bấm "Sửa" để sửa tại chỗ. */}
        <section className="bg-white rounded-xl border p-5">
          <TicketEditor
            code={t.ticket_code} state={t.state} khan={t.khan} lastNote={t.last_note}
            ticketType={t.ticket_type} description={t.description} province={t.province}
            loaiList={loaiList} staff={staff} csId={t.cs_phu_trach} ktId={t.ky_thuat}
            defaultCsId={defaultCsId} defaultKtId={defaultKtId}
          />
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

        {admin && t.customer_id && (
          <Link href={`/ky-thuat?kh=${t.customer_id}&loai=ticket&ref=${encodeURIComponent(t.ticket_code)}&mota=${encodeURIComponent(t.description ?? '')}`}
            className="inline-block rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium">
            + Tạo lịch kỹ thuật cho ticket này
          </Link>
        )}

        {(nhom.length > 0 || admin) && (
          <section className="bg-white rounded-xl border p-5 space-y-2">
            <h2 className="font-medium text-slate-900">Thuộc nhóm lỗi</h2>
            {nhom.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {nhom.map((n) => (
                  <Link
                    key={n.group_code}
                    href={`/nhom-loi/${n.group_code}`}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border hover:bg-slate-50"
                  >
                    <span className="text-sm text-slate-900">{n.nhom_ten}</span>
                    <MucDoBadge muc_do={n.muc_do} />
                    {n.nguon === 'người' && <span className="text-[10px] text-violet-500">gán tay</span>}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Chưa vào nhóm nào (mô tả không khớp mẫu tự động).</p>
            )}
            <p className="text-xs text-slate-500">
              Gom tự động từ nội dung mô tả. Xem cả cụm để biết đây là ca lẻ hay lỗi hàng loạt.
            </p>
            {admin && (
              <div className="pt-2 border-t mt-2">
                <p className="text-xs font-medium text-slate-600 mb-2">Gắn tay vào nhóm (lỗi mới chưa có mẫu):</p>
                <GanNhomLoi code={t.ticket_code} daGan={nhom} nhomList={nhomList} />
              </div>
            )}
          </section>
        )}

        <section className="bg-white rounded-xl border p-5">
          <h2 className="font-medium text-slate-900 mb-3">Nhật ký trao đổi</h2>
          <TicketNotes code={t.ticket_code} notes={notes} />
        </section>

        <section className="bg-white rounded-xl border p-5">
          <h2 className="font-medium text-slate-900 mb-3">Ảnh / Video</h2>
          <DinhKemMedia entityType="ticket" entityId={t.ticket_code} items={media} choSua />
        </section>

        <section className="bg-white rounded-xl border p-5">
          <h2 className="font-medium text-slate-900 mb-3">Chi phí & vật tư</h2>
          <TicketItems code={t.ticket_code} items={items} catalog={catalog} choPhepSua={admin} />
        </section>
      </div>
    </main>
  )
}
