'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { datTrangThaiSerial, thuHoiMay, doiMayChoKhach, serialsTheoMay, type SuDungSerial, type SerialKho } from '@/app/actions'
import { NHAN_TRANG_THAI_SERIAL, TRANG_THAI_KHO_DAT_TAY } from '@/lib/danhSach'
import { vnDateTime } from '@/components/TicketBadge'

const MAU: Record<string, string> = {
  ton_kho: 'bg-slate-100 text-slate-600', da_lap: 'bg-emerald-100 text-emerald-800',
  trung_bay: 'bg-sky-100 text-sky-800', mkt: 'bg-violet-100 text-violet-800',
  bao_tri: 'bg-amber-100 text-amber-800', thanh_ly: 'bg-red-100 text-red-700',
}

export function VongDoiMay({
  serial, internalCode, trangThai, suKien, dangLap, laAdmin,
}: {
  serial: string; internalCode: string | null; trangThai: string | null
  suKien: SuDungSerial[]; dangLap: boolean; laAdmin: boolean
}) {
  const router = useRouter()
  const [den, setDen] = useState('')
  const [ghiChu, setGhiChu] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [moDoi, setMoDoi] = useState(false)
  const [dsMoi, setDsMoi] = useState<SerialKho[]>([])
  const [serialMoi, setSerialMoi] = useState('')

  function moDoiMay() {
    setMoDoi(true); setErr(null)
    if (internalCode) serialsTheoMay(internalCode).then((r) => setDsMoi(r.filter((s) => s.serial !== serial)))
  }
  async function doiMay() {
    if (!window.confirm(`Đổi máy ${serial} → ${serialMoi} cho khách (máy cũ về bảo trì, BH kế thừa mốc cũ)?`)) return
    setBusy(true); setErr(null)
    const r = await doiMayChoKhach(serial, serialMoi, ghiChu || undefined)
    setBusy(false)
    if (!r.ok) setErr(r.error)
    else { setMoDoi(false); setSerialMoi(''); setGhiChu(''); router.refresh() }
  }

  async function datKho() {
    if (!den) return
    if (!window.confirm(`Đổi trạng thái serial ${serial} → ${NHAN_TRANG_THAI_SERIAL[den] ?? den}?`)) return
    setBusy(true); setErr(null)
    const r = await datTrangThaiSerial(serial, den, ghiChu || undefined)
    setBusy(false)
    if (!r.ok) setErr(r.error)
    else { setDen(''); setGhiChu(''); router.refresh() }
  }
  async function thuHoi() {
    if (!window.confirm(`Thu hồi máy ${serial} khỏi khách (chuyển "bảo trì")? Sau đó đăng ký máy mới cho khách.`)) return
    setBusy(true); setErr(null)
    const r = await thuHoiMay(serial, ghiChu || undefined)
    setBusy(false)
    if (!r.ok) setErr(r.error)
    else { setGhiChu(''); router.refresh() }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Trạng thái:</span>
        <span className={`px-2 py-0.5 rounded-full text-xs ${MAU[trangThai ?? ''] ?? 'bg-slate-100 text-slate-500'}`}>
          {NHAN_TRANG_THAI_SERIAL[trangThai ?? ''] ?? (trangThai ?? '—')}
        </span>
      </div>

      {laAdmin && (
        <div className="rounded-lg border p-3 space-y-2 bg-slate-50">
          {dangLap ? (
            <div className="space-y-2">
              {!moDoi ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={moDoiMay} disabled={busy}
                    className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50">
                    Đổi máy cho khách
                  </button>
                  <button onClick={thuHoi} disabled={busy}
                    className="rounded-lg border border-amber-300 text-amber-700 px-3 py-1.5 text-sm hover:bg-amber-50 disabled:opacity-50">
                    Chỉ thu hồi (không thay máy)
                  </button>
                  <span className="text-xs text-slate-400">Máy cũ → bảo trì; BH kế thừa mốc cũ.</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  {dsMoi.length ? (
                    <>
                      <select value={serialMoi} onChange={(e) => setSerialMoi(e.target.value)}
                        className="rounded-lg border px-3 py-1.5 text-sm bg-white font-mono text-slate-900">
                        <option value="">— Chọn serial máy MỚI (tồn kho, cùng loại) —</option>
                        {dsMoi.map((s) => <option key={s.serial} value={s.serial}>{s.serial}</option>)}
                      </select>
                      <button onClick={doiMay} disabled={busy || !serialMoi}
                        className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50">Đổi</button>
                    </>
                  ) : <span className="text-sm text-amber-700">Không còn serial tồn kho cùng loại để đổi.</span>}
                  <button onClick={() => setMoDoi(false)} className="text-sm text-slate-500 underline">Huỷ</button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <select value={den} onChange={(e) => setDen(e.target.value)}
                className="rounded-lg border px-3 py-1.5 text-sm bg-white text-slate-900">
                <option value="">— Đặt trạng thái kho —</option>
                {TRANG_THAI_KHO_DAT_TAY.filter((t) => t !== trangThai).map((t) => (
                  <option key={t} value={t}>{NHAN_TRANG_THAI_SERIAL[t]}</option>
                ))}
              </select>
              <button onClick={datKho} disabled={busy || !den}
                className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50">Đặt</button>
            </div>
          )}
          <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Ghi chú (tuỳ chọn)"
            className="w-full rounded-lg border px-3 py-1.5 text-sm text-slate-900" />
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
      )}

      {suKien.length > 0 ? (
        <ul className="border rounded-lg divide-y text-sm">
          {suKien.map((s) => (
            <li key={s.id} className="px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-800">
                  {NHAN_TRANG_THAI_SERIAL[s.den_trang_thai ?? ''] ?? s.su_kien}
                  {s.tu_trang_thai && s.den_trang_thai && (
                    <span className="text-slate-400"> ({NHAN_TRANG_THAI_SERIAL[s.tu_trang_thai] ?? s.tu_trang_thai} → {NHAN_TRANG_THAI_SERIAL[s.den_trang_thai] ?? s.den_trang_thai})</span>
                  )}
                </span>
                <span className="text-[11px] text-slate-400 flex-none">{vnDateTime(s.luc)}</span>
              </div>
              {s.ghi_chu && <div className="text-xs text-slate-500">{s.ghi_chu}</div>}
              {s.boi && <div className="text-[10px] text-slate-400">{s.boi}</div>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">Chưa có sự kiện vòng đời nào được ghi.</p>
      )}
    </div>
  )
}
