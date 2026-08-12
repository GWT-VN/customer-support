'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { taoKyThuat, suaKyThuat, xoaKyThuat, taoLichKyThuat, type KyThuat, type ViecInput } from '@/app/actions'
import { LOAI_VIEC_KT } from '@/lib/danhSach'
import { KhachPicker } from '@/components/KhachPicker'

const HOM_NAY = () => new Date().toISOString().slice(0, 10)

/**
 * Quản lý kỹ thuật + GÁN CHUYẾN ĐI (1 chuyến nhiều việc).
 * Kỹ thuật gồm nhân viên + cộng tác viên. Việc "Khác" bắt buộc ghi cụ thể.
 */
export function KyThuatBang({ dsKt }: { dsKt: KyThuat[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  // thêm kỹ thuật
  const [ten, setTen] = useState('')
  const [sdt, setSdt] = useState('')
  const [ctv, setCtv] = useState(false)

  // tạo chuyến
  const [ktId, setKtId] = useState('')
  const [ngay, setNgay] = useState(HOM_NAY())
  const [khachId, setKhachId] = useState('')
  const [diaChi, setDiaChi] = useState('')
  const [ghiChu, setGhiChu] = useState('')
  const [viec, setViec] = useState<ViecInput[]>([{ loai_viec: 'bao_tri', mo_ta: '', ref: '' }])

  async function themKt() {
    if (!ten.trim()) return
    setBusy(true); setErr(null); setMsg(null)
    const r = await taoKyThuat({ ten, sdt: sdt || undefined, la_ctv: ctv })
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    setTen(''); setSdt(''); setCtv(false); setMsg('Đã thêm kỹ thuật.'); router.refresh()
  }
  async function toggle(k: KyThuat) {
    setBusy(true); setErr(null)
    const r = await suaKyThuat(k.id, { ten: k.ten, sdt: k.sdt ?? undefined, vung: k.vung ?? undefined, email: k.email ?? undefined, la_ctv: k.la_ctv, hoat_dong: !k.hoat_dong })
    setBusy(false); if (!r.ok) setErr(r.error); else router.refresh()
  }
  async function xoa(k: KyThuat) {
    if (!window.confirm(`Xoá kỹ thuật "${k.ten}"?`)) return
    setBusy(true); setErr(null)
    const r = await xoaKyThuat(k.id); setBusy(false); if (!r.ok) setErr(r.error); else router.refresh()
  }

  function setViecAt(i: number, patch: Partial<ViecInput>) {
    setViec((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)))
  }
  async function taoChuyen() {
    setBusy(true); setErr(null); setMsg(null)
    const r = await taoLichKyThuat({ kyThuatId: ktId, ngay, customerId: khachId || undefined, diaChi: diaChi || undefined, ghiChu: ghiChu || undefined, viec })
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    setMsg('Đã tạo chuyến.'); setKhachId(''); setDiaChi(''); setGhiChu(''); setViec([{ loai_viec: 'bao_tri', mo_ta: '', ref: '' }]); router.refresh()
  }

  const oInput = 'rounded border px-2 py-1 text-sm text-slate-900 bg-white'

  return (
    <div className="space-y-4">
      {(msg || err) && <p className={`text-sm ${err ? 'text-red-600' : 'text-emerald-700'}`}>{err ?? msg}</p>}

      {/* Tạo chuyến */}
      <section className="bg-white rounded-xl border p-4 space-y-3">
        <h2 className="font-medium text-slate-900">Gán chuyến đi cho kỹ thuật</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-600">Kỹ thuật<br />
            <select value={ktId} onChange={(e) => setKtId(e.target.value)} className={`${oInput} mt-0.5`}>
              <option value="">— Chọn —</option>
              {dsKt.filter((k) => k.hoat_dong).map((k) => <option key={k.id} value={k.id}>{k.ten}{k.la_ctv ? ' (CTV)' : ''}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-600">Ngày<br />
            <input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} className={`${oInput} mt-0.5`} />
          </label>
          <label className="text-xs text-slate-600 flex-1 min-w-40">Địa chỉ (tuỳ chọn)<br />
            <input value={diaChi} onChange={(e) => setDiaChi(e.target.value)} className={`${oInput} mt-0.5 w-full`} />
          </label>
        </div>
        <div>
          <p className="text-xs text-slate-600 mb-1">Khách (tuỳ chọn):</p>
          {khachId ? <p className="text-xs text-emerald-700">✓ đã chọn <button onClick={() => setKhachId('')} className="underline text-slate-500 ml-1">bỏ</button></p> : <KhachPicker onPick={(id) => setKhachId(id)} />}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-slate-600">Việc trong chuyến (1 chuyến nhiều việc):</p>
          {viec.map((v, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select value={v.loai_viec} onChange={(e) => setViecAt(i, { loai_viec: e.target.value })} className={oInput}>
                {LOAI_VIEC_KT.map((l) => <option key={l.v} value={l.v}>{l.nhan}</option>)}
              </select>
              <input value={v.mo_ta ?? ''} onChange={(e) => setViecAt(i, { mo_ta: e.target.value })}
                placeholder={v.loai_viec === 'khac' ? 'Ghi cụ thể việc gì (bắt buộc)' : 'Mô tả / ref (serial, mã ticket…)'}
                className={`${oInput} flex-1 min-w-48`} />
              {viec.length > 1 && <button onClick={() => setViec((vs) => vs.filter((_, j) => j !== i))} className="text-red-500 text-sm">✕</button>}
            </div>
          ))}
          <button onClick={() => setViec((vs) => [...vs, { loai_viec: 'khac', mo_ta: '', ref: '' }])} className="text-xs text-sky-600 underline">+ thêm việc</button>
        </div>

        <div className="flex items-center gap-2">
          <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Ghi chú chuyến (tuỳ chọn)" className={`${oInput} flex-1`} />
          <button disabled={busy || !ktId} onClick={taoChuyen} className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm disabled:opacity-50">Tạo chuyến</button>
        </div>
      </section>

      {/* Quản lý kỹ thuật */}
      <section className="bg-white rounded-xl border p-4 space-y-3">
        <h2 className="font-medium text-slate-900">Kỹ thuật ({dsKt.length})</h2>
        <div className="flex flex-wrap items-end gap-2">
          <input value={ten} onChange={(e) => setTen(e.target.value)} placeholder="Tên kỹ thuật" className={oInput} />
          <input value={sdt} onChange={(e) => setSdt(e.target.value)} placeholder="SĐT" className={`${oInput} w-32`} />
          <label className="flex items-center gap-1 text-xs text-slate-700"><input type="checkbox" checked={ctv} onChange={(e) => setCtv(e.target.checked)} />Cộng tác viên</label>
          <button disabled={busy || !ten.trim()} onClick={themKt} className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm disabled:opacity-50">+ Thêm</button>
        </div>
        <ul className="divide-y border rounded-lg">
          {dsKt.map((k) => (
            <li key={k.id} className="px-3 py-2 flex items-center justify-between gap-3">
              <span className="text-sm">
                <span className={k.hoat_dong ? 'text-slate-900' : 'text-slate-400 line-through'}>{k.ten}</span>
                {k.la_ctv && <span className="text-[11px] text-violet-600 ml-1">CTV</span>}
                {k.sdt && <span className="text-xs text-slate-400 font-mono ml-1">· {k.sdt}</span>}
              </span>
              <span className="flex items-center gap-2">
                <button onClick={() => toggle(k)} className="text-xs text-slate-500 underline">{k.hoat_dong ? 'ngừng' : 'bật'}</button>
                <button onClick={() => xoa(k)} className="text-xs text-red-600 underline">xoá</button>
              </span>
            </li>
          ))}
          {dsKt.length === 0 && <li className="px-3 py-4 text-sm text-slate-400">Chưa có kỹ thuật. Thêm ở trên.</li>}
        </ul>
      </section>
    </div>
  )
}
