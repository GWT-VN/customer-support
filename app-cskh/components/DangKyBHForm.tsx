'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  dangKyBaoHanh, dsMayCoSerial, serialsTheoMay, serialInfo,
  type SerialKho, type MayKho, type KhachTom,
} from '@/app/actions'
import { SerialPicker } from '@/components/SerialPicker'
import { KhachPicker } from '@/components/KhachPicker'

const HOM_NAY = () => new Date().toISOString().slice(0, 10)

function vn(d: string | null) {
  return d ? new Date(d).toLocaleDateString('vi-VN') : '—'
}

/**
 * Đăng ký + kích hoạt bảo hành (Đợt 1).
 *  · Chọn MÁY trước -> serial lọc theo máy (còn chưa kích hoạt), hoặc
 *  · Gõ SERIAL trước -> tự soi máy + trạng thái (đã kích hoạt cho ai chưa).
 *  · Địa chỉ khách + địa chỉ lắp (tick dùng chung). Ngày bắt đầu bảo hành.
 */
export function DangKyBHForm() {
  const [dsMay, setDsMay] = useState<MayKho[]>([])
  const [mayCode, setMayCode] = useState('')            // '' = chưa chọn máy -> gõ serial tự do
  const [serialList, setSerialList] = useState<SerialKho[]>([])
  const [serial, setSerial] = useState('')
  const [info, setInfo] = useState<SerialKho | null>(null)

  const [khachId, setKhachId] = useState('')
  const [khachAddr, setKhachAddr] = useState<string | null>(null)
  const [dungDcKhach, setDungDcKhach] = useState(true)
  const [dcLap, setDcLap] = useState('')

  const [ngay, setNgay] = useState(HOM_NAY())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()

  // Tải danh sách máy 1 lần
  useEffect(() => {
    let song = true
    dsMayCoSerial().then((r) => { if (song) setDsMay(r) })
    return () => { song = false }
  }, [])

  // Chọn máy -> tải serial của máy đó (chỉ chạy khi có mayCode; clear làm ở handler)
  useEffect(() => {
    if (!mayCode) return
    let song = true
    serialsTheoMay(mayCode).then((r) => { if (song) setSerialList(r) })
    return () => { song = false }
  }, [mayCode])

  // Serial thay đổi -> soi trạng thái (debounce; setState chỉ trong callback async)
  useEffect(() => {
    const s = serial.trim()
    if (!s) return
    let song = true
    const id = setTimeout(() => { serialInfo(s).then((r) => { if (song) setInfo(r) }) }, 250)
    return () => { song = false; clearTimeout(id) }
  }, [serial])

  function chonMay(code: string) {
    setMayCode(code); setSerial(''); setInfo(null); setSerialList([]); setErr(null)
  }
  function datSerial(v: string) {
    setSerial(v); setErr(null)
    if (!v.trim()) setInfo(null)
  }
  function chonKhach(id: string, _nhan: string, k?: KhachTom) {
    setKhachId(id); setKhachAddr(k?.address ?? null)
  }

  const daKichHoat = info?.bh_kich_hoat === true
  const dcLapCuoi = dungDcKhach ? (khachAddr ?? '') : dcLap

  async function luu() {
    setBusy(true); setErr(null); setMsg(null)
    const r = await dangKyBaoHanh({
      serial, customer_id: khachId, install_date: ngay,
      install_address: dcLapCuoi.trim() || undefined,
    })
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    setMsg(`Đã đăng ký + kích hoạt BH cho serial ${serial}.`)
    setMayCode(''); setSerial(''); setInfo(null); setSerialList([])
    setKhachId(''); setKhachAddr(null); setDcLap(''); setDungDcKhach(true); setNgay(HOM_NAY())
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border p-5 space-y-4 max-w-2xl">
      {/* 1. Máy */}
      <div>
        <label className="text-sm font-medium text-slate-700">1. Máy (chọn để lọc serial)</label>
        <select value={mayCode} onChange={(e) => chonMay(e.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white text-slate-900">
          <option value="">— Chưa chọn (sẽ gõ serial tự do) —</option>
          {dsMay.map((m) => (
            <option key={m.internal_code} value={m.internal_code}>
              {m.ten_noi_bo ?? m.internal_code} · {m.internal_code} (còn {m.con_lai})
            </option>
          ))}
        </select>
      </div>

      {/* 2. Serial */}
      <div>
        <label className="text-sm font-medium text-slate-700">2. Serial máy</label>
        {mayCode ? (
          serialList.length ? (
            <select value={serial} onChange={(e) => datSerial(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white font-mono text-slate-900">
              <option value="">— Chọn serial còn kích hoạt được —</option>
              {serialList.map((s) => (
                <option key={s.serial} value={s.serial}>
                  {s.serial}{s.ten_khach ? ` · đã lắp: ${s.ten_khach}` : ' · tồn kho'}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm bg-amber-50 text-amber-900 rounded-lg px-3 py-2 mt-1">
              Máy này không còn serial nào chưa kích hoạt trong kho.
            </p>
          )
        ) : (
          <>
            <p className="text-xs text-slate-400 mb-1">Gõ serial; chưa có thì tạo chờ duyệt.</p>
            <div className="flex"><SerialPicker value={serial} onChange={datSerial} placeholder="Gõ serial…" /></div>
          </>
        )}

        {/* Soi trạng thái serial */}
        {serial.trim() && info && (
          <div className={
            'mt-2 text-sm rounded-lg px-3 py-2 ' +
            (daKichHoat ? 'bg-red-50 text-red-800'
              : info.trang_thai === 'da_lap_chua_kich_hoat' ? 'bg-amber-50 text-amber-900'
              : 'bg-emerald-50 text-emerald-900')
          }>
            <div className="font-medium">{info.ten_noi_bo ?? info.ma_noi_bo ?? '—'}
              <span className="font-normal text-slate-500"> · mã {info.ma_noi_bo ?? '—'}</span>
            </div>
            {daKichHoat ? (
              <div>⛔ ĐÃ kích hoạt BH cho <strong>{info.ten_khach ?? '—'}</strong>
                {info.ngay_lap && <> (ngày {vn(info.ngay_lap)})</>} — không đăng ký lại.</div>
            ) : info.trang_thai === 'da_lap_chua_kich_hoat' ? (
              <div>Đã lắp cho <strong>{info.ten_khach ?? '—'}</strong> nhưng chưa kích hoạt BH.</div>
            ) : (
              <div>Tồn kho — đăng ký được.</div>
            )}
          </div>
        )}
        {serial.trim() && !info && (
          <p className="mt-2 text-xs text-slate-500">Serial chưa có trong kho — sẽ tạo tự do khi đăng ký.</p>
        )}
      </div>

      {/* 3. Khách */}
      <div>
        <label className="text-sm font-medium text-slate-700">3. Khách hàng</label>
        <p className="text-xs text-slate-400 mb-1">Tìm khách đã có; không có thì tạo mới (admin duyệt sau).</p>
        <KhachPicker onPick={chonKhach} />
      </div>

      {/* 4. Địa chỉ */}
      <div>
        <label className="text-sm font-medium text-slate-700">4. Địa chỉ lắp đặt</label>
        <p className="text-xs text-slate-400">Địa chỉ khách: {khachAddr || '—'}</p>
        <label className="flex items-center gap-1.5 text-sm text-slate-700 mt-1">
          <input type="checkbox" checked={dungDcKhach} onChange={(e) => setDungDcKhach(e.target.checked)} />
          Dùng địa chỉ khách làm địa chỉ lắp
        </label>
        {!dungDcKhach && (
          <input value={dcLap} onChange={(e) => setDcLap(e.target.value)} placeholder="Địa chỉ lắp khác…"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900" />
        )}
      </div>

      {/* 5. Ngày bắt đầu BH */}
      <label className="block">
        <span className="text-sm font-medium text-slate-700">5. Ngày bắt đầu bảo hành</span>
        <input type="date" value={ngay} max={HOM_NAY()} onChange={(e) => setNgay(e.target.value)}
          className="mt-1 block rounded-lg border px-3 py-2 text-sm text-slate-900" />
      </label>

      <div className="flex items-center gap-3">
        <button onClick={luu} disabled={busy || !serial.trim() || !khachId || daKichHoat}
          className="rounded-lg bg-slate-900 text-white px-5 py-2.5 font-medium disabled:opacity-50">
          {busy ? 'Đang đăng ký…' : 'Đăng ký + kích hoạt bảo hành'}
        </button>
        {daKichHoat && <span className="text-sm text-red-600">Serial đã kích hoạt — chọn serial khác.</span>}
        {msg && <span className="text-sm text-emerald-700">{msg}</span>}
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </div>
  )
}
