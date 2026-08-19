'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { activateWarranty } from '@/app/actions'

export function ActivateForm({
  serial,
  defaultDate,
  activated,
  hasPolicy,
}: {
  serial: string
  defaultDate: string | null
  activated: boolean
  hasPolicy: boolean
}) {
  const [date, setDate] = useState(defaultDate ?? new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()

  async function run() {
    if (!window.confirm(`Bạn chắc chắn ${activated ? 'kích hoạt LẠI (tính lại hạn)' : 'kích hoạt bảo hành'} cho serial ${serial} từ ${date}?`)) return
    setBusy(true)
    setErr(null)
    const r = await activateWarranty(serial, date)
    setBusy(false)
    if (!r.ok) setErr(r.error)
    else router.refresh()
  }

  return (
    <div className="space-y-3">
      {!hasPolicy && (
        <p className="text-sm bg-amber-50 text-amber-900 rounded-lg px-3 py-2">
          ⚠️ Máy này chưa có chính sách bảo hành trong <code className="text-xs">product_warranty</code> —
          kích hoạt được nhưng <strong>không tính ra ngày hết hạn</strong>.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-sm text-slate-700">Ngày bắt đầu bảo hành</span>
          <input
            type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="mt-1 block rounded-lg border px-3 py-2 text-slate-900"
          />
        </label>
        <button
          onClick={run} disabled={busy}
          className="rounded-lg bg-slate-900 text-white px-4 py-2 font-medium disabled:opacity-50"
        >
          {busy ? 'Đang chạy…' : activated ? 'Kích hoạt lại (tính lại hạn)' : 'Kích hoạt bảo hành'}
        </button>
      </div>

      {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
    </div>
  )
}
