'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

/**
 * Lọc theo ngày, dùng chung cho mọi bảng có trường ngày. Điều khiển 2 tham số URL
 * `ngtu`/`ngden` (xem docLocNgay). 4 chế độ suy từ dữ liệu, không cần param mode:
 *   đúng ngày (tu==den) · khoảng (tu..den) · trước (chỉ den) · sau (chỉ tu).
 * Đổi lọc thì XOÁ `trang` (về trang 1), giữ mọi tham số khác. Dùng useSearchParams
 * -> nơi gọi phải bọc <Suspense>.
 */
type Che = 'dung' | 'khoang' | 'truoc' | 'sau'
const NHAN_CHE: Record<Che, string> = {
  dung: 'Đúng ngày', khoang: 'Trong khoảng', truoc: 'Trước ngày', sau: 'Từ ngày',
}
function suyChe(tu: string, den: string): Che {
  if (tu && den) return tu === den ? 'dung' : 'khoang'
  if (den) return 'truoc'
  if (tu) return 'sau'
  return 'dung'
}

export function LocNgay({ nhan = 'Ngày' }: { nhan?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const tu = sp.get('ngtu') ?? ''
  const den = sp.get('ngden') ?? ''
  const [che, setChe] = useState<Che>(suyChe(tu, den))

  function di(ntu: string, nden: string) {
    const p = new URLSearchParams(sp.toString())
    if (ntu) p.set('ngtu', ntu); else p.delete('ngtu')
    if (nden) p.set('ngden', nden); else p.delete('ngden')
    p.delete('trang')
    const qs = p.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function doiChe(c: Che) {
    setChe(c)
    if (tu || den) di('', '')   // đổi chế độ -> xoá giá trị cũ cho khỏi lẫn
  }

  const oNgay = 'rounded-lg border px-3 py-2 text-sm text-slate-900 bg-white'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={che} onChange={(e) => doiChe(e.target.value as Che)}
        className="rounded-lg border px-3 py-2 text-sm bg-white text-slate-700">
        {(Object.keys(NHAN_CHE) as Che[]).map((c) => (
          <option key={c} value={c}>{nhan} · {NHAN_CHE[c]}</option>
        ))}
      </select>

      {che === 'dung' && (
        <input type="date" value={tu} onChange={(e) => di(e.target.value, e.target.value)} className={oNgay} />
      )}
      {che === 'sau' && (
        <input type="date" value={tu} onChange={(e) => di(e.target.value, '')} className={oNgay} />
      )}
      {che === 'truoc' && (
        <input type="date" value={den} onChange={(e) => di('', e.target.value)} className={oNgay} />
      )}
      {che === 'khoang' && (
        <>
          <input type="date" value={tu} max={den || undefined}
            onChange={(e) => di(e.target.value, den)} className={oNgay} />
          <span className="text-slate-400 text-sm">→</span>
          <input type="date" value={den} min={tu || undefined}
            onChange={(e) => di(tu, e.target.value)} className={oNgay} />
        </>
      )}
    </div>
  )
}
