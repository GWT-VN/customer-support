'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { datTrangThaiSerial } from '@/app/actions'
import { NHAN_TRANG_THAI_SERIAL, TRANG_THAI_KHO_DAT_TAY } from '@/lib/danhSach'

const MAU: Record<string, string> = {
  ton_kho: 'bg-slate-100 text-slate-600', da_lap: 'bg-emerald-100 text-emerald-800',
  trung_bay: 'bg-sky-100 text-sky-800', mkt: 'bg-violet-100 text-violet-800',
  kiem_dinh_nuoc: 'bg-cyan-100 text-cyan-800', lap_test: 'bg-indigo-100 text-indigo-800',
  bao_tri: 'bg-amber-100 text-amber-800', thanh_ly: 'bg-red-100 text-red-700',
}

/**
 * Badge trạng thái + đổi nhanh NGAY trong list kho serial (đỡ phải mở từng máy).
 *  - Máy đã lắp khách: chỉ hiện badge + link sang trang máy (phải thu hồi trước khi đổi).
 *  - Máy ở kho + admin: chọn trạng thái mới -> Đặt (có xác nhận). Ghi nhật ký vòng đời.
 */
export function DoiTrangThaiKho({ serial, trangThai, laAdmin }: { serial: string; trangThai: string | null; laAdmin: boolean }) {
  const router = useRouter()
  const [den, setDen] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const tt = trangThai ?? 'ton_kho'
  const badge = (
    <span className={`px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${MAU[tt] ?? 'bg-slate-100 text-slate-500'}`}>
      {NHAN_TRANG_THAI_SERIAL[tt] ?? tt}
    </span>
  )

  if (tt === 'da_lap') {
    return (
      <div className="flex items-center gap-2">
        {badge}
        <Link href={`/may/${encodeURIComponent(serial)}`} prefetch={false} className="text-[11px] text-slate-400 underline">ở khách</Link>
      </div>
    )
  }
  if (!laAdmin) return badge

  async function dat() {
    if (!den) return
    if (!window.confirm(`Đổi ${serial} → ${NHAN_TRANG_THAI_SERIAL[den] ?? den}?`)) return
    setBusy(true); setErr(null)
    const r = await datTrangThaiSerial(serial, den)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    setDen(''); router.refresh()
  }

  return (
    <div className="flex items-center gap-1.5">
      {badge}
      <select value={den} onChange={(e) => setDen(e.target.value)} disabled={busy}
        className="rounded border px-1.5 py-1 text-xs bg-white text-slate-700 max-w-[9rem]">
        <option value="">đổi…</option>
        {TRANG_THAI_KHO_DAT_TAY.filter((t) => t !== tt).map((t) => (
          <option key={t} value={t}>{NHAN_TRANG_THAI_SERIAL[t]}</option>
        ))}
      </select>
      {den && (
        <button disabled={busy} onClick={dat} className="rounded bg-slate-900 text-white px-2 py-1 text-xs disabled:opacity-50">Đặt</button>
      )}
      {err && <span className="text-[11px] text-red-600">{err}</span>}
    </div>
  )
}
