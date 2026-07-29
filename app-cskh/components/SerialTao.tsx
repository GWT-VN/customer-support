'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSerialPending } from '@/app/actions'

/** Tạo serial mới -> hàng chờ duyệt (không đẩy thẳng lên kho). Ai cũng tạo được, admin mới duyệt. */
export function SerialTao() {
  const [mo, setMo] = useState(false)
  const [f, setF] = useState({ serial: '', internal_code: '', model: '', ma_quoc_te: '', ten_noi_bo: '', ghi_chu: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  async function tao() {
    setBusy(true); setErr(null); setMsg(null)
    const r = await createSerialPending(f)
    setBusy(false)
    if (!r.ok) setErr(r.error)
    else {
      setMsg('Đã gửi chờ duyệt.'); setF({ serial: '', internal_code: '', model: '', ma_quoc_te: '', ten_noi_bo: '', ghi_chu: '' })
      router.refresh()
    }
  }

  if (!mo) {
    return (
      <button onClick={() => setMo(true)}
        className="rounded-lg border bg-white text-slate-700 px-3 py-1.5 text-sm">+ Tạo serial mới (chờ duyệt)</button>
    )
  }
  return (
    <div className="rounded-lg border p-3 space-y-2 bg-slate-50">
      <div className="grid sm:grid-cols-2 gap-2">
        <input value={f.serial} onChange={set('serial')} placeholder="Serial *"
          className="rounded-lg border px-3 py-2 text-slate-900 font-mono text-sm" />
        <input value={f.internal_code} onChange={set('internal_code')} placeholder="Mã nội bộ"
          className="rounded-lg border px-3 py-2 text-slate-900 text-sm" />
        <input value={f.model} onChange={set('model')} placeholder="Model (vd GTEC-30A02-G)"
          className="rounded-lg border px-3 py-2 text-slate-900 text-sm" />
        <input value={f.ma_quoc_te} onChange={set('ma_quoc_te')} placeholder="Mã quốc tế"
          className="rounded-lg border px-3 py-2 text-slate-900 text-sm" />
        <input value={f.ten_noi_bo} onChange={set('ten_noi_bo')} placeholder="Tên nội bộ"
          className="rounded-lg border px-3 py-2 text-slate-900 text-sm sm:col-span-2" />
        <input value={f.ghi_chu} onChange={set('ghi_chu')} placeholder="Ghi chú"
          className="rounded-lg border px-3 py-2 text-slate-900 text-sm sm:col-span-2" />
      </div>
      <div className="flex items-center gap-3">
        <button onClick={tao} disabled={busy || !f.serial.trim()}
          className="rounded-lg bg-slate-900 text-white px-4 py-2 font-medium disabled:opacity-50">
          {busy ? 'Đang gửi…' : 'Gửi chờ duyệt'}
        </button>
        <button onClick={() => setMo(false)} className="text-sm text-slate-500 underline">Đóng</button>
        {msg && <span className="text-sm text-emerald-700">{msg}</span>}
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </div>
  )
}
