import { DieuHuong } from '@/components/DieuHuong'
import { chanNeuKhongPhaiAdmin } from '@/lib/supabase'
import { doanhSoCskh } from '@/app/actions'

function tien(n: number | null) {
  return (n ?? 0).toLocaleString('vi-VN') + ' đ'
}
function thangVN(s: string) {
  const [y, m] = s.split('-')
  return `Tháng ${m}/${y}`
}

export default async function DoanhSoPage() {
  await chanNeuKhongPhaiAdmin()
  const rows = await doanhSoCskh()

  // gom theo tháng
  const theoThang = new Map<string, typeof rows>()
  for (const r of rows) {
    const k = r.thang
    if (!theoThang.has(k)) theoThang.set(k, [])
    theoThang.get(k)!.push(r)
  }
  const tongTatCa = rows.reduce((s, r) => s + (r.tong_tien ?? 0), 0)

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">Doanh số CSKH</h1>
          <DieuHuong />
        </header>

        <p className="text-sm bg-sky-50 text-sky-900 rounded-lg px-3 py-2">
          Tổng hợp các hạng mục <strong>có thu phí</strong> ghi trong ticket, theo tháng × mã nội bộ.
          Mục miễn phí và đổi máy không tính vào đây.
        </p>

        <div className="bg-white rounded-xl border p-4 flex items-baseline justify-between">
          <span className="text-slate-600">Tổng doanh số (tất cả)</span>
          <span className="text-2xl font-semibold text-slate-900">{tien(tongTatCa)}</span>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-slate-400">Chưa có hạng mục thu phí nào.</p>
        ) : (
          [...theoThang.entries()].map(([thang, ds]) => {
            const tongThang = ds.reduce((s, r) => s + (r.tong_tien ?? 0), 0)
            return (
              <section key={thang} className="bg-white rounded-xl border overflow-hidden">
                <div className="flex items-baseline justify-between px-4 py-2.5 bg-slate-50 border-b">
                  <h2 className="font-medium text-slate-900">{thangVN(thang)}</h2>
                  <span className="font-semibold text-slate-900">{tien(tongThang)}</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Hạng mục</th>
                      <th className="text-left px-4 py-2 font-medium">Mã</th>
                      <th className="text-right px-4 py-2 font-medium">Lượt</th>
                      <th className="text-right px-4 py-2 font-medium">SL</th>
                      <th className="text-right px-4 py-2 font-medium">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ds.map((r) => (
                      <tr key={r.catalog_code ?? 'x'}>
                        <td className="px-4 py-2 text-slate-800">{r.ten_hang_muc ?? '(không rõ)'}</td>
                        <td className="px-4 py-2 font-mono text-xs text-slate-400">{r.catalog_code ?? '—'}</td>
                        <td className="px-4 py-2 text-right text-slate-600">{r.so_luot}</td>
                        <td className="px-4 py-2 text-right text-slate-600">{r.tong_so_luong ?? '—'}</td>
                        <td className="px-4 py-2 text-right font-medium text-slate-900">{tien(r.tong_tien)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )
          })
        )}
      </div>
    </main>
  )
}
