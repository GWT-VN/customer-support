'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { duyetKhach, type KhachTom } from '@/app/actions'

/** Khách chờ duyệt (tạo từ CS). Duyệt CHỈ admin (server cũng chặn). */
export function KhachChoDuyetList({ items }: { items: KhachTom[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function duyet(id: string) {
    setBusy(id); setErr(null)
    const r = await duyetKhach(id)
    setBusy(null)
    if (!r.ok) setErr(r.error)
    else router.refresh()
  }

  if (!items.length) return <p className="text-sm text-slate-400">Không có khách nào chờ duyệt.</p>
  return (
    <div className="space-y-2">
      {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
      <ul className="divide-y border rounded-lg">
        {items.map((k) => (
          <li key={k.id} className="px-3 py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-slate-900">{k.full_name}</div>
              {k.primary_phone && <div className="font-mono text-xs text-slate-500">{k.primary_phone}</div>}
            </div>
            <button onClick={() => duyet(k.id)} disabled={busy === k.id}
              className="rounded-lg bg-emerald-600 text-white px-3 py-1 text-xs font-medium disabled:opacity-50 flex-none">
              {busy === k.id ? '…' : 'Duyệt'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
