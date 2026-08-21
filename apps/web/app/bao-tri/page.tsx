import Link from 'next/link'
import { Suspense } from 'react'
import { OTimKiem } from '@/bang'
import { maintenanceDue, maintenanceCounts, khoaTatCaBaoTri, listBangView, baoTriTheoThang } from '@/app/actions'
import { PhanTrang } from '@/bang'
import { ChipSapXep } from '@/bang'
import { hoiQuyen } from '@/lib/nen-tang/kiem-quyen'
import { KhungChon, ThanhDaChon } from '@/bang'
import { LocNgay } from '@/bang'
import { ExportBaoTriButton } from '@/components/ExportBaoTriButton'
import { BangBaoTri } from '@/components/BangBaoTri'
import { LichBaoTriThang } from '@/components/LichBaoTriThang'

const SAP = 'sắp đến hạn (≤30 ngày)'

export default async function BaoTriPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tt?: string; cot?: string; chieu?: string; trang?: string; ngtu?: string; ngden?: string; thang?: string }>
}) {
  const { q = '', tt, cot, chieu, trang: trangRaw, ngtu, ngden, thang: thangRaw } = await searchParams
  const trang = Math.max(1, Number(trangRaw) || 1)
  const laLich = tt === 'lich'
  const thang = /^\d{4}-\d{2}$/.test(thangRaw ?? '') ? thangRaw! : new Date().toISOString().slice(0, 7)
  const tinhTrang = tt ?? SAP           // mặc định: việc cần làm gần nhất
  const [{ rows, tong, soTrang, sapXep }, counts, views, quyen, lichRows] = await Promise.all([
    laLich
      ? Promise.resolve({ rows: [], tong: 0, trang: 1, soTrang: 1, sapXep: { cot: 'due_date', tang: true, macDinh: true } } as Awaited<ReturnType<typeof maintenanceDue>>)
      : maintenanceDue(tinhTrang, q, { trang, cot, chieu, ngtu, ngden }),
    maintenanceCounts(),
    laLich ? Promise.resolve([]) : listBangView('maintenance'),
    hoiQuyen({
      hangLoat: ['cs.hang_loat.cap_nhat', 'QUANLY'],
      viewChung: ['he_thong.view_chung', 'QUANLY'],
      xuat: ['cs.bao_cao.xuat', 'QUANLY'],
    }),
    laLich ? baoTriTheoThang(thang) : Promise.resolve([]),
  ])

  const tabs = [
    { key: SAP, label: `Sắp đến hạn (${counts[SAP] ?? 0})` },
    { key: 'QUÁ HẠN', label: `Quá hạn (${counts['QUÁ HẠN'] ?? 0})` },
    { key: 'còn hạn', label: `Còn hạn (${counts['còn hạn'] ?? 0})` },
    { key: 'đã xong', label: 'Đã xong' },
    { key: 'all', label: 'Tất cả' },
    { key: 'lich', label: '📅 Lịch (calendar)' },
  ]

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">Lịch bảo trì</h1>
        </header>

        <Suspense>
          <OTimKiem placeholder="Gõ tên khách, SĐT, bộ máy, công trình…" />
        </Suspense>

        <div className="flex gap-2 flex-wrap">
          {tabs.map((t) => {
            const active = t.key === 'all' ? tinhTrang === '' : tinhTrang === t.key
            return (
              <Link
                key={t.key}
                // Giữ cột/chiều đang sắp khi đổi tab — đổi tab là đổi BỘ LỌC, không
                // phải lý do để vứt thứ tự người dùng vừa chọn (TieuDeCotSapXep cũng
                // giữ ngược lại như vậy).
                href={`/bao-tri?${new URLSearchParams({
                  ...(q && { q }),
                  tt: t.key === 'all' ? '' : t.key,
                  ...(cot && { cot }),
                  ...(chieu && { chieu }),
                })}`}
                className={`px-3 py-1.5 rounded-lg text-sm border ${
                  active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'
                }`}
              >
                {t.label}
              </Link>
            )
          })}
        </div>

        {laLich ? (
          <LichBaoTriThang thang={thang} rows={lichRows} />
        ) : (
          <>
            <p className="text-sm bg-sky-50 text-sky-900 rounded-lg px-3 py-2">
              Gói bảo trì POE theo hợp đồng. Bấm <strong>“Đã bảo trì”</strong> sau mỗi lần đi để đúng tiến độ
              — số lần còn lại tự trừ. Dòng “chưa khớp khách” là lịch từ Asana chưa gắn được vào hồ sơ khách.
            </p>

            <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500">
              <span>{rows.length < tong ? `Hiện ${rows.length} trên ${tong} lượt` : `${tong} lượt`}</span>
              <Suspense>
                <ChipSapXep cot={sapXep.cot} tang={sapXep.tang} macDinh={sapXep.macDinh} />
              </Suspense>
            </div>

            <KhungChon
              khoaTrang={rows.map((r) => r.visit_id)}
              tong={tong}
              bat={quyen.hangLoat}
              thamSo={{ q, tt: tinhTrang, cot, chieu, ngtu, ngden }}
              layTatCaKhoa={khoaTatCaBaoTri}
            >
            <ThanhDaChon nhan="lượt bảo trì" />
            <BangBaoTri rows={rows} choViewChung={quyen.viewChung} views={views} congCu={
              <>
                <Suspense><LocNgay nhan="Đến hạn" /></Suspense>
                {quyen.xuat && <ExportBaoTriButton tt={tt} q={q} ngtu={ngtu} ngden={ngden} />}
              </>
            } />
            </KhungChon>

            <Suspense>
              <PhanTrang trang={trang} soTrang={soTrang} />
            </Suspense>
          </>
        )}
      </div>
    </main>
  )
}
