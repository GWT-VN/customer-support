'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { themDiaChiKhach, xoaDiaChiKhach, type DiaChiKhach } from '@/app/actions'
import { NHAN_LOAI_DIA_CHI } from '@/lib/danhSach'

/**
 * Địa chỉ THÊM của khách — nhà / công ty / lắp đặt.
 *
 * `cs_customers.address` chỉ chứa được một địa chỉ, mà khách thật hay có hai:
 * ca CEO nêu là cô Mai vừa có địa chỉ nhà (Ô Chợ Dừa) vừa có địa chỉ công ty
 * (cao ốc H3, Q4). Trước đây gộp hai hồ sơ là một trong hai địa chỉ hết chỗ.
 * Khối này bày cùng chỗ với SĐT phụ để CS thấy nó cùng một loại việc.
 */
export function DiaChiKhachList({
  customerId, items,
}: { customerId: string; items: DiaChiKhach[] }) {
  const [dc, setDc] = useState('')
  const [loai, setLoai] = useState('cty')
  const [ghiChu, setGhiChu] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()

  async function them() {
    if (!dc.trim()) { setErr('Nhập địa chỉ đã.'); return }
    setBusy(true); setErr(null)
    const r = await themDiaChiKhach(customerId, dc, loai, ghiChu)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    setDc(''); setGhiChu(''); router.refresh()
  }

  async function xoa(id: string, nhan: string) {
    if (!window.confirm(`Xoá địa chỉ "${nhan}"?`)) return
    setBusy(true); setErr(null)
    const r = await xoaDiaChiKhach(id, customerId)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    router.refresh()
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="font-medium text-slate-900">Địa chỉ khác ({items.length})</h2>
        <p className="text-xs text-slate-400">
          Địa chỉ chính nằm ở khối trên. Đây là các địa chỉ thêm — công ty, nhà, nơi lắp đặt.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-400">Chưa có địa chỉ nào khác.</p>
      ) : (
        <ul className="divide-y rounded-lg border text-sm">
          {items.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  {NHAN_LOAI_DIA_CHI[d.loai] ?? d.loai}
                </span>
                <span className="ml-2 text-slate-800">{d.dia_chi}</span>
                {d.ghi_chu && <span className="block text-xs text-slate-400">{d.ghi_chu}</span>}
              </span>
              <button onClick={() => xoa(d.id, d.dia_chi)} disabled={busy}
                className="shrink-0 text-xs text-slate-400 underline hover:text-red-600 disabled:opacity-50">
                xoá
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2 border-t pt-3">
        <label className="block min-w-[220px] flex-1">
          <span className="text-xs text-slate-600">Địa chỉ</span>
          <input value={dc} onChange={(e) => setDc(e.target.value)}
            placeholder="Số nhà, đường, phường, quận, tỉnh…"
            className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs text-slate-600">Loại</span>
          <select value={loai} onChange={(e) => setLoai(e.target.value)}
            className="mt-1 rounded-lg border bg-white px-2 py-1.5 text-sm">
            <option value="cty">Công ty</option>
            <option value="nha">Nhà</option>
            <option value="lap_dat">Lắp đặt</option>
            <option value="khac">Khác</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-slate-600">Ghi chú</span>
          <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)}
            className="mt-1 w-40 rounded-lg border px-2 py-1.5 text-sm" />
        </label>
        <button onClick={them} disabled={busy}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50">
          Thêm địa chỉ
        </button>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
    </section>
  )
}
