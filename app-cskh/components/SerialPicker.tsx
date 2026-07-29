'use client'

import { useEffect, useState } from 'react'
import { searchSerials, createSerialPending, type SerialRow } from '@/app/actions'

/**
 * Chọn serial từ kho (serial_registry). Gõ để tìm; chưa có thì "tạo chờ duyệt".
 * onChange trả chuỗi serial (cả khi gõ tay) để nơi dùng vẫn lưu được giá trị.
 */
export function SerialPicker({
  value, onChange, placeholder,
}: { value: string; onChange: (s: string) => void; placeholder?: string }) {
  const [q, setQ] = useState(value)
  const [sug, setSug] = useState<SerialRow[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => { setQ(value) }, [value])

  useEffect(() => {
    const t = q.trim()
    if (!open || !t) { setSug([]); return }
    let huy = false
    const id = setTimeout(async () => {
      const r = await searchSerials(t, 8)
      if (!huy) setSug(r)
    }, 250)
    return () => { huy = true; clearTimeout(id) }
  }, [q, open])

  function pick(s: string) { onChange(s); setQ(s); setOpen(false) }

  async function tao() {
    setBusy(true); setMsg(null)
    const r = await createSerialPending({ serial: q.trim() })
    setBusy(false)
    if (!r.ok) setMsg(r.error)
    else { onChange(q.trim()); setMsg('Đã gửi chờ duyệt'); setOpen(false) }
  }

  const khop = sug.some((s) => s.serial === q.trim())
  return (
    <div className="relative flex-1 min-w-52">
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); onChange(e.target.value); setOpen(true); setMsg(null) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={placeholder}
        className="w-full rounded-lg border px-3 py-2 text-slate-900 font-mono text-sm"
      />
      {msg && <p className="text-[10px] text-slate-500 mt-0.5">{msg}</p>}
      {open && q.trim() && (
        <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-lg border bg-white shadow-lg">
          {sug.map((s) => (
            <li key={s.serial}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s.serial)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 font-mono">
                {s.serial}
                <span className="text-slate-400"> · {s.internal_code ?? s.model ?? ''}</span>
              </button>
            </li>
          ))}
          {!khop && (
            <li className="px-3 py-1.5 text-xs border-t">
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={tao} disabled={busy}
                className="text-amber-700 hover:underline disabled:opacity-50">
                {busy ? 'Đang gửi…' : `+ Chưa có — tạo “${q.trim()}” (chờ duyệt)`}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
