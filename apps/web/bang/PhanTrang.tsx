'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useGiaoDien } from './CauHinh'

/**
 * Nút "Trước"/"Sau" + "Trang X / Y". Giữ nguyên mọi tham số khác trên URL
 * (q, state, tt, bh…), chỉ đổi `trang`. Ẩn hẳn khi chỉ có 1 trang.
 *
 * Dùng useSearchParams -> component gọi PhanTrang phải nằm trong <Suspense>.
 */
export function PhanTrang({ trang, soTrang }: { trang: number; soTrang: number }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const gd = useGiaoDien()

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
    <div className={gd.phanTrang_khung}>
      {coTruoc ? (
        <Link href={hrefTrang(trang - 1)} className={gd.phanTrang_nut}>
          ← Trước
        </Link>
      ) : (
        <span className={gd.phanTrang_nutTat}>← Trước</span>
      )}
      <span className={gd.phanTrang_chuSo}>Trang {trang} / {soTrang}</span>
      {coSau ? (
        <Link href={hrefTrang(trang + 1)} className={gd.phanTrang_nut}>
          Sau →
        </Link>
      ) : (
        <span className={gd.phanTrang_nutTat}>Sau →</span>
      )}
    </div>
  )
}
