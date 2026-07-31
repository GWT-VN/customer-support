'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { doiKhachMay, doiSerialMay, xoaMayDaLap, serialsTheoMay, type SerialKho } from '@/app/actions'
import { KhachPicker } from '@/components/KhachPicker'

type KetQua = { ok: true; applied: boolean } | { ok: false; error: string }

/** Sửa/xoá MÁY ĐÃ LẮP (đều qua admin duyệt): 1 nút "Sửa" mở panel đổi khách · đổi serial · xoá. */
export function SuaMayDaLap({ serial, internalCode }: { serial: string; internalCode: string | null }) {
  const router = useRouter()
  const [mo, setMo] = useState(false)
  const [serialMoi, setSerialMoi] = useState('')
  const [dsSerial, setDsSerial] = useState<SerialKho[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!mo || !internalCode) return
    let song = true
    serialsTheoMay(internalCode).then((r) => { if (song) setDsSerial(r.filter((s) => s.serial !== serial)) })
    return () => { song = false }
  }, [mo, internalCode, serial])

  function bao(r: KetQua, okMsg: string) {
    if (!r.ok) { setErr(r.error); return }
    setErr(null); setMsg(r.applied ? okMsg : 'Đã gửi chờ admin duyệt.'); setMo(false); router.refresh()
  }

  async function doiKhach(id: string) {
    if (!window.confirm(`Bạn chắc chắn ĐỔI KHÁCH cho serial ${serial}?`)) return
    setBusy(true); setErr(null); setMsg(null)
    const r = await doiKhachMay(serial, id); setBusy(false); bao(r, 'Đã đổi khách.')
  }
  async function doiSerial() {
    if (!window.confirm(`Bạn chắc chắn ĐỔI SERIAL ${serial} → ${serialMoi}? (chuyển khách + BH sang serial mới)`)) return
    setBusy(true); setErr(null); setMsg(null)
    const r = await doiSerialMay(serial, serialMoi); setBusy(false); bao(r, 'Đã đổi serial.')
  }
  async function xoa() {
    if (!window.confirm(`Bạn chắc chắn XOÁ máy đã lắp này (trả serial ${serial} về kho, gỡ BH + lịch thay lõi)?`)) return
    setBusy(true); setErr(null); setMsg(null)
    const r = await xoaMayDaLap(serial); setBusy(false); bao(r, 'Đã trả serial về kho.')
  }

  if (!mo) {
    return (
      <div className="space-y-1">
        <button onClick={() => { setMo(true); setMsg(null); setErr(null) }}
          className="rounded-lg border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Sửa máy đã lắp</button>
        {msg && <p className="text-sm text-emerald-700">{msg}</p>}
        <p className="text-[11px] text-slate-400">Đổi khách · đổi serial · xoá — đều cần admin duyệt (admin làm là áp ngay).</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Đổi khách */}
      <div className="rounded-lg border p-3">
        <p className="text-sm font-medium text-slate-700 mb-1">Đổi khách (cùng serial)</p>
        <KhachPicker onPick={(id) => doiKhach(id)} />
      </div>

      {/* Đổi serial */}
      <div className="rounded-lg border p-3 space-y-2">
        <p className="text-sm font-medium text-slate-700">Đổi serial (nhầm — giữ khách)</p>
        {internalCode ? (
          dsSerial.length ? (
            <div className="flex gap-2 flex-wrap items-center">
              <select value={serialMoi} onChange={(e) => setSerialMoi(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm bg-white font-mono text-slate-900">
                <option value="">— Chọn serial đúng (tồn kho, cùng máy) —</option>
                {dsSerial.map((s) => <option key={s.serial} value={s.serial}>{s.serial}</option>)}
              </select>
              <button onClick={doiSerial} disabled={busy || !serialMoi}
                className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50">Đổi</button>
            </div>
          ) : <p className="text-sm text-amber-700">Không còn serial tồn kho nào của máy này.</p>
        ) : <p className="text-sm text-amber-700">Máy chưa có mã nội bộ — không lọc được serial.</p>}
      </div>

      {/* Xoá */}
      <div className="rounded-lg border border-red-200 p-3 flex items-center justify-between gap-3">
        <span className="text-sm text-slate-700">Xoá máy đã lắp → trả serial về kho</span>
        <button onClick={xoa} disabled={busy}
          className="rounded-lg border border-red-200 text-red-600 px-3 py-1.5 text-sm hover:bg-red-50 disabled:opacity-50">Xoá (về kho)</button>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => setMo(false)} className="text-sm text-slate-500 underline">Đóng</button>
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </div>
  )
}
