'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addTicketNote, updateTicketNote, deleteTicketNote, type TicketNote } from '@/app/actions'
import { vnDateTime } from '@/components/TicketBadge'

// "YYYY-MM-DDTHH:MM" theo GIỜ ĐỊA PHƯƠNG cho input datetime-local
function nowLocal() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
function toLocal(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
// datetime-local (local) -> ISO UTC để lưu
const toIso = (local: string) => (local ? new Date(local).toISOString() : undefined)

/** Nhật ký trao đổi: thêm (chọn giờ + nội dung) + sửa/xoá dòng cũ. */
export function TicketNotes({ code, notes }: { code: string; notes: TicketNote[] }) {
  const [text, setText] = useState('')
  const [khi, setKhi] = useState(nowLocal())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [suaId, setSuaId] = useState<string | null>(null)
  const router = useRouter()

  async function add() {
    setBusy(true); setErr(null)
    const r = await addTicketNote(code, text, toIso(khi))
    setBusy(false)
    if (!r.ok) setErr(r.error)
    else { setText(''); setKhi(nowLocal()); router.refresh() }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border p-3 space-y-2 bg-slate-50">
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} rows={2}
          placeholder="Nội dung trao đổi với khách…"
          className="w-full rounded-lg border px-3 py-2 text-slate-900"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-sm text-slate-600 flex items-center gap-1.5">
            Thời gian
            <input type="datetime-local" value={khi} onChange={(e) => setKhi(e.target.value)}
              className="rounded-lg border px-2 py-1.5 text-sm" />
          </label>
          <button onClick={add} disabled={busy || !text.trim()}
            className="rounded-lg bg-slate-900 text-white px-4 py-1.5 font-medium disabled:opacity-50">
            {busy ? 'Đang thêm…' : 'Thêm'}
          </button>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-slate-400">Chưa có ghi chú nào.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) =>
            suaId === n.id ? (
              <NoteEdit key={n.id} code={code} note={n} onXong={() => setSuaId(null)} />
            ) : (
              <li key={n.id} className="border-l-2 border-slate-200 pl-3 py-0.5 group">
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  {vnDateTime(n.created_at)}{n.tac_gia && ` · ${n.tac_gia}`}
                  <button onClick={() => setSuaId(n.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-900 underline">sửa</button>
                </div>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{n.noi_dung}</p>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}

function NoteEdit({ code, note, onXong }: { code: string; note: TicketNote; onXong: () => void }) {
  const [text, setText] = useState(note.noi_dung)
  const [khi, setKhi] = useState(toLocal(note.created_at))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()

  async function luu() {
    setBusy(true); setErr(null)
    const r = await updateTicketNote(note.id, code, { noi_dung: text, khi: toIso(khi) })
    setBusy(false)
    if (!r.ok) setErr(r.error)
    else { onXong(); router.refresh() }
  }
  async function xoa() {
    setBusy(true); setErr(null)
    const r = await deleteTicketNote(note.id, code)
    setBusy(false)
    if (!r.ok) setErr(r.error)
    else { onXong(); router.refresh() }
  }

  return (
    <li className="border-l-2 border-slate-900 pl-3 py-1 space-y-1.5 bg-slate-50 rounded-r-lg">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
        className="w-full rounded-lg border px-2 py-1 text-sm text-slate-900" />
      <div className="flex items-center gap-2 flex-wrap">
        <input type="datetime-local" value={khi} onChange={(e) => setKhi(e.target.value)}
          className="rounded-lg border px-2 py-1 text-sm" />
        <button onClick={luu} disabled={busy}
          className="rounded-lg bg-slate-900 text-white px-3 py-1 text-sm disabled:opacity-50">Lưu</button>
        <button onClick={onXong} className="text-xs text-slate-500 underline">Huỷ</button>
        <button onClick={xoa} disabled={busy}
          className="text-xs text-red-500 hover:text-red-700 underline ml-auto">Xoá</button>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </li>
  )
}
