import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { coTheVaoSales } from '@/lib/nen-tang/gac-cong'
import { requireNhanSu } from '@/lib/nen-tang/phien'
import { BoLocChon, OTimKiem, ThanhDangLoc } from '@/bang'
import { danhSachKhach, kenhChonDuoc, kenhTrongDon, khachTrungSdt, nhanVienChonDuoc, tinhTrongKhach } from '../actions'
import { TaoKhachButton } from '../TaoKhachButton'

export const metadata = { title: 'Khách hàng · GWT Sales' }
export const dynamic = 'force-dynamic'

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d
}

export default async function SalesKhachPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tinh?: string; kenh?: string }>
}) {
  await requireNhanSu()
  if (!(await coTheVaoSales())) redirect('/?loi=khong_du_quyen')
  const { q, tinh, kenh } = await searchParams
  const [rows, tinhOpts, kenhOpts, kenhDim, trung, nhanVien] = await Promise.all([
    danhSachKhach(q ?? '', { tinh, kenh }),
    tinhTrongKhach(),
    kenhTrongDon(),
    kenhChonDuoc(),
    khachTrungSdt(),
    nhanVienChonDuoc(),
  ])
  const dieuKien = [
    tinh ? { nhan: 'Tỉnh/TP', giaTri: tinh } : null,
    kenh ? { nhan: 'Kênh', giaTri: kenh } : null,
  ].filter(Boolean) as { nhan: string; giaTri: string }[]

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1100px] space-y-4 p-4 sm:p-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Khách hàng</h1>
            <p className="text-sm text-slate-500">{rows.length} khách · <span className="font-mono">KH…</span> từ Sheet · <span className="font-mono">KA…</span> tạo trên app</p>
          </div>
          <TaoKhachButton kenh={kenhDim} nhanVien={nhanVien} />
        </header>

        {/* Cảnh báo trùng — CEO chốt 22/08: đếm và nói ra, không chặn cứng ở DB. */}
        {trung.length > 0 && (
          <details className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-amber-900">
              ⚠ {trung.length} số điện thoại đang có nhiều hồ sơ khách
              <span className="ml-2 font-normal text-amber-700">— bấm để xem và gộp</span>
            </summary>
            <div className="mt-3 space-y-2">
              {trung.map((t) => (
                <div key={t.sdt9} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono text-amber-900">…{t.sdt9}</span>
                  <span className="text-amber-700">→</span>
                  {t.ma.map((m, i) => (
                    <Link key={m} href={`/sales/khach/${encodeURIComponent(m)}`}
                      className="rounded-md bg-white px-2 py-0.5 text-xs ring-1 ring-amber-200 hover:ring-amber-400">
                      <span className="font-mono text-slate-500">{m}</span>
                      {t.ten[i] && <span className="ml-1.5 text-slate-700">{t.ten[i]}</span>}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-amber-700">
              Phần lớn do Google Sheet ăn mất số 0 đầu SĐT. Sửa trong <b>ô SĐT của dòng đơn</b>
              rồi chạy <b>Dựng lại DM_KHACH → Đồng bộ khách</b> — hai hồ sơ sẽ tự gộp làm một.
            </p>
          </details>
        )}

        {/* Đọc useSearchParams -> BẮT BUỘC bọc Suspense, xem docs/CHUAN-FILTER.md */}
        <Suspense fallback={<div className="h-20" />}>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <OTimKiem placeholder="Tìm tên / SĐT / mã KH…" />
            <div className="flex flex-wrap items-center gap-2">
              <BoLocChon param="tinh" nhan="Tỉnh/TP" tuyChon={tinhOpts.map((t) => ({ giaTri: t, nhan: t }))} />
              <BoLocChon param="kenh" nhan="Kênh" tuyChon={kenhOpts.map((k) => ({ giaTri: k, nhan: k }))} />
            </div>
          </div>
        </Suspense>

        <ThanhDangLoc dieuKien={dieuKien} hienThi={rows.length} tong={rows.length} nhan="khách" />

        {kenh && (
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
            Kênh của khách đang <b>suy từ đơn đã mua</b> — cột <code>channel_id</code> vừa thêm 21/08 và
            chưa có ai điền. Khách chưa có đơn nào sẽ không hiện khi lọc theo kênh.
          </p>
        )}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Mã KH</th>
                  <th className="px-3 py-2.5 font-medium">Tên</th>
                  <th className="px-3 py-2.5 font-medium">SĐT</th>
                  <th className="px-3 py-2.5 font-medium">Tỉnh/TP</th>
                  <th className="px-3 py-2.5 text-right font-medium">Đơn</th>
                  <th className="px-3 py-2.5 font-medium">Mua gần nhất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-slate-400">Không có khách nào khớp.</td>
                  </tr>
                ) : (
                  rows.map((c) => (
                    <tr key={c.customer_code} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs">
                        <Link href={`/sales/khach/${encodeURIComponent(c.customer_code)}`} className="text-teal-700 hover:underline">
                          {c.customer_code}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-800">
                        <Link href={`/sales/khach/${encodeURIComponent(c.customer_code)}`} className="hover:text-teal-700 hover:underline">
                          {c.name || '—'}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{c.phone || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600">{c.province || '—'}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">{c.total_orders ?? 0}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{fmtDate(c.last_order_date)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}
