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

export default async function ChiTietKhachPage({
  params, searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  await requireNhanSu()
  if (!(await coTheVaoSales())) redirect('/?loi=khong_du_quyen')
  const { code } = await params
  const { tab } = await searchParams
  const data = await chiTietKhach(decodeURIComponent(code))
  if (!data) notFound()
  const { customer: c, daNoiCS, purchases } = data
  // Máy/bảo hành/bảo trì/ticket CỐ Ý không hiện ở Sales — CEO chốt 22/08: mấy thứ đó
  // xem bên CSKH. Nhồi vào đây là hai khu hiện hai bản của cùng một dữ liệu rồi lệch nhau.
  const dangXem = tab === 'don' ? 'don' : 'hoso'
  const nen = `/sales/khach/${encodeURIComponent(c.customer_code)}`

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
              <div className="flex flex-col items-end gap-1">
                <Link href={`${nen}/sua`}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-teal-400 hover:text-teal-700">
                  Sửa hồ sơ
                </Link>
                <span className="text-[11px] text-slate-400">Khách từ Sheet — sửa được các ô của app</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-1 border-b border-slate-200">
          {([
            { ma: 'hoso', nhan: 'Hồ sơ', href: nen },
            { ma: 'don', nhan: 'Đơn đã mua', href: `${nen}?tab=don`, dem: purchases.length },
          ] as const).map((t) => (
            <Link key={t.ma} href={t.href}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                dangXem === t.ma
                  ? 'border-[#0e8c9a] text-[#0e8c9a]'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'}`}>
              {t.nhan}
              {'dem' in t && t.dem != null && (
                <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{t.dem}</span>
              )}
            </Link>
          ))}
        </div>

        {dangXem === 'hoso' && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <Field label="SĐT" value={fmtPhone(c.phone)} />
            <Field label="Tỉnh/TP" value={c.province} />
            <Field label="Địa chỉ" value={c.address} />
            <Field label="Số đơn" value={`${c.total_orders ?? 0}${c.total_gift_orders ? ` (+${c.total_gift_orders} tặng)` : ''}`} />
            <Field label="Mua lần đầu" value={fmtDate(c.first_order_date)} />
            <Field label="Mua gần nhất" value={fmtDate(c.last_order_date)} />
            <Field label="Kênh" value={c.kenh} />
            <Field label="Sales phụ trách" value={c.sales_owner} />
            <Field label="Email" value={c.email} />
            <Field label="Công ty (HĐ)" value={c.company_invoice} />
            <Field label="MST" value={c.tax_code} />
            <Field label="Địa chỉ công ty" value={c.dia_chi_cty} />
            <Field label="SĐT công ty" value={c.sdt_cty} />
            <Field label="Người đại diện" value={c.nguoi_dai_dien} />
            <Field label="Chức danh" value={c.chuc_vu_dai_dien} />
            <Field label="Mã khách (hệ mới)" value={c.ma_kh} />
          </dl>
          {c.note && <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">📝 {c.note}</p>}
        </section>
        )}

        {dangXem === 'don' && (
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
        )}
      </div>
    </main>
  )
}
