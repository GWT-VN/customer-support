'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { taoKyThuat, suaKyThuat, xoaKyThuat, taoLichKyThuat, boiCanhKhach, capNhatDiaChiMay, lichTuanKyThuat, taoNghiKyThuat, xoaNghiKyThuat, type KyThuat, type ViecInput, type BoiCanhKhach, type TuanKyThuat } from '@/app/actions'
import { LOAI_VIEC_KT, NHAN_LOAI_VIEC } from '@/lib/danhSach'
import { TINH_VN } from '@/lib/tinh'
import { KhachPicker } from '@/components/KhachPicker'
import { vnDate } from '@/components/Badge'

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
  const [tuan, setTuan] = useState<TuanKyThuat | null>(null)

  async function loadTuan(kt: string, ng: string) {
    if (kt && ng) setTuan(await lichTuanKyThuat(kt, ng)); else setTuan(null)
  }
  async function baoNghi() {
    if (!ktId || !ngay) return
    const r = await taoNghiKyThuat(ktId, ngay); if (r.ok) loadTuan(ktId, ngay)
  }
  async function boNghi(id: string) {
    const r = await xoaNghiKyThuat(id); if (r.ok) loadTuan(ktId, ngay)
  }
  const [khachId, setKhachId] = useState('')
  const [diaChi, setDiaChi] = useState('')
  const [tinh, setTinh] = useState('')
  const [capMay, setCapMay] = useState(false)   // cập nhật địa chỉ mới cho máy của khách
  const [ghiChu, setGhiChu] = useState('')
  const [viec, setViec] = useState<ViecInput[]>([{ loai_viec: 'bao_tri', mo_ta: '', ref: '' }])
  const [ctx, setCtx] = useState<BoiCanhKhach | null>(null)

  async function chonKhach(id: string) {
    setKhachId(id); setCapMay(false)
    const c = await boiCanhKhach(id)
    setCtx(c)
    if (c.dia_chi) setDiaChi(c.dia_chi)   // địa chỉ: máy -> khách -> tự điền
    if (c.tinh) setTinh(c.tinh)
  }

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
    const r = await taoLichKyThuat({ kyThuatId: ktId, ngay, customerId: khachId || undefined, diaChi: diaChi || undefined, tinh: tinh || undefined, ghiChu: ghiChu || undefined, viec })
    if (!r.ok) { setBusy(false); setErr(r.error); return }
    // Khách chuyển địa chỉ mới -> cập nhật cho máy (có xác nhận).
    let themMsg = ''
    if (capMay && khachId && diaChi.trim()) {
      if (window.confirm(`Cập nhật địa chỉ "${diaChi.trim()}" cho MỌI máy đang lắp của khách này?`)) {
        const r2 = await capNhatDiaChiMay(khachId, diaChi)
        if (r2.ok) themMsg = ` Đã cập nhật địa chỉ ${r2.so} máy.`
      }
    }
    setBusy(false)
    setMsg('Đã tạo chuyến.' + themMsg); setKhachId(''); setCtx(null); setDiaChi(''); setTinh(''); setCapMay(false); setGhiChu(''); setViec([{ loai_viec: 'bao_tri', mo_ta: '', ref: '' }])
    if (ktId && ngay) loadTuan(ktId, ngay)
    router.refresh()
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
            <select value={ktId} onChange={(e) => { setKtId(e.target.value); loadTuan(e.target.value, ngay) }} className={`${oInput} mt-0.5`}>
              <option value="">— Chọn —</option>
              {dsKt.filter((k) => k.hoat_dong).map((k) => <option key={k.id} value={k.id}>{k.ten}{k.la_ctv ? ' (CTV)' : ''}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-600">Ngày<br />
            <input type="date" value={ngay} onChange={(e) => { setNgay(e.target.value); loadTuan(ktId, e.target.value) }} className={`${oInput} mt-0.5`} />
          </label>
          <label className="text-xs text-slate-600">Tỉnh/TP<br />
            <select value={tinh} onChange={(e) => setTinh(e.target.value)} className={`${oInput} mt-0.5`}>
              <option value="">— Chọn tỉnh —</option>
              {TINH_VN.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-600 flex-1 min-w-40">Địa chỉ (tự theo máy → khách; sửa được)<br />
            <input value={diaChi} onChange={(e) => setDiaChi(e.target.value)} className={`${oInput} mt-0.5 w-full`} />
          </label>
        </div>
        {tuan && ktId && (
          <div className="rounded-lg border bg-slate-50 p-2 text-xs">
            <p className="text-slate-600 mb-1">
              Lịch tuần của kỹ thuật ({vnDate(tuan.tu)} – {vnDate(tuan.den)}): {tuan.chuyen.length} chuyến · {tuan.nghi.length} ngày nghỉ
              <button onClick={baoNghi} className="text-amber-700 underline ml-2">Báo nghỉ ngày {vnDate(ngay)}</button>
            </p>
            {tuan.chuyen.length === 0 && tuan.nghi.length === 0 ? (
              <p className="text-slate-400">Trống — rảnh cả tuần.</p>
            ) : (
              <ul className="space-y-0.5">
                {tuan.nghi.map((n) => (
                  <li key={n.id} className="text-amber-700">🌙 {vnDate(n.ngay)}: nghỉ phép{n.ly_do ? ` (${n.ly_do})` : ''} <button onClick={() => boNghi(n.id)} className="text-slate-400 underline">bỏ</button></li>
                ))}
                {tuan.chuyen.map((c) => (
                  <li key={c.id} className="text-slate-600">📅 {vnDate(c.ngay)}: {c.ten_khach ?? c.dia_chi ?? 'chuyến'} · {c.viec.map((v) => NHAN_LOAI_VIEC[v.loai_viec] ?? v.loai_viec).join(', ')}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {khachId && diaChi.trim() && ctx?.dia_chi !== diaChi.trim() && (
          <label className="flex items-center gap-1.5 text-xs text-amber-700">
            <input type="checkbox" checked={capMay} onChange={(e) => setCapMay(e.target.checked)} />
            Khách chuyển địa chỉ mới — cập nhật địa chỉ này cho máy của khách (sẽ hỏi xác nhận)
          </label>
        )}
        <div>
          <p className="text-xs text-slate-600 mb-1">Khách (chọn để tự lấy địa chỉ + bộ/máy/ticket):</p>
          {khachId ? <p className="text-xs text-emerald-700">✓ đã chọn <button onClick={() => { setKhachId(''); setCtx(null) }} className="underline text-slate-500 ml-1">bỏ</button></p> : <KhachPicker onPick={(id) => chonKhach(id)} />}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-slate-600">Việc trong chuyến (1 chuyến nhiều việc):</p>
          {viec.map((v, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select value={v.loai_viec} onChange={(e) => setViecAt(i, { loai_viec: e.target.value, ref: '', mo_ta: '', so_tien: undefined })} className={oInput}>
                {LOAI_VIEC_KT.map((l) => <option key={l.v} value={l.v}>{l.nhan}</option>)}
              </select>
              {v.loai_viec === 'bao_tri' && ctx && ctx.plans.length > 0 ? (
                <select value={v.ref ?? ''} onChange={(e) => { const p = ctx.plans.find((x) => x.id === e.target.value); setViecAt(i, { ref: e.target.value, mo_ta: p?.nhan ?? '' }) }} className={`${oInput} flex-1 min-w-48`}>
                  <option value="">— Chọn bộ cần bảo trì —</option>
                  {ctx.plans.map((p) => <option key={p.id} value={p.id}>{p.nhan}</option>)}
                </select>
              ) : v.loai_viec === 'thay_loi' && ctx && ctx.machines.length > 0 ? (
                <>
                  <select value={v.ref ?? ''} onChange={(e) => setViecAt(i, { ref: e.target.value, mo_ta: '' })} className={oInput}>
                    <option value="">— Chọn máy —</option>
                    {ctx.machines.map((m) => <option key={m.serial} value={m.serial}>{m.nhan}{m.dia_chi ? ` — ${m.dia_chi}` : ''}</option>)}
                  </select>
                  {v.ref && (() => {
                    const loi = ctx.machines.find((m) => m.serial === v.ref)?.loi ?? []
                    return loi.length > 0 ? (
                      <select value={v.mo_ta ?? ''} onChange={(e) => setViecAt(i, { mo_ta: e.target.value })} className={`${oInput} flex-1 min-w-40`}>
                        <option value="">— Chọn lõi cần thay —</option>
                        {loi.map((l) => <option key={l.code} value={`${l.ten ?? l.code} (${l.code})`}>{l.ten ?? l.code} ({l.code})</option>)}
                      </select>
                    ) : (
                      <input value={v.mo_ta ?? ''} onChange={(e) => setViecAt(i, { mo_ta: e.target.value })} placeholder="Lõi cần thay (máy chưa có danh mục lõi)" className={`${oInput} flex-1 min-w-40`} />
                    )
                  })()}
                </>
              ) : v.loai_viec === 'ticket' && ctx && ctx.tickets.length > 0 ? (
                <select value={v.ref ?? ''} onChange={(e) => { const t = ctx.tickets.find((x) => x.code === e.target.value); setViecAt(i, { ref: e.target.value, mo_ta: t?.nhan ?? '' }) }} className={`${oInput} flex-1 min-w-48`}>
                  <option value="">— Chọn ticket —</option>
                  {ctx.tickets.map((t) => <option key={t.code} value={t.code}>{t.nhan}</option>)}
                </select>
              ) : v.loai_viec === 'thu_tien' ? (
                <>
                  <input type="number" value={v.so_tien ?? ''} onChange={(e) => setViecAt(i, { so_tien: Number(e.target.value) || undefined })} placeholder="Số tiền (VND)" className={`${oInput} w-36`} />
                  <input value={v.mo_ta ?? ''} onChange={(e) => setViecAt(i, { mo_ta: e.target.value })} placeholder="Nội dung thu (tuỳ chọn)" className={`${oInput} flex-1 min-w-40`} />
                </>
              ) : (
                <input value={v.mo_ta ?? ''} onChange={(e) => setViecAt(i, { mo_ta: e.target.value })}
                  placeholder={v.loai_viec === 'khac' ? 'Ghi cụ thể việc gì (bắt buộc)' : 'Mô tả (tuỳ chọn)'} className={`${oInput} flex-1 min-w-48`} />
              )}
              {viec.length > 1 && <button onClick={() => setViec((vs) => vs.filter((_, j) => j !== i))} className="text-red-500 text-sm">✕</button>}
            </div>
          ))}
          <button onClick={() => setViec((vs) => [...vs, { loai_viec: 'khac', mo_ta: '', ref: '' }])} className="text-xs text-sky-600 underline">+ thêm việc</button>
          {!khachId && <p className="text-[11px] text-amber-500">Chọn khách ở trên để hiện danh sách bộ/máy/ticket cho từng việc (không chọn vẫn nhập tay được).</p>}
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
