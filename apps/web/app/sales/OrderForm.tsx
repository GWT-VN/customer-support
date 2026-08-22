'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChonTinh } from '@/components/ChonTinh'
import { taoDon, suaDon, timKhachChoDon, boiCanhGia } from './actions'
import { fmtVnd } from './_ui'
import { deriveSourceTab } from './_calc'
import {
  type CatalogPick,
  type ChannelOpt,
  type NewOrderItem,
  type NewOrderInput,
  type OrderFormInitial,
  type CustomerHit,
  FULFILL_OPTS,
  PAYMENT_OPTS,
  PAYMETHOD_OPTS,
  VAT_OPTS,
  maVat,
} from './_types'
import { giaGoiY, nhanBac, type BoiCanhGia, type GiaGoiY } from './_ctkm'

type Line = NewOrderItem & { key: number }

const emptyLine = (key: number): Line => ({
  key,
  internal_code: '',
  product_name: '',
  category_l1: null,
  category_l2: null,
  quantity: 1,
  unit_price_vat: 0,
  is_gift: false,
  // Mặc định 8%: 320/328 mã là 8%, và Apps Script cũng mặc định vậy (defaultVatFor_).
  // Để trống là người nhập dễ quên -> tiền trước VAT tính sai. Chọn sản phẩm xong thì
  // VAT tự điền lại theo đúng mã (xem onPick của ProductPicker).
  vat_pct: 0.08,
  vat_loai: 'VAT' as const,
  note: null,
})

function todayISO(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const inp =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100'
const lbl = 'block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1'
const card = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm'

/** Ô tìm sản phẩm: gõ theo tên / mã nội bộ / mã cũ / mã đối tác, hoặc bấm chọn. */
function ProductPicker({
  catalog,
  code,
  name,
  onPick,
}: {
  catalog: CatalogPick[]
  code: string
  name: string
  onPick: (c: CatalogPick) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const arr = !s
      ? catalog
      : catalog.filter(
          (c) =>
            c.name.toLowerCase().includes(s) ||
            c.internal_code.toLowerCase().includes(s) ||
            (c.ma_cu ?? '').toLowerCase().includes(s) ||
            (c.ma_doitac ?? '').toLowerCase().includes(s)
        )
    return arr.slice(0, 40)
  }, [q, catalog])
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  return (
    <div className="relative" ref={boxRef}>
      <input
        className={inp}
        placeholder="Gõ tên / mã nội bộ / mã cũ… hoặc bấm chọn"
        value={open ? q : code ? `${name} (${code})` : ''}
        onFocus={() => { setOpen(true); setQ('') }}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white text-sm shadow-lg">
          {filtered.length === 0 && <div className="px-3 py-2 text-slate-400">Không thấy sản phẩm khớp.</div>}
          {filtered.map((c) => (
            <button
              key={c.internal_code}
              type="button"
              onClick={() => { onPick(c); setOpen(false); setQ('') }}
              className="block w-full px-3 py-2 text-left hover:bg-slate-50"
            >
              <span className="text-slate-800">{c.name}</span>
              <span className="ml-1 font-mono text-xs text-slate-400">
                {c.internal_code}
                {c.ma_cu ? ` · cũ ${c.ma_cu}` : ''}
              </span>
            </button>
          ))}
          {filtered.length === 40 && <div className="px-3 py-1.5 text-[11px] text-slate-400">Gõ thêm để lọc hẹp hơn…</div>}
        </div>
      )}
    </div>
  )
}

