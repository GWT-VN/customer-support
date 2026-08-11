'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ganKenh, type Kenh } from '@/app/actions'

/** Gắn khách vào 1 kênh/đối tác (đại lý/KTS/KOL…). Taxonomy dim_channel do Sales quản,
 *  CSKH chỉ chọn. Nhóm option theo channel_l1. */
export function GanKenh({
  customerId, channelId, kenh,
}: { customerId: string; channelId: number | null; kenh: Kenh[] }) {
  const router = useRouter()
  const [val, setVal] = useState(channelId != null ? String(channelId) : '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const nhom = new Map<string, Kenh[]>()
  for (const k of kenh) {
    const g = nhom.get(k.channel_l1) ?? []
    g.push(k); nhom.set(k.channel_l1, g)
  }

  async function doi(v: string) {
    setVal(v); setBusy(true); setMsg(null)
    const r = await ganKenh(customerId, v ? Number(v) : null)
    setBusy(false)
    if (!r.ok) setMsg(r.error)
    else { setMsg('Đã lưu.'); router.refresh() }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select value={val} onChange={(e) => doi(e.target.value)} disabled={busy}
        className="rounded-lg border px-3 py-1.5 text-sm bg-white text-slate-900">
        <option value="">— Chưa gắn kênh —</option>
        {[...nhom.entries()].map(([l1, ks]) => (
          <optgroup key={l1} label={l1}>
            {ks.map((k) => (
              <option key={k.id} value={k.id}>{k.channel_l2 ? `${l1} · ${k.channel_l2}` : l1}</option>
            ))}
          </optgroup>
        ))}
      </select>
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </div>
  )
}
