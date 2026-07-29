'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { markMaintenanceDone, unmarkMaintenanceDone } from '@/app/actions'
import { vnDate } from '@/components/Badge'

const HOM_NAY = () => new Date().toISOString().slice(0, 10)

/**
 * Đánh dấu 1 lượt bảo trì đã làm. 1 chạm = "đã bảo trì hôm nay".
 * Đã xong rồi thì hiện ngày + cho bỏ đánh dấu (ghi nhầm).
 */
export function BaoTriDoneButton({
  visitId,
  completedAt,
}: {
  visitId: string
  completedAt: string | null
}) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(HOM_NAY())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()

  async function ghi(ngay: string) {
    setBusy(true); setErr(null)
    const r = await markMaintenanceDone(visitId, ngay)
    setBusy(false)
    if (!r.ok) setErr(r.error)
    else { setOpen(false); router.refresh() }
  }

  async function boDanhDau() {
    setBusy(true); setErr(null)
    const r = await unmarkMaintenanceDone(visitId)
    setBusy(false)
    if (!r.ok) setErr(r.error)
    else router.refresh()
  }

  if (completedAt) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-emerald-700 whitespace-nowrap">✓ {vnDate(completedAt.slice(0, 10))}</span>
        <button onClick={boDanhDau} disabled={busy}
          className="text-[10px] text-slate-400 hover:text-red-600 underline">bỏ</button>
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
    )
  }

  if (!open) {
    return (
      <div className="flex items-center gap-1.5">
        <button onClick={() => ghi(HOM_NAY())} disabled={busy}
          className="rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50 px-2.5 py-1 text-xs">
          {busy ? '…' : 'Đã bảo trì hôm nay'}
        </button>
        <button onClick={() => setOpen(true)}
          className="text-xs text-slate-500 hover:text-slate-900 underline">ngày khác</button>
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-end gap-2 bg-slate-50 rounded-lg p-2">
      <label className="block">
        <span className="text-xs text-slate-600">Ngày bảo trì</span>
        <input type="date" value={date} max={HOM_NAY()} onChange={(e) => setDate(e.target.value)}
          className="mt-0.5 block rounded-lg border px-2 py-1 text-sm" />
      </label>
      <button onClick={() => ghi(date)} disabled={busy}
        className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50">
        {busy ? 'Đang ghi…' : 'Ghi'}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-slate-500 underline">Huỷ</button>
      {err && <p className="text-xs text-red-600 w-full">{err}</p>}
    </div>
  )
}
