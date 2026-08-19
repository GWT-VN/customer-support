'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { logReplacement } from '@/app/actions'

const HOM_NAY = () => new Date().toISOString().slice(0, 10)

/**
 * Nút ghi log thay lõi. Mặc định 1 chạm = "đã thay hôm nay".
 * Cần ghi ngày khác thì mở ra chọn — nhưng đường nhanh phải là 1 chạm,
 * nếu không nhân viên sẽ không ghi và dữ liệu lại bẩn như cũ.
 */
export function ThayLoiButton({
  serial,
  filterCode,
  filterName,
  compact = false,
}: {
  serial: string
  filterCode: string
  filterName?: string | null
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(HOM_NAY())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()

  async function ghi(ngay: string) {
    setBusy(true)
    setErr(null)
    const r = await logReplacement({ serial, filter_code: filterCode, replaced_at: ngay, note })
    setBusy(false)
    if (!r.ok) setErr(r.error)
    else {
      setOpen(false)
      setNote('')
      router.refresh()
    }
  }

  if (!open) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => ghi(HOM_NAY())} disabled={busy}
          className={`rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50 ${
            compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
          }`}
          title={`Ghi: đã thay ${filterName ?? filterCode} hôm nay`}
        >
          {busy ? '…' : 'Đã thay hôm nay'}
        </button>
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-slate-500 hover:text-slate-900 underline"
          title="Thay vào ngày khác"
        >
          ngày khác
        </button>
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-end gap-2 bg-slate-50 rounded-lg p-2">
      <label className="block">
        <span className="text-xs text-slate-600">Ngày thay</span>
        <input
          type="date" value={date} max={HOM_NAY()} onChange={(e) => setDate(e.target.value)}
          className="mt-0.5 block rounded-lg border px-2 py-1 text-sm"
        />
      </label>
      <label className="block flex-1 min-w-40">
        <span className="text-xs text-slate-600">Ghi chú</span>
        <input
          value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="ai thay, lý do…"
          className="mt-0.5 w-full rounded-lg border px-2 py-1 text-sm"
        />
      </label>
      <button
        onClick={() => ghi(date)} disabled={busy}
        className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {busy ? 'Đang ghi…' : 'Ghi'}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-slate-500 underline">Huỷ</button>
      {err && <p className="text-xs text-red-600 w-full">{err}</p>}
    </div>
  )
}
