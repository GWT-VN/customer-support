'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { doiKhachMay, doiSerialMay, xoaMayDaLap, serialsTheoMay, type SerialKho } from '@/app/actions'
import { KhachPicker } from '@/components/KhachPicker'

type KetQua = { ok: true; applied: boolean } | { ok: false; error: string }

/** Sửa/xoá MÁY ĐÃ LẮP (đều qua admin duyệt): đổi khách · đổi serial · xoá (về kho). */
export function SuaMayDaLap({ serial, internalCode }: { serial: string; internalCode: string | null }) {
  const router = useRouter()
  const [mo, setMo] = useState<null | 'khach' | 'serial'>(null)
  const [serialMoi, setSerialMoi] = useState('')
  const [dsSerial, setDsSerial] = useState<SerialKho[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (mo !== 'serial' || !internalCode) return
    let song = true
    serialsTheoMay(internalCode).then((r) => { if (song) setDsSerial(r.filter((s) => s.serial !== serial)) })
    return () => { song = false }
  }, [mo, internalCode, serial])

  function bao(r: KetQua, okMsg: string) {
    if (!r.ok) { setErr(r.error); return }
    setErr(null); setMsg(r.applied ? okMsg : 'Đã gửi chờ admin duyệt.'); setMo(null); router.refresh()
  }

  async function doiKhach(id: string) {
    setBusy(true); setErr(null); setMsg(null)
    const r = await doiKhachMay(serial, id); setBusy(false); bao(r, 'Đã đổi khách.')
  }
  async function doiSerial() {
    setBusy(true); setErr(null); setMsg(null)
    const r = await doiSerialMay(serial, serialMoi); setBusy(false); bao(r, 'Đã đổi serial.')
  }
  async function xoa() {
    if (!window.confirm('Gửi yêu cầu XOÁ máy đã lắp này (trả serial về kho)?')) return
    setBusy(true); setErr(null); setMsg(null)
    const r = await xoaMayDaLap(serial); setBusy(false); bao(r, 'Đã trả serial về kho.')
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => { setMo(mo === 'khach' ? null : 'khach'); setMsg(null); setErr(null) }}
          className="rounded-lg border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Đổi khách</button>
        <button onClick={() => { setMo(mo === 'serial' ? null : 'serial'); setMsg(null); setErr(null) }}
          className="rounded-lg border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Đổi serial (nhầm)</button>
        <button onClick={xoa} disabled={busy}
          className="rounded-lg border border-red-200 text-red-600 px-3 py-1.5 text-sm hover:bg-red-50 disabled:opacity-50">
          Xoá máy (về kho)</button>
      </div>

      {mo === 'khach' && (
        <div className="rounded-lg border p-3 bg-slate-50">
          <p className="text-xs text-slate-500 mb-1">Chọn khách mới cho serial này:</p>
          <KhachPicker onPick={(id) => doiKhach(id)} />
        </div>
      )}

      {mo === 'serial' && (
        <div className="rounded-lg border p-3 bg-slate-50 space-y-2">
          <p className="text-xs text-slate-500">Giữ khách, chuyển sang serial đúng (còn tồn kho, cùng máy):</p>
          {internalCode ? (
            dsSerial.length ? (
              <div className="flex gap-2 flex-wrap items-center">
                <select value={serialMoi} onChange={(e) => setSerialMoi(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm bg-white font-mono text-slate-900">
                  <option value="">— Chọn serial đúng —</option>
                  {dsSerial.map((s) => <option key={s.serial} value={s.serial}>{s.serial}</option>)}
                </select>
                <button onClick={doiSerial} disabled={busy || !serialMoi}
                  className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
                  Đổi</button>
              </div>
            ) : <p className="text-sm text-amber-700">Không còn serial tồn kho nào của máy này.</p>
          ) : <p className="text-sm text-amber-700">Máy chưa có mã nội bộ — không lọc được serial.</p>}
        </div>
      )}

      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}
      <p className="text-[11px] text-slate-400">Sửa/xoá máy cần admin duyệt (admin làm là áp ngay).</p>
    </div>
  )
}
