import { chanNeuKhongPhaiAdmin } from '@/lib/supabase'
import { auditLog } from '@/app/actions'

const NHAN: Record<string, string> = {
  duyet_serial: 'Duyệt serial',
  tu_choi_serial: 'Từ chối serial',
  xoa_serial_pending: 'Xoá serial chờ',
  duyet_khach: 'Duyệt khách',
  kich_hoat_bh: 'Kích hoạt BH',
  sua_nv: 'Sửa nhân viên',
}

function khiNao(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', { hour12: false })
}

export default async function AuditPage() {
  await chanNeuKhongPhaiAdmin()
  const rows = await auditLog(200)

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">Nhật ký thao tác</h1>
        </header>

        <p className="text-sm bg-sky-50 text-sky-900 rounded-lg px-3 py-2">
          Vết các thao tác nhạy cảm: duyệt serial/khách, kích hoạt bảo hành, sửa nhân viên… — ai làm, lúc nào.
          200 dòng gần nhất.
        </p>

        {rows.length === 0 ? (
          <p className="text-sm text-slate-400">Chưa có thao tác nào được ghi.</p>
        ) : (
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Lúc</th>
                  <th className="text-left px-4 py-3 font-medium">Người</th>
                  <th className="text-left px-4 py-3 font-medium">Hành động</th>
                  <th className="text-left px-4 py-3 font-medium">Đối tượng</th>
                  <th className="text-left px-4 py-3 font-medium">Kết quả</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 align-top">
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{khiNao(r.luc)}</td>
                    <td className="px-4 py-2.5 text-slate-700">{r.actor ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-900">{NHAN[r.hanh_dong] ?? r.hanh_dong}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{r.doi_tuong ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={r.ket_qua === 'ok' ? 'text-emerald-700' : 'text-red-600'}>
                        {r.ket_qua}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
