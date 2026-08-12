'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  datTrangThaiSerial, doiMayChoKhach, doiKhachMay, doiSerialMay, xoaMayDaLap,
  serialsTheoMay, type SuDungSerial, type SerialKho, type TrangThai,
} from '@/app/actions'
import { MAU_TRANG_THAI } from '@/lib/danhSach'
import { KhachPicker } from '@/components/KhachPicker'
import { vnDateTime } from '@/components/TicketBadge'

type KetQua = { ok: true; applied?: boolean; ma_moi?: string } | { ok: false; error: string }
type Panel = '' | 'doi_may' | 'doi_serial' | 'doi_khach' | 'go'

/**
 * MỘT chỗ quản lý máy: trạng thái + nhật ký + các thao tác — gom gọn, nhãn rõ.
 *  · Máy đang ở khách: Đổi máy (thay máy lỗi) · Đổi serial (gõ nhầm) · Đổi khách · Gỡ về kho.
 *  · Máy ở kho: đặt trạng thái (danh mục cấu hình được) + BẮT BUỘC mô tả hiện trạng máy.
 * Danh mục trạng thái (`ds`) do trang truyền vào từ bảng serial_trang_thai.
 */
export function QuanLyMay({
  serial, internalCode, trangThai, suKien, dangLap, laAdmin, ds,
}: {
  serial: string; internalCode: string | null; trangThai: string | null
  suKien: SuDungSerial[]; dangLap: boolean; laAdmin: boolean; ds: TrangThai[]
}) {
  const router = useRouter()
  const [panel, setPanel] = useState<Panel>('')
  const [dsMoi, setDsMoi] = useState<SerialKho[]>([])
  const [serialMoi, setSerialMoi] = useState('')
  const [den, setDen] = useState('')
  const [ghiChu, setGhiChu] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const mapTT = new Map(ds.map((t) => [t.code, t]))
  const nhan = (code: string | null | undefined) => (code ? mapTT.get(code)?.nhan ?? code : '—')
  const mauClass = (code: string | null | undefined) =>
    MAU_TRANG_THAI[mapTT.get(code ?? '')?.mau ?? 'slate'] ?? MAU_TRANG_THAI.slate
  const datTayList = ds.filter((t) => t.cho_dat_tay && t.hoat_dong && t.code !== trangThai)

  function mo(p: Panel) {
    setPanel(p); setErr(null); setMsg(null); setSerialMoi('')
    if ((p === 'doi_may' || p === 'doi_serial') && internalCode) {
      serialsTheoMay(internalCode).then((r) => setDsMoi(r.filter((s) => s.serial !== serial)))
    }
  }
  async function chay(fn: () => Promise<KetQua>, confirmMsg: string, okMsg: string) {
    if (!window.confirm(confirmMsg)) return
    setBusy(true); setErr(null); setMsg(null)
    const r = await fn()
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    setMsg('applied' in r && r.applied === false ? 'Đã gửi chờ admin duyệt.' : okMsg)
    setPanel(''); setGhiChu(''); router.refresh()
  }

  const nut = 'rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50'
  const oSerial = (
    <select value={serialMoi} onChange={(e) => setSerialMoi(e.target.value)}
      className="rounded-lg border px-3 py-1.5 text-sm bg-white font-mono text-slate-900">
      <option value="">— Chọn serial (tồn kho, cùng loại) —</option>
      {dsMoi.map((s) => <option key={s.serial} value={s.serial}>{s.serial}</option>)}
    </select>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Trạng thái:</span>
        <span className={`px-2 py-0.5 rounded-full text-xs ${mauClass(trangThai)}`}>{nhan(trangThai)}</span>
      </div>

      {laAdmin && dangLap && (
        <div className="rounded-lg border p-3 space-y-2 bg-slate-50">
          <p className="text-xs font-medium text-slate-600">Máy đang ở khách — thao tác:</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => mo(panel === 'doi_may' ? '' : 'doi_may')} className={`${nut} border-slate-300 text-slate-800`}>Đổi máy cho khách (máy lỗi)</button>
            <button onClick={() => mo(panel === 'doi_serial' ? '' : 'doi_serial')} className={`${nut} text-slate-700`}>Sửa serial gõ nhầm</button>
            <button onClick={() => mo(panel === 'doi_khach' ? '' : 'doi_khach')} className={`${nut} text-slate-700`}>Đổi khách</button>
            <button onClick={() => mo(panel === 'go' ? '' : 'go')} className={`${nut} border-red-200 text-red-600`}>Gỡ khỏi khách (về kho)</button>
          </div>

          {panel === 'doi_may' && (
            <div className="rounded-lg border bg-white p-2.5 space-y-2">
              <p className="text-xs text-slate-500">Thay máy MỚI cho khách: máy này về <strong>Thu hồi bảo hành</strong>, máy mới nối tiếp <strong>bảo hành + khách cũ</strong>.</p>
              <div className="flex flex-wrap items-center gap-2">
                {oSerial}
                <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Lý do (tuỳ chọn)" className="rounded-lg border px-3 py-1.5 text-sm text-slate-900" />
                <button disabled={busy || !serialMoi} onClick={() => chay(() => doiMayChoKhach(serial, serialMoi, ghiChu || undefined), `Đổi máy ${serial} → ${serialMoi} cho khách?`, 'Đã đổi máy.')} className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm disabled:opacity-50">Đổi máy</button>
              </div>
            </div>
          )}
          {panel === 'doi_serial' && (
            <div className="rounded-lg border bg-white p-2.5 space-y-2">
              <p className="text-xs text-slate-500">Chỉ SỬA serial gõ sai (giữ khách + BH): serial cũ về <strong>tồn kho</strong>, serial đúng thành <strong>đã lắp</strong>.</p>
              <div className="flex flex-wrap items-center gap-2">
                {oSerial}
                <button disabled={busy || !serialMoi} onClick={() => chay(() => doiSerialMay(serial, serialMoi), `Sửa serial ${serial} → ${serialMoi} (giữ khách)?`, 'Đã sửa serial.')} className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm disabled:opacity-50">Sửa</button>
              </div>
            </div>
          )}
          {panel === 'doi_khach' && (
            <div className="rounded-lg border bg-white p-2.5 space-y-2">
              <p className="text-xs text-slate-500">Cùng serial, gắn sang khách khác.</p>
              <KhachPicker onPick={(id) => chay(() => doiKhachMay(serial, id), `Đổi khách cho serial ${serial}?`, 'Đã đổi khách.')} />
            </div>
          )}
          {panel === 'go' && (
            <div className="rounded-lg border border-red-200 bg-white p-2.5 space-y-2">
              <p className="text-xs text-slate-500">Chỉ <strong>bỏ gán khách</strong> (KHÔNG xoá khách); serial về <strong>tồn kho</strong>, gỡ BH + lịch lõi của máy này.</p>
              <button disabled={busy} onClick={() => chay(() => xoaMayDaLap(serial), `Gỡ máy ${serial} khỏi khách, trả serial về kho?`, 'Đã gỡ về kho.')} className="rounded-lg border border-red-200 text-red-600 px-3 py-1.5 text-sm hover:bg-red-50 disabled:opacity-50">Gỡ về kho</button>
            </div>
          )}
        </div>
      )}

      {laAdmin && !dangLap && (
        <div className="rounded-lg border p-3 space-y-2 bg-slate-50">
          <p className="text-xs font-medium text-slate-600">Máy ở kho — đổi trạng thái (bắt buộc mô tả hiện trạng máy):</p>
          <div className="flex flex-wrap items-center gap-2">
            <select value={den} onChange={(e) => setDen(e.target.value)} className="rounded-lg border px-3 py-1.5 text-sm bg-white text-slate-900">
              <option value="">— Chọn trạng thái —</option>
              {datTayList.map((t) => <option key={t.code} value={t.code}>{t.nhan}</option>)}
            </select>
            <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Mô tả hiện trạng máy (bắt buộc)" className="rounded-lg border px-3 py-1.5 text-sm text-slate-900 min-w-64" />
            <button disabled={busy || !den || !ghiChu.trim()} onClick={() => chay(() => datTrangThaiSerial(serial, den, ghiChu), `Đổi trạng thái serial ${serial} → ${nhan(den)}?`, 'Đã cập nhật.')} className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm disabled:opacity-50">Đặt</button>
          </div>
        </div>
      )}

      {(msg || err) && <p className={`text-sm ${err ? 'text-red-600' : 'text-emerald-700'}`}>{err ?? msg}</p>}

      {suKien.length > 0 ? (
        <div>
          <p className="text-xs text-slate-500 mb-1">Nhật ký vòng đời</p>
          <ul className="border rounded-lg divide-y text-sm">
            {suKien.map((s) => (
              <li key={s.id} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-800">
                    {nhan(s.den_trang_thai) !== '—' ? nhan(s.den_trang_thai) : s.su_kien}
                    {s.tu_trang_thai && s.den_trang_thai && (
                      <span className="text-slate-400"> ({nhan(s.tu_trang_thai)} → {nhan(s.den_trang_thai)})</span>
                    )}
                  </span>
                  <span className="text-[11px] text-slate-400 flex-none">{vnDateTime(s.luc)}</span>
                </div>
                {s.ghi_chu && <div className="text-xs text-slate-500">{s.ghi_chu}</div>}
                {s.boi && <div className="text-[10px] text-slate-400">{s.boi}</div>}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-slate-400">Chưa có sự kiện vòng đời nào.</p>
      )}
    </div>
  )
}
