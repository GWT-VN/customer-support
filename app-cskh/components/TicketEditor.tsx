'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateTicket, type Staff } from '@/app/actions'

const STATES = [
  { key: 'Open', label: 'Đang mở' },
  { key: 'Done', label: 'Đã xong' },
  { key: 'Cancel', label: 'Đã huỷ' },
]

export function TicketEditor({
  code,
  state,
  khan,
  lastNote,
  staff,
  csId,
  ktId,
  defaultCsId = null,
  defaultKtId = null,
}: {
  code: string
  state: string
  khan: boolean
  lastNote: string | null
  staff: Staff[]
  csId: string | null
  ktId: string | null
  // Người đang đăng nhập — tự điền vào ô còn trống (đổi/chọn lại được).
  defaultCsId?: string | null
  defaultKtId?: string | null
}) {
  const [st, setSt] = useState(state)
  const [kh, setKh] = useState(khan)
  const [note, setNote] = useState(lastNote ?? '')
  const [cs, setCs] = useState(csId ?? defaultCsId ?? '')
  const [kt, setKt] = useState(ktId ?? defaultKtId ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()

  async function save() {
    setBusy(true); setErr(null); setMsg(null)
    const r = await updateTicket(code, {
      state: st, khan: kh, last_note: note,
      cs_phu_trach: cs || null, ky_thuat: kt || null,
    })
    setBusy(false)
    if (!r.ok) setErr(r.error)
    else { setMsg('Đã lưu.'); router.refresh() }
  }

  return (
    <div className="space-y-3">
      <div>
        <span className="text-sm text-slate-700">Trạng thái</span>
        <div className="mt-1 flex gap-2">
          {STATES.map((s) => (
            <button
              key={s.key} onClick={() => setSt(s.key)}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                st === s.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="text-sm text-slate-700">Ưu tiên</span>
        <div className="mt-1">
          <button
            onClick={() => setKh(!kh)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              kh ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600'
            }`}
          >
            {kh ? '🔴 Khẩn (bấm để bỏ)' : 'Đánh dấu Khẩn'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm text-slate-700">CS phụ trách</span>
          <select value={cs} onChange={(e) => setCs(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-slate-900 bg-white">
            <option value="">— Chưa gán —</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.ten}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-slate-700">Kỹ thuật phụ trách</span>
          <select value={kt} onChange={(e) => setKt(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-slate-900 bg-white">
            <option value="">— Chưa gán —</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.ten}</option>)}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-sm text-slate-700">Tóm tắt xử lý (hiện tại)</span>
        <textarea
          value={note} onChange={(e) => setNote(e.target.value)} rows={5}
          placeholder="Kỹ thuật đã làm gì, nguyên nhân, kết quả…"
          className="mt-1 w-full rounded-lg border px-3 py-2 text-slate-900"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          onClick={save} disabled={busy}
          className="rounded-lg bg-slate-900 text-white px-4 py-2 font-medium disabled:opacity-50"
        >
          {busy ? 'Đang lưu…' : 'Lưu'}
        </button>
        {msg && <span className="text-sm text-emerald-700">{msg}</span>}
      </div>

      {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
    </div>
  )
}
