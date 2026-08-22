import Link from 'next/link'
import { danhSachCtkm, quyenCtkm } from './actions'
import { CtkmActions } from './CtkmActions'
import { nhanKieuGiam, nhanNhomKhach } from '../_ctkm'

export const metadata = { title: 'Khuyến mãi · GWT Sales' }
export const dynamic = 'force-dynamic'

const vnd = new Intl.NumberFormat('vi-VN')
const tien = (n: number | null) => (n == null ? '—' : vnd.format(n) + ' ₫')

function fmt(d: string | null): string {
  if (!d) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
  return m ? `${m[3]}/${m[2]}` : d
}

/** Tháng gần đây cho ô lọc — YYYY-MM, tính theo giờ máy (KHÔNG toISOString, lệch UTC). */
function cacThang(n = 6): { gt: string; nhan: string }[] {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const gt = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { gt, nhan: `Tháng ${d.getMonth() + 1}/${d.getFullYear()}` }
  })
}

const CHIP: Record<string, string> = {
  ban_hanh: 'bg-emerald-100 text-emerald-700',
  nhap: 'bg-amber-100 text-amber-700',
  ket_thuc: 'bg-slate-100 text-slate-500',
}
const NHAN_TT: Record<string, string> = {
  ban_hanh: '● Đang chạy',
  nhap: 'Nháp — chưa áp cho đơn nào',
  ket_thuc: 'Đã kết thúc',
}

export default async function CtkmPage({
  searchParams,
}: {
  searchParams: Promise<{ thang?: string }>
}) {
  const { thang } = await searchParams
  const [ds, quyen] = await Promise.all([danhSachCtkm(thang), quyenCtkm()])
  const thangs = cacThang()

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1100px] space-y-4 p-4 sm:p-6">
        <div className="text-sm">
          <Link href="/sales" className="text-teal-700 hover:underline">← Đơn hàng</Link>
        </div>

        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Chương trình khuyến mãi</h1>
            <p className="text-sm text-slate-500">
              Khuyến mãi cho <b>khách lẻ</b> theo kênh. Khách đã gán bậc đại lý hưởng giá theo bậc, không ăn chương trình ở đây.
            </p>
          </div>
          {quyen.soan && (
            <Link
              href="/sales/ctkm/moi"
              className="rounded-lg bg-[#0e8c9a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a6771]"
            >
              ＋ Tạo chương trình
            </Link>
          )}
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/sales/ctkm"
            className={
              'rounded-full border px-3 py-1.5 text-xs font-medium ' +
              (!thang ? 'border-[#0e8c9a] bg-[#0e8c9a] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300')
            }
          >
            Tất cả
          </Link>
          {thangs.map((t) => (
            <Link
              key={t.gt}
              href={`/sales/ctkm?thang=${t.gt}`}
              className={
                'rounded-full border px-3 py-1.5 text-xs font-medium ' +
                (thang === t.gt ? 'border-[#0e8c9a] bg-[#0e8c9a] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300')
              }
            >
              {t.nhan}
            </Link>
          ))}
        </div>

        {!quyen.duyet && (
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
            Bạn soạn và sửa được chương trình, nhưng <b>ban hành</b> phải do người có quyền duyệt.
            Soạn xong bấm <b>Lưu nháp</b> rồi báo để duyệt.
          </p>
        )}

        {ds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-400">
            {thang ? 'Tháng này chưa có chương trình nào.' : 'Chưa có chương trình nào.'}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {ds.map((c) => (
              <article
                key={c.id}
                className={
                  'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ' +
                  (c.trang_thai === 'ket_thuc' ? 'opacity-60' : '')
                }
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-slate-900">{c.ten}</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {fmt(c.tu_ngay)} → {c.den_ngay ? fmt(c.den_ngay) : 'vô thời hạn'}
                      {c.ma && <span className="ml-2 font-mono text-slate-400">{c.ma}</span>}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${CHIP[c.trang_thai] ?? CHIP.nhap}`}>
                    {NHAN_TT[c.trang_thai] ?? c.trang_thai}
                  </span>
                </div>

                <dl className="space-y-2 px-4 py-3 text-sm">
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-[11px] uppercase tracking-wide text-slate-400">Giảm giá</dt>
                    <dd className="font-medium text-slate-800">
                      {nhanKieuGiam(c.kieu_giam, c.muc_chung)}
                      {c.kieu_giam === 'PCT' && c.giam_toi_da != null && (
                        <span className="ml-1 font-normal text-slate-500">(tối đa {tien(c.giam_toi_da)})</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-[11px] uppercase tracking-wide text-slate-400">Áp dụng</dt>
                    <dd className="text-slate-700">
                      {nhanNhomKhach(c.nhom_khach)}
                      {' · '}
                      {c.so_sp === 0 ? 'mọi sản phẩm' : `${c.so_sp} sản phẩm`}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-[11px] uppercase tracking-wide text-slate-400">Kênh</dt>
                    <dd className="text-slate-700">
                      {c.so_kenh === 0 ? (
                        <span className="text-rose-600">chưa chọn kênh — sẽ không áp cho đơn nào</span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {c.kenh_nhan.slice(0, 3).map((k) => (
                            <span key={k} className="rounded bg-teal-50 px-1.5 py-0.5 text-xs text-teal-800">{k}</span>
                          ))}
                          {c.so_kenh > 3 && <span className="text-xs text-slate-500">+{c.so_kenh - 3}</span>}
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-[11px] uppercase tracking-wide text-slate-400">Quà kèm</dt>
                    <dd className="text-slate-700">{c.so_qua === 0 ? 'không có' : `${c.so_qua} món`}</dd>
                  </div>
                </dl>

                <CtkmActions id={c.id} ten={c.ten} trangThai={c.trang_thai} quyen={quyen} />
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
