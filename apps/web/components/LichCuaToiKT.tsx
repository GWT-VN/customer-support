'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { datTrangThaiLichKT, ghiKetQuaBaoTri, type KetQuaDo, type LichKyThuatRow, type LoaiMay } from '@/app/actions'
import { NHAN_LOAI_VIEC } from '@/lib/danhSach'
import { vnDate } from '@/components/Badge'
import { AnhViec } from '@/components/AnhViec'

const HOM_NAY = () => new Date().toISOString().slice(0, 10)

const MAU_TT: Record<string, string> = {
  hen: 'bg-sky-100 text-sky-800', xong: 'bg-emerald-100 text-emerald-800', huy: 'bg-slate-100 text-slate-500 line-through',
}
const NHAN_TT: Record<string, string> = { hen: 'Đã hẹn', xong: 'Xong', huy: 'Huỷ' }

// Các cột số của KetQuaDo (trước/sau lọc) — tách riêng để index động không bị suy về never.
type SoField = 'tds_truoc' | 'tds_sau' | 'ph_truoc' | 'ph_sau' | 'do_cung_truoc' | 'do_cung_sau' | 'clo_truoc' | 'clo_sau'

// Chỉ tiêu đo. t = cột trước lọc (đầu vào, dùng chung 1 điểm), s = cột sau lọc (riêng từng máy).
type ChiTieu = { key: string; nhan: string; t: SoField; s: SoField }
const TDS: ChiTieu = { key: 'tds', nhan: 'TDS (ppm)', t: 'tds_truoc', s: 'tds_sau' }
const PH: ChiTieu = { key: 'ph', nhan: 'pH', t: 'ph_truoc', s: 'ph_sau' }
const DO_CUNG: ChiTieu = { key: 'do_cung', nhan: 'Độ cứng', t: 'do_cung_truoc', s: 'do_cung_sau' }
const CLO: ChiTieu = { key: 'clo', nhan: 'Clo dư', t: 'clo_truoc', s: 'clo_sau' }

// POU (máy uống) đo TDS + pH; POE (lọc tổng) đo độ cứng + Clo; không rõ -> đủ 4.
function chiTieuTheoLoai(mmloai: LoaiMay): ChiTieu[] {
  if (mmloai === 'POU') return [TDS, PH]
  if (mmloai === 'POE') return [DO_CUNG, CLO]
  return [TDS, PH, DO_CUNG, CLO]
}

/**
 * Giữ NGUYÊN CHUỖI người gõ, không parse ngay từng phím.
 *
 * Trước đây map này là `number`: gõ "7." -> Number("7.") = 7 -> ô render lại
 * thành "7", dấu chấm bay mất nên KHÔNG TÀI NÀO gõ được pH 7.5. Chỉ đổi sang
 * số ở bước lưu.
 */
type SoMap = Partial<Record<SoField, string>>

