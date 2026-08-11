import Link from 'next/link'
import { Suspense } from 'react'
import { coreForecast, coreCounts } from '@/app/actions'
import { ThayLoiButton } from '@/components/ThayLoiButton'
import { vnDate } from '@/components/Badge'
import { OTimKiem } from '@/bang'
import { ThanhDangLoc } from '@/bang'
import { PhanTrang } from '@/bang'
import { TieuDeCotSapXep } from '@/bang'
import { LocNgay } from '@/bang'
import { docLocNgay, moTaLocNgay } from '@/lib/danhSach'
import { laAdmin } from '@/lib/supabase'
import { khoaTatCaLoi } from '@/app/actions'
import { KhungChon, OChonTatCa, OChonDong, ThanhDaChon } from '@/bang'
import { ExportLoiButton } from '@/components/ExportLoiButton'

const SAP = 'sắp đến hạn (≤30 ngày)'

function HanBadge({ tt, ngay }: { tt: string; ngay: number | null }) {
  if (tt === 'QUÁ HẠN')
    return <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 whitespace-nowrap">
      Quá {Math.abs(ngay ?? 0)} ngày
    </span>
  if (tt === SAP)
    return <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 whitespace-nowrap">
      Còn {ngay} ngày
    </span>
  if (tt.startsWith('không rõ'))
    return <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">Không rõ</span>
  return <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800 whitespace-nowrap">
    Còn {ngay} ngày
  </span>
}

