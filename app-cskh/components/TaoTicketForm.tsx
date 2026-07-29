'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTicket } from '@/app/actions'
import { KhachPicker } from '@/components/KhachPicker'
import { SerialPicker } from '@/components/SerialPicker'

/** Tạo ticket mới: chọn khách + máy (tuỳ chọn) + loại + mô tả -> lưu, nhảy sang ticket. */
export function TaoTicketForm({ loaiList }: { loaiList: string[] }) {
  const [khachId, setKhachId] = useState('')
  const [serial, setSerial] = useState('')
  const [loai, setLoai] = useState('')
  const [moTa, setMoTa] = useState('')
  const [tinh, setTinh] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()

  async function luu() {
    setBusy(true); setErr(null)
    const r = await createTicket({
      customer_id: khachId || undefined,
      serial: serial.trim() || undefined,
      ticket_type: loai.trim(),
      description: moTa.trim(),
      province: tinh.trim() || undefined,
    })
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    router.push(`/ticket/${r.code}`)
  }

  return (
    <div className="bg-white rounded-xl border p-5 space-y-4 max-w-2xl">
      <div>
        <label className="text-sm font-medium text-slate-700">Khách hàng</label>
        <KhachPicker onPick={(id) => setKhachId(id)} />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Máy (serial) — tuỳ chọn</label>
        <div className="flex mt-1">
          <SerialPicker value={serial} onChange={setSerial} placeholder="Gõ serial nếu biết…" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Loại ticket *</span>
          <input value={loai} onChange={(e) => setLoai(e.target.value)} list="loai-ticket"
            placeholder="vd: Lỗi máy, Bảo trì…"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900" />
          <datalist id="loai-ticket">
            {loaiList.map((l) => <option key={l} value={l} />)}
          </datalist>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Tỉnh/TP</span>
          <input value={tinh} onChange={(e) => setTinh(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900" />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Mô tả sự cố *</span>
        <textarea value={moTa} onChange={(e) => setMoTa(e.target.value)} rows={4}
          placeholder="Khách báo lỗi gì…"
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900" />
      </label>

      <div className="flex items-center gap-3">
        <button onClick={luu} disabled={busy || !loai.trim() || !moTa.trim()}
          className="rounded-lg bg-slate-900 text-white px-5 py-2.5 font-medium disabled:opacity-50">
          {busy ? 'Đang tạo…' : 'Tạo ticket'}
        </button>
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </div>
  )
}
