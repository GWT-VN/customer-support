'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { taoTrangThai, suaTrangThai, xoaTrangThai, type TrangThai } from '@/app/actions'
import { MAU_TRANG_THAI, MAU_TOKENS } from '@/lib/danhSach'

type Form = { nhan: string; mau: string; thu_tu: string; cho_dat_tay: boolean; hoat_dong: boolean }
const RONG: Form = { nhan: '', mau: 'slate', thu_tu: '100', cho_dat_tay: true, hoat_dong: true }

/**
 * Cấu hình danh mục trạng thái máy (admin). Thêm/sửa/đổi màu/thứ tự/bật-tắt/xoá.
 * Trạng thái HỆ THỐNG (ton_kho/da_lap) chỉ đổi được nhãn/màu, không xoá.
 */
export function TrangThaiCauHinh({ ds }: { ds: TrangThai[] }) {
  const router = useRouter()
  const [sua, setSua] = useState<string | null>(null)  // code đang sửa, hoặc '__moi__'
  const [maMoi, setMaMoi] = useState('')
  const [form, setForm] = useState<Form>(RONG)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function moSua(t: TrangThai) {
    setSua(t.code); setErr(null)
    setForm({ nhan: t.nhan, mau: t.mau, thu_tu: String(t.thu_tu), cho_dat_tay: t.cho_dat_tay, hoat_dong: t.hoat_dong })
  }
  function moThem() {
    setSua('__moi__'); setErr(null); setMaMoi(''); setForm(RONG)
  }

  async function luu() {
    setBusy(true); setErr(null)
    const input = { nhan: form.nhan, mau: form.mau, thu_tu: Number(form.thu_tu) || 100, cho_dat_tay: form.cho_dat_tay, hoat_dong: form.hoat_dong }
    const r = sua === '__moi__' ? await taoTrangThai(maMoi, input) : await suaTrangThai(sua!, input)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    setSua(null); router.refresh()
  }
  async function xoa(code: string, nhan: string) {
    if (!window.confirm(`Xoá trạng thái "${nhan}"?`)) return
    setBusy(true); setErr(null)
    const r = await xoaTrangThai(code)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    router.refresh()
  }

  const oInput = 'rounded border px-2 py-1 text-sm text-slate-900 bg-white'
  const capForm = (
    <div className="flex flex-wrap items-center gap-2 bg-slate-50 rounded-lg p-2">
      {sua === '__moi__' && (
        <input value={maMoi} onChange={(e) => setMaMoi(e.target.value)} placeholder="mã (a-z_)" className={`${oInput} font-mono w-32`} />
      )}
      <input value={form.nhan} onChange={(e) => setForm({ ...form, nhan: e.target.value })} placeholder="Tên hiển thị" className={`${oInput} w-52`} />
      <select value={form.mau} onChange={(e) => setForm({ ...form, mau: e.target.value })} className={oInput}>
        {MAU_TOKENS.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <span className={`px-2 py-0.5 rounded-full text-xs ${MAU_TRANG_THAI[form.mau] ?? MAU_TRANG_THAI.slate}`}>{form.nhan || 'xem trước'}</span>
      <input value={form.thu_tu} onChange={(e) => setForm({ ...form, thu_tu: e.target.value })} inputMode="numeric" className={`${oInput} w-16`} title="Thứ tự" />
      <label className="flex items-center gap-1 text-xs text-slate-700"><input type="checkbox" checked={form.cho_dat_tay} onChange={(e) => setForm({ ...form, cho_dat_tay: e.target.checked })} />đặt tay</label>
      <label className="flex items-center gap-1 text-xs text-slate-700"><input type="checkbox" checked={form.hoat_dong} onChange={(e) => setForm({ ...form, hoat_dong: e.target.checked })} />dùng</label>
      <button disabled={busy} onClick={luu} className="rounded-lg bg-slate-900 text-white px-3 py-1 text-sm disabled:opacity-50">Lưu</button>
      <button disabled={busy} onClick={() => setSua(null)} className="rounded-lg border px-3 py-1 text-sm">Huỷ</button>
    </div>
  )

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-medium text-slate-900">Cấu hình trạng thái máy</h2>
          <p className="text-xs text-slate-500">Thêm/sửa/đổi màu/thứ tự. Trạng thái hệ thống (Tồn kho, Đã lắp) không xoá được.</p>
        </div>
        {sua !== '__moi__' && (
          <button onClick={moThem} className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm font-medium">+ Thêm trạng thái</button>
        )}
      </div>

      {sua === '__moi__' && capForm}
      {err && sua === '__moi__' && <p className="text-sm text-red-600">{err}</p>}

      <ul className="divide-y border rounded-lg">
        {ds.map((t) => (
          <li key={t.code} className="px-3 py-2">
            {sua === t.code ? (
              <div className="space-y-1">
                {capForm}
                {err && <p className="text-sm text-red-600">{err}</p>}
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-xs ${MAU_TRANG_THAI[t.mau] ?? MAU_TRANG_THAI.slate}`}>{t.nhan}</span>
                <span className="font-mono text-[11px] text-slate-400">{t.code}</span>
                <span className="text-[11px] text-slate-400">#{t.thu_tu}</span>
                {t.he_thong && <span className="text-[11px] text-slate-400">hệ thống</span>}
                {t.cho_dat_tay && <span className="text-[11px] text-sky-600">đặt tay</span>}
                {!t.hoat_dong && <span className="text-[11px] text-red-500">ngừng dùng</span>}
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={() => moSua(t)} className="text-sm text-slate-600 underline">Sửa</button>
                  {!t.he_thong && <button onClick={() => xoa(t.code, t.nhan)} className="text-sm text-red-600 underline">Xoá</button>}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
