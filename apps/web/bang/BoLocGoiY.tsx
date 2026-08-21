'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { boDau } from './timkiem'

/**
 * Ô lọc GÕ-ĐỂ-GỢI-Ý theo MỘT tham số URL. Dùng thay `BoLocChon` khi danh sách lựa
 * chọn dài tới mức cuộn tay không nổi (vài trăm mã sản phẩm, hàng nghìn khách…).
 *
 * Khớp không dấu ở cả hai đầu, tìm theo `giaTri` (mã) LẪN `nhan` (tên) — gõ "WH15A"
 * hay gõ tên tiếng Việt đều ra.
 *
 * Đổi lựa chọn -> XOÁ `trang` (về trang 1), giữ nguyên mọi tham số khác.
 * Dùng useSearchParams -> nơi gọi phải bọc <Suspense>.
 */
export function BoLocGoiY({
  param,
  nhan,
  tuyChon,
  toiDa = 30,
}: {
  param: string
  nhan: string
  /** `giaTri` = thứ ghi lên URL (thường là mã). `nhan` = tên người đọc. */
  tuyChon: { giaTri: string; nhan: string }[]
  toiDa?: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const dangChon = sp.get(param) ?? ''

  const [mo, setMo] = useState(false)
  const [q, setQ] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function ngoai(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setMo(false)
    }
    document.addEventListener('mousedown', ngoai)
    return () => document.removeEventListener('mousedown', ngoai)
  }, [])

  const loc = useMemo(() => {
    const s = boDau(q.trim())
    const ds = !s
      ? tuyChon
      : tuyChon.filter((t) => boDau(t.giaTri).includes(s) || boDau(t.nhan).includes(s))
    return ds.slice(0, toiDa)
  }, [q, tuyChon, toiDa])

  function di(giaTri: string) {
    const p = new URLSearchParams(sp.toString())
    if (giaTri) p.set(param, giaTri)
    else p.delete(param)
    p.delete('trang')
    const qs = p.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
    setMo(false)
    setQ('')
  }

  const nhanDangChon = tuyChon.find((t) => t.giaTri === dangChon)?.nhan
  const o =
    'w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-400'

  return (
    <div className="relative" ref={boxRef}>
      <input
        className={o}
        placeholder={`${nhan}: gõ để tìm…`}
        title={dangChon ? `${nhan}: ${nhanDangChon ?? dangChon}` : `${nhan}: Tất cả`}
        value={mo ? q : dangChon ? (nhanDangChon ? `${dangChon} — ${nhanDangChon}` : dangChon) : ''}
        onFocus={() => {
          setMo(true)
          setQ('')
        }}
        onChange={(e) => setQ(e.target.value)}
      />
      {dangChon && !mo && (
        <button
          type="button"
          onClick={() => di('')}
          title={`Bỏ lọc ${nhan}`}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600"
        >
          ✕
        </button>
      )}
      {mo && (
        <div className="absolute z-20 mt-1 max-h-72 w-72 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          <button
            type="button"
            onClick={() => di('')}
            className="block w-full px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50"
          >
            {nhan}: Tất cả
          </button>
          {loc.length === 0 ? (
            <div className="px-3 py-3 text-sm text-slate-400">Không có mục nào khớp.</div>
          ) : (
            loc.map((t) => (
              <button
                key={t.giaTri}
                type="button"
                onClick={() => di(t.giaTri)}
                className={
                  'block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ' +
                  (t.giaTri === dangChon ? 'bg-teal-50 text-teal-800' : 'text-slate-700')
                }
              >
                <span className="font-mono text-xs text-slate-500">{t.giaTri}</span>
                {t.nhan && t.nhan !== t.giaTri && <span className="ml-2">{t.nhan}</span>}
              </button>
            ))
          )}
          {tuyChon.length > loc.length && (
            // Nói rõ đang cắt bớt. Im lặng cắt là người dùng tưởng gõ đúng mà "không có".
            <div className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
              Đang hiện {loc.length} / {tuyChon.length} mục — gõ thêm để thu hẹp.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
