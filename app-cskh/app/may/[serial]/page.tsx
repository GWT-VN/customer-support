import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getMachine, ticketsOfSerial } from '@/app/actions'
import { WarrantyBadge, vnDate } from '@/components/Badge'
import { ActivateForm } from '@/components/ActivateForm'
import { TicketList } from '@/components/TicketList'
import { LoiCuaMay } from '@/components/LoiCuaMay'

export default async function MachinePage({ params }: { params: Promise<{ serial: string }> }) {
  const { serial } = await params
  const m = await getMachine(decodeURIComponent(serial))
  if (!m) notFound()
  const tickets = await ticketsOfSerial(m.serial)

  // Chỉ chứa DỮ LIỆU, không chứa JSX — cách hiển thị do chỗ render quyết định.
  // (Để JSX trong mảng thì eslint react/jsx-key báo lỗi, dù ở đây không cần key.)
  const rows: { label: string; value: React.ReactNode; mono?: boolean }[] = [
    { label: 'Serial', value: m.serial, mono: true },
    { label: 'Máy', value: m.product_name ?? '—' },
    { label: 'Mã nội bộ', value: m.internal_code ?? '—', mono: true },
    { label: 'Nhóm', value: m.category_l2 ?? '—' },
    { label: 'Ngày lắp', value: vnDate(m.install_date) },
    { label: 'Trạng thái máy', value: m.status },
    { label: 'Bắt đầu BH', value: vnDate(m.warranty_start) },
    { label: 'Hết BH máy', value: vnDate(m.warranty_full_end) },
    { label: 'Hết BH linh kiện', value: vnDate(m.warranty_core_end) },
  ]

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <Link href="/" className="text-sm text-slate-600 underline">← Máy đã lắp</Link>

        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{m.product_name}</h1>
          <WarrantyBadge m={m} />
        </div>

        <section className="bg-white rounded-xl border p-5">
          <h2 className="font-medium text-slate-900 mb-3">Khách hàng</h2>
          {m.customer_id ? (
            <p className="text-sm">
              <Link href={`/khach/${m.customer_id}`} prefetch={false} className="text-slate-900 underline font-medium">
                {m.customer_name}
              </Link>
              <span className="text-slate-500"> · </span>
              <span className="font-mono text-xs">{m.primary_phone ?? <span className="text-amber-600">chưa có SĐT</span>}</span>
            </p>
          ) : <p className="text-sm text-slate-400">Chưa gắn khách</p>}
        </section>

        <section className="bg-white rounded-xl border p-5">
          <h2 className="font-medium text-slate-900 mb-3">Thông tin máy</h2>
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {rows.map(({ label, value, mono }) => (
              <div key={label} className="flex justify-between border-b border-slate-100 py-1.5">
                <dt className="text-slate-500">{label}</dt>
                <dd className={`text-slate-900 text-right${mono ? ' font-mono text-xs' : ''}`}>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="bg-white rounded-xl border p-5">
          <h2 className="font-medium text-slate-900 mb-3">Lõi lọc & lịch thay</h2>
          <LoiCuaMay serial={m.serial} />
        </section>

        <section className="bg-white rounded-xl border p-5">
          <h2 className="font-medium text-slate-900 mb-3">Ticket của máy này ({tickets.length})</h2>
          <TicketList tickets={tickets} empty="Máy này chưa có ticket nào." />
        </section>

        <section className="bg-white rounded-xl border p-5">
          <h2 className="font-medium text-slate-900 mb-3">Bảo hành</h2>
          <ActivateForm
            serial={m.serial}
            defaultDate={m.warranty_start ?? m.install_date}
            activated={m.warranty_activated}
            hasPolicy={m.co_chinh_sach_bh}
          />
        </section>
      </div>
    </main>
  )
}
