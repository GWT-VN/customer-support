'use client'

import { useState } from 'react'

type TepXem = { url: string; ten: string; video: boolean }

/**
 * KHUNG upload ảnh/video cho 1 chuyến (yêu cầu #2). Hiện chỉ CHỌN + XEM TRƯỚC ở máy —
 * CHƯA lưu lên đâu (sẽ đẩy về Google Drive khi có cấu hình service account).
 * Giữ chuyenId để nối lưu trữ sau này.
 */
export function AnhViec({ chuyenId }: { chuyenId: string }) {
  const [mo, setMo] = useState(false)
  const [teps, setTeps] = useState<TepXem[]>([])

  function chon(e: React.ChangeEvent<HTMLInputElement>) {
    const fs = Array.from(e.target.files ?? [])
    setTeps((cur) => [...cur, ...fs.map((f) => ({ url: URL.createObjectURL(f), ten: f.name, video: f.type.startsWith('video') }))])
    e.target.value = ''
  }
  function xoa(i: number) {
    setTeps((cur) => { const t = cur[i]; if (t) URL.revokeObjectURL(t.url); return cur.filter((_, j) => j !== i) })
  }

  if (!mo) return <button onClick={() => setMo(true)} className="text-xs text-slate-500 hover:text-slate-800 underline">+ Ảnh/video hiện trường</button>

  return (
    <div data-chuyen={chuyenId} className="rounded-lg border bg-slate-50 p-2.5 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <label className="rounded-lg border bg-white px-3 py-1.5 text-xs text-slate-700 cursor-pointer hover:bg-slate-50">
          Chọn ảnh/video
          <input type="file" accept="image/*,video/*" multiple onChange={chon} className="hidden" />
        </label>
        <button onClick={() => setMo(false)} className="text-xs text-slate-500 underline">Đóng</button>
      </div>
      {teps.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {teps.map((t, i) => (
            <div key={i} className="relative">
              {t.video
                ? <video src={t.url} className="h-20 w-20 object-cover rounded border" muted />
                // eslint-disable-next-line @next/next/no-img-element -- xem trước blob cục bộ, không tối ưu qua next/image
                : <img src={t.url} alt={t.ten} className="h-20 w-20 object-cover rounded border" />}
              <button onClick={() => xoa(i)} className="absolute -top-1.5 -right-1.5 bg-white border rounded-full w-5 h-5 text-xs text-red-600 leading-none">×</button>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-amber-700">⚠️ Khung thử — chưa lưu lên hệ thống. Sẽ đẩy về Google Drive khi cấu hình xong.</p>
    </div>
  )
}
