import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { coTheVaoSales } from '@/lib/nen-tang/gac-cong'
import { requireNhanSu } from '@/lib/nen-tang/phien'
import { chiTietKhach } from '../../actions'
import { isAppCustomer } from '../../_db'
import { CustomerActions } from '../../CustomerActions'
import { Field, StatusBadge, TabBadge, fmtDate, fmtPhone, fmtQty } from '../../_ui'

export const metadata = { title: 'Hồ sơ khách · GWT Sales' }
export const dynamic = 'force-dynamic'

function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <h2 className="text-base font-semibold text-slate-900">{children}</h2>
      {count != null && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{count}</span>}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">{children}</div>
}

export default async function ChiTietKhachPage({ params }: { params: Promise<{ code: string }> }) {
  await requireNhanSu()
  if (!(await coTheVaoSales())) redirect('/?loi=khong_du_quyen')
  const { code } = await params
  const data = await chiTietKhach(decodeURIComponent(code))
  if (!data) notFound()
  const { customer: c, daNoiCS, purchases, machines, maintenance, tickets } = data

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1100px] space-y-6 p-4 sm:p-6">
        <div className="text-sm">
          <Link href="/sales/khach" className="text-teal-700 hover:underline">← Khách hàng</Link>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{c.name || '(chưa có tên)'}</h1>
            <p className="mt-1 font-mono text-xs text-slate-400">{c.customer_code}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {daNoiCS ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">● Đã nối hồ sơ CS</span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">○ Chưa nối CS</span>
            )}
            {isAppCustomer(c.customer_code) ? (
              <CustomerActions customerCode={c.customer_code} />
            ) : (
              <span className="text-xs text-slate-400">Khách từ Sheet — sửa ở Google Sheet</span>
            )}
          </div>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <Field label="SĐT" value={fmtPhone(c.phone)} />
            <Field label="Tỉnh/TP" value={c.province} />
            <Field label="Địa chỉ" value={c.address} />
            <Field label="Số đơn" value={`${c.total_orders ?? 0}${c.total_gift_orders ? ` (+${c.total_gift_orders} tặng)` : ''}`} />
            <Field label="Mua lần đầu" value={fmtDate(c.first_order_date)} />
            <Field label="Mua gần nhất" value={fmtDate(c.last_order_date)} />
            <Field label="Công ty (HĐ)" value={c.company_invoice} />
            <Field label="MST" value={c.tax_code} />
          </dl>
          {c.note && <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">📝 {c.note}</p>}
        </section>

        <section>
          <SectionTitle count={purchases.length}>Sản phẩm đã mua</SectionTitle>
          {purchases.length === 0 ? (
            <Empty>Chưa có dòng mua nào.</Empty>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Ngày</th>
                      <th className="px-3 py-2.5 font-medium">Đơn</th>
                      <th className="px-3 py-2.5 font-medium">Sản phẩm</th>
                      <th className="px-3 py-2.5 font-medium">Mã nội bộ</th>
                      <th className="px-3 py-2.5 font-medium">Danh mục</th>
                      <th className="px-3 py-2.5 text-right font-medium">SL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchases.map((p) => (
                      <tr key={p.key} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{fmtDate(p.order_date)}</td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          {p.order_code ? (
                            <Link href={`/sales/don/${encodeURIComponent(p.order_code)}`} className="inline-flex items-center gap-1.5 text-teal-700 hover:underline">
                              <TabBadge tab={p.source_tab} />
                              <span className="text-xs">{p.order_code}</span>
                            </Link>
                          ) : (
                            <TabBadge tab={p.source_tab} />
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-800">
                          <span className="inline-flex items-center gap-2">
                            {p.product_name || '—'}
                            {p.is_gift && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">Tặng</span>}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-500">{p.internal_code || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-600">{[p.category_l1, p.category_l2].filter(Boolean).join(' / ') || '—'}</td>
                        <td className="px-3 py-2.5 text-right text-slate-700">{fmtQty(p.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section>
          <SectionTitle count={machines.length}>Máy đã lắp &amp; bảo hành</SectionTitle>
          {machines.length === 0 ? (
            <Empty>{daNoiCS ? 'Chưa có máy nào trong hồ sơ CS.' : 'Chưa nối hồ sơ CS nên chưa có dữ liệu máy/bảo hành.'}</Empty>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {machines.map((m) => (
                <div key={m.serial} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-slate-900">{m.model_freetext || m.internal_code || 'Máy'}</div>
                      <div className="mt-0.5 font-mono text-xs text-slate-400">SN: {m.serial}</div>
                    </div>
                    {m.status && <StatusBadge value={m.status} />}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <Field label="Ngày lắp" value={fmtDate(m.install_date)} />
                    <Field label="Mã nội bộ" value={m.internal_code} />
                    <Field label="BH máy đến" value={fmtDate(m.full_end)} />
                    <Field label="BH lõi đến" value={fmtDate(m.core_end)} />
                  </dl>
                  {m.install_address && <p className="mt-2 text-xs text-slate-400">📍 {m.install_address}</p>}
                </div>
              ))}
            </div>
          )}
        </section>

        {maintenance.length > 0 && (
          <section>
            <SectionTitle count={maintenance.length}>Gói bảo trì</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {maintenance.map((mp) => (
                <div key={mp.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-slate-900">{mp.loai_goi || 'Gói bảo trì'}</div>
                    {mp.trang_thai && <StatusBadge value={mp.trang_thai} />}
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <Field label="Bộ máy" value={mp.bo_may} />
                    <Field label="Ký HĐ" value={fmtDate(mp.ngay_ky_hd)} />
                    <Field label="Số năm" value={mp.so_nam} />
                    <Field label="Chu kỳ (tháng)" value={mp.chu_ky_thang} />
                  </dl>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionTitle count={tickets.length}>Ticket chăm sóc (CS)</SectionTitle>
          {tickets.length === 0 ? (
            <Empty>Chưa có ticket nào.</Empty>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Mã</th>
                      <th className="px-3 py-2.5 font-medium">Loại</th>
                      <th className="px-3 py-2.5 font-medium">Trạng thái</th>
                      <th className="px-3 py-2.5 font-medium">Mô tả</th>
                      <th className="px-3 py-2.5 font-medium">Tạo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tickets.map((t) => (
                      <tr key={t.ticket_code} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-600">
                          {t.khan && <span title="Khẩn">🔴 </span>}
                          {t.ticket_code}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{t.ticket_type || '—'}</td>
                        <td className="px-3 py-2.5"><StatusBadge value={t.state} /></td>
                        <td className="max-w-xs px-3 py-2.5 text-slate-600"><span className="line-clamp-2">{t.description || '—'}</span></td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{fmtDate(t.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