export function OrderForm({
  catalog,
  channels,
  mode = 'create',
  orderCode,
  initial,
}: {
  catalog: CatalogPick[]
  channels: ChannelOpt[]
  mode?: 'create' | 'edit'
  orderCode?: string
  initial?: OrderFormInitial
}) {
  const router = useRouter()
  const isEdit = mode === 'edit'

  const initHasNewCust = !!initial && !initial.customer_code && !!(initial.customer_name || initial.phone)
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>(initHasNewCust ? 'new' : 'existing')
  const [custQuery, setCustQuery] = useState('')
  const [custHits, setCustHits] = useState<CustomerHit[]>([])
  const [selectedCust, setSelectedCust] = useState<CustomerHit | null>(
    initial?.customer_code
      ? { customer_code: initial.customer_code, name: initial.customer_name, phone: initial.phone, phone_chuan: initial.phone, province: null, province_moi: null }
      : null
  )
  const [newName, setNewName] = useState(initHasNewCust ? initial!.customer_name ?? '' : '')
  const [newPhone, setNewPhone] = useState(initHasNewCust ? initial!.phone ?? '' : '')
  const [searching, startSearch] = useTransition()

  const [address, setAddress] = useState(initial?.address ?? '')
  const [province, setProvince] = useState(initial?.province ?? '')
  const [orderDate, setOrderDate] = useState(initial?.order_date || todayISO())
  const [channelId, setChannelId] = useState(initial?.channel_id ? String(initial.channel_id) : '')
  const [partnerCode, setPartnerCode] = useState(initial?.partner_order_code ?? '')
  const [status, setStatus] = useState(initial?.status ?? 'Mới')
  const [payment, setPayment] = useState(initial?.payment_status ?? 'Chờ cọc')
  const [payMethod, setPayMethod] = useState(initial?.payment_method ?? '')
  const [shippingCode, setShippingCode] = useState(initial?.shipping_code ?? '')
  const [installDate, setInstallDate] = useState(initial?.install_date ?? '')
  const [note, setNote] = useState(initial?.note ?? '')

  // ── Ô Sheet bổ sung 22/08 ────────────────────────────────────────────────
  const [chiTietKenh, setChiTietKenh] = useState(initial?.channel_detail ?? '')
  const [quaTang, setQuaTang] = useState(initial?.qua_tang ?? '')
  const [dungQuaTang, setDungQuaTang] = useState(initial?.su_dung_qua_tang ?? '')
  const [linkTracking, setLinkTracking] = useState(initial?.tracking_url ?? '')
  const [kichHoatBH, setKichHoatBH] = useState(!!initial?.kich_hoat_bh)
  const [emailDon, setEmailDon] = useState(initial?.email ?? '')
  const [tienCoc, setTienCoc] = useState(initial?.tien_coc != null ? String(initial.tien_coc) : '')
  // POU
  const [guiHdsd, setGuiHdsd] = useState(!!initial?.gui_hdsd)
  const [xuatHD, setXuatHD] = useState(!!initial?.xuat_hoa_don)
  const [doiSoat, setDoiSoat] = useState(!!initial?.da_doi_soat)
  const [ngayDoiSoat, setNgayDoiSoat] = useState(initial?.ngay_doi_soat ?? '')
  // POE
  const [soHD, setSoHD] = useState(initial?.so_hd ?? '')
  const [tenGoi, setTenGoi] = useState(initial?.ten_goi_khach ?? '')
  const [tenFolder, setTenFolder] = useState(initial?.ten_folder ?? '')
  const [tenTheoDoi, setTenTheoDoi] = useState(initial?.ten_khach_theo_doi ?? '')
  const [tienSeThu, setTienSeThu] = useState(initial?.tien_se_thu != null ? String(initial.tien_se_thu) : '')
  const [bienBan, setBienBan] = useState(!!initial?.bien_ban_xac_nhan)
  const [baoCaoLap, setBaoCaoLap] = useState(!!initial?.bao_cao_lap_dat)
  const [tienDoLap, setTienDoLap] = useState(initial?.tien_do_lap_dat ?? '')
  const [ngayXongLap, setNgayXongLap] = useState(initial?.ngay_hoan_thanh_lap ?? '')
  const [tuDien, setTuDien] = useState(initial?.tu_dien ?? '')
  const [phienBan, setPhienBan] = useState(initial?.version ?? '')
  const [ngheNghiep, setNgheNghiep] = useState(initial?.nghe_nghiep ?? '')
  const [ngaySinhKH, setNgaySinhKH] = useState(initial?.ngay_sinh ?? '')
  const [gioiTinh, setGioiTinh] = useState(initial?.gioi_tinh ?? '')
  const [doTuoi, setDoTuoi] = useState(initial?.do_tuoi ?? '')
  const [loaiNha, setLoaiNha] = useState(initial?.loai_nha ?? '')
  const [tinhTrangNha, setTinhTrangNha] = useState(initial?.tinh_trang_nha ?? '')
  const [ctyXuatHD, setCtyXuatHD] = useState(initial?.cong_ty_xuat_hd ?? '')
  const [mstXuatHD, setMstXuatHD] = useState(initial?.mst ?? '')
  const [dcXuatHD, setDcXuatHD] = useState(initial?.dia_chi_xuat_hd ?? '')
  const [moPOE, setMoPOE] = useState(false)

  const [lines, setLines] = useState<Line[]>(
    initial?.items?.length ? initial.items.map((it, i) => ({ ...it, key: i + 1 })) : [emptyLine(1)]
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── GIÁ TỰ BẮT ───────────────────────────────────────────────────────────
  // CEO chốt: khách có bậc/kênh thì lên đơn tự ăn đúng chính sách đang áp.
  // Gợi ý thôi — người nhập vẫn gõ đè được, chỉ bị nhắc khi bán dưới mức đã duyệt.
  const custCode = customerMode === 'existing' ? selectedCust?.customer_code ?? null : null
  const kenhSo = channelId ? Number(channelId) : null
  /** Khoá của lần tra hiện tại. Đổi khách/kênh/ngày là đổi khoá. */
  const khoaGia = `${custCode ?? ''}|${kenhSo ?? ''}|${orderDate}`

  // Lưu KÈM khoá rồi so lúc đọc, thay vì xoá state ngay trong effect: kết quả về muộn
  // của lần tra cũ tự bị bỏ qua vì khoá không khớp, và effect không phải gọi setState
  // đồng bộ (thứ đẻ ra render dây chuyền).
  const [bcRaw, setBcRaw] = useState<{ khoa: string; bc: BoiCanhGia } | null>(null)
  useEffect(() => {
    if (!custCode && kenhSo == null) return
    let huy = false
    boiCanhGia(custCode, kenhSo, orderDate).then((bc) => { if (!huy) setBcRaw({ khoa: khoaGia, bc }) })
    return () => { huy = true }
  }, [khoaGia, custCode, kenhSo, orderDate])
  const bcGia = bcRaw?.khoa === khoaGia ? bcRaw.bc : null

  /**
   * Giá gợi ý cho từng dòng — DẪN XUẤT, không giữ trong state.
   *
   * Giữ bằng state là phải có effect đồng bộ lại mỗi khi đổi khách/kênh/ngày, và
   * effect đó gọi setState trong lúc render (React cảnh báo đúng). Tính thẳng từ
   * `lines + bcGia + orderDate` thì không bao giờ lệch pha.
   *
   * Đổi khách giữa chừng KHÔNG tự sửa đơn giá đang có — đơn soạn dở mà số nhảy dưới
   * tay người nhập là mất tin tưởng. Chỉ đổi nhãn, kèm nút để họ tự áp lại.
   */
  const goiY = useMemo<Record<number, GiaGoiY>>(() => {
    if (!bcGia) return {}
    const m: Record<number, GiaGoiY> = {}
    for (const l of lines) if (l.internal_code) m[l.key] = giaGoiY(bcGia, l.internal_code, orderDate)
    return m
  }, [bcGia, lines, orderDate])

  function runSearch(q: string) {
    setCustQuery(q)
    if (q.trim().length < 2) return setCustHits([])
    startSearch(async () => setCustHits((await timKhachChoDon(q)) as CustomerHit[]))
  }
  const setLine = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const addLine = () => setLines((ls) => [...ls, emptyLine(Math.max(0, ...ls.map((l) => l.key)) + 1)])
  const removeLine = (key: number) => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls))

  const total = lines.reduce((s, l) => s + (l.is_gift ? 0 : (Number(l.quantity) || 0) * (Number(l.unit_price_vat) || 0)), 0)

  // Loại đơn suy từ SẢN PHẨM, đúng cách Apps Script cắt tab — không bắt người nhập chọn tay.
  const loaiDon = deriveSourceTab(lines)
  const laPOE = loaiDon === 'DON_POE'
  const laPOU = loaiDon === 'DON_POU'
  // Đơn lõi/muối/dịch vụ cũng bán qua Viettelpost và cũng thu COD -> cũng phải đối soát
  // y như POU (Sheet chốt 29/07/2025, EXTRA.O có 'Đã đối soát' + 'Ngày nhận đối soát').
  const coDoiSoat = laPOU || loaiDon === 'DON_OTHERS'
  const conCanThu = total - (tienCoc === '' ? 0 : Number(tienCoc) || 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const input: NewOrderInput = {
      customer_code: customerMode === 'existing' ? selectedCust?.customer_code ?? null : null,
      phone: customerMode === 'existing' ? selectedCust?.phone_chuan ?? selectedCust?.phone ?? null : newPhone.trim() || null,
      customer_name: customerMode === 'existing' ? selectedCust?.name ?? null : newName.trim() || null,
      address: address.trim() || null,
      province: province.trim() || null,
      order_date: orderDate,
      channel_id: channelId ? Number(channelId) : null,
      partner_order_code: partnerCode.trim() || null,
      status: status || null,
      payment_status: payment || null,
      payment_method: payMethod || null,
      shipping_code: shippingCode.trim() || null,
      install_date: installDate || null,
      channel_detail: chiTietKenh.trim() || null,
      qua_tang: quaTang.trim() || null,
      su_dung_qua_tang: dungQuaTang.trim() || null,
      tracking_url: linkTracking.trim() || null,
      kich_hoat_bh: kichHoatBH,
      email: emailDon.trim() || null,
      tien_coc: tienCoc === '' ? null : Number(tienCoc),
      gui_hdsd: guiHdsd,
      xuat_hoa_don: xuatHD,
      da_doi_soat: doiSoat,
      ngay_doi_soat: ngayDoiSoat || null,
      so_hd: soHD.trim() || null,
      ten_goi_khach: tenGoi.trim() || null,
      ten_folder: tenFolder.trim() || null,
      ten_khach_theo_doi: tenTheoDoi.trim() || null,
      tien_se_thu: tienSeThu === '' ? null : Number(tienSeThu),
      bien_ban_xac_nhan: bienBan,
      bao_cao_lap_dat: baoCaoLap,
      tien_do_lap_dat: tienDoLap.trim() || null,
      ngay_hoan_thanh_lap: ngayXongLap || null,
      tu_dien: tuDien.trim() || null,
      version: phienBan.trim() || null,
      nghe_nghiep: ngheNghiep.trim() || null,
      ngay_sinh: ngaySinhKH || null,
      gioi_tinh: gioiTinh || null,
      do_tuoi: doTuoi.trim() || null,
      loai_nha: loaiNha.trim() || null,
      tinh_trang_nha: tinhTrangNha.trim() || null,
      cong_ty_xuat_hd: ctyXuatHD.trim() || null,
      mst: mstXuatHD.trim() || null,
      dia_chi_xuat_hd: dcXuatHD.trim() || null,
      note: note.trim() || null,
      items: lines.map((l) => ({
        internal_code: l.internal_code,
        product_name: l.product_name,
        category_l1: l.category_l1,
        category_l2: l.category_l2,
        quantity: Number(l.quantity) || 0,
        unit_price_vat: Number(l.unit_price_vat) || 0,
        is_gift: l.is_gift,
        vat_pct: l.vat_pct == null || (l.vat_pct as unknown as string) === '' ? null : Number(l.vat_pct),
        vat_loai: l.vat_loai ?? null,
        note: l.note?.trim() || null,
      })),
    }
    const res = isEdit && orderCode ? await suaDon(orderCode, input) : await taoDon(input)
    if (res.ok) {
      router.push(`/sales/don/${encodeURIComponent(res.order_code)}`)
      router.refresh()
    } else {
      setError(res.error)
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Khách hàng */}
      <div className={card}>
        <div className="mb-3 flex items-center gap-4">
          <span className="text-sm font-semibold text-slate-800">Khách hàng</span>
          <div className="flex gap-1 text-sm">
            {(['existing', 'new'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setCustomerMode(m)}
                className={'rounded-md px-3 py-1 ' + (customerMode === m ? 'bg-[#0e8c9a] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
              >
                {m === 'existing' ? 'Khách cũ' : 'Khách mới'}
              </button>
            ))}
          </div>
        </div>

        {customerMode === 'existing' ? (
          selectedCust ? (
            <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
              <span>
                <b>{selectedCust.name || '(chưa tên)'}</b> · {selectedCust.phone_chuan || selectedCust.phone} ·{' '}
                <span className="font-mono text-xs text-slate-500">{selectedCust.customer_code}</span>
              </span>
              <button type="button" className="text-slate-500 hover:text-slate-700" onClick={() => setSelectedCust(null)}>Đổi</button>
            </div>
          ) : (
            <div className="relative">
              <input className={inp} placeholder="Tìm khách theo tên / SĐT / mã KH…" value={custQuery} onChange={(e) => runSearch(e.target.value)} />
              {(searching || custHits.length > 0) && (
                <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {searching && <div className="px-3 py-2 text-sm text-slate-400">Đang tìm…</div>}
                  {custHits.map((h) => (
                    <button key={h.customer_code} type="button" onClick={() => { setSelectedCust(h); setCustHits([]); setCustQuery('') }} className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50">
                      <b>{h.name || '(chưa tên)'}</b>{' '}
                      <span className="text-slate-500">· {h.phone_chuan || h.phone || '—'} · {h.province_moi || h.province || ''}</span>
                      <span className="ml-1 font-mono text-xs text-slate-400">{h.customer_code}</span>
                    </button>
                  ))}
                  {!searching && custQuery.length >= 2 && custHits.length === 0 && (
                    <div className="px-3 py-2 text-sm text-slate-400">Không thấy — chuyển sang <b>Khách mới</b>?</div>
                  )}
                </div>
              )}
            </div>
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={lbl}>Tên khách</label><input className={inp} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nguyễn Văn A" /></div>
            <div><label className={lbl}>SĐT</label><input className={inp} value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="09xxxxxxxx" inputMode="tel" /></div>
            <p className="text-xs text-slate-400 sm:col-span-2">Khách mới nhập tại đây sẽ nối theo SĐT; muốn cấp mã KA thì tạo ở trang Khách hàng.</p>
          </div>
        )}
      </div>

      {/* Sản phẩm */}
      <div className={card}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-800">Sản phẩm</span>
          <button type="button" onClick={addLine} className="rounded-md bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-200">＋ Thêm dòng</button>
        </div>
        {/* Hàng tiêu đề: các ô số bên phải rất hẹp, không có nhãn thì không đoán được ô nào là gì. */}
        <div className="mb-1 hidden grid-cols-12 gap-2 px-2 text-[11px] uppercase tracking-wide text-slate-400 sm:grid">
          <span className="col-span-5">Sản phẩm</span>
          <span className="col-span-2 text-right">Số lượng</span>
          <span className="col-span-2 text-right">Đơn giá (gồm VAT)</span>
          <span className="col-span-1 text-right">VAT</span>
          <span className="col-span-1 text-center">Quà</span>
          <span className="col-span-1" />
        </div>

        {/* Nói RÕ khách này đang ăn chính sách nào — không để app lặng lẽ điền số. */}
        {bcGia && (bcGia.bac || bcGia.ctkm) && (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">
            <span className="font-semibold">Đang áp:</span>
            {bcGia.bac ? (
              <>
                <span className="rounded-full bg-teal-600 px-2 py-0.5 text-xs font-semibold text-white">
                  {nhanBac(bcGia.bac)}
                </span>
                {bcGia.ctkm && (
                  <span className="text-xs text-teal-700">
                    (đại lý ăn giá bậc, <b>không</b> cộng thêm khuyến mãi bán lẻ)
                  </span>
                )}
              </>
            ) : (
              <span className="rounded-full bg-teal-600 px-2 py-0.5 text-xs font-semibold text-white">
                {bcGia.ctkm?.ten}
              </span>
            )}
            {bcGia.soCtkmKhac > 0 && (
              <span className="text-xs text-teal-700">
                · còn {bcGia.soCtkmKhac} chương trình khác cũng khớp, app lấy cái giảm sâu nhất
              </span>
            )}
          </div>
        )}
        <div className="space-y-2">
          {lines.map((l) => (
            <div key={l.key} className="rounded-lg border border-slate-100 bg-slate-50/50 p-2">
              <div className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-12 sm:col-span-5">
                  <ProductPicker
                    catalog={catalog}
                    code={l.internal_code}
                    name={l.product_name}
                    onPick={(c) =>
                      setLine(l.key, {
                        internal_code: c.internal_code,
                        product_name: c.name,
                        category_l1: c.category_l1,
                        category_l2: c.category_l2,
                        // VAT tự điền theo mã nội bộ (CEO chốt 21/08). Mã chưa xếp loại
                        // (mục chi phí kế toán) thì để trống chứ không đoán 8%.
                        vat_pct: c.vat_pct,
                        vat_loai: c.vat_loai,
                        // Chỉ điền khi ô đang trống/0 — không đè số người nhập đã tự gõ.
                        ...(() => {
                          if (!bcGia) return {}
                          const g = giaGoiY(bcGia, c.internal_code, orderDate)
                          return g.gia != null && !Number(l.unit_price_vat) ? { unit_price_vat: g.gia } : {}
                        })(),
                      })
                    }
                  />
                </div>
                <input type="number" min={0} className={inp + ' col-span-3 sm:col-span-2 text-right'} value={l.quantity} onChange={(e) => setLine(l.key, { quantity: Number(e.target.value) })} title="Số lượng (DVBT = số lần)" />
                <input type="number" min={0} step={1000} className={inp + ' col-span-4 sm:col-span-2 text-right'} value={l.unit_price_vat} onChange={(e) => setLine(l.key, { unit_price_vat: Number(e.target.value) })} placeholder="Đơn giá (gồm VAT)" disabled={l.is_gift} title="Đơn giá ĐÃ GỒM VAT — giống cột 'Đơn giá sau VAT' trong Google Sheet. Tiền trước VAT app tự tính ra." />
                <LineGiaNhan
                  g={goiY[l.key]}
                  daGo={Number(l.unit_price_vat) || 0}
                  laQua={l.is_gift}
                  onApLai={(v) => setLine(l.key, { unit_price_vat: v })}
                />
                <select
                  className={inp + ' col-span-2 sm:col-span-1 text-right'}
                  value={maVat(l.vat_pct, l.vat_loai)}
                  onChange={(e) => {
                    const v = VAT_OPTS.find((x) => x.ma === e.target.value)
                    setLine(l.key, { vat_pct: v?.pct ?? null, vat_loai: v?.loai ?? null })
                  }}
                  title="Thuế suất VAT — KCT: không chịu thuế (muối) · KAD: không áp dụng (bình gas)"
                >
                  {VAT_OPTS.map((v) => (
                    <option key={v.ma} value={v.ma}>{v.nhan}</option>
                  ))}
                </select>
                <label className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1 text-xs text-slate-500" title="Hàng tặng"><input type="checkbox" checked={l.is_gift} onChange={(e) => setLine(l.key, { is_gift: e.target.checked })} />Quà</label>
                <button type="button" onClick={() => removeLine(l.key)} className="col-span-1 text-slate-400 hover:text-rose-600" title="Xoá dòng">✕</button>
              </div>
              <input className={inp + ' mt-1.5 text-xs'} value={l.note ?? ''} onChange={(e) => setLine(l.key, { note: e.target.value })} placeholder="Ghi chú dòng (tuỳ chọn)…" />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400"><b>DVBT</b> = mã bảo trì, SL = số lần. Nguồn đơn tự suy từ danh mục. Tick “Quà” → dòng tính 0 đ.</p>
        <div className="mt-3 flex items-center justify-end gap-3 border-t border-slate-100 pt-3 text-sm">
          <span className="text-slate-500">Tổng (VAT)</span>
          <span className="text-lg font-semibold text-slate-900">{fmtVnd(total)}</span>
        </div>
      </div>

      {/* Giao & thanh toán */}
      <div className={card}>
        <div className="mb-3 text-sm font-semibold text-slate-800">Giao hàng & thanh toán</div>
        <div className="grid gap-3 sm:grid-cols-4">
          <div><label className={lbl}>Ngày đơn</label><input type="date" className={inp} value={orderDate} onChange={(e) => setOrderDate(e.target.value)} required /></div>
          <div><label className={lbl}>Kênh</label>
            <select className={inp} value={channelId} onChange={(e) => setChannelId(e.target.value)}>
              <option value="">— chọn —</option>
              {channels.map((c) => <option key={c.id} value={c.id}>{[c.channel_l1, c.channel_l2].filter(Boolean).join(' · ')}</option>)}
            </select>
          </div>
          <div><label className={lbl}>Chi tiết kênh</label><input className={inp} value={chiTietKenh} onChange={(e) => setChiTietKenh(e.target.value)} placeholder="Tên shop / người giới thiệu…" /></div>
          <div><label className={lbl}>Mã đơn đối tác</label><input className={inp} value={partnerCode} onChange={(e) => setPartnerCode(e.target.value)} placeholder="Shopee / HĐ…" /></div>
          <div><label className={lbl}>Ngày lắp đặt</label><input type="date" className={inp} value={installDate} onChange={(e) => setInstallDate(e.target.value)} /></div>
          <div><label className={lbl}>Tình trạng hàng</label><select className={inp} value={status} onChange={(e) => setStatus(e.target.value)}>{FULFILL_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
          <div><label className={lbl}>Thanh toán</label><select className={inp} value={payment} onChange={(e) => setPayment(e.target.value)}>{PAYMENT_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
          <div><label className={lbl}>Hình thức TT</label><select className={inp} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>{PAYMETHOD_OPTS.map((o) => <option key={o} value={o}>{o || '— chọn —'}</option>)}</select></div>
          <div><label className={lbl}>Mã vận đơn</label><input className={inp} value={shippingCode} onChange={(e) => setShippingCode(e.target.value)} /></div>
          <div className="sm:col-span-2"><label className={lbl}>Link tracking</label><input className={inp} value={linkTracking} onChange={(e) => setLinkTracking(e.target.value)} placeholder="https://…" /></div>
          <div><label className={lbl}>Số tiền đã cọc</label>
            <input type="number" min={0} step={1000} className={inp + ' text-right tabular-nums'} value={tienCoc} onChange={(e) => setTienCoc(e.target.value)} />
          </div>
          <div><label className={lbl}>Còn cần thu</label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right text-sm font-semibold tabular-nums text-slate-700">
              {fmtVnd(conCanThu)}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Tổng đơn − đã cọc, app tự tính</p>
          </div>
          <div className="sm:col-span-1"><label className={lbl}>Tỉnh / TP</label>
            <ChonTinh value={province} onChange={setProvince} className={inp} />
          </div>
          <div className="sm:col-span-3"><label className={lbl}>Địa chỉ giao</label><input className={inp} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
        </div>
        <div className="mt-3"><label className={lbl}>Ghi chú đơn</label><textarea className={inp} rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>


      {/* QUÀ TẶNG — Sheet để 2 ô CHỮ TỰ DO cho cả POE lẫn POU (chốt 27/07/2025, bỏ cách
          tách từng cột "Lõi PCF / Lõi NF / Bình gas" đánh 0/2). Giữ đúng như vậy: nhân viên
          ghi kiểu liệt kê, ép thành ô chọn là mất những ca ngoài danh sách. */}
      {(laPOE || laPOU) && (
        <div className={card}>
          <div className="mb-3 text-sm font-semibold text-slate-800">Quà tặng</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={lbl}>Quà tặng đi kèm</label>
              <textarea className={inp} rows={2} value={quaTang} onChange={(e) => setQuaTang(e.target.value)}
                placeholder="02 lõi PCF / 01 lõi NF / 01 bình gas" />
            </div>
            <div>
              <label className={lbl}>Sử dụng quà tặng</label>
              <textarea className={inp} rows={2} value={dungQuaTang} onChange={(e) => setDungQuaTang(e.target.value)}
                placeholder="01 lõi PCF (27/6/2025)" />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Ghi kiểu liệt kê như trong Sheet. Hàng tặng có mã và có tính vào đơn thì tick
            <b> Quà</b> ở dòng hàng bên trên, đừng ghi vào đây.
          </p>
        </div>
      )}

      {/* POU — theo dõi sau bán: bảo hành, hướng dẫn sử dụng, hoá đơn, đối soát. */}
      {coDoiSoat && (
        <div className={card}>
          <div className="mb-3 text-sm font-semibold text-slate-800">
            {laPOU ? 'Theo dõi sau bán (POU)' : 'Đối soát'}
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {laPOU && (
              <div className="sm:col-span-2"><label className={lbl}>Email khách</label>
                <input type="email" className={inp} value={emailDon} onChange={(e) => setEmailDon(e.target.value)} /></div>
            )}
            <div><label className={lbl}>Ngày nhận đối soát</label>
              <input type="date" className={inp} value={ngayDoiSoat} onChange={(e) => setNgayDoiSoat(e.target.value)} /></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            <OTick nhan="Đã đối soát" giaTri={doiSoat} doi={setDoiSoat} />
            {laPOU && <>
              <OTick nhan="Kích hoạt bảo hành" giaTri={kichHoatBH} doi={setKichHoatBH}
                chuThich="Hồ sơ bảo hành nằm bên CSKH — đây chỉ là cờ đánh dấu trên đơn" />
              <OTick nhan="Gửi HDSD (CTD50/CTS10)" giaTri={guiHdsd} doi={setGuiHdsd} />
              <OTick nhan="Xuất hoá đơn" giaTri={xuatHD} doi={setXuatHD} />
            </>}
          </div>
        </div>
      )}

      {/* POE — đơn lọc tổng: hồ sơ, tiến độ lắp, khảo sát nhà, thông tin xuất hoá đơn.
          Gập lại vì 20 ô, mở ra chỉ khi cần. */}
      {laPOE && (
        <div className={card}>
          <button type="button" onClick={() => setMoPOE((v) => !v)}
            className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-800">
            <span>Hồ sơ &amp; lắp đặt (POE)</span>
            <span className="text-slate-400">{moPOE ? '▲' : '▼ mở ra'}</span>
          </button>

          {moPOE && (
            <div className="mt-3 space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <div><label className={lbl}>Số HĐ</label><input className={inp} value={soHD} onChange={(e) => setSoHD(e.target.value)} /></div>
                <div><label className={lbl}>Tên gọi khách</label><input className={inp} value={tenGoi} onChange={(e) => setTenGoi(e.target.value)} placeholder="gọi thân mật" /></div>
                <div><label className={lbl}>Tên folder</label><input className={inp} value={tenFolder} onChange={(e) => setTenFolder(e.target.value)} /></div>
                <div><label className={lbl}>Tên khách theo dõi</label><input className={inp} value={tenTheoDoi} onChange={(e) => setTenTheoDoi(e.target.value)} /></div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div><label className={lbl}>Tiền sẽ thu</label>
                  <input type="number" min={0} step={1000} className={inp + ' text-right tabular-nums'} value={tienSeThu} onChange={(e) => setTienSeThu(e.target.value)} /></div>
                <div><label className={lbl}>Tiến độ lắp đặt</label><input className={inp} value={tienDoLap} onChange={(e) => setTienDoLap(e.target.value)} /></div>
                <div><label className={lbl}>Ngày hoàn thành lắp</label><input type="date" className={inp} value={ngayXongLap} onChange={(e) => setNgayXongLap(e.target.value)} /></div>
                <div><label className={lbl}>Tủ điện</label><input className={inp} value={tuDien} onChange={(e) => setTuDien(e.target.value)} /></div>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <OTick nhan="Biên bản xác nhận" giaTri={bienBan} doi={setBienBan} />
                <OTick nhan="Báo cáo lắp đặt" giaTri={baoCaoLap} doi={setBaoCaoLap} />
                <OTick nhan="Kích hoạt bảo hành" giaTri={kichHoatBH} doi={setKichHoatBH}
                  chuThich="Hồ sơ bảo hành nằm bên CSKH — đây chỉ là cờ đánh dấu trên đơn" />
              </div>

              <div className="border-t border-slate-100 pt-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Khảo sát tại thời điểm lắp
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div><label className={lbl}>Version</label><input className={inp} value={phienBan} onChange={(e) => setPhienBan(e.target.value)} /></div>
                  <div><label className={lbl}>Nghề nghiệp</label><input className={inp} value={ngheNghiep} onChange={(e) => setNgheNghiep(e.target.value)} /></div>
                  <div><label className={lbl}>Ngày sinh</label><input type="date" className={inp} value={ngaySinhKH} onChange={(e) => setNgaySinhKH(e.target.value)} /></div>
                  <div><label className={lbl}>Giới tính</label>
                    <select className={inp} value={gioiTinh} onChange={(e) => setGioiTinh(e.target.value)}>
                      <option value="">—</option><option value="Nam">Nam</option><option value="Nữ">Nữ</option><option value="Khác">Khác</option>
                    </select></div>
                  <div><label className={lbl}>Độ tuổi</label><input className={inp} value={doTuoi} onChange={(e) => setDoTuoi(e.target.value)} placeholder="30-40" /></div>
                  <div><label className={lbl}>Loại nhà</label><input className={inp} value={loaiNha} onChange={(e) => setLoaiNha(e.target.value)} placeholder="Chung cư, nhà phố…" /></div>
                  <div><label className={lbl}>Tình trạng nhà</label><input className={inp} value={tinhTrangNha} onChange={(e) => setTinhTrangNha(e.target.value)} placeholder="Đang ở, đang xây…" /></div>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Đây là khảo sát <b>của lần lắp này</b>, không phải hồ sơ khách — một khách lắp
                  hai lần có thể khai khác nhau, nên lưu ở đơn.
                </p>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Xuất hoá đơn cho công ty
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="sm:col-span-2"><label className={lbl}>Công ty xuất HĐ</label><input className={inp} value={ctyXuatHD} onChange={(e) => setCtyXuatHD(e.target.value)} /></div>
                  <div><label className={lbl}>MST</label><input className={inp + ' font-mono'} value={mstXuatHD} onChange={(e) => setMstXuatHD(e.target.value)} /></div>
                  <div className="sm:col-span-4"><label className={lbl}>Địa chỉ xuất HĐ</label><input className={inp} value={dcXuatHD} onChange={(e) => setDcXuatHD(e.target.value)} /></div>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Chỉ điền khi hợp đồng ký với <b>công ty</b>. Tên / SĐT / địa chỉ khách ở trên
                  vẫn giữ của <b>người</b>, không thay bằng thông tin công ty.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={submitting} className="rounded-lg bg-[#0e8c9a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0a6771] disabled:opacity-60">
          {submitting ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Tạo đơn'}
        </button>
        {!isEdit && <span className="text-xs text-slate-400">Mã đơn tự sinh (YYMMDD-{'{E|U|O}'}nnn) theo loại sản phẩm.</span>}
      </div>
    </form>
  )
}


/**
 * Nhãn dưới ô đơn giá: giá này ở đâu ra, và có đang bán dưới mức đã duyệt không.
 *
 * Cảnh báo chứ KHÔNG chặn — CEO chốt bán dưới giá là quyết định kinh doanh, có ca hợp lệ
 * (đổi trả, thanh lý). Chặn cứng là nhân viên đi đường vòng, app mất luôn dấu vết.
 */
function LineGiaNhan({
  g, daGo, laQua, onApLai,
}: { g: GiaGoiY | undefined; daGo: number; laQua: boolean; onApLai: (v: number) => void }) {
  if (!g || laQua) return <div className="col-span-12 hidden" />
  const lech = g.gia != null && daGo > 0 && daGo !== g.gia
  const duoi = g.gia != null && daGo > 0 && daGo < g.gia

  return (
    <div className="col-span-12 -mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-1 text-xs">
      {g.nguon === 'KHONG_RO' ? (
        <span className="text-amber-600">⚠ {g.nhan} — nhập tay giúp.</span>
      ) : (
        <span className={g.nguon === 'NIEM_YET' ? 'text-slate-400' : 'text-teal-700'}>
          {g.nguon === 'NIEM_YET' ? 'Giá niêm yết' : `Theo ${g.nhan}`}
          {g.gia != null && <> · <b>{fmtVnd(g.gia)}</b></>}
        </span>
      )}
      {duoi && <span className="text-rose-600">⚠ đang bán THẤP HƠN mức đã duyệt</span>}
      {lech && g.gia != null && (
        <button type="button" onClick={() => onApLai(g.gia as number)}
          className="text-teal-700 underline hover:text-teal-900">áp lại giá này</button>
      )}
    </div>
  )
}


/** Ô tick có nhãn bấm được — Sheet dùng checkbox, giữ nguyên kiểu cho quen tay. */
function OTick({
  nhan, giaTri, doi, chuThich,
}: { nhan: string; giaTri: boolean; doi: (v: boolean) => void; chuThich?: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700" title={chuThich}>
      <input type="checkbox" className="h-4 w-4 accent-[#0e8c9a]" checked={giaTri} onChange={(e) => doi(e.target.checked)} />
      {nhan}
    </label>
  )
}
