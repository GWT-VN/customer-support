'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { datTrangThaiLichKT, type LichKyThuatRow } from '@/app/actions'
import { NHAN_LOAI_VIEC } from '@/lib/danhSach'
import { vnDate } from '@/components/Badge'
import { BaoTriDoneButton } from '@/components/BaoTriDoneButton'

const MAU_TT: Record<string, string> = {
  hen: 'bg-sky-100 text-sky-800', xong: 'bg-emerald-100 text-emerald-800', huy: 'bg-slate-100 text-slate-500 line-through',
}
const NHAN_TT: Record<string, string> = { hen: 'Đã hẹn', xong: 'Xong', huy: 'Huỷ' }

/**
 * Màn hình KỸ THUẬT tự xem: chỉ chuyến của mình. Mỗi chuyến gồm địa chỉ + các việc.
 * Kỹ thuật bấm "Hoàn thành chuyến" (tự cập nhật bảo trì/thay lõi/ticket), và ghi
 * kết quả đo nước cho từng việc bảo trì. Có link tra cứu khách/máy/ticket của chuyến.
 */
export function LichCuaToiKT({ rows }: { rows: LichKyThuatRow[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function hoanThanh(id: string) {
    setBusy(id); setMsg(null); setErr(null)
    const r = await datTrangThaiLichKT(id, 'xong')
    setBusy(null)
    if (!r.ok) { setErr(r.error); return }
    if (r.cap_nhat > 0) setMsg(`Đã hoàn thành + cập nhật ${r.cap_nhat} việc.`)
    router.refresh()
  }
  async function moLai(id: string) {
    setBusy(id); setErr(null)
    const r = await datTrangThaiLichKT(id, 'hen')
    setBusy(null)
    if (!r.ok) { setErr(r.error); return }
    router.refresh()
  }

  if (rows.length === 0) return <p className="text-sm text-slate-400">Bạn chưa có chuyến nào trong khoảng này.</p>

  const theoNgay = new Map<string, LichKyThuatRow[]>()
  for (const r of rows) { const a = theoNgay.get(r.ngay) ?? []; a.push(r); theoNgay.set(r.ngay, a) }

  return (
    <div className="space-y-4">
      {msg && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{msg}</p>}
      {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
      {[...theoNgay.entries()].map(([ngay, list]) => (
        <div key={ngay}>
          <h3 className="text-sm font-medium text-slate-700 mb-1.5">{vnDate(ngay)} ({list.length} chuyến)</h3>
          <ul className="space-y-3">
            {list.map((r) => (
              <li key={r.id} className="bg-white rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {r.customer_id
                        ? <Link href={`/khach/${r.customer_id}`} prefetch={false} className="font-medium text-slate-900 underline">{r.ten_khach ?? 'khách'}</Link>
                        : <span className="font-medium text-slate-900">{r.ten_khach ?? '—'}</span>}
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${MAU_TT[r.trang_thai] ?? ''}`}>{NHAN_TT[r.trang_thai] ?? r.trang_thai}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {r.tinh && <span>{r.tinh}</span>}
                      {r.dia_chi && <span>{r.tinh ? ' · ' : ''}{r.dia_chi}</span>}
                      {!r.tinh && !r.dia_chi && <span className="text-slate-400">chưa có địa chỉ</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-none">
                    {r.trang_thai !== 'xong'
                      ? <button disabled={busy === r.id} onClick={() => hoanThanh(r.id)} className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50">{busy === r.id ? '…' : '✓ Hoàn thành chuyến'}</button>
                      : <button disabled={busy === r.id} onClick={() => moLai(r.id)} className="text-xs text-sky-600 underline">mở lại</button>}
                  </div>
                </div>

                <ul className="mt-2.5 space-y-2">
                  {r.viec.map((v, i) => (
                    <li key={i} className="rounded-lg bg-slate-50 border px-3 py-2">
                      <div className="flex items-center gap-2 flex-wrap text-sm">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] ${v.loai_viec === 'thu_tien' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'}`}>{NHAN_LOAI_VIEC[v.loai_viec] ?? v.loai_viec}</span>
                        {v.mo_ta && <span className="text-slate-700">{v.mo_ta}</span>}
                        {v.so_tien ? <span className="text-amber-700 font-medium">{v.so_tien.toLocaleString('vi-VN')}đ</span> : null}
                        {v.loai_viec === 'thay_loi' && v.ref && <Link href={`/may/${encodeURIComponent(v.ref)}`} prefetch={false} className="text-xs text-sky-600 underline">máy {v.ref}</Link>}
                        {v.loai_viec === 'ticket' && v.ref && <Link href={`/ticket/${encodeURIComponent(v.ref)}`} prefetch={false} className="text-xs text-sky-600 underline">ticket {v.ref}</Link>}
                      </div>
                      {v.loai_viec === 'bao_tri' && v.ref && (
                        <div className="mt-1.5">
                          <BaoTriDoneButton visitId={v.ref} completedAt={null} />
                        </div>
                      )}
                    </li>
                  ))}
                  {r.viec.length === 0 && <li className="text-xs text-slate-400">Chuyến chưa gán việc cụ thể.</li>}
                </ul>

                {r.ghi_chu && <p className="text-[11px] text-slate-400 mt-2">Ghi chú: {r.ghi_chu}</p>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
