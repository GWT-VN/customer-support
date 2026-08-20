'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  dangKyBaoHanh, dsMayCoSerial, serialsTheoMay, serialInfo,
  type SerialKho, type MayKho, type KhachTom, type CatalogChon,
} from '@/app/actions'
import { DO_CHAC_NGAY_LAP, NHAN_DO_CHAC, type DoChacNgayLap } from '@/lib/danhSach'
import { SerialPicker } from '@/components/SerialPicker'
import { KhachPicker } from '@/components/KhachPicker'
import { ChonCatalog } from '@/components/ChonCatalog'
import { ChonTinh } from '@/components/ChonTinh'

const HOM_NAY = () => new Date().toISOString().slice(0, 10)

function vn(d: string | null) {
  return d ? new Date(d).toLocaleDateString('vi-VN') : '—'
}

/**
 * Đăng ký + kích hoạt bảo hành (Đợt 1).
 *  · Chọn MÁY trước -> serial lọc theo máy (còn chưa kích hoạt), hoặc
 *  · Gõ SERIAL trước -> tự soi máy + trạng thái (đã kích hoạt cho ai chưa).
 *  · Địa chỉ khách + địa chỉ lắp (tick dùng chung). Ngày bắt đầu bảo hành.
 */
export function DangKyBHForm() {
  const [dsMay, setDsMay] = useState<MayKho[]>([])
  const [mayCode, setMayCode] = useState('')            // '' = chưa chọn máy -> gõ serial tự do
  const [serialList, setSerialList] = useState<SerialKho[]>([])
  const [serial, setSerial] = useState('')
  const [serialQ, setSerialQ] = useState('')        // ô gõ tìm serial (khi đã chọn máy)
  const [serialOpen, setSerialOpen] = useState(false)
  const [info, setInfo] = useState<SerialKho | null>(null)

  const [khachId, setKhachId] = useState('')
  const [khachAddr, setKhachAddr] = useState<string | null>(null)
  const [dungDcKhach, setDungDcKhach] = useState(true)
  const [dcLap, setDcLap] = useState('')
  const [tinhLap, setTinhLap] = useState('')

  const [ngay, setNgay] = useState(HOM_NAY())
  const [doChac, setDoChac] = useState<DoChacNgayLap>('chinh_xac')
  const [ghiChu, setGhiChu] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()

  // Tải danh sách máy 1 lần
  useEffect(() => {
    let song = true
    dsMayCoSerial().then((r) => { if (song) setDsMay(r) })
    return () => { song = false }
  }, [])

  // Chọn máy -> tải serial của máy đó (chỉ chạy khi có mayCode; clear làm ở handler)
  useEffect(() => {
    if (!mayCode) return
    let song = true
    serialsTheoMay(mayCode).then((r) => { if (song) setSerialList(r) })
    return () => { song = false }
  }, [mayCode])

  // Serial thay đổi -> soi trạng thái (debounce; setState chỉ trong callback async)
  useEffect(() => {
    const s = serial.trim()
    if (!s) return
    let song = true
    const id = setTimeout(() => { serialInfo(s).then((r) => { if (song) setInfo(r) }) }, 250)
    return () => { song = false; clearTimeout(id) }
  }, [serial])

  function chonMay(code: string) {
    setMayCode(code); setSerial(''); setSerialQ(''); setSerialOpen(false)
    setInfo(null); setSerialList([]); setErr(null)
  }
  function datSerial(v: string) {
    setSerial(v); setErr(null)
    if (!v.trim()) setInfo(null)
  }
  // Gõ tìm serial theo ĐUÔI (gõ 123 -> ưu tiên serial kết thúc bằng 123).
  function goSerial(v: string) {
    setSerialQ(v); setSerialOpen(true)
    const hit = serialList.find((s) => s.serial === v.trim())
    datSerial(hit ? hit.serial : '')
  }
  function chonSerialTrongList(s: SerialKho) {
    setSerialQ(s.serial); setSerialOpen(false); datSerial(s.serial)
  }
  const q = serialQ.trim().toLowerCase()
  const serialLoc = (q
    ? serialList.filter((s) => s.serial.toLowerCase().includes(q))
        .sort((a, b) =>
          (a.serial.toLowerCase().endsWith(q) ? 0 : 1) - (b.serial.toLowerCase().endsWith(q) ? 0 : 1))
    : serialList
  ).slice(0, 12)
  function chonKhach(id: string, _nhan: string, k?: KhachTom) {
    setKhachId(id); setKhachAddr(k?.address ?? null)
  }

  const daKichHoat = info?.bh_kich_hoat === true
  // Tỉnh là ô riêng trên giao diện cho CS khỏi gõ lẫn, nhưng `installed_base` chỉ
  // có MỘT cột địa chỉ chữ trơn — nên ghép lại khi lưu thay vì đổi schema.
  // Dùng địa chỉ khách thì thôi, địa chỉ đó đã có tỉnh của khách rồi.
  const dcLapCuoi = dungDcKhach
    ? (khachAddr ?? '')
    : [dcLap.trim(), tinhLap.trim()].filter(Boolean).join(', ')
  // dsMayCoSerial (v_may_kho) đã LỌC chỉ máy (bỏ lõi/vỏ) -> danh sách typeahead chỉ có máy.
  const catalogMay: CatalogChon[] = useMemo(
    () => dsMay.map((m) => ({
      internal_code: m.internal_code,
      ten: `${m.ten_noi_bo ?? m.internal_code} (còn ${m.con_lai})`,
      danh_muc: null,
    })), [dsMay])

  async function luu() {
    setBusy(true); setErr(null); setMsg(null)
    const r = await dangKyBaoHanh({
      serial, customer_id: khachId, install_date: ngay,
      install_address: dcLapCuoi.trim() || undefined,
      ngay_lap_do_chac: doChac,
      ghi_chu: ghiChu.trim() || undefined,
    })
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    setMsg(`Đã đăng ký + kích hoạt BH cho serial ${serial}.`)
    setMayCode(''); setSerial(''); setSerialQ(''); setSerialOpen(false); setInfo(null); setSerialList([])
    setKhachId(''); setKhachAddr(null); setDcLap(''); setTinhLap(''); setDungDcKhach(true); setNgay(HOM_NAY())
    setDoChac('chinh_xac'); setGhiChu('')
    router.refresh()
  }

  return (
    <div className="bg-white rounded-xl border p-5 space-y-4 max-w-2xl">
      {/* 1. Máy — gõ để lọc theo tên/mã (chỉ MÁY, không lõi/vật tư); bỏ trống = gõ serial tự do */}
      <div>
        <label className="text-sm font-medium text-slate-700">1. Máy (gõ tên/mã để lọc serial)</label>
        <div className="mt-1">
          <ChonCatalog catalog={catalogMay} value={mayCode} onChange={chonMay}
            placeholder="Gõ tên/mã máy… (bỏ trống để gõ serial tự do)" />
        </div>
      </div>

      {/* 2. Serial */}
      <div>
        <label className="text-sm font-medium text-slate-700">2. Serial máy</label>
        {mayCode ? (
          serialList.length ? (
            <div className="relative mt-1">
              <input value={serialQ} onChange={(e) => goSerial(e.target.value)}
                onFocus={() => setSerialOpen(true)}
                onBlur={() => setTimeout(() => setSerialOpen(false), 200)}
                placeholder="Chọn hoặc gõ số CUỐI serial…"
                className="w-full rounded-lg border px-3 py-2 text-sm bg-white font-mono text-slate-900" />
              {serialOpen && serialLoc.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-lg border bg-white shadow-lg">
                  {serialLoc.map((s) => (
                    <li key={s.serial}>
                      <button type="button" onMouseDown={(e) => e.preventDefault()}
                        onClick={() => chonSerialTrongList(s)}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 font-mono">
                        {s.serial}
                        <span className="text-slate-400">{s.ten_khach ? ` · đã lắp: ${s.ten_khach}` : ' · tồn kho'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm bg-amber-50 text-amber-900 rounded-lg px-3 py-2 mt-1">
              Máy này không còn serial nào chưa kích hoạt trong kho.
            </p>
          )
        ) : (
          <>
            <p className="text-xs text-slate-400 mb-1">Gõ serial; chưa có thì tạo chờ duyệt.</p>
            <div className="flex"><SerialPicker value={serial} onChange={datSerial} placeholder="Gõ serial…" /></div>
          </>
        )}

        {/* Soi trạng thái serial */}
        {serial.trim() && info && (
          <div className={
            'mt-2 text-sm rounded-lg px-3 py-2 ' +
            (daKichHoat ? 'bg-red-50 text-red-800'
              : info.trang_thai === 'da_lap_chua_kich_hoat' ? 'bg-amber-50 text-amber-900'
              : 'bg-emerald-50 text-emerald-900')
          }>
            <div className="font-medium">{info.ten_noi_bo ?? info.ma_noi_bo ?? '—'}
              <span className="font-normal text-slate-500"> · mã {info.ma_noi_bo ?? '—'}</span>
            </div>
            {daKichHoat ? (
              <div>⛔ ĐÃ kích hoạt BH cho <strong>{info.ten_khach ?? '—'}</strong>
                {info.ngay_lap && <> (ngày {vn(info.ngay_lap)})</>} — không đăng ký lại.</div>
            ) : info.trang_thai === 'da_lap_chua_kich_hoat' ? (
              <div>Đã lắp cho <strong>{info.ten_khach ?? '—'}</strong> nhưng chưa kích hoạt BH.</div>
            ) : (
              <div>Tồn kho — đăng ký được.</div>
            )}
          </div>
        )}
        {serial.trim() && !info && (
          <p className="mt-2 text-xs text-slate-500">Serial chưa có trong kho — sẽ tạo tự do khi đăng ký.</p>
        )}
      </div>

      {/* 3. Khách */}
      <div>
        <label className="text-sm font-medium text-slate-700">3. Khách hàng</label>
        <p className="text-xs text-slate-400 mb-1">Tìm khách đã có; không có thì tạo mới (admin duyệt sau).</p>
        <KhachPicker onPick={chonKhach} />
      </div>

      {/* 4. Địa chỉ */}
      <div>
        <label className="text-sm font-medium text-slate-700">4. Địa chỉ lắp đặt</label>
        <p className="text-xs text-slate-400">Địa chỉ khách: {khachAddr || '—'}</p>
        {/* Hỏi theo chiều KHẲNG ĐỊNH: mặc định lắp tại nhà khách, tick khi khác.
            Bản trước hỏi ngược ("dùng địa chỉ khách", mặc định đã tick) nên tick
            vào lại làm ẩn mất ô nhập — đúng ngược ý người dùng đang định làm. */}
        <label className="flex items-center gap-1.5 text-sm text-slate-700 mt-1">
          <input type="checkbox" checked={!dungDcKhach} onChange={(e) => setDungDcKhach(!e.target.checked)} />
          Địa chỉ lắp khác địa chỉ khách
        </label>
        {!dungDcKhach && (
          <>
            <input value={dcLap} onChange={(e) => setDcLap(e.target.value)} placeholder="Số nhà, thôn/xã, quận/huyện…"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900" />
            <div className="mt-2">
              <span className="text-sm font-medium text-slate-700">Tỉnh / TP</span>
              <ChonTinh value={tinhLap} onChange={setTinhLap} />
              <p className="text-xs text-slate-400 mt-1">
                Ô riêng để khỏi gõ lẫn vào địa chỉ — địa chỉ lắp có thể khác địa chỉ khách.
              </p>
            </div>
          </>
        )}
      </div>

      {/* 5. Ngày bắt đầu BH */}
      <div>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">5. Ngày bắt đầu bảo hành</span>
          <input type="date" value={ngay} max={HOM_NAY()} onChange={(e) => setNgay(e.target.value)}
            className="mt-1 block rounded-lg border px-3 py-2 text-sm text-slate-900" />
        </label>

        {/* Khách chỉ liên hệ lúc máy hỏng thì thường không nhớ ngày lắp. Vẫn phải
            điền một ngày (bảo hành + lịch bảo trì + lịch thay lõi đều tính từ đó),
            nhưng đánh dấu rõ đây là ngày đoán để sau này đọc còn biết. */}
        <div className="mt-2">
          <span className="text-sm font-medium text-slate-700">Ngày này chắc tới đâu?</span>
          <select value={doChac} onChange={(e) => setDoChac(e.target.value as DoChacNgayLap)}
            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm text-slate-900 bg-white">
            {DO_CHAC_NGAY_LAP.map((k) => <option key={k} value={k}>{NHAN_DO_CHAC[k]}</option>)}
          </select>
          {doChac !== 'chinh_xac' && (
            <>
              <textarea value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} rows={2}
                placeholder="Khách nói gì? vd: chỉ nhớ mùa hè năm ngoái · lấy theo ngày hoá đơn đại lý"
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm text-slate-900" />
              <p className="text-xs text-amber-600 mt-1">
                Hạn bảo hành vẫn tính từ ngày trên, nhưng máy sẽ hiện nhãn
                “{NHAN_DO_CHAC[doChac].toLowerCase()}” để người sau biết mà kiểm lại.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={luu} disabled={busy || !serial.trim() || !khachId || daKichHoat}
          className="rounded-lg bg-slate-900 text-white px-5 py-2.5 font-medium disabled:opacity-50">
          {busy ? 'Đang đăng ký…' : 'Đăng ký + kích hoạt bảo hành'}
        </button>
        {daKichHoat && <span className="text-sm text-red-600">Serial đã kích hoạt — chọn serial khác.</span>}
        {msg && <span className="text-sm text-emerald-700">{msg}</span>}
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </div>
  )
}
