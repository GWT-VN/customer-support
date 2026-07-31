'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { xuatKhach, taiExportDaDuyet, type YeuCauExport } from '@/app/actions'
import { XUAT_KHACH_COT, XUAT_KHACH_MAC_DINH } from '@/lib/danhSach'

/** Tải CSV mã hoá UTF-16LE + BOM — Excel (cả Mac lẫn Windows) đọc tiếng Việt đúng.
 *  (UTF-8+BOM bị Mac Excel bỏ qua -> lỗi font, nên phải UTF-16LE.) */
function taiCsv(text: string, ten: string) {
  const n = text.length
  const buf = new ArrayBuffer(2 + n * 2)
  const view = new DataView(buf)
  view.setUint8(0, 0xff); view.setUint8(1, 0xfe)          // BOM UTF-16LE
  for (let i = 0; i < n; i++) view.setUint16(2 + i * 2, text.charCodeAt(i), true)
  const blob = new Blob([buf], { type: 'text/csv;charset=utf-16le' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = ten; a.click()
  URL.revokeObjectURL(url)
}
const HOM_NAY = () => new Date().toISOString().slice(0, 10)

/** Xuất danh sách khách: chọn trường + gate PII (admin ngay / CS chờ duyệt). */
export function ExportKhachButton({ q, daDuyet }: { q: string; daDuyet: YeuCauExport[] }) {
  const router = useRouter()
  const [chon, setChon] = useState<string[]>([...XUAT_KHACH_MAC_DINH])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const coPii = XUAT_KHACH_COT.some((c) => c.pii && chon.includes(c.key))
  function toggle(key: string) {
    setChon((cur) => cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key])
    setMsg(null); setErr(null)
  }

  async function xuat() {
    setBusy(true); setErr(null); setMsg(null)
    const r = await xuatKhach(q, chon)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    if ('csv' in r) taiCsv(r.csv, `khach_${HOM_NAY()}.csv`)
    else { setMsg('Đã gửi yêu cầu xuất (có SĐT/địa chỉ) — chờ admin duyệt.'); router.refresh() }
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
    <div className="rounded-lg border bg-white p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-sm font-medium text-slate-700">Xuất Excel — chọn trường:</span>
        {XUAT_KHACH_COT.map((c) => (
          <label key={c.key} className="flex items-center gap-1.5 text-sm text-slate-700">
            <input type="checkbox" checked={chon.includes(c.key)} onChange={() => toggle(c.key)} />
            {c.nhan}{c.pii && <span className="text-[10px] text-amber-600">(PII)</span>}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={xuat} disabled={busy || chon.length === 0}
          className="rounded-lg bg-slate-900 text-white px-4 py-1.5 text-sm font-medium disabled:opacity-50">
          {busy ? 'Đang xuất…' : coPii ? '⬇ Xuất (có PII — cần duyệt)' : '⬇ Xuất'}
        </button>
        {coPii && <span className="text-xs text-amber-700">Có SĐT/địa chỉ → admin xuất ngay, CS phải chờ duyệt.</span>}
        {daDuyet.map((y) => (
          <button key={y.id} onClick={() => tai(y.id)} disabled={busy}
            className="rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 px-3 py-1.5 text-sm disabled:opacity-50">
            ⬇ Tải bản đã duyệt{y.tieu_chi?.q ? ` (lọc “${String(y.tieu_chi.q)}”)` : ''}
          </button>
        ))}
        {msg && <span className="text-sm text-emerald-700">{msg}</span>}
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </div>
  )
}
