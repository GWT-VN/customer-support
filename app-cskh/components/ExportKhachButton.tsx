'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { xuatKhach, taiExportDaDuyet, type YeuCauExport } from '@/app/actions'

function taiCsv(csv: string, ten: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = ten; a.click()
  URL.revokeObjectURL(url)
}
const HOM_NAY = () => new Date().toISOString().slice(0, 10)

/** Xuất danh sách khách: bản không-PII (tải ngay) · bản có PII (admin ngay / CS chờ duyệt). */
export function ExportKhachButton({ q, daDuyet }: { q: string; daDuyet: YeuCauExport[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function xuat(coPii: boolean) {
    setBusy(true); setErr(null); setMsg(null)
    const r = await xuatKhach(q, coPii)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    if ('csv' in r) taiCsv(r.csv, `khach_${HOM_NAY()}.csv`)
    else { setMsg('Đã gửi yêu cầu xuất bản có SĐT/địa chỉ — chờ admin duyệt.'); router.refresh() }
  }
  async function tai(id: string) {
    if (!window.confirm('Tải bản có SĐT/địa chỉ (đã được duyệt)?')) return
    setBusy(true); setErr(null); setMsg(null)
    const r = await taiExportDaDuyet(id)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    taiCsv(r.csv, `khach_co_sdt_${HOM_NAY()}.csv`); router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={() => xuat(false)} disabled={busy}
        className="rounded-lg border bg-white text-slate-700 px-3 py-1.5 text-sm disabled:opacity-50">
        ⬇ Xuất (không SĐT/địa chỉ)
      </button>
      <button onClick={() => xuat(true)} disabled={busy}
        className="rounded-lg border bg-white text-slate-700 px-3 py-1.5 text-sm disabled:opacity-50">
        ⬇ Xuất có SĐT/địa chỉ
      </button>
      {daDuyet.map((y) => (
        <button key={y.id} onClick={() => tai(y.id)} disabled={busy}
          className="rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 px-3 py-1.5 text-sm disabled:opacity-50">
          ⬇ Tải bản đã duyệt{y.tieu_chi?.q ? ` (lọc “${String(y.tieu_chi.q)}”)` : ''}
        </button>
      ))}
      {msg && <span className="text-sm text-emerald-700">{msg}</span>}
      {err && <span className="text-sm text-red-600">{err}</span>}
    </div>
  )
}
