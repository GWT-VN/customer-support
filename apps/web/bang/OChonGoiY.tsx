'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { boDau } from './timkiem'

/**
 * Ô CHỌN GÕ-ĐỂ-GỢI-Ý cho FORM (giá trị nằm trong state, không phải trên URL).
 *
 * ⚠️ LUẬT TOÀN APP (CEO chốt 22/08/2026): danh sách chọn **quá 10 mục** thì PHẢI
 * cho gõ để tìm, không được để `<select>` trần. Cuộn tay qua 51 mã sản phẩm hay 64
 * tỉnh là chậm và dễ chọn nhầm. Xem `docs/CHUAN-FILTER.md`.
 *
 * Bản dành cho ô LỌC (đọc/ghi tham số URL) là `BoLocGoiY` — cùng cách gõ, khác chỗ
 * lưu giá trị. Đừng dùng lẫn.
 *
 * Khớp không dấu ở cả hai đầu, tìm theo `gt` (mã) LẪN `nhan` (tên) LẪN `phu`.
 */
export type MucChon = { gt: string; nhan: string; phu?: string }

export function OChonGoiY({
  giaTri,
  onChon,
  tuyChon,
  choTrong = 'Gõ để tìm…',
  className = '',
  toiDa = 30,
  choPhepXoa = true,
}: {
  giaTri: string | null
  onChon: (gt: string) => void
  tuyChon: MucChon[]
  choTrong?: string
  className?: string
  toiDa?: number
  choPhepXoa?: boolean
}) {
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
      : tuyChon.filter(
          (t) =>
            boDau(t.gt).includes(s) || boDau(t.nhan).includes(s) || boDau(t.phu ?? '').includes(s)
        )
    return ds.slice(0, toiDa)
  }, [q, tuyChon, toiDa])

  const dangChon = tuyChon.find((t) => t.gt === giaTri)
  const o =
    className ||
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100'

  return (
    <div className="relative" ref={boxRef}>
      <input
        className={o}
        placeholder={choTrong}
        value={mo ? q : dangChon ? (dangChon.nhan === dangChon.gt ? dangChon.gt : `${dangChon.gt} — ${dangChon.nhan}`) : (giaTri ?? '')}
        onFocus={() => { setMo(true); setQ('') }}
        onChange={(e) => setQ(e.target.value)}
      />
      {choPhepXoa && giaTri && !mo && (
        <button
          type="button"
          onClick={() => onChon('')}
          title="Bỏ chọn"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600"
        >
          ✕
        </button>
      )}
      {mo && (
        <div className="absolute z-30 mt-1 max-h-72 w-full min-w-[260px] overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {loc.length === 0 ? (
            <div className="px-3 py-3 text-sm text-slate-400">Không có mục nào khớp.</div>
          ) : (
            loc.map((t) => (
              <button
                key={t.gt}
                type="button"
                onClick={() => { onChon(t.gt); setMo(false); setQ('') }}
                className={
                  'block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ' +
                  (t.gt === giaTri ? 'bg-teal-50 text-teal-800' : 'text-slate-700')
                }
              >
                {t.nhan !== t.gt && <span className="font-mono text-xs text-slate-500">{t.gt}</span>}
                <span className={t.nhan !== t.gt ? 'ml-2' : ''}>{t.nhan}</span>
                {t.phu && <span className="ml-2 text-xs text-slate-400">{t.phu}</span>}
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
