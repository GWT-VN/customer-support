import Link from 'next/link'
import { DieuHuong } from '@/components/DieuHuong'
import { listToFix } from '@/app/actions'

export default async function ToFixPage() {
  const { rows: list, tong, trang, soTrang } = await listToFix()
  // Chỉ tính trên trang hiện tại — tong ở trên là tổng số khách cần dọn thật.
  const thieuSdt = list.filter((c) => c.needs_phone)
  const thieuDiaChi = list.filter((c) => !c.address)

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        <Link href="/" className="text-sm text-slate-600 underline">← Máy đã lắp</Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Khách cần dọn dữ liệu</h1>
            <p className="text-sm text-slate-500 mt-1">
              {tong} khách cần dọn{soTrang > 1 && ` (trang ${trang}/${soTrang})`} · trên trang này:{' '}
              {thieuSdt.length} thiếu/lỗi SĐT · {thieuDiaChi.length} thiếu địa chỉ.
              Di trú từ Odoo không lấp được — phải sửa tay. Bấm tên khách để sửa.
            </p>
          </div>
          <DieuHuong />
        </div>

        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Khách</th>
                <th className="text-left px-4 py-3 font-medium">Máy</th>
                <th className="text-left px-4 py-3 font-medium">SĐT</th>
                <th className="text-left px-4 py-3 font-medium">Địa chỉ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 align-top">
                  <td className="px-4 py-3">
                    <Link href={`/khach/${c.id}`} prefetch={false} className="text-slate-900 underline font-medium">
                      {c.full_name}
                    </Link>
                    {c.notes && <p className="text-xs text-amber-700 mt-0.5 max-w-md">{c.notes}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.machines}</td>
                  <td className="px-4 py-3">
                    {c.needs_phone ? (
                      c.primary_phone ? (
                        <span className="font-mono text-xs text-amber-700">{c.primary_phone} ⚠️</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">thiếu</span>
                      )
                    ) : (
                      <span className="font-mono text-xs text-slate-600">{c.primary_phone}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.address ? (
                      <span className="text-slate-600 text-xs">{c.address.slice(0, 45)}…</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">thiếu</span>
                    )}
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">Không còn gì để dọn. 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
