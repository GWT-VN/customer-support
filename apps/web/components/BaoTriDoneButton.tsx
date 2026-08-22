'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { markMaintenanceDone, unmarkMaintenanceDone, ghiKetQuaBaoTri, deXuatDoiLich, type KetQuaDo, type DoiLichMuc } from '@/app/actions'
import { XacNhanDoiLich } from '@/components/XacNhanDoiLich'
import { vnDate } from '@/components/Badge'

const HOM_NAY = () => new Date().toISOString().slice(0, 10)

/** Các cột số của KetQuaDo (trước/sau lọc). */
type SoField = 'tds_truoc' | 'tds_sau' | 'ph_truoc' | 'ph_sau' | 'do_cung_truoc' | 'do_cung_sau' | 'clo_truoc' | 'clo_sau'

/**
 * Ô số giữ NGUYÊN CHUỖI người gõ, chỉ đổi sang số lúc lưu.
 *
 * Trước đây parse ngay từng phím rồi render số trở lại: gõ "7." -> Number("7.")
 * = 7 -> ô thành "7", dấu chấm mất, nên không gõ nổi pH 7.5.
 */
const soHoacBo = (s: string | undefined): number | undefined => {
  const t = s?.trim()
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Đánh dấu 1 lượt bảo trì đã làm. 1 chạm = "đã bảo trì hôm nay".
 * "Kết quả đo" mở form nhập TDS/pH/độ cứng/Clo (trước-sau lọc) + ghi chú theo NGÀY THỰC;
 * lưu xong hệ tự DỜI các lượt sau tính từ ngày thực.
 */
export function BaoTriDoneButton({ visitId, completedAt }: { visitId: string; completedAt: string | null }) {
  const [open, setOpen] = useState(false)
  const [moKQ, setMoKQ] = useState(false)
  const [date, setDate] = useState(HOM_NAY())
  const [kq, setKq] = useState<KetQuaDo>({ ngay: HOM_NAY() })
  const [so, setSo] = useState<Partial<Record<SoField, string>>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  // Đề xuất dời lịch đang chờ CS trả lời. Giữ cả NGÀY vì phải tính lại theo đúng ngày đã ghi,
  // không phải hôm nay — CS hay ghi bù cho hôm trước.
  const [hoiDoi, setHoiDoi] = useState<{ ngay: string; muc: DoiLichMuc[] } | null>(null)
  const router = useRouter()

  /** Sau khi ghi xong: có gì để dời thì HỎI, không có thì báo xong luôn. */
  function sauKhiGhi(ngay: string, deXuat: DoiLichMuc[], nhanXong: string) {
    if (deXuat.length) { setHoiDoi({ ngay, muc: deXuat }); setMsg(null) }
    else { setHoiDoi(null); setMsg(nhanXong) }
    router.refresh()
  }

  async function ghi(ngay: string) {
    setBusy(true); setErr(null)
    const r = await markMaintenanceDone(visitId, ngay)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    setOpen(false)
    sauKhiGhi(ngay, r.deXuat, 'Đã đánh dấu xong.')
  }
  /**
   * Lượt ĐÃ xong rồi vẫn phải dời lại được: kỹ thuật ghi kết quả ngoài hiện trường thì
   * không được hỏi (CEO chốt CS mới xác nhận), và còn 22 hồ sơ di sản đợt import Asana
   * đang lệch chu kỳ. Tra lúc BẤM chứ không tra sẵn cho cả bảng — mỗi dòng một câu truy vấn
   * thì mở màn bảo trì là mấy chục lượt tra vô ích.
   */
  async function xemDoiLich() {
    if (!completedAt) return
    setBusy(true); setErr(null); setMsg(null)
    const ngayLam = completedAt.slice(0, 10)
    const muc = await deXuatDoiLich(visitId, ngayLam)
    setBusy(false)
    if (!muc.length) { setMsg('Các lượt sau đã đúng ngày, không cần dời.'); return }
    setHoiDoi({ ngay: ngayLam, muc })
  }

  async function boDanhDau() {
    setBusy(true); setErr(null)
    const r = await unmarkMaintenanceDone(visitId)
    setBusy(false)
    if (!r.ok) setErr(r.error); else router.refresh()
  }
  async function luuKQ() {
    setBusy(true); setErr(null); setMsg(null)
    const day: KetQuaDo = { ...kq }
    for (const k of Object.keys(so) as SoField[]) day[k] = soHoacBo(so[k])
    const r = await ghiKetQuaBaoTri(visitId, day)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    setMoKQ(false)
    sauKhiGhi(day.ngay, r.deXuat, 'Đã lưu kết quả.')
  }

  const oNum = 'w-16 rounded border px-1.5 py-0.5 text-xs'
  if (moKQ) {
    const o = (k: SoField, ph: string) => (
      <input inputMode="decimal" placeholder={ph} value={so[k] ?? ''}
        onChange={(e) => setSo((c) => ({ ...c, [k]: e.target.value }))} className={oNum} />
    )
    const hang = (nhan: string, kt: SoField, ks: SoField) => (
      <div className="flex items-center gap-1.5">
        <span className="w-20 text-slate-600">{nhan}</span>
        {o(kt, 'trước')}
        <span className="text-slate-300">→</span>
        {o(ks, 'sau')}
      </div>
    )
    return (
      <div className="bg-slate-50 rounded-lg border p-2.5 space-y-1.5 text-xs min-w-64">
        <label className="flex items-center gap-2 text-slate-600">Ngày làm thực tế
          <input type="date" max={HOM_NAY()} value={kq.ngay} onChange={(e) => setKq((c) => ({ ...c, ngay: e.target.value }))} className="rounded border px-2 py-1" />
        </label>
        <p className="text-slate-500">Chỉ tiêu nước (trước lọc → sau lọc):</p>
        {hang('TDS (ppm)', 'tds_truoc', 'tds_sau')}
        {hang('pH', 'ph_truoc', 'ph_sau')}
        {hang('Độ cứng', 'do_cung_truoc', 'do_cung_sau')}
        {hang('Clo dư', 'clo_truoc', 'clo_sau')}
        <input value={kq.ghi_chu ?? ''} onChange={(e) => setKq((c) => ({ ...c, ghi_chu: e.target.value }))} placeholder="Ghi chú khác" className="w-full rounded border px-2 py-1" />
        <div className="flex items-center gap-2 pt-0.5">
          <button onClick={luuKQ} disabled={busy} className="rounded-lg bg-emerald-600 text-white px-3 py-1 font-medium disabled:opacity-50">{busy ? 'Đang lưu…' : 'Lưu kết quả'}</button>
          <button onClick={() => setMoKQ(false)} className="text-slate-500 underline">Huỷ</button>
          {err && <span className="text-red-600">{err}</span>}
        </div>
      </div>
    )
  }

  if (completedAt) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-emerald-700 whitespace-nowrap">✓ {vnDate(completedAt.slice(0, 10))}</span>
        <button onClick={() => { setMoKQ(true); setKq({ ngay: completedAt.slice(0, 10) }); setSo({}) }} className="text-[10px] text-sky-600 underline">kết quả</button>
        <button onClick={xemDoiLich} disabled={busy} className="text-[10px] text-amber-700 underline">dời lịch sau</button>
        <button onClick={boDanhDau} disabled={busy} className="text-[10px] text-slate-400 hover:text-red-600 underline">bỏ</button>
        {msg && <span className="text-[10px] text-emerald-700">{msg}</span>}
        {err && <span className="text-xs text-red-600">{err}</span>}
        {hoiDoi && (
          <XacNhanDoiLich visitId={visitId} ngay={hoiDoi.ngay} deXuat={hoiDoi.muc}
            onXong={(kq) => { setHoiDoi(null); setMsg(kq === 'da_doi' ? 'Đã dời lịch các lượt sau.' : 'Đã đánh dấu xong — lịch giữ nguyên.') }} />
        )}
      </div>
    )
  }

  if (!open) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <button onClick={() => ghi(HOM_NAY())} disabled={busy} className="rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50 px-2.5 py-1 text-xs">{busy ? '…' : 'Đã bảo trì hôm nay'}</button>
        <button onClick={() => setOpen(true)} className="text-xs text-slate-500 hover:text-slate-900 underline">ngày khác</button>
        <button onClick={() => { setMoKQ(true); setKq({ ngay: HOM_NAY() }); setSo({}) }} className="text-xs text-sky-600 underline">+ kết quả đo</button>
        {msg && <span className="text-[10px] text-emerald-700">{msg}</span>}
        {err && <span className="text-xs text-red-600">{err}</span>}
        {hoiDoi && (
          <XacNhanDoiLich visitId={visitId} ngay={hoiDoi.ngay} deXuat={hoiDoi.muc}
            onXong={(kq) => { setHoiDoi(null); setMsg(kq === 'da_doi' ? 'Đã dời lịch các lượt sau.' : 'Đã đánh dấu xong — lịch giữ nguyên.') }} />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-end gap-2 bg-slate-50 rounded-lg p-2">
      <label className="block">
        <span className="text-xs text-slate-600">Ngày bảo trì</span>
        <input type="date" value={date} max={HOM_NAY()} onChange={(e) => setDate(e.target.value)} className="mt-0.5 block rounded-lg border px-2 py-1 text-sm" />
      </label>
      <button onClick={() => ghi(date)} disabled={busy} className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50">{busy ? 'Đang ghi…' : 'Ghi'}</button>
      <button onClick={() => setOpen(false)} className="text-xs text-slate-500 underline">Huỷ</button>
      {err && <p className="text-xs text-red-600 w-full">{err}</p>}
    </div>
  )
}
