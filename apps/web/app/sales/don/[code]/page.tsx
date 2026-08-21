import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { coTheVaoSales } from '@/lib/nen-tang/gac-cong'
import { requireNhanSu } from '@/lib/nen-tang/phien'
import { chiTietDon } from '../../actions'
import { OrderActions } from '../../OrderActions'
import { Field, StatusBadge, TabBadge, fmtDate, fmtQty, fmtVnd } from '../../_ui'

export const metadata = { title: 'Chi tiết đơn · GWT Sales' }
export const dynamic = 'force-dynamic'

export default async function ChiTietDonPage({ params }: { params: Promise<{ code: string }> }) {
  await requireNhanSu()
  if (!(await coTheVaoSales())) redirect('/?loi=khong_du_quyen')
  const { code } = await params
  const orderCode = decodeURIComponent(code)
  const don = await chiTietDon(orderCode)
  if (!don) notFound()

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1100px] space-y-5 p-4 sm:p-6">
        <div className="text-sm">
          <Link href="/sales" className="text-teal-700 hover:underline">← Đơn hàng</Link>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <TabBadge tab={don.source_tab} />
          <h1 className="font-mono text-xl font-semibold text-slate-900">{don.order_code}</h1>
          {don.is_app ? (
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-700">Đơn tạo từ app</span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Từ Google Sheet</span>
          )}
          {don.created_by && <span className="text-xs text-slate-400">bởi {don.created_by}</span>}
          {don.is_app && (
            <div className="ml-auto"><OrderActions orderCode={don.order_code} /></div>
          )}
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Ngày" value={fmtDate(don.order_date)} />
            <Field
              label="Khách"
              value={
                don.customer_code ? (
                  <Link href={`/sales/khach/${encodeURIComponent(don.customer_code)}`} className="text-teal-700 hover:underline">
                    {don.customer_name || don.customer_code}
                  </Link>
                ) : (
                  don.customer_name
                )
              }
            />
            <Field label="Tỉnh/TP" value={don.province} />
            <Field
              label="Kênh"
              value={don.channel ? don.channel + (don.channel_detail ? ` · ${don.channel_detail}` : '') : null}
            />
            <Field label="Tình trạng hàng" value={<StatusBadge value={don.fulfillment_status} />} />
            <Field label="Thanh toán" value={<StatusBadge value={don.payment_status} />} />
            <Field label="Số dòng" value={don.lines.length} />
            <Field label="Tổng (VAT)" value={<span className="font-semibold">{fmtVnd(don.total_vat)}</span>} />
          </dl>
        </section>

        {don.is_app && (don.address || don.partner_order_code || don.payment_method || don.shipping_code || don.install_date) && (
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Địa chỉ" value={don.address} />
              <Field label="Mã đơn đối tác" value={don.partner_order_code} />
              <Field label="Hình thức TT" value={don.payment_method} />
              <Field label="Mã vận đơn" value={don.shipping_code} />
              <Field label="Ngày lắp đặt" value={fmtDate(don.install_date)} />
            </dl>
          </section>
        )}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700">Sản phẩm trong đơn</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Sản phẩm</th>
                  <th className="px-3 py-2.5 font-medium">Mã nội bộ</th>
                  <th className="px-3 py-2.5 font-medium">Danh mục</th>
                  <th className="px-3 py-2.5 text-right font-medium">SL</th>
                  <th className="px-3 py-2.5 text-right font-medium">Đơn giá (VAT)</th>
                  <th className="px-3 py-2.5 text-right font-medium">Thành tiền (VAT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {don.lines.map((l) => (
                  <tr key={l.key} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-slate-800">{l.product_name || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-500">{l.internal_code || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-600">{[l.category_l1, l.category_l2].filter(Boolean).join(' / ') || '—'}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{fmtQty(l.quantity)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{fmtVnd(l.unit_price_vat)}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-slate-900">{fmtVnd(l.amount_vat)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={5} className="px-3 py-2.5 text-right font-medium text-slate-600">Tổng cộng (VAT)</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-slate-900">{fmtVnd(don.total_vat)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {(don.note || don.lines.some((l) => l.note)) && (
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Ghi chú</div>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {don.note && <li>{don.note}</li>}
              {don.lines.filter((l) => l.note).map((l) => (
                <li key={l.key}>{l.note}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  )
}
