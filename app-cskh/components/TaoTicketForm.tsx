'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createTicket, machinesOfCustomer, type Staff, type Machine } from '@/app/actions'
import { KhachPicker } from '@/components/KhachPicker'

const HOM_NAY = () => new Date().toISOString().slice(0, 10)
const STATES = [{ k: 'Open', l: 'Đang mở' }, { k: 'Done', l: 'Đã xong' }, { k: 'Cancel', l: 'Đã huỷ' }]

/** Form tạo ticket đầy đủ: khách -> máy của khách + ngày/trạng thái/khẩn/ghi chú/người xử lý. */
export function TaoTicketForm({ loaiList, staff, meId }: { loaiList: string[]; staff: Staff[]; meId?: string }) {
  const [khachId, setKhachId] = useState('')
  const [may, setMay] = useState<Machine[] | null>(null)   // null = chưa chọn khách
  const [dangTaiMay, setDangTaiMay] = useState(false)
  const [serial, setSerial] = useState('')
  const [loai, setLoai] = useState('')
  const [moTa, setMoTa] = useState('')
  const [ngay, setNgay] = useState(HOM_NAY())
  const [state, setState] = useState('Open')
  const [khan, setKhan] = useState(false)
  const [note, setNote] = useState('')
  const [cs, setCs] = useState(meId ?? '')   // mặc định người tạo; bỏ trống server vẫn auto gán mình
  const [kt, setKt] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()

  async function chonKhach(id: string) {
    setKhachId(id); setSerial(''); setMay(null); setDangTaiMay(true)
    const ds = await machinesOfCustomer(id)
    setMay(ds); setDangTaiMay(false)
  }

  async function luu() {
    setBusy(true); setErr(null)
    const r = await createTicket({
      customer_id: khachId || undefined,
      serial: serial.trim() || undefined,
      ticket_type: loai.trim(),
      description: moTa.trim(),
      created_at: ngay,
      state, khan,
      last_note: note.trim() || undefined,
      cs_phu_trach: cs || null,
      ky_thuat: kt || null,
    })
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    router.push(`/ticket/${r.code}`)
  }

  return (
    <div className="bg-white rounded-xl border p-5 space-y-4 max-w-2xl">
      <div>
        <label className="text-sm font-medium text-slate-700">1. Khách hàng *</label>
        <KhachPicker onPick={(id) => chonKhach(id)} />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">2. Máy của khách (serial) *</label>
        {may === null ? (
          <p className="text-xs text-slate-400 mt-1">
            {dangTaiMay ? 'Đang tải máy của khách…' : 'Chọn khách trước để hiện máy của họ.'}
          </p>
        ) : may.length === 0 ? (
          <p className="text-sm bg-amber-50 text-amber-900 rounded-lg px-3 py-2 mt-1">
            ⚠️ Khách này <strong>chưa có máy nào được kích hoạt</strong>. Cần{' '}
            <Link href="/dang-ky-bh" className="underline font-medium">Đăng ký bảo hành</Link>{' '}
            cho máy trước, rồi quay lại tạo ticket.
          </p>
        ) : (
          <select value={serial} onChange={(e) => setSerial(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 bg-white">
            <option value="">— Chọn máy báo lỗi (bắt buộc) —</option>
            {may.map((m) => (
              <option key={m.serial} value={m.serial}>
                {m.product_name ?? m.internal_code} · {m.serial}{m.warranty_activated ? '' : ' (chưa kích hoạt)'}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Loại ticket *</span>
          <input value={loai} onChange={(e) => setLoai(e.target.value)} list="loai-ticket"
            placeholder="vd: Lỗi máy, Bảo trì…"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900" />
          <datalist id="loai-ticket">{loaiList.map((l) => <option key={l} value={l} />)}</datalist>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Ngày tạo</span>
          <input type="date" value={ngay} max={HOM_NAY()} onChange={(e) => setNgay(e.target.value)}
            className="mt-1 block rounded-lg border px-3 py-2 text-sm text-slate-900" />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Mô tả sự cố *</span>
        <textarea value={moTa} onChange={(e) => setMoTa(e.target.value)} rows={3}
          placeholder="Khách báo lỗi gì…"
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900" />
      </label>

      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <span className="text-sm font-medium text-slate-700">Trạng thái</span>
          <div className="mt-1 flex gap-2">
            {STATES.map((s) => (
              <button key={s.k} type="button" onClick={() => setState(s.k)}
                className={`px-3 py-1.5 rounded-lg text-sm border ${state === s.k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'}`}>
                {s.l}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-1.5 text-sm text-slate-700 pb-1.5">
          <input type="checkbox" checked={khan} onChange={(e) => setKhan(e.target.checked)} /> 🔴 Khẩn
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">CS phụ trách</span>
          <select value={cs} onChange={(e) => setCs(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white text-slate-900">
            <option value="">— Chưa gán —</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.ten}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Kỹ thuật phụ trách</span>
          <select value={kt} onChange={(e) => setKt(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white text-slate-900">
            <option value="">— Chưa gán —</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.ten}</option>)}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Ghi chú xử lý (tuỳ chọn)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder="Đã xử lý gì, kết quả…"
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900" />
      </label>

      <div className="flex items-center gap-3">
        <button onClick={luu} disabled={busy || !khachId || !serial.trim() || !loai.trim() || !moTa.trim()}
          className="rounded-lg bg-slate-900 text-white px-5 py-2.5 font-medium disabled:opacity-50">
          {busy ? 'Đang tạo…' : 'Tạo ticket'}
        </button>
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </div>
  )
}
