'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addTicketItem, deleteTicketItem, type TicketMuc } from '@/app/actions'

const LOAI: Record<string, { label: string; cls: string }> = {
  thu_phi: { label: 'Thu phí', cls: 'bg-amber-100 text-amber-800' },
  vat_tu:  { label: 'Vật tư',  cls: 'bg-sky-100 text-sky-800' },
  doi_may: { label: 'Đổi máy', cls: 'bg-violet-100 text-violet-800' },
}

function tien(n: number | null) {
  if (n === null || n === undefined) return null
  return n.toLocaleString('vi-VN') + ' đ'
}

export function TicketItems({ code, items }: { code: string; items: TicketMuc[] }) {
  const [loai, setLoai] = useState('thu_phi')
  const [moTa, setMoTa] = useState('')
  const [soTien, setSoTien] = useState('')
  const [tinhPhi, setTinhPhi] = useState(true)
  const [serialCu, setSerialCu] = useState('')
  const [serialMoi, setSerialMoi] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()

  function reset() {
    setMoTa(''); setSoTien(''); setSerialCu(''); setSerialMoi(''); setTinhPhi(true)
  }

  async function add() {
    setBusy(true); setErr(null)
    const r = await addTicketItem(code, {
      loai, mo_ta: moTa,
      so_tien: soTien.trim() ? Number(soTien.replace(/[^\d]/g, '')) : null,
      tinh_phi: tinhPhi,
      serial_cu: loai === 'doi_may' ? serialCu : undefined,
      serial_moi: loai === 'doi_may' ? serialMoi : undefined,
    })
    setBusy(false)
    if (!r.ok) setErr(r.error)
    else { reset(); router.refresh() }
  }

  async function del(id: string) {
    await deleteTicketItem(id, code)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <ul className="divide-y border rounded-lg">
          {items.map((it) => {
            const l = LOAI[it.loai] ?? { label: it.loai, cls: 'bg-slate-100 text-slate-600' }
            return (
              <li key={it.id} className="px-3 py-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${l.cls}`}>{l.label}</span>
                    {tien(it.so_tien) && (
                      <span className="text-sm font-medium text-slate-900">{tien(it.so_tien)}</span>
                    )}
                    <span className={`text-xs ${it.tinh_phi ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {it.tinh_phi ? 'Tính phí' : 'Miễn phí'}
                    </span>
                  </div>
                  {it.mo_ta && <p className="text-sm text-slate-700">{it.mo_ta}</p>}
                  {(it.serial_cu || it.serial_moi) && (
                    <p className="font-mono text-xs text-slate-500">
                      {it.serial_cu ?? '—'} → {it.serial_moi ?? '—'}
                    </p>
                  )}
                </div>
                <button onClick={() => del(it.id)}
                  className="text-xs text-slate-400 hover:text-red-600 flex-none">Xoá</button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="rounded-lg border p-3 space-y-2 bg-slate-50">
        <div className="flex gap-2 flex-wrap">
          {Object.entries(LOAI).map(([k, v]) => (
            <button key={k} onClick={() => setLoai(k)}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                loai === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'
              }`}>
              {v.label}
            </button>
          ))}
        </div>

        <input value={moTa} onChange={(e) => setMoTa(e.target.value)}
          placeholder="Mô tả (vd: thay bơm, công lắp, phí vận chuyển…)"
          className="w-full rounded-lg border px-3 py-2 text-slate-900" />

        <div className="flex gap-2 flex-wrap items-center">
          <input value={soTien} onChange={(e) => setSoTien(e.target.value)} inputMode="numeric"
            placeholder="Số tiền (đ)"
            className="rounded-lg border px-3 py-2 text-slate-900 w-40" />
          <label className="flex items-center gap-1.5 text-sm text-slate-700">
            <input type="checkbox" checked={tinhPhi} onChange={(e) => setTinhPhi(e.target.checked)} />
            Tính phí khách
          </label>
        </div>

        {loai === 'doi_may' && (
          <div className="flex gap-2 flex-wrap">
            <input value={serialCu} onChange={(e) => setSerialCu(e.target.value)}
              placeholder="Serial máy CŨ (thu hồi)"
              className="rounded-lg border px-3 py-2 text-slate-900 font-mono text-sm flex-1 min-w-52" />
            <input value={serialMoi} onChange={(e) => setSerialMoi(e.target.value)}
              placeholder="Serial máy MỚI (đổi cho khách)"
              className="rounded-lg border px-3 py-2 text-slate-900 font-mono text-sm flex-1 min-w-52" />
          </div>
        )}

        <div className="flex items-center gap-3">
          <button onClick={add} disabled={busy}
            className="rounded-lg bg-slate-900 text-white px-4 py-2 font-medium disabled:opacity-50">
            {busy ? 'Đang thêm…' : '+ Thêm mục'}
          </button>
          {err && <span className="text-sm text-red-600">{err}</span>}
        </div>
      </div>
    </div>
  )
}
