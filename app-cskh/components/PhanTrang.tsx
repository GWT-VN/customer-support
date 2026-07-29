'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Nút "Trước"/"Sau" + "Trang X / Y". Giữ nguyên mọi tham số khác trên URL
 * (q, state, tt, bh…), chỉ đổi `trang`. Ẩn hẳn khi chỉ có 1 trang.
 *
 * Dùng useSearchParams -> component gọi PhanTrang phải nằm trong <Suspense>.
 */
export function PhanTrang({ trang, soTrang }: { trang: number; soTrang: number }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (soTrang <= 1) return null

  function hrefTrang(t: number) {
    const sp = new URLSearchParams(searchParams.toString())
    if (t <= 1) sp.delete('trang')
    else sp.set('trang', String(t))
    const qs = sp.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  const coTruoc = trang > 1
  const coSau = trang < soTrang

  return (
    <div className="flex items-center justify-center gap-3 text-sm">
      {coTruoc ? (
        <Link href={hrefTrang(trang - 1)} className="rounded-lg border bg-white text-slate-700 px-3 py-1.5 hover:bg-slate-50">
          ← Trước
        </Link>
      ) : (
        <span className="rounded-lg border bg-white text-slate-300 px-3 py-1.5">← Trước</span>
      )}
      <span className="text-slate-500">Trang {trang} / {soTrang}</span>
      {coSau ? (
        <Link href={hrefTrang(trang + 1)} className="rounded-lg border bg-white text-slate-700 px-3 py-1.5 hover:bg-slate-50">
          Sau →
        </Link>
      ) : (
        <span className="rounded-lg border bg-white text-slate-300 px-3 py-1.5">Sau →</span>
      )}
    </div>
  )
}
