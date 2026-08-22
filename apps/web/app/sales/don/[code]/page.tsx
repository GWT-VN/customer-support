import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { coTheVaoSales } from '@/lib/nen-tang/gac-cong'
import { requireNhanSu } from '@/lib/nen-tang/phien'
import { chiTietDon } from '../../actions'
import { OrderActions } from '../../OrderActions'
import { Field, StatusBadge, TabBadge, fmtDate, fmtQty, fmtVnd } from '../../_ui'
import { nhanVat } from '../../_types'

export const metadata = { title: 'Chi tiết đơn · GWT Sales' }
export const dynamic = 'force-dynamic'

export default async function ChiTietDonPage({ params }: { params: Promise<{ code: string }> }) {
  await requireNhanSu()
  if (!(await coTheVaoSales())) redirect('/?loi=khong_du_quyen')
  const { code } = await params
  const orderCode = decodeURIComponent(code)
  const don = await chiTietDon(orderCode)
  if (!don) notFound()
  // Đơn TẶNG chỉ có ở customer_purchases — bảng đó KHÔNG có cột tiền. Ẩn hẳn các cột
  // tiền thay vì hiện '0 ₫', vì 0 đ trông như "đã bán giá 0" chứ không phải "không có dữ liệu".
  const laDonTang = don.source_tab === 'DON_TANG'

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
            <Field label="Hình thức TT" value={don.payment_method} />
            <Field label="Số dòng" value={don.lines.length} />
            {laDonTang ? (
              <Field label="Tổng sau VAT" value={<span className="text-slate-400">không có dữ liệu tiền</span>} />
            ) : (
              <Field label="Tổng sau VAT" value={<span className="font-semibold">{fmtVnd(don.total_vat)}</span>} />
            )}
          </dl>
        </section>

        {don.is_app && (don.address || don.partner_order_code || don.shipping_code || don.install_date) && (
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Địa chỉ" value={don.address} />
              <Field label="Mã đơn đối tác" value={don.partner_order_code} />
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
                  {!laDonTang && <th className="px-3 py-2.5 text-right font-medium" title="Đơn giá ĐÃ GỒM VAT">Đơn giá<span className="ml-0.5 font-normal text-slate-400">(gồm VAT)</span></th>}
                  {!laDonTang && <th className="px-3 py-2.5 text-right font-medium" title="Giá niêm yết 1 đơn vị, đã gồm VAT">Niêm yết</th>}
                  {!laDonTang && <th className="px-3 py-2.5 text-right font-medium" title="(giá niêm yết × SL) − thành tiền">Khuyến mãi</th>}
                  {!laDonTang && <th className="px-3 py-2.5 text-right font-medium">VAT</th>}
                  {!laDonTang && <th className="px-3 py-2.5 text-right font-medium">Thành tiền</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {don.lines.map((l) => (
                  <tr key={l.key} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-slate-800">
                      <span className="inline-flex items-center gap-2">
                        {l.product_name || '—'}
                        {l.is_gift && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">Tặng</span>
                        )}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-500">{l.internal_code || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-600">{[l.category_l1, l.category_l2].filter(Boolean).join(' / ') || '—'}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{fmtQty(l.quantity)}</td>
                    {!laDonTang && <td className="px-3 py-2.5 text-right text-slate-700">{fmtVnd(l.unit_price_vat)}</td>}
                    {!laDonTang && (
                      <td className="px-3 py-2.5 text-right text-slate-500">
                        {l.gia_niem_yet == null ? <span title="Mã này chưa có trong bảng giá niêm yết">—</span> : fmtVnd(l.gia_niem_yet)}
                      </td>
                    )}
                    {!laDonTang && (
                      <td className="px-3 py-2.5 text-right">
                        {l.khuyen_mai == null ? (
                          <span className="text-slate-300" title={l.is_gift ? 'Dòng quà — theo dõi ở cột Tặng' : 'Chưa có giá niêm yết cho mã này'}>—</span>
                        ) : l.khuyen_mai > 0 ? (
                          <span className="font-medium text-emerald-700">{fmtVnd(l.khuyen_mai)}</span>
                        ) : l.khuyen_mai < 0 ? (
                          <span className="text-amber-700" title="Bán CAO hơn giá niêm yết">+{fmtVnd(-l.khuyen_mai)}</span>
                        ) : (
                          <span className="text-slate-400" title="Bán đúng giá niêm yết">0 ₫</span>
                        )}
                      </td>
                    )}
                    {!laDonTang && (
                      <td className="px-3 py-2.5 text-right text-slate-500">
                        {nhanVat(l.vat_pct, l.vat_loai)}
                      </td>
                    )}
                    {!laDonTang && <td className="px-3 py-2.5 text-right font-medium text-slate-900">{fmtVnd(l.amount_vat)}</td>}
                  </tr>
                ))}
              </tbody>
              {/* colSpan=8 vì bảng có 9 cột: SP · Mã · Danh mục · SL · Đơn giá · Niêm yết ·
                  Khuyến mãi · VAT · Thành tiền. Thêm/bớt cột thì PHẢI sửa số này. */}
              {!laDonTang && (
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={8} className="px-3 py-2 text-right text-slate-600">Tổng trước VAT</td>
                  <td className="px-3 py-2 text-right text-slate-700">{fmtVnd(don.total_net)}</td>
                </tr>
                <tr>
                  <td colSpan={8} className="px-3 py-2 text-right text-slate-600">Tiền VAT</td>
                  <td className="px-3 py-2 text-right text-slate-700">{fmtVnd(don.total_vat_tien)}</td>
                </tr>
                <tr className="border-t border-slate-200">
                  <td colSpan={8} className="px-3 py-2.5 text-right font-medium text-slate-700">Tổng sau VAT</td>
                  <td className="px-3 py-2.5 text-right text-base font-semibold text-slate-900">{fmtVnd(don.total_vat)}</td>
                </tr>
              </tfoot>
              )}
            </table>
          </div>
        </section>

        {laDonTang && (
          <p className="text-xs text-slate-500">
            Đơn tặng lấy từ bảng lịch sử mua (<code>customer_purchases</code>) — bảng này không lưu giá,
            nên đơn tặng không có số tiền. Không phải lỗi hiển thị.
          </p>
        )}

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
