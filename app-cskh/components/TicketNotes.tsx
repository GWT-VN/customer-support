'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addTicketNote, type TicketNote } from '@/app/actions'
import { vnDateTime } from '@/components/TicketBadge'

/** Nhật ký trao đổi theo mốc thời gian — mỗi lần liên hệ khách ghi 1 dòng. */
export function TicketNotes({ code, notes }: { code: string; notes: TicketNote[] }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()

  async function add() {
    setBusy(true); setErr(null)
    const r = await addTicketNote(code, text)
    setBusy(false)
    if (!r.ok) setErr(r.error)
    else { setText(''); router.refresh() }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} rows={2}
          placeholder="Ghi lại trao đổi với khách hôm nay…"
          className="flex-1 rounded-lg border px-3 py-2 text-slate-900"
        />
        <button
          onClick={add} disabled={busy || !text.trim()}
          className="rounded-lg bg-slate-900 text-white px-4 font-medium disabled:opacity-50 self-start py-2"
        >
          {busy ? 'Đang thêm…' : 'Thêm'}
        </button>
      </div>
      {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}

      {notes.length === 0 ? (
        <p className="text-sm text-slate-400">Chưa có ghi chú nào.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="border-l-2 border-slate-200 pl-3 py-0.5">
              <div className="text-xs text-slate-400">
                {vnDateTime(n.created_at)}{n.tac_gia && ` · ${n.tac_gia}`}
              </div>
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{n.noi_dung}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
