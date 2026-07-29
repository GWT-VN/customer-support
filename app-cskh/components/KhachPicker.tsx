'use client'

import { useEffect, useState } from 'react'
import { searchCustomers, taoKhachChoDuyet, type KhachTom } from '@/app/actions'

/**
 * Chọn khách (tìm trong cs_customers) hoặc tạo mới -> chờ admin duyệt.
 * onPick trả (id, nhãn hiển thị). Không setState đồng bộ trong effect (tránh lỗi eslint).
 */
export function KhachPicker({ onPick }: { onPick: (id: string, nhan: string) => void }) {
  const [q, setQ] = useState('')
  const [chon, setChon] = useState<string | null>(null)   // nhãn khách đã chọn
  const [sug, setSug] = useState<KhachTom[]>([])
  const [open, setOpen] = useState(false)
  const [taoMo, setTaoMo] = useState(false)
  const [f, setF] = useState({ full_name: '', primary_phone: '', address: '', province: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const t = q.trim()
    if (!open || !t) return
    let huy = false
    const id = setTimeout(async () => {
      const r = await searchCustomers(t, 8)
      if (!huy) setSug(r)
    }, 250)
    return () => { huy = true; clearTimeout(id) }
  }, [q, open])

  function pick(k: KhachTom) {
    const nhan = `${k.full_name}${k.primary_phone ? ` · ${k.primary_phone}` : ''}`
    setChon(nhan); onPick(k.id, nhan); setOpen(false)
  }

  async function taoMoi() {
    setBusy(true); setErr(null)
    const r = await taoKhachChoDuyet(f)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    const nhan = `${f.full_name.trim()} (chờ duyệt)`
    setChon(nhan); onPick(r.id, nhan); setTaoMo(false)
  }

  if (chon) {
    return (
      <div className="flex items-center gap-2 rounded-lg border px-3 py-2 bg-emerald-50">
        <span className="text-sm text-slate-900">{chon}</span>
        <button type="button" onClick={() => { setChon(null); setQ('') }}
          className="text-xs text-slate-500 underline ml-auto">đổi</button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Tìm khách theo tên hoặc SĐT…"
          className="w-full rounded-lg border px-3 py-2 text-slate-900"
        />
        {open && q.trim() && (
          <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-lg border bg-white shadow-lg">
            {sug.map((k) => (
              <li key={k.id}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(k)}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100">
                  {k.full_name}
                  {k.primary_phone && <span className="font-mono text-xs text-slate-400"> · {k.primary_phone}</span>}
                  {k.trang_thai === 'cho_duyet' && <span className="text-[10px] text-amber-600"> · chờ duyệt</span>}
                </button>
              </li>
            ))}
            {sug.length === 0 && <li className="px-3 py-1.5 text-xs text-slate-400">Không thấy — tạo khách mới bên dưới.</li>}
          </ul>
        )}
      </div>

      {!taoMo ? (
        <button type="button" onClick={() => setTaoMo(true)}
          className="text-sm text-slate-600 underline">+ Không có? Tạo khách mới (chờ duyệt)</button>
      ) : (
        <div className="rounded-lg border p-3 space-y-2 bg-slate-50">
          <div className="grid sm:grid-cols-2 gap-2">
            <input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })}
              placeholder="Tên khách *" className="rounded-lg border px-3 py-2 text-sm text-slate-900" />
            <input value={f.primary_phone} onChange={(e) => setF({ ...f, primary_phone: e.target.value })}
              placeholder="SĐT" className="rounded-lg border px-3 py-2 text-sm text-slate-900" />
            <input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })}
              placeholder="Địa chỉ" className="rounded-lg border px-3 py-2 text-sm text-slate-900 sm:col-span-2" />
            <input value={f.province} onChange={(e) => setF({ ...f, province: e.target.value })}
              placeholder="Tỉnh/TP" className="rounded-lg border px-3 py-2 text-sm text-slate-900" />
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={taoMoi} disabled={busy || !f.full_name.trim()}
              className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
              {busy ? 'Đang tạo…' : 'Tạo (chờ duyệt)'}
            </button>
            <button type="button" onClick={() => setTaoMo(false)} className="text-sm text-slate-500 underline">Đóng</button>
            {err && <span className="text-sm text-red-600">{err}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
