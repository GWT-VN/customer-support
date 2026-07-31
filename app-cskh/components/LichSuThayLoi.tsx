'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { suaReplacement, deleteReplacement } from '@/app/actions'
import { vnDate } from '@/components/Badge'

type Row = { id: string; filter_code: string; replaced_at: string; note: string | null }
type KetQua = { ok: true; applied: boolean } | { ok: false; error: string }

/** Lịch sử thay lõi — sửa/xoá đều qua admin duyệt (admin áp ngay). */
export function LichSuThayLoi({ serial, items }: { serial: string; items: Row[] }) {
  const router = useRouter()
  const [suaId, setSuaId] = useState<string | null>(null)
  const [f, setF] = useState({ filter_code: '', replaced_at: '', note: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  function moSua(r: Row) {
    setSuaId(r.id); setF({ filter_code: r.filter_code, replaced_at: r.replaced_at, note: r.note ?? '' })
    setMsg(null); setErr(null)
  }
  function bao(r: KetQua, okMsg: string) {
    if (!r.ok) { setErr(r.error); return }
    setErr(null); setMsg(r.applied ? okMsg : 'Đã gửi chờ admin duyệt.'); setSuaId(null); router.refresh()
  }
  async function luuSua() {
    if (!window.confirm('Bạn chắc chắn lưu sửa dòng lịch thay lõi này?')) return
    setBusy(true); setErr(null); setMsg(null)
    const r = await suaReplacement(suaId!, {
      filter_code: f.filter_code.trim(), replaced_at: f.replaced_at, note: f.note.trim() || undefined,
    })
    setBusy(false); bao(r, 'Đã sửa.')
  }
  async function xoa(id: string) {
    if (!window.confirm('Gửi yêu cầu xoá dòng lịch thay lõi này?')) return
    setBusy(true); setErr(null); setMsg(null)
    const r = await deleteReplacement(id, serial); setBusy(false); bao(r, 'Đã xoá.')
  }

  if (!items.length) return null
  return (
    <div>
      <p className="text-xs text-slate-500 mb-1">Lịch sử đã thay ({items.length})</p>
      <ul className="text-xs border rounded-lg divide-y">
        {items.map((h) => (
          <li key={h.id} className="px-3 py-2">
            {suaId === h.id ? (
              <div className="flex flex-wrap items-center gap-2">
                <input value={f.filter_code} onChange={(e) => setF({ ...f, filter_code: e.target.value })}
                  className="w-40 rounded border px-2 py-1 font-mono" placeholder="Mã lõi" />
                <input type="date" value={f.replaced_at} onChange={(e) => setF({ ...f, replaced_at: e.target.value })}
                  className="rounded border px-2 py-1" />
                <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })}
                  className="flex-1 min-w-32 rounded border px-2 py-1" placeholder="Ghi chú" />
                <button onClick={luuSua} disabled={busy}
                  className="rounded bg-slate-900 text-white px-2.5 py-1 disabled:opacity-50">Lưu</button>
                <button onClick={() => setSuaId(null)} className="text-slate-500 underline">Huỷ</button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-600">
                  {vnDate(h.replaced_at)} — <span className="font-mono">{h.filter_code}</span>
                  {h.note && <span className="text-slate-400"> · {h.note}</span>}
                </span>
                <span className="flex gap-2 flex-none">
                  <button onClick={() => moSua(h)} className="text-slate-500 hover:underline">Sửa</button>
                  <button onClick={() => xoa(h.id)} className="text-red-600 hover:underline">Xoá</button>
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
      {msg && <p className="text-xs text-emerald-700 mt-1">{msg}</p>}
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
    </div>
  )
}
