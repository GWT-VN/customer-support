'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { duyetExport, tuChoiExport, type YeuCauExport } from '@/app/actions'

/** Yêu cầu xuất danh sách CÓ PII (SĐT/địa chỉ) chờ admin duyệt. */
export function DuyetExportList({ items }: { items: YeuCauExport[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function lam(id: string, duyet: boolean) {
    setBusy(id); setErr(null)
    const r = duyet ? await duyetExport(id) : await tuChoiExport(id)
    setBusy(null)
    if (!r.ok) setErr(r.error)
    else router.refresh()
  }

  if (!items.length) return <p className="text-sm text-slate-400">Không có yêu cầu xuất nào chờ duyệt.</p>
  return (
    <div className="space-y-2">
      {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
      <ul className="divide-y border rounded-lg">
        {items.map((y) => (
          <li key={y.id} className="px-3 py-2.5 flex items-start justify-between gap-3 text-sm">
            <div className="min-w-0">
              <div className="text-slate-900">Xuất khách <strong>có SĐT/địa chỉ</strong></div>
              {y.tieu_chi?.q ? <div className="text-slate-500 text-xs">lọc: “{String(y.tieu_chi.q)}”</div> : <div className="text-slate-400 text-xs">toàn bộ</div>}
              <div className="text-[11px] text-slate-400">{y.nguoi_gui ?? '—'} · {new Date(y.created_at).toLocaleString('vi-VN', { hour12: false })}</div>
            </div>
            <div className="flex gap-2 flex-none">
              <button onClick={() => lam(y.id, true)} disabled={busy === y.id}
                className="rounded-lg bg-emerald-600 text-white px-3 py-1 text-xs font-medium disabled:opacity-50">
                {busy === y.id ? '…' : 'Duyệt'}
              </button>
              <button onClick={() => lam(y.id, false)} disabled={busy === y.id}
                className="rounded-lg border px-3 py-1 text-xs text-slate-600 disabled:opacity-50">Từ chối</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
