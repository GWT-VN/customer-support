'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateTicket } from '@/app/actions'

const STATES = [
  { key: 'Open', label: 'Đang mở' },
  { key: 'Done', label: 'Đã xong' },
  { key: 'Cancel', label: 'Đã huỷ' },
]

export function TicketEditor({
  code,
  state,
  lastNote,
}: {
  code: string
  state: string
  lastNote: string | null
}) {
  const [st, setSt] = useState(state)
  const [note, setNote] = useState(lastNote ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()

  async function save() {
    setBusy(true); setErr(null); setMsg(null)
    const r = await updateTicket(code, { state: st, last_note: note })
    setBusy(false)
    if (!r.ok) setErr(r.error)
    else { setMsg('Đã lưu.'); router.refresh() }
  }

  return (
    <div className="space-y-3">
      <div>
        <span className="text-sm text-slate-700">Trạng thái</span>
        <div className="mt-1 flex gap-2">
          {STATES.map((s) => (
            <button
              key={s.key} onClick={() => setSt(s.key)}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                st === s.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="text-sm text-slate-700">Ghi chú xử lý</span>
        <textarea
          value={note} onChange={(e) => setNote(e.target.value)} rows={5}
          placeholder="Kỹ thuật đã làm gì, nguyên nhân, kết quả…"
          className="mt-1 w-full rounded-lg border px-3 py-2 text-slate-900"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          onClick={save} disabled={busy}
          className="rounded-lg bg-slate-900 text-white px-4 py-2 font-medium disabled:opacity-50"
        >
          {busy ? 'Đang lưu…' : 'Lưu'}
        </button>
        {msg && <span className="text-sm text-emerald-700">{msg}</span>}
      </div>

      {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
    </div>
  )
}
