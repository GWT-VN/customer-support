'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { approveSerial, rejectSerial, deleteSerialPending, type SerialPending } from '@/app/actions'
import { vnDateTime } from '@/components/TicketBadge'

/** Danh sách serial chờ duyệt. Duyệt/từ chối/xoá CHỈ admin (server cũng chặn). */
export function SerialPendingList({ items, laAdmin }: { items: SerialPending[]; laAdmin: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function chay(id: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(id); setErr(null)
    const r = await fn()
    setBusy(null)
    if (!r.ok) setErr(r.error ?? 'Lỗi')
    else router.refresh()
  }

  const duyet = (id: string) => chay(id, () => approveSerial(id))
  const tuChoi = (id: string) => {
    const ly = window.prompt('Lý do từ chối (tuỳ chọn):') ?? undefined
    return chay(id, () => rejectSerial(id, ly))
  }
  const xoa = (id: string) => {
    if (!window.confirm('Xoá hẳn serial pending này? Không khôi phục được.')) return
    return chay(id, () => deleteSerialPending(id))
  }

  if (!items.length) return <p className="text-sm text-slate-400">Không có serial nào chờ duyệt.</p>
  return (
    <div className="space-y-2">
      {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
      <ul className="divide-y border rounded-lg">
        {items.map((s) => (
          <li key={s.id} className="px-3 py-2.5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-mono text-sm text-slate-900">{s.serial}</div>
              <div className="text-xs text-slate-500">
                {[s.internal_code, s.model, s.ma_quoc_te, s.ten_noi_bo].filter(Boolean).join(' · ') || '—'}
              </div>
              {s.ghi_chu && <div className="text-xs text-slate-400">{s.ghi_chu}</div>}
              <div className="text-[10px] text-slate-400">
                {s.nguoi_tao && `${s.nguoi_tao} · `}{vnDateTime(s.created_at)}
              </div>
            </div>
            {laAdmin ? (
              <div className="flex items-center gap-2 flex-none">
                <button onClick={() => duyet(s.id)} disabled={busy === s.id}
                  className="rounded-lg bg-emerald-600 text-white px-3 py-1 text-xs font-medium disabled:opacity-50">
                  {busy === s.id ? '…' : 'Duyệt'}
                </button>
                <button onClick={() => tuChoi(s.id)} disabled={busy === s.id}
                  className="text-xs text-slate-500 hover:text-slate-900 underline">Từ chối</button>
                <button onClick={() => xoa(s.id)} disabled={busy === s.id}
                  className="text-xs text-red-500 hover:text-red-700 underline">Xoá</button>
              </div>
            ) : (
              <span className="text-xs text-amber-600 flex-none">chờ admin duyệt</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
