import { chanNeuThieuQuyen } from '@/lib/nen-tang/kiem-quyen'
import Link from 'next/link'
import { auditLog } from '@/app/actions'

const NHAN_BANG: Record<string, string> = {
  cs_customers: 'khách', customer_contacts: 'SĐT phụ',
  filter_replacement: 'lịch thay lõi', installed_base: 'máy đã lắp',
}
const NHAN: Record<string, string> = {
  duyet_serial: 'Duyệt serial', tu_choi_serial: 'Từ chối serial', xoa_serial_pending: 'Xoá serial chờ',
  duyet_khach: 'Duyệt khách', kich_hoat_bh: 'Kích hoạt BH', sua_nv: 'Sửa nhân viên',
  gui_yeu_cau: 'Gửi yêu cầu (chờ duyệt)', duyet_yeu_cau: 'Duyệt yêu cầu', tu_choi_yeu_cau: 'Từ chối yêu cầu',
}

/** Nhãn hành động: ưu tiên map, còn lại suy từ mẫu <loai>_<bảng>. */
function nhanHanhDong(hd: string): string {
  if (NHAN[hd]) return NHAN[hd]
  const m = hd.match(/^(sua|xoa|doi_serial)_(.+)$/)
  if (m) {
    const loai = m[1] === 'sua' ? 'Sửa' : m[1] === 'xoa' ? 'Xoá' : 'Đổi serial'
    return `${loai} ${NHAN_BANG[m[2]] ?? m[2]}`
  }
  return hd
}

function khiNao(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', { hour12: false })
}
function chiTiet(o: Record<string, unknown> | null): string {
  if (!o) return '—'
  return Object.entries(o).map(([k, v]) => `${k}=${v ?? '—'}`).join(' · ')
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string }>
}) {
  await chanNeuThieuQuyen('he_thong.nhat_ky', 'ADMIN')
  const { n } = await searchParams
  const soDong = Math.min(5000, Math.max(100, Number(n) || 300))
  const rows = await auditLog(soDong)
  const conNua = rows.length === soDong

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">Nhật ký thao tác</h1>
        </header>

        <p className="text-sm bg-sky-50 text-sky-900 rounded-lg px-3 py-2">
          Vết mọi thao tác nhạy cảm: duyệt/kích hoạt/sửa/xoá + chi tiết. Đang hiện {rows.length} dòng gần nhất.
        </p>

        {rows.length === 0 ? (
          <p className="text-sm text-slate-400">Chưa có thao tác nào được ghi.</p>
        ) : (
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Lúc</th>
                  <th className="text-left px-3 py-3 font-medium">Người</th>
                  <th className="text-left px-3 py-3 font-medium">Hành động</th>
                  <th className="text-left px-3 py-3 font-medium">Đối tượng</th>
                  <th className="text-left px-3 py-3 font-medium">Chi tiết</th>
                  <th className="text-left px-3 py-3 font-medium">Kết quả</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 align-top">
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{khiNao(r.luc)}</td>
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{r.actor ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-900 whitespace-nowrap">{nhanHanhDong(r.hanh_dong)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500 break-all">{r.doi_tuong ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-500 break-all max-w-md">{chiTiet(r.chi_tiet)}</td>
                    <td className="px-3 py-2">
                      <span className={r.ket_qua === 'ok' ? 'text-emerald-700' : 'text-red-600'}>{r.ket_qua}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {conNua && (
          <Link href={`/audit?n=${soDong + 300}`}
            className="inline-block rounded-lg border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            Xem thêm 300 dòng
          </Link>
        )}
      </div>
    </main>
  )
}
