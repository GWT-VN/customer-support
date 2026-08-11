import Link from 'next/link'
import { Suspense } from 'react'
import { coreForecast, coreCounts, khoaTatCaLoi, listBangView } from '@/app/actions'
import { OTimKiem } from '@/bang'
import { ThanhDangLoc } from '@/bang'
import { PhanTrang } from '@/bang'
import { LocNgay } from '@/bang'
import { docLocNgay, moTaLocNgay } from '@/lib/danhSach'
import { laAdmin } from '@/lib/supabase'
import { KhungChon, ThanhDaChon } from '@/bang'
import { ExportLoiButton } from '@/components/ExportLoiButton'
import { BangLoi } from '@/components/BangLoi'

const SAP = 'sắp đến hạn (≤30 ngày)'

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
  const [{ rows, tong, soTrang, sapXep }, counts, admin, views] = await Promise.all([
    coreForecast(tinhTrang, q, { trang, cot, chieu, ngtu, ngden }),
    coreCounts(),
    laAdmin(),
    listBangView('core'),
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
        <BangLoi rows={rows} admin={admin} views={views} />
        </KhungChon>

        <Suspense>
          <PhanTrang trang={trang} soTrang={soTrang} />
        </Suspense>
      </div>
    </main>
  )
}