export default async function LoiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tt?: string; trang?: string; cot?: string; chieu?: string; ngtu?: string; ngden?: string }>
}) {
  const { q = '', tt, trang: trangRaw, cot, chieu, ngtu, ngden } = await searchParams
  const tinhTrang = tt ?? SAP           // mặc định: danh sách gọi được NGAY
  const trang = Math.max(1, Number(trangRaw) || 1)
  const { tu: ngTuOk, den: ngDenOk } = docLocNgay({ ngtu, ngden })
  const moTaNgay = moTaLocNgay(ngTuOk, ngDenOk, 'Đến hạn')
  const [{ rows, tong, soTrang, sapXep }, counts, admin] = await Promise.all([
    coreForecast(tinhTrang, q, { trang, cot, chieu, ngtu, ngden }),
    coreCounts(),
    laAdmin(),
  ])

  const tabs = [
    { key: SAP, label: `Sắp đến hạn (${counts[SAP] ?? 0})` },
    { key: 'QUÁ HẠN', label: `Quá hạn (${counts['QUÁ HẠN'] ?? 0})` },
    { key: 'còn hạn', label: `Còn hạn (${counts['còn hạn'] ?? 0})` },
    { key: 'all', label: 'Tất cả' },
  ]

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">Lịch thay lõi</h1>
        </header>

        <Suspense>
          <OTimKiem placeholder="Gõ serial, tên khách, SĐT, mã lõi…" />
        </Suspense>

        <div className="flex gap-2 flex-wrap">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={`/loi?${new URLSearchParams({ ...(q && { q }), tt: t.key === 'all' ? '' : t.key })}`}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                tinhTrang === t.key || (t.key === 'all' && !tt && false)
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {tinhTrang === 'QUÁ HẠN' && (
          <p className="text-sm bg-amber-50 text-amber-900 rounded-lg px-3 py-2">
            ⚠️ <strong>Đây KHÔNG phải danh sách gọi bán.</strong> Nhật ký thay lõi mới bắt đầu ghi, nên
            máy cũ nào chưa từng log đều hiện quá hạn — dù thực tế đã được thay rồi. Hãy dùng làm
            <strong> danh sách cần xác minh</strong>: gọi hỏi khách đã thay chưa, rồi bấm “Đã thay” kèm
            đúng ngày. Ghi dần thì con số này tự đúng lên.
          </p>
        )}

        <Suspense>
          <LocNgay nhan="Đến hạn" />
        </Suspense>

        <ThanhDangLoc
          dieuKien={[
            ...(q ? [{ nhan: 'Từ khoá', giaTri: q }] : []),
            ...(moTaNgay ? [{ nhan: 'Đến hạn', giaTri: moTaNgay.replace(/^Đến hạn\s*[:=]?\s*/, '') }] : []),
          ]}
          hienThi={rows.length}
          tong={tong}
          nhan="dòng (máy × lõi)"
          sapXep={sapXep}
        />

        {/* Khoá dòng phải là (serial, filter_code): một máy có NHIỀU lõi nên riêng
            serial KHÔNG định danh được một dòng — trùng khoá là tick một ô sáng
            nhiều ô. Đúng cặp khoá đang dùng cho React key và cho khoá phụ phân trang. */}
        {admin && <ExportLoiButton tt={tt} q={q} ngtu={ngtu} ngden={ngden} />}

        <KhungChon
          khoaTrang={rows.map((r) => `${r.serial}-${r.filter_code}`)}
          tong={tong}
          bat={admin}
          // `tt` phải là tinhTrang ĐÃ GIẢI (mặc định SAP khi URL trống), không phải
          // `tt` thô — nếu không, "chọn tất cả" sẽ ôm cả tab khác tab đang xem.
          thamSo={{ q, tt: tinhTrang, cot, chieu, ngtu, ngden }}
          layTatCaKhoa={khoaTatCaLoi}
        >
        <ThanhDaChon nhan="dòng lõi" />
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <Suspense>
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <OChonTatCa nhan="dòng lõi" />
                  <TieuDeCotSapXep cot="customer_name" nhan="Khách" chieuMacDinh="asc" />
                  {/* Cột hiện product_name + serial — sắp theo serial vì đó là cột trong whitelist. */}
                  <TieuDeCotSapXep cot="serial" nhan="Máy" chieuMacDinh="asc" />
                  <th className="text-left px-4 py-3 font-medium">Lõi cần thay</th>
                  <th className="text-left px-4 py-3 font-medium">Chu kỳ</th>
                  <th className="text-left px-4 py-3 font-medium">Mốc tính</th>
                  <TieuDeCotSapXep cot="han_som" nhan="Đến hạn" chieuMacDinh="asc" dangMacDinh />
                  <th className="text-left px-4 py-3 font-medium">Ghi log</th>
                </tr>
              </thead>
            </Suspense>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={`${r.serial}-${r.filter_code}`} className="hover:bg-slate-50 align-top">
                  <OChonDong khoa={`${r.serial}-${r.filter_code}`} moTa={`lõi ${r.filter_code} của máy ${r.serial}`} />
                  <td className="px-4 py-3">
                    {r.customer_id ? (
                      <Link href={`/khach/${r.customer_id}`} prefetch={false} className="text-slate-900 underline">{r.customer_name}</Link>
                    ) : <span className="text-slate-400">—</span>}
                    <div className="font-mono text-xs text-slate-500">
                      {r.primary_phone ?? <span className="text-amber-600">thiếu SĐT</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/may/${encodeURIComponent(r.serial)}`} prefetch={false} className="text-slate-900 underline">
                      {r.product_name}
                    </Link>
                    <div className="font-mono text-[10px] text-slate-400">{r.serial}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-slate-900">{r.filter_code}</div>
                    <div className="text-xs text-slate-500">{r.filter_name}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.chu_ky_raw}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {vnDate(r.moc_tinh)}
                    <div className="text-[10px] text-slate-400">
                      {r.lan_thay_gan_nhat ? 'lần thay gần nhất' : 'ngày lắp (chưa có log thay)'}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <HanBadge tt={r.tinh_trang} ngay={r.con_bao_nhieu_ngay} />
                    <div className="text-[10px] text-slate-400 mt-0.5">{vnDate(r.han_som)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <ThayLoiButton serial={r.serial} filterCode={r.filter_code} filterName={r.filter_name} compact />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={admin ? 8 : 7} className="px-4 py-10 text-center text-slate-400">
                    Không có dòng nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </KhungChon>

        <Suspense>
          <PhanTrang trang={trang} soTrang={soTrang} />
        </Suspense>
      </div>
    </main>
  )
}
