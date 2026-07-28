'use client'

import { useState } from 'react'
import { ticketsCsv } from '@/app/actions'

/** Tải danh sách ticket đang lọc ra CSV (Excel mở trực tiếp). */
export function ExportButton({
  q, state, khan, mine,
}: {
  q: string; state?: string; khan?: boolean; mine?: boolean
}) {
  const [busy, setBusy] = useState(false)

  async function download() {
    setBusy(true)
    try {
      const csv = await ticketsCsv(q, state, khan, mine)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ticket_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button onClick={download} disabled={busy}
      className="rounded-lg border bg-white text-slate-700 px-3 py-1.5 text-sm disabled:opacity-50">
      {busy ? 'Đang tạo…' : '⬇ Tải CSV'}
    </button>
  )
}
