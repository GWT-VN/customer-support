'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { datTrangThaiSerial, type TrangThai } from '@/app/actions'
import { MAU_TRANG_THAI } from '@/lib/danhSach'

/**
 * Badge trạng thái + đổi nhanh NGAY trong list kho serial (đỡ phải mở từng máy).
 *  - Máy đã lắp khách: chỉ badge + link sang trang máy (phải thu hồi trước khi đổi).
 *  - Máy ở kho + admin: chọn trạng thái mới + BẮT BUỘC mô tả hiện trạng -> Đặt.
 * Danh mục `ds` do trang truyền vào (bảng serial_trang_thai).
 */
export function DoiTrangThaiKho({
  serial, trangThai, laAdmin, ds,
}: {
  serial: string; trangThai: string | null; laAdmin: boolean; ds: TrangThai[]
}) {
  const router = useRouter()
  const [den, setDen] = useState('')
  const [ghiChu, setGhiChu] = useState('')
  const [ngay, setNgay] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const mapTT = new Map(ds.map((t) => [t.code, t]))
  const tt = trangThai ?? 'ton_kho'
  const nhan = (code: string) => mapTT.get(code)?.nhan ?? code
  const mauClass = MAU_TRANG_THAI[mapTT.get(tt)?.mau ?? 'slate'] ?? MAU_TRANG_THAI.slate
  const datTayList = ds.filter((t) => t.cho_dat_tay && t.hoat_dong && t.code !== tt)

  const badge = (
    <span className={`px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${mauClass}`}>{nhan(tt)}</span>
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
    if (!den || !ghiChu.trim()) return
    if (!window.confirm(`Đổi ${serial} → ${nhan(den)}?`)) return
    setBusy(true); setErr(null)
    const r = await datTrangThaiSerial(serial, den, ghiChu, ngay || undefined)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    setDen(''); setGhiChu(''); setNgay(''); router.refresh()
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        {badge}
        <select value={den} onChange={(e) => setDen(e.target.value)} disabled={busy}
          className="rounded border px-1.5 py-1 text-xs bg-white text-slate-700 max-w-[9rem]">
          <option value="">đổi…</option>
          {datTayList.map((t) => <option key={t.code} value={t.code}>{t.nhan}</option>)}
        </select>
        {den && (
          <>
            <input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} title="Ngày (bỏ trống = hôm nay)"
              className="rounded border px-1.5 py-1 text-xs text-slate-900" />
            <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="mô tả hiện trạng (bắt buộc)"
              className="rounded border px-2 py-1 text-xs text-slate-900 min-w-48" />
            <button disabled={busy || !ghiChu.trim()} onClick={dat} className="rounded bg-slate-900 text-white px-2 py-1 text-xs disabled:opacity-50">Đặt</button>
          </>
        )}
      </div>
      {err && <span className="text-[11px] text-red-600">{err}</span>}
    </div>
  )
}
