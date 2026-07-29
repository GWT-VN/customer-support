'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { dangKyBaoHanh, type SerialRow } from '@/app/actions'
import { SerialPicker } from '@/components/SerialPicker'
import { KhachPicker } from '@/components/KhachPicker'

const HOM_NAY = () => new Date().toISOString().slice(0, 10)

/** Đăng ký bảo hành: chọn serial (máy tự điền từ kho) -> chọn/tạo khách -> ngày lắp -> kích hoạt BH. */
export function DangKyBHForm() {
  const [serial, setSerial] = useState('')
  const [may, setMay] = useState<SerialRow | null>(null)
  const [khachId, setKhachId] = useState('')
  const [ngay, setNgay] = useState(HOM_NAY())
  const [diaChi, setDiaChi] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()

  async function luu() {
    setBusy(true); setErr(null); setMsg(null)
    const r = await dangKyBaoHanh({ serial, customer_id: khachId, install_date: ngay, install_address: diaChi })
    setBusy(false)
    if (!r.ok) setErr(r.error)
    else {
      setMsg(`Đã đăng ký + kích hoạt BH cho serial ${serial}.`)
      setSerial(''); setMay(null); setKhachId(''); setDiaChi(''); setNgay(HOM_NAY())
      router.refresh()
    }
  }

  return (
    <div className="bg-white rounded-xl border p-5 space-y-4 max-w-2xl">
      <div>
        <label className="text-sm font-medium text-slate-700">1. Serial máy</label>
        <p className="text-xs text-slate-400 mb-1">Chọn từ kho serial; chưa có thì tạo chờ duyệt.</p>
        <div className="flex">
          <SerialPicker value={serial} onChange={setSerial}
            onPickRow={setMay} placeholder="Gõ serial…" />
        </div>
        {may && (
          <div className="mt-2 text-sm bg-slate-50 rounded-lg px-3 py-2 text-slate-700">
            <span className="font-medium">{may.ten_noi_bo ?? may.internal_code ?? '—'}</span>
            <span className="text-slate-400"> · mã nội bộ {may.internal_code ?? '—'}</span>
            {may.model && <span className="text-slate-400"> · model {may.model}</span>}
            {may.ma_quoc_te && <span className="text-slate-400"> · mã QT {may.ma_quoc_te}</span>}
          </div>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">2. Khách hàng</label>
        <p className="text-xs text-slate-400 mb-1">Tìm khách đã có; không có thì tạo mới (admin duyệt sau).</p>
        <KhachPicker onPick={(id) => setKhachId(id)} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">3. Ngày lắp</span>
          <input type="date" value={ngay} max={HOM_NAY()} onChange={(e) => setNgay(e.target.value)}
            className="mt-1 block rounded-lg border px-3 py-2 text-sm text-slate-900" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Địa chỉ lắp (tuỳ chọn)</span>
          <input value={diaChi} onChange={(e) => setDiaChi(e.target.value)}
            placeholder="Nơi lắp đặt" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900" />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={luu} disabled={busy || !serial.trim() || !khachId}
          className="rounded-lg bg-slate-900 text-white px-5 py-2.5 font-medium disabled:opacity-50">
          {busy ? 'Đang đăng ký…' : 'Đăng ký + kích hoạt bảo hành'}
        </button>
        {msg && <span className="text-sm text-emerald-700">{msg}</span>}
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </div>
  )
}
