'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addTicketItem, deleteTicketItem, type TicketMuc, type CatalogItem } from '@/app/actions'

function tien(n: number | null) {
  if (n === null || n === undefined) return null
  return n.toLocaleString('vi-VN') + ' đ'
}

/**
 * `choPhepSua` chỉ ẩn nút cho gọn mắt — KHÔNG phải phân quyền.
 * Rào thật ở addTicketItem()/deleteTicketItem() trên server.
 * Hạng mục thu phí/vật tư gộp làm một; BẮT BUỘC chọn từ catalog_item.
 */
export function TicketItems(
  { code, items, catalog, choPhepSua }:
  { code: string; items: TicketMuc[]; catalog: CatalogItem[]; choPhepSua: boolean }
) {
  const [loai, setLoai] = useState<'hang_muc' | 'doi_may'>('hang_muc')
  const [catalogCode, setCatalogCode] = useState('')
  const [soLuong, setSoLuong] = useState('1')
  const [moTa, setMoTa] = useState('')
  const [soTien, setSoTien] = useState('')
  const [tinhPhi, setTinhPhi] = useState(true)
  const [serialCu, setSerialCu] = useState('')
  const [serialMoi, setSerialMoi] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()

  const tenTheoCode = useMemo(
    () => new Map(catalog.map((c) => [c.code, c.ten ?? c.code])), [catalog])

  function reset() {
    setCatalogCode(''); setSoLuong('1'); setMoTa(''); setSoTien('')
    setTinhPhi(true); setSerialCu(''); setSerialMoi('')
  }

  async function add() {
    setBusy(true); setErr(null)
    const r = await addTicketItem(code, {
      loai,
      catalog_code: loai === 'hang_muc' ? catalogCode : undefined,
      so_luong: Number(soLuong.replace(/[^\d]/g, '')) || 1,
      mo_ta: moTa,
      so_tien: soTien.trim() ? Number(soTien.replace(/[^\d]/g, '')) : null,
      tinh_phi: tinhPhi,
      serial_cu: loai === 'doi_may' ? serialCu : undefined,
      serial_moi: loai === 'doi_may' ? serialMoi : undefined,
    })
    setBusy(false)
    if (!r.ok) setErr(r.error)
    else { reset(); router.refresh() }
  }

  async function del(id: string) {
    await deleteTicketItem(id, code)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <ul className="divide-y border rounded-lg">
          {items.map((it) => (
            <li key={it.id} className="px-3 py-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                {it.loai === 'doi_may' ? (
                  <>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-violet-100 text-violet-800">Đổi máy</span>
                    <p className="font-mono text-xs text-slate-500">
                      {it.serial_cu ?? '—'} → {it.serial_moi ?? '—'}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-slate-900">
                        {tenTheoCode.get(it.catalog_code ?? '') ?? it.catalog_code ?? 'Hạng mục'}
                      </span>
                      {it.so_luong && it.so_luong > 1 && (
                        <span className="text-xs text-slate-500">× {it.so_luong}</span>
                      )}
                      {tien(it.so_tien) && (
                        <span className="text-sm font-medium text-slate-900">{tien(it.so_tien)}</span>
                      )}
                      <span className={`text-xs ${it.tinh_phi ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {it.tinh_phi ? 'Thu phí' : 'Miễn phí'}
                      </span>
                    </div>
                    {it.catalog_code && <span className="font-mono text-[10px] text-slate-400">{it.catalog_code}</span>}
                  </>
                )}
                {it.mo_ta && <p className="text-sm text-slate-700">{it.mo_ta}</p>}
              </div>
              {choPhepSua && (
                <button onClick={() => del(it.id)}
                  className="text-xs text-slate-400 hover:text-red-600 flex-none">Xoá</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!choPhepSua && (
        <p className="text-sm text-slate-400">
          {items.length === 0 && 'Chưa có mục nào. '}
          Chỉ quản trị mới ghi được chi phí, vật tư, đổi máy.
        </p>
      )}

      {choPhepSua && (
        <div className="rounded-lg border p-3 space-y-2 bg-slate-50">
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setLoai('hang_muc')}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                loai === 'hang_muc' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'}`}>
              Hạng mục (thu phí / vật tư)
            </button>
            <button onClick={() => setLoai('doi_may')}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                loai === 'doi_may' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'}`}>
              Đổi máy
            </button>
          </div>

          {loai === 'hang_muc' ? (
            <>
              <select value={catalogCode} onChange={(e) => setCatalogCode(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-slate-900 bg-white">
                <option value="">— Chọn hạng mục (bắt buộc) —</option>
                {catalog.map((c) => (
                  <option key={c.code} value={c.code}>
                    {(c.ten ?? c.code)}{c.danh_muc === 'Services' ? ' · DV' : ''} · {c.code}
                  </option>
                ))}
              </select>
              <div className="flex gap-2 flex-wrap items-center">
                <label className="text-sm text-slate-700 flex items-center gap-1">
                  SL
                  <input value={soLuong} onChange={(e) => setSoLuong(e.target.value)} inputMode="numeric"
                    className="rounded-lg border px-2 py-2 text-slate-900 w-16" />
                </label>
                <input value={soTien} onChange={(e) => setSoTien(e.target.value)} inputMode="numeric"
                  placeholder="Thành tiền (đ)"
                  className="rounded-lg border px-3 py-2 text-slate-900 w-40" />
                <label className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input type="checkbox" checked={tinhPhi} onChange={(e) => setTinhPhi(e.target.checked)} />
                  Thu phí khách
                </label>
              </div>
              <input value={moTa} onChange={(e) => setMoTa(e.target.value)}
                placeholder="Ghi chú (tuỳ chọn)"
                className="w-full rounded-lg border px-3 py-2 text-slate-900" />
            </>
          ) : (
            <>
              <div className="flex gap-2 flex-wrap">
                <input value={serialCu} onChange={(e) => setSerialCu(e.target.value)}
                  placeholder="Serial máy CŨ (thu hồi)"
                  className="rounded-lg border px-3 py-2 text-slate-900 font-mono text-sm flex-1 min-w-52" />
                <input value={serialMoi} onChange={(e) => setSerialMoi(e.target.value)}
                  placeholder="Serial máy MỚI (đổi cho khách)"
                  className="rounded-lg border px-3 py-2 text-slate-900 font-mono text-sm flex-1 min-w-52" />
              </div>
              <input value={moTa} onChange={(e) => setMoTa(e.target.value)}
                placeholder="Ghi chú (tuỳ chọn)"
                className="w-full rounded-lg border px-3 py-2 text-slate-900" />
            </>
          )}

          <div className="flex items-center gap-3">
            <button onClick={add} disabled={busy}
              className="rounded-lg bg-slate-900 text-white px-4 py-2 font-medium disabled:opacity-50">
              {busy ? 'Đang thêm…' : '+ Thêm mục'}
            </button>
            {err && <span className="text-sm text-red-600">{err}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