/** Chuỗi ô nhập -> số gửi lên server. Rỗng/dở dang ("7.", "-", ".") -> bỏ qua. */
const soHoacBo = (s: string | undefined): number | undefined => {
  const t = s?.trim()
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

/** Đo nước cho 1 việc bảo trì. "Trước lọc" dùng chung `truoc` cả chuyến; "sau lọc" riêng máy này. */
function DoNuocViec({
  visitId, mmloai, truoc, setTruoc,
}: {
  visitId: string; mmloai: LoaiMay; truoc: SoMap; setTruoc: (f: (c: SoMap) => SoMap) => void
}) {
  const router = useRouter()
  const [mo, setMo] = useState(false)
  const [ngay, setNgay] = useState(HOM_NAY())
  const [sau, setSau] = useState<SoMap>({})
  const [ghiChu, setGhiChu] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const ct = chiTieuTheoLoai(mmloai)

  async function luu() {
    setBusy(true); setErr(null); setMsg(null)
    const kq: KetQuaDo = { ngay, ghi_chu: ghiChu || undefined }
    for (const c of ct) { kq[c.t] = soHoacBo(truoc[c.t]); kq[c.s] = soHoacBo(sau[c.s]) }
    const r = await ghiKetQuaBaoTri(visitId, kq)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    // CỐ Ý không hỏi kỹ thuật có dời lịch không: CEO chốt 21/08 là **CS** xác nhận rồi mới đổi.
    // Kỹ thuật đang ở nhà khách, không nắm được lịch hẹn miệng của các lượt sau. Chỉ báo cho
    // biết lịch chưa đụng tới, để không ai tưởng hệ thống đã tự dời.
    setMsg(r.deXuat.length
      ? `Đã lưu kết quả đo. ${r.deXuat.length} lượt sau lệch ngày — CS sẽ xác nhận dời.`
      : 'Đã lưu kết quả đo.')
    router.refresh()
  }

  if (!mo) {
    return (
      <button onClick={() => setMo(true)} className="text-xs text-sky-600 underline">
        + Ghi kết quả đo{mmloai ? ` (${mmloai})` : ''}
      </button>
    )
  }

  const oNum = 'w-20 rounded border px-1.5 py-0.5 text-xs'
  return (
    <div className="bg-white rounded-lg border p-2.5 space-y-1.5 text-xs">
      <label className="flex items-center gap-2 text-slate-600">Ngày làm thực tế
        <input type="date" max={HOM_NAY()} value={ngay} onChange={(e) => setNgay(e.target.value)} className="rounded border px-2 py-1" />
      </label>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-x-2 gap-y-1 items-center">
        <span />
        <span className="text-slate-400 text-[10px]">trước lọc (đầu vào)</span>
        <span className="text-slate-400 text-[10px]">sau lọc (máy này)</span>
        {ct.map((c) => (
          <div key={c.key} className="contents">
            <span className="text-slate-600">{c.nhan}</span>
            <input inputMode="decimal" value={truoc[c.t] ?? ''} placeholder="chung điểm"
              onChange={(e) => setTruoc((cur) => ({ ...cur, [c.t]: e.target.value }))} className={oNum} />
            <input inputMode="decimal" value={sau[c.s] ?? ''} placeholder="sau"
              onChange={(e) => setSau((cur) => ({ ...cur, [c.s]: e.target.value }))} className={oNum} />
          </div>
        ))}
      </div>
      {mmloai === null && <p className="text-[10px] text-slate-400">Không rõ loại máy — hiện đủ 4 chỉ tiêu.</p>}
      <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Ghi chú khác" className="w-full rounded border px-2 py-1" />
      <div className="flex items-center gap-2 pt-0.5">
        <button onClick={luu} disabled={busy} className="rounded-lg bg-emerald-600 text-white px-3 py-1 font-medium disabled:opacity-50">{busy ? 'Đang lưu…' : 'Lưu kết quả'}</button>
        <button onClick={() => setMo(false)} className="text-slate-500 underline">Đóng</button>
        {msg && <span className="text-emerald-700">{msg}</span>}
        {err && <span className="text-red-600">{err}</span>}
      </div>
    </div>
  )
}

/** 1 chuyến của kỹ thuật: các việc + đo nước (chia sẻ chỉ số đầu vào giữa các máy cùng điểm). */
function TripCard({ r, busy, hoanThanh, moLai }: {
  r: LichKyThuatRow; busy: string | null; hoanThanh: (id: string) => void; moLai: (id: string) => void
}) {
  // "Trước lọc" = nước nguồn của điểm này -> dùng chung cho mọi máy trong chuyến.
  const [truoc, setTruoc] = useState<SoMap>({})

  return (
    <li className="bg-white rounded-xl border p-4">
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
              {v.loai_viec === 'bao_tri' && v.mmloai && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{v.mmloai === 'POU' ? 'Máy uống (POU)' : 'Lọc tổng (POE)'}</span>}
              {v.mo_ta && <span className="text-slate-700">{v.mo_ta}</span>}
              {v.so_tien ? <span className="text-amber-700 font-medium">{v.so_tien.toLocaleString('vi-VN')}đ</span> : null}
              {v.loai_viec === 'thay_loi' && v.ref && <Link href={`/may/${encodeURIComponent(v.ref)}`} prefetch={false} className="text-xs text-sky-600 underline">máy {v.ref}</Link>}
              {v.loai_viec === 'ticket' && v.ref && <Link href={`/ticket/${encodeURIComponent(v.ref)}`} prefetch={false} className="text-xs text-sky-600 underline">ticket {v.ref}</Link>}
            </div>
            {v.loai_viec === 'bao_tri' && v.ref && (
              <div className="mt-1.5">
                <DoNuocViec visitId={v.ref} mmloai={v.mmloai ?? null} truoc={truoc} setTruoc={setTruoc} />
              </div>
            )}
          </li>
        ))}
        {r.viec.length === 0 && <li className="text-xs text-slate-400">Chuyến chưa gán việc cụ thể.</li>}
      </ul>

      <div className="mt-2.5">
        <AnhViec chuyenId={r.id} />
      </div>

      {r.ghi_chu && <p className="text-[11px] text-slate-400 mt-2">Ghi chú: {r.ghi_chu}</p>}
    </li>
  )
}

/**
 * Màn hình KỸ THUẬT tự xem: chỉ chuyến của mình. Hoàn thành chuyến (cascade bảo trì/
 * thay lõi/ticket) + ghi kết quả đo theo loại máy. Nhiều máy cùng điểm chia sẻ chỉ số
 * đầu vào (trước lọc), chỉ khác chỉ số sau lọc. Có link tra cứu khách/máy/ticket.
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
    // Ca chuyến ĐÃ xong nhưng vài việc ăn theo không cập nhật được: vẫn phải tải lại, nếu
    // không màn hình còn hiện nút "Hoàn thành chuyến" trong khi chuyến đã xong thật.
    if (!r.ok) { setErr(r.error); router.refresh(); return }
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
              <TripCard key={r.id} r={r} busy={busy} hoanThanh={hoanThanh} moLai={moLai} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
