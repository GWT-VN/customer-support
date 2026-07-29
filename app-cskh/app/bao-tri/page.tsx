import Link from 'next/link'
import { Suspense } from 'react'
import { DieuHuong } from '@/components/DieuHuong'
import { OTimKiem } from '@/components/OTimKiem'
import { maintenanceDue, maintenanceCounts } from '@/app/actions'
import { BaoTriDoneButton } from '@/components/BaoTriDoneButton'
import { vnDate } from '@/components/Badge'
import { TieuDeCotSapXep } from '@/components/TieuDeCotSapXep'
import { ChipSapXep } from '@/components/ChipSapXep'
import { laAdmin } from '@/lib/supabase'
import { KhungChon, OChonTatCa, OChonDong, ThanhDaChon } from '@/components/ChonDong'

const SAP = 'sắp đến hạn (≤30 ngày)'

function TinhTrangBadge({ tt }: { tt: string }) {
  if (tt === 'QUÁ HẠN')
    return <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 whitespace-nowrap">Quá hạn</span>
  if (tt === SAP)
    return <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 whitespace-nowrap">Sắp đến hạn</span>
  if (tt === 'đã xong')
    return <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800 whitespace-nowrap">Đã xong</span>
  if (tt.startsWith('không rõ'))
    return <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">Không rõ</span>
  return <span className="px-2 py-0.5 rounded-full text-xs bg-sky-100 text-sky-800 whitespace-nowrap">Còn hạn</span>
}

export default async function BaoTriPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tt?: string; cot?: string; chieu?: string }>
}) {
  const { q = '', tt, cot, chieu } = await searchParams
  const tinhTrang = tt ?? SAP           // mặc định: việc cần làm gần nhất
  const [{ rows, sapXep }, counts, admin] = await Promise.all([
    maintenanceDue(tinhTrang, q, { cot, chieu }),
    maintenanceCounts(),
    laAdmin(),
  ])

  const tabs = [
    { key: SAP, label: `Sắp đến hạn (${counts[SAP] ?? 0})` },
    { key: 'QUÁ HẠN', label: `Quá hạn (${counts['QUÁ HẠN'] ?? 0})` },
    { key: 'còn hạn', label: `Còn hạn (${counts['còn hạn'] ?? 0})` },
    { key: 'đã xong', label: 'Đã xong' },
    { key: 'all', label: 'Tất cả' },
  ]

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">Lịch bảo trì</h1>
          <DieuHuong />
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

        <p className="text-sm bg-sky-50 text-sky-900 rounded-lg px-3 py-2">
          Gói bảo trì POE theo hợp đồng. Bấm <strong>“Đã bảo trì”</strong> sau mỗi lần đi để đúng tiến độ
          — số lần còn lại tự trừ. Dòng “chưa khớp khách” là lịch từ Asana chưa gắn được vào hồ sơ khách.
        </p>

        <div className="flex items-center gap-3 flex-wrap text-sm">
          <span className="text-slate-500">
            {rows.length} lượt{rows.length === 100 && ' — giới hạn 100, gõ cụ thể hơn'}
          </span>
          <Suspense>
            <ChipSapXep cot={sapXep.cot} tang={sapXep.tang} macDinh={sapXep.macDinh} />
          </Suspense>
        </div>

        <KhungChon khoaTrang={rows.map((r) => r.visit_id)} bat={admin}>
        <ThanhDaChon nhan="lượt bảo trì" />
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <Suspense>
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <OChonTatCa nhan="lượt bảo trì" />
                  {/* Cột hiện tên khách + tên công trình; sắp theo customer_name vì
                      đó là cột trong whitelist COT_BAO_TRI. */}
                  <TieuDeCotSapXep cot="customer_name" nhan="Khách / công trình" chieuMacDinh="asc" />
                  <th className="text-left px-4 py-3 font-medium">Bộ máy · gói</th>
                  <th className="text-left px-4 py-3 font-medium">Lần</th>
                  <TieuDeCotSapXep cot="due_date" nhan="Đến hạn" chieuMacDinh="asc" dangMacDinh />
                  <th className="text-left px-4 py-3 font-medium">Ghi</th>
                </tr>
              </thead>
            </Suspense>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.visit_id} className="hover:bg-slate-50 align-top">
                  <OChonDong khoa={r.visit_id} moTa={`lượt bảo trì của ${r.customer_name ?? r.section ?? 'khách chưa khớp'}`} />
                  <td className="px-4 py-3">
                    <div className="text-slate-900">{r.customer_name ?? r.section ?? '—'}</div>
                    {r.primary_phone && <div className="font-mono text-xs text-slate-500">{r.primary_phone}</div>}
                    {r.customer_name && r.section && (
                      <div className="text-[10px] text-slate-400 line-clamp-1">{r.section}</div>
                    )}
                    {r.chua_khop_khach && (
                      <span className="text-[10px] text-amber-600">chưa khớp khách</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {r.bo_may ?? '—'}
                    {r.loai_goi && <div className="text-[10px] text-slate-400">{r.loai_goi}</div>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {r.lan_thu ?? '—'}{r.tong_lan ? `/${r.tong_lan}` : ''}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <TinhTrangBadge tt={r.tinh_trang} />
                    <div className="text-[10px] text-slate-400 mt-0.5">{vnDate(r.due_date)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <BaoTriDoneButton visitId={r.visit_id} completedAt={r.completed_at} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={admin ? 6 : 5} className="px-4 py-10 text-center text-slate-400">
                    Không có lượt nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </KhungChon>
      </div>
    </main>
  )
}
