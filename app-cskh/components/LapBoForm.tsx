'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  comboChon, linhKienCombo, serialsTheoMay, lapBoCombo,
  type LinhKienCombo, type SerialKho, type KhachTom,
} from '@/app/actions'
import { KhachPicker } from '@/components/KhachPicker'
import { SerialRo } from '@/components/SerialRo'

const HOM_NAY = () => new Date().toISOString().slice(0, 10)

/** Ô chọn serial tồn kho cho 1 thiết bị của bộ (lọc theo mã nội bộ, chưa kích hoạt BH).
 *  Chọn từ danh sách HOẶC gõ số CUỐI để tìm (gõ 123 -> ưu tiên serial kết thúc 123). */
function ChonSerialThietBi({
  lk, value, onChange,
}: { lk: LinhKienCombo; value: string; onChange: (serial: string) => void }) {
  const [ds, setDs] = useState<SerialKho[]>([])
  const [tai, setTai] = useState(true)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  // Keyed theo internal_code ở parent -> mỗi thiết bị là một instance riêng, effect
  // chỉ chạy 1 lần lúc mount. Không setState đồng bộ trong thân effect (eslint chặn).
  useEffect(() => {
    let song = true
    serialsTheoMay(lk.internal_code).then((r) => { if (song) { setDs(r); setTai(false) } })
    return () => { song = false }
  }, [lk.internal_code])

  const kq = q.trim().toLowerCase()
  const loc = (kq
    ? ds.filter((s) => s.serial.toLowerCase().includes(kq))
        .sort((a, b) =>
          (a.serial.toLowerCase().endsWith(kq) ? 0 : 1) - (b.serial.toLowerCase().endsWith(kq) ? 0 : 1))
    : ds
  ).slice(0, 12)

  function go(v: string) {
    setQ(v); setOpen(true)
    // Gõ trúng nguyên serial tồn kho -> nhận luôn; chưa trúng thì bỏ chọn.
    const hit = ds.find((s) => s.serial.toLowerCase() === v.trim().toLowerCase())
    onChange(hit ? hit.serial : '')
  }
  function chon(s: SerialKho) { setQ(s.serial); setOpen(false); onChange(s.serial) }

  return (
    <div className="rounded-lg border p-3 bg-white space-y-1">
      <div className="text-sm font-medium text-slate-800">{lk.ten ?? lk.internal_code}</div>
      <div className="font-mono text-[11px] text-slate-400">{lk.internal_code}</div>
      {tai ? (
        <p className="text-xs text-slate-400">Đang tải serial…</p>
      ) : ds.length === 0 ? (
        <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
          Không còn serial tồn kho cho thiết bị này — nhập kho trước.
        </p>
      ) : (
        <div className="relative">
          <input value={q} onChange={(e) => go(e.target.value)}
            onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder={`Chọn hoặc gõ số CUỐI serial (còn ${ds.length})…`}
            className={`w-full rounded-lg border px-3 py-2 text-sm bg-white font-mono text-slate-900 ${value ? 'border-emerald-400' : ''}`} />
          {open && loc.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-lg border bg-white shadow-lg">
              {loc.map((s) => (
                <li key={s.serial}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => chon(s)}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 font-mono">
                    {s.serial}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {value && <div className="text-xs text-slate-500 mt-1">Đã chọn: <SerialRo serial={value} /></div>}
        </div>
      )}
    </div>
  )
}

export function LapBoForm() {
  const router = useRouter()
  const [combos, setCombos] = useState<{ combo: string; ten: string | null }[]>([])
  const [combo, setCombo] = useState('')
  const [linhKien, setLinhKien] = useState<LinhKienCombo[]>([])
  const [chon, setChon] = useState<Record<string, string>>({})   // internal_code -> serial
  const [khachId, setKhachId] = useState('')
  const [khachAddr, setKhachAddr] = useState<string | null>(null)
  const [dungDcKhach, setDungDcKhach] = useState(true)
  const [dcLap, setDcLap] = useState('')
  const [ngay, setNgay] = useState(HOM_NAY())
  const [busy, setBusy] = useState(false)
  const [maBo, setMaBo] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { comboChon().then(setCombos) }, [])

  function chonCombo(c: string) {
    setCombo(c); setChon({}); setLinhKien([]); setErr(null); setMaBo(null)
    if (c) linhKienCombo(c).then(setLinhKien)
  }
  function chonKhach(id: string, _nhan: string, k?: KhachTom) {
    setKhachId(id); setKhachAddr(k?.address ?? null)
  }

  const dcLapCuoi = dungDcKhach ? (khachAddr ?? '') : dcLap
  const duSerial = linhKien.length > 0 && linhKien.every((lk) => (chon[lk.internal_code] ?? '').trim())
  const sanSang = !!combo && !!khachId && duSerial && /^\d{4}-\d{2}-\d{2}$/.test(ngay)

  const tienMa = useMemo(() => {
    if (!combo || !/^\d{4}-\d{2}-\d{2}$/.test(ngay)) return null
    const [y, m] = ngay.split('-')
    return `${combo}${y}${m}###`
  }, [combo, ngay])

  async function luu() {
    setBusy(true); setErr(null); setMaBo(null)
    const r = await lapBoCombo({
      combo, customer_id: khachId, install_date: ngay,
      install_address: dcLapCuoi.trim() || undefined,
      serials: linhKien.map((lk) => ({ internal_code: lk.internal_code, serial: chon[lk.internal_code] })),
    })
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    setMaBo(r.ma_bo)
    setCombo(''); setLinhKien([]); setChon({}); setKhachId(''); setKhachAddr(null)
    setDcLap(''); setDungDcKhach(true); setNgay(HOM_NAY())
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border p-5 space-y-4 max-w-2xl">
      {/* 1. Combo */}
      <div>
        <label className="text-sm font-medium text-slate-700">1. Bộ hệ thống (combo)</label>
        <select value={combo} onChange={(e) => chonCombo(e.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white text-slate-900">
          <option value="">— Chọn bộ —</option>
          {combos.map((c) => (
            <option key={c.combo} value={c.combo}>{c.ten ? `${c.ten} (${c.combo})` : c.combo}</option>
          ))}
        </select>
        {tienMa && <p className="text-xs text-slate-400 mt-1">Mã bộ sẽ sinh dạng <span className="font-mono">{tienMa.replace('###', 'xxx')}</span></p>}
      </div>

      {/* 2. Serial từng thiết bị */}
      {linhKien.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">2. Serial thiết bị ({linhKien.length})</label>
          {linhKien.map((lk) => (
            <ChonSerialThietBi key={lk.internal_code} lk={lk}
              value={chon[lk.internal_code] ?? ''}
              onChange={(s) => setChon((p) => ({ ...p, [lk.internal_code]: s }))} />
          ))}
        </div>
      )}

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
        <button onClick={luu} disabled={busy || !sanSang}
          className="rounded-lg bg-slate-900 text-white px-5 py-2.5 font-medium disabled:opacity-50">
          {busy ? 'Đang lắp…' : 'Lắp bộ + kích hoạt bảo hành'}
        </button>
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>

      {maBo && (
        <p className="text-sm bg-emerald-50 text-emerald-800 rounded-lg px-3 py-2">
          ✅ Đã lắp bộ <span className="font-mono font-medium">{maBo}</span> + kích hoạt BH từng thiết bị.
        </p>
      )}
    </div>
  )
}
