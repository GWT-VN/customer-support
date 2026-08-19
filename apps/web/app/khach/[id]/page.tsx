import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCustomer, ticketsOfCustomer, machinesOfCustomer, kenhChon, baoTriCuaKhach } from '@/app/actions'
import { CustomerEditor } from '@/components/CustomerEditor'
import { GopKhachButton } from '@/components/GopKhachButton'
import { GanKenh } from '@/components/GanKenh'
import { KhachTabs } from '@/components/KhachTabs'
import { TicketList } from '@/components/TicketList'
import { WarrantyBadge, vnDate } from '@/components/Badge'
import { NutQuayLai } from '@/components/NutQuayLai'
import { laQuanLy } from '@/lib/supabase'

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { customer, contacts } = await getCustomer(id)
  if (!customer) notFound()
  const [tickets, machines, kenh, baoTri, quanLy] = await Promise.all([
    ticketsOfCustomer(id), machinesOfCustomer(id), kenhChon(), baoTriCuaKhach(id), laQuanLy(),
  ])
  const btDaXong = baoTri.filter((v) => v.completed_at).length

  // Bốn khối dưới đây là NGUYÊN nội dung của 4 section cũ, chỉ bỏ dòng <h2> vì
  // nhãn tab đã nói rồi. Không đổi một dòng logic nào bên trong.
  const khoiMay = (
    <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      {machines.length === 0 ? (
        <p className="text-sm text-slate-400">Khách này chưa có máy nào trong hệ thống.</p>
      ) : (
        <ul className="divide-y border rounded-lg">
          {machines.map((m) => (
            <li key={m.serial} className="px-3 py-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/may/${encodeURIComponent(m.serial)}`} prefetch={false} className="text-slate-900 underline">
                  {m.product_name ?? m.serial}
                </Link>
                <div className="font-mono text-xs text-slate-400">{m.serial}</div>
                <div className="text-xs text-slate-500">Lắp: {vnDate(m.install_date)}</div>
              </div>
              <WarrantyBadge m={m} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  const khoiTicket = (
    <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <TicketList tickets={tickets} empty="Khách này chưa có ticket nào." />
    </section>
  )

  const khoiBaoTri = (
    <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm text-slate-500">{btDaXong}/{baoTri.length} lượt đã làm</p>
        {quanLy && (
          <Link href={`/bao-tri/len-lich?kh=${customer.id}`} prefetch={false} className="text-xs text-sky-700 underline whitespace-nowrap">
            ＋ Tạo lịch bảo trì
          </Link>
        )}
      </div>
      {baoTri.length === 0 ? (
        <p className="text-sm text-slate-400">Khách này chưa có lịch bảo trì.</p>
      ) : (
        <ul className="divide-y border rounded-lg text-sm">
          {baoTri.map((v) => {
            const doNuoc = [
              v.tds_truoc != null || v.tds_sau != null ? `TDS ${v.tds_truoc ?? '?'}→${v.tds_sau ?? '?'}` : null,
              v.ph_truoc != null || v.ph_sau != null ? `pH ${v.ph_truoc ?? '?'}→${v.ph_sau ?? '?'}` : null,
              v.do_cung_truoc != null || v.do_cung_sau != null ? `Độ cứng ${v.do_cung_truoc ?? '?'}→${v.do_cung_sau ?? '?'}` : null,
              v.clo_truoc != null || v.clo_sau != null ? `Clo ${v.clo_truoc ?? '?'}→${v.clo_sau ?? '?'}` : null,
            ].filter(Boolean).join(' · ')
            return (
              <li key={v.visit_id} className="px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-700">
                    <span className="text-slate-400">Lần {v.lan_thu ?? '?'}</span> · {vnDate(v.due_date)}
                    {v.bo_may && <span className="text-slate-400"> · {v.bo_may}</span>}
                  </span>
                  {v.completed_at
                    ? <span className="text-xs text-emerald-700">✓ đã làm {vnDate(v.completed_at.slice(0, 10))}</span>
                    : <span className="text-xs text-amber-600">chưa làm</span>}
                </div>
                {(doNuoc || v.ket_qua_ghi_chu) && <div className="text-[11px] text-slate-500 mt-0.5">💧 {doNuoc}{v.ket_qua_ghi_chu ? ` · ${v.ket_qua_ghi_chu}` : ''}</div>}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )

  const khoiThongTin = (
    <div className="space-y-4">
      <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-medium text-slate-900 mb-1">Kênh / đối tác</h2>
        <p className="text-xs text-slate-400 mb-2">Đại lý/KTS/KOL quản lý khách này (taxonomy chung với Sales).</p>
        <GanKenh customerId={customer.id} channelId={customer.channel_id} kenh={kenh} />
      </section>
      <CustomerEditor customer={customer} contacts={contacts} />
    </div>
  )

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        <NutQuayLai macDinh="/" />

        {/* Đầu trang: ai — gọi số nào — ở đâu — bao nhiêu máy/ticket/bảo trì.
            Trước đây phải cuộn qua 5 khối dọc mới ráp đủ chừng đó thông tin. */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4 flex-wrap">
            <span className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-[#fbeadd] text-lg font-bold text-[#8a4a1c]">
              {(customer.full_name ?? '?').trim().slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-[200px] flex-1">
              <h1 className="text-xl font-semibold text-slate-900">{customer.full_name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
                {customer.primary_phone
                  ? <span className="font-mono">{customer.primary_phone}</span>
                  : <span className="text-amber-600">thiếu SĐT</span>}
                {customer.province && <span>· {customer.province}</span>}
                {customer.source && <span>· {customer.source}</span>}
              </div>
            </div>
            <GopKhachButton giuId={customer.id} tenGiu={customer.full_name} />
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
            {[
              { n: String(machines.length), t: 'Máy đã lắp' },
              { n: String(tickets.length), t: 'Ticket' },
              { n: `${btDaXong}/${baoTri.length}`, t: 'Bảo trì đã làm' },
              { n: String(contacts.length), t: 'Liên hệ' },
            ].map((o) => (
              <div key={o.t} className="bg-slate-50 px-3 py-2.5 text-center">
                <div className="text-lg font-bold tabular-nums text-slate-900">{o.n}</div>
                <div className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">{o.t}</div>
              </div>
            ))}
          </div>
        </section>

        <KhachTabs
          tabs={[
            { khoa: 'may', nhan: `Máy (${machines.length})`, noiDung: khoiMay },
            { khoa: 'ticket', nhan: `Ticket (${tickets.length})`, noiDung: khoiTicket },
            { khoa: 'baotri', nhan: `Bảo trì (${baoTri.length})`, noiDung: khoiBaoTri },
            { khoa: 'thongtin', nhan: 'Thông tin & kênh', noiDung: khoiThongTin },
          ]}
        />
      </div>
    </main>
  )
}
