'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateTicket, type Staff } from '@/app/actions'

const STATES = [
  { key: 'Open', label: 'Đang mở' },
  { key: 'Done', label: 'Đã xong' },
  { key: 'Cancel', label: 'Đã huỷ' },
]

/**
 * Khối nội dung + xử lý của ticket: mặc định chế độ XEM, bấm "Sửa" để sửa TẠI CHỖ
 * chính khối này (không tách view trên / edit dưới). Lưu/Huỷ xong quay lại chế độ xem.
 * Dùng chung server action updateTicket (đã validate/trim server-side).
 */
export function TicketEditor({
  code,
  state,
  khan,
  lastNote,
  ticketType,
  description,
  province = null,
  loaiList = [],
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
  ticketType: string | null
  description: string | null
  province?: string | null
  loaiList?: string[]
  staff: Staff[]
  csId: string | null
  ktId: string | null
  // Người đang đăng nhập — tự điền vào ô còn trống (đổi/chọn lại được).
  defaultCsId?: string | null
  defaultKtId?: string | null
}) {
  const [edit, setEdit] = useState(false)
  const [st, setSt] = useState(state)
  const [kh, setKh] = useState(khan)
  const [note, setNote] = useState(lastNote ?? '')
  const [loai, setLoai] = useState(ticketType ?? '')
  const [moTa, setMoTa] = useState(description ?? '')
  const [cs, setCs] = useState(csId ?? defaultCsId ?? '')
  const [kt, setKt] = useState(ktId ?? defaultKtId ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()

  const tenNV = (id: string) => staff.find((s) => s.id === id)?.ten ?? '—'

  async function save() {
    if (!loai.trim() || !moTa.trim()) { setErr('Phân loại và Mô tả không được trống.'); return }
    setBusy(true); setErr(null); setMsg(null)
    const r = await updateTicket(code, {
      state: st, khan: kh, last_note: note, ticket_type: loai, description: moTa,
      cs_phu_trach: cs || null, ky_thuat: kt || null,
    })
    setBusy(false)
    if (!r.ok) setErr(r.error)
    else { setMsg('Đã lưu.'); setEdit(false); router.refresh() }
  }

  // Huỷ: trả các ô về đúng giá trị gốc (từ props / server) rồi quay lại chế độ xem.
  function huy() {
    setSt(state); setKh(khan); setNote(lastNote ?? ''); setLoai(ticketType ?? '')
    setMoTa(description ?? ''); setCs(csId ?? defaultCsId ?? ''); setKt(ktId ?? defaultKtId ?? '')
    setErr(null); setEdit(false)
  }

  // ── Chế độ XEM (mặc định) ────────────────────────────────────────────────
  if (!edit) {
    const stLabel = STATES.find((s) => s.key === st)?.label ?? st
    return (
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-medium text-slate-900">Nội dung &amp; xử lý</h2>
          <button onClick={() => setEdit(true)}
            className="text-sm text-slate-600 underline flex-none">Sửa</button>
        </div>

        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <span className="text-xs text-slate-500">Loại</span>
            <p className="text-slate-900">{loai || '—'}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Trạng thái</span>
            <p className="text-slate-900">
              {stLabel}
              {kh && <span className="ml-2 font-medium text-red-600">· 🔴 Khẩn</span>}
            </p>
          </div>
          <div>
            <span className="text-xs text-slate-500">CS phụ trách</span>
            <p className="text-slate-900">{cs ? tenNV(cs) : <span className="text-amber-600">chưa gán</span>}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Kỹ thuật phụ trách</span>
            <p className="text-slate-900">{kt ? tenNV(kt) : <span className="text-slate-400">chưa gán</span>}</p>
          </div>
          {province && (
            <div>
              <span className="text-xs text-slate-500">Tỉnh/TP</span>
              <p className="text-slate-900">{province}</p>
            </div>
          )}
        </div>

        <div>
          <span className="text-xs text-slate-500">Mô tả khách báo</span>
          <p className="text-slate-900 whitespace-pre-wrap">{moTa || '—'}</p>
        </div>
        <div>
          <span className="text-xs text-slate-500">Tóm tắt xử lý (hiện tại)</span>
          <p className="text-slate-900 whitespace-pre-wrap">{note || '—'}</p>
        </div>

        {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      </div>
    )
  }

  // ── Chế độ SỬA ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <h2 className="font-medium text-slate-900">Sửa nội dung &amp; xử lý</h2>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm text-slate-700">Phân loại *</span>
          <input value={loai} onChange={(e) => setLoai(e.target.value)} list="loai-ticket-edit"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900" />
          <datalist id="loai-ticket-edit">{loaiList.map((l) => <option key={l} value={l} />)}</datalist>
        </label>
      </div>
      <label className="block">
        <span className="text-sm text-slate-700">Mô tả khách báo *</span>
        <textarea value={moTa} onChange={(e) => setMoTa(e.target.value)} rows={3}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900" />
      </label>

      <div>
        <span className="text-sm text-slate-700">Trạng thái</span>
        <div className="mt-1 flex gap-2">
          {STATES.map((s) => (
            <button
              key={s.key} type="button" onClick={() => setSt(s.key)}
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
            type="button" onClick={() => setKh(!kh)}
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
        <button
          type="button" onClick={huy} disabled={busy}
          className="rounded-lg border px-4 py-2 font-medium text-slate-600 disabled:opacity-50 hover:bg-slate-50"
        >
          Huỷ
        </button>
      </div>

      {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
    </div>
  )
}
