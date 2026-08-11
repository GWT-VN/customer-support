'use client'

import { useMemo, useState } from 'react'
import type { CatalogChon } from '@/app/actions'

/**
 * Ô chọn sản phẩm từ catalog — GÕ để lọc theo tên + mã nội bộ (bỏ dấu), thay cho
 * <select> 326 dòng. Trả về internal_code. Dùng cho nhập kho / lắp bộ.
 */
const khongDau = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')

export function ChonCatalog({
  catalog, value, onChange, placeholder = 'Gõ tên hoặc mã nội bộ…',
}: {
  catalog: CatalogChon[]
  value: string
  onChange: (internalCode: string) => void
  placeholder?: string
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  const goiY = useMemo(() => {
    const kq = khongDau(q.trim())
    if (!kq) return catalog.slice(0, 12)
    return catalog
      .filter((c) => khongDau(c.internal_code).includes(kq) || khongDau(c.ten ?? '').includes(kq))
      .slice(0, 12)
  }, [q, catalog])

  function chon(c: CatalogChon) {
    onChange(c.internal_code)
    setQ(`${c.ten ?? c.internal_code} · ${c.internal_code}`)
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); if (!e.target.value.trim()) onChange('') }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={placeholder}
        className={`w-full rounded-lg border px-3 py-2 text-sm bg-white text-slate-900 ${value ? 'border-emerald-400' : ''}`}
      />
      {open && goiY.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-lg border bg-white shadow-lg">
          {goiY.map((c) => (
            <li key={c.internal_code}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => chon(c)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100">
                {c.ten ?? c.internal_code}
                <span className="font-mono text-[10px] text-slate-400"> · {c.internal_code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
