'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type CotXuat = { key: string; nhan: string; pii?: boolean }
type KetQuaXuat = { ok: true; csv: string } | { ok: true; pending: true } | { ok: false; error: string }
type KetQuaTai = { ok: true; csv: string } | { ok: false; error: string }

/** Tải CSV mã hoá UTF-16LE + BOM — Excel (Mac + Windows) đọc tiếng Việt đúng.
 *  (UTF-8+BOM bị Mac Excel bỏ qua -> lỗi font.) */
function taiCsvUtf16(text: string, ten: string) {
  const n = text.length
  const buf = new ArrayBuffer(2 + n * 2)
  const view = new DataView(buf)
  view.setUint8(0, 0xff); view.setUint8(1, 0xfe)
  for (let i = 0; i < n; i++) view.setUint16(2 + i * 2, text.charCodeAt(i), true)
  const blob = new Blob([buf], { type: 'text/csv;charset=utf-16le' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = ten; a.click()
  URL.revokeObjectURL(url)
}
const HOM_NAY = () => new Date().toISOString().slice(0, 10)

/**
 * Nút "Xuất Excel" DÙNG CHUNG cho mọi bảng: bấm mở dropdown chọn trường (cuộn được
 * khi nhiều trường), rồi Xuất. Tải bằng UTF-16LE. onXuat trả csv (tải luôn) hoặc
 * pending (chờ duyệt). daDuyet + onTai: các yêu cầu đã duyệt để tải lại (tuỳ chọn).
 */
export function NutXuat({
  cot, macDinh, tenFile, onXuat, daDuyet = [], onTai,
}: {
  cot: readonly CotXuat[]
  macDinh: readonly string[]
  tenFile: string
  onXuat: (cot: string[]) => Promise<KetQuaXuat>
  daDuyet?: { id: string; nhan?: string }[]
  onTai?: (id: string) => Promise<KetQuaTai>
}) {
  const router = useRouter()
  const [mo, setMo] = useState(false)
  const [chon, setChon] = useState<string[]>([...macDinh])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const coPii = cot.some((c) => c.pii && chon.includes(c.key))
  function toggle(key: string) {
    setChon((cur) => cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key])
    setMsg(null); setErr(null)
  }

  async function xuat() {
    setBusy(true); setErr(null); setMsg(null)
    const r = await onXuat(chon)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    if ('csv' in r) { taiCsvUtf16(r.csv, `${tenFile}_${HOM_NAY()}.csv`); setMo(false) }
    else { setMsg('Đã gửi yêu cầu (có PII) — chờ admin duyệt.'); setMo(false); router.refresh() }
  }
  async function tai(id: string) {
    if (!onTai || !window.confirm('Tải bản đã được duyệt?')) return
    setBusy(true); setErr(null); setMsg(null)
    const r = await onTai(id)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    taiCsvUtf16(r.csv, `${tenFile}_pii_${HOM_NAY()}.csv`); router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <button onClick={() => { setMo((v) => !v); setMsg(null); setErr(null) }} disabled={busy}
          className="rounded-lg border bg-white text-slate-700 px-3 py-1.5 text-sm disabled:opacity-50">
          ⬇ Xuất Excel ▾
        </button>
        {mo && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMo(false)} />
            <div className="absolute z-20 mt-1 w-64 rounded-lg border bg-white shadow-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">Chọn trường xuất</span>
                <div className="flex gap-2 text-[11px]">
                  <button onClick={() => setChon(cot.map((c) => c.key))} className="text-slate-500 hover:underline">Tất cả</button>
                  <button onClick={() => setChon([])} className="text-slate-500 hover:underline">Bỏ hết</button>
                </div>
              </div>
              <ul className="max-h-56 overflow-auto space-y-1 pr-1">
                {cot.map((c) => (
                  <li key={c.key}>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={chon.includes(c.key)} onChange={() => toggle(c.key)} />
                      {c.nhan}{c.pii && <span className="text-[10px] text-amber-600">(PII)</span>}
                    </label>
                  </li>
                ))}
              </ul>
              {coPii && <p className="text-[11px] text-amber-700">Có SĐT/địa chỉ → admin xuất ngay, CS phải chờ duyệt.</p>}
              <button onClick={xuat} disabled={busy || chon.length === 0}
                className="w-full rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50">
                {busy ? 'Đang xuất…' : coPii ? 'Xuất (cần duyệt)' : 'Xuất'}
              </button>
            </div>
          </>
        )}
      </div>

      {daDuyet.map((y) => (
        <button key={y.id} onClick={() => tai(y.id)} disabled={busy}
          className="rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 px-3 py-1.5 text-sm disabled:opacity-50">
          ⬇ Tải bản đã duyệt{y.nhan ? ` ${y.nhan}` : ''}
        </button>
      ))}
      {msg && <span className="text-sm text-emerald-700">{msg}</span>}
      {err && <span className="text-sm text-red-600">{err}</span>}
    </div>
  )
}
