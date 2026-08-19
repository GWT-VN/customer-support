'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { datTrangThaiLichKT, xoaLichKyThuat, type LichKyThuatRow } from '@/app/actions'
import { NHAN_LOAI_VIEC } from '@/lib/danhSach'
import { vnDate } from '@/components/Badge'

const MAU_TT: Record<string, string> = {
  hen: 'bg-sky-100 text-sky-800', xong: 'bg-emerald-100 text-emerald-800', huy: 'bg-slate-100 text-slate-500 line-through',
}
const NHAN_TT: Record<string, string> = { hen: 'Đã hẹn', xong: 'Xong', huy: 'Huỷ' }

/** Danh sách chuyến đi kỹ thuật, gom theo ngày. Cho đổi trạng thái / xoá (quản lý). */
export function LichKyThuatList({ rows }: { rows: LichKyThuatRow[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function dat(id: string, tt: 'hen' | 'xong' | 'huy') {
    setBusy(id); setMsg(null)
    const r = await datTrangThaiLichKT(id, tt)
    setBusy(null)
    if (r.ok && tt === 'xong' && r.cap_nhat > 0) setMsg(`Đã hoàn thành + cập nhật ${r.cap_nhat} việc (bảo trì/thay lõi/ticket).`)
    router.refresh()
  }
  async function xoa(id: string) {
    if (!window.confirm('Xoá chuyến này?')) return
    setBusy(id); await xoaLichKyThuat(id); setBusy(null); router.refresh()
  }

  if (rows.length === 0) return <p className="text-sm text-slate-400">Chưa có chuyến nào trong khoảng này.</p>

  // gom theo ngày
  const theoNgay = new Map<string, LichKyThuatRow[]>()
  for (const r of rows) { const a = theoNgay.get(r.ngay) ?? []; a.push(r); theoNgay.set(r.ngay, a) }

  return (
    <div className="space-y-4">
      {msg && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{msg}</p>}
      {[...theoNgay.entries()].map(([ngay, list]) => (
        <div key={ngay}>
          <h3 className="text-sm font-medium text-slate-700 mb-1.5">{vnDate(ngay)} ({list.length} chuyến)</h3>
          <ul className="space-y-2">
            {list.map((r) => (
              <li key={r.id} className="bg-white rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-slate-900">{r.ten_ky_thuat ?? '(chưa gán KT)'}</span>
                    <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${MAU_TT[r.trang_thai] ?? ''}`}>{NHAN_TT[r.trang_thai] ?? r.trang_thai}</span>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {r.customer_id ? <Link href={`/khach/${r.customer_id}`} prefetch={false} className="underline text-slate-700">{r.ten_khach ?? 'khách'}</Link> : (r.ten_khach ?? '—')}
                      {r.tinh && <span> · {r.tinh}</span>}
                      {r.dia_chi && <span> · {r.dia_chi}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {r.viec.map((v, i) => (
                        <span key={i} className={`px-1.5 py-0.5 rounded text-[11px] ${v.loai_viec === 'thu_tien' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                          {NHAN_LOAI_VIEC[v.loai_viec] ?? v.loai_viec}
                          {v.so_tien ? `: ${v.so_tien.toLocaleString('vi-VN')}đ` : ''}
                          {v.mo_ta ? `${v.so_tien ? ' · ' : ': '}${v.mo_ta}` : ''}
                          {(v.loai_viec === 'thay_loi' || v.loai_viec === 'ticket') && v.ref ? ` · ${v.ref}` : ''}
                        </span>
                      ))}
                    </div>
                    {r.ghi_chu && <p className="text-[11px] text-slate-400 mt-1">{r.ghi_chu}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-none">
                    {r.trang_thai !== 'xong' && <button disabled={busy === r.id} onClick={() => dat(r.id, 'xong')} className="text-xs text-emerald-700 underline">✓ xong</button>}
                    {r.trang_thai !== 'huy' && <button disabled={busy === r.id} onClick={() => dat(r.id, 'huy')} className="text-xs text-slate-500 underline">huỷ</button>}
                    {r.trang_thai === 'huy' && <button disabled={busy === r.id} onClick={() => dat(r.id, 'hen')} className="text-xs text-sky-600 underline">mở lại</button>}
                    <button disabled={busy === r.id} onClick={() => xoa(r.id)} className="text-xs text-red-600 underline">xoá</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
