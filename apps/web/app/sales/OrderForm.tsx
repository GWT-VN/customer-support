'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TINH_VN } from '@/lib/tinh'
import { taoDon, suaDon, timKhachChoDon } from './actions'
import { fmtVnd } from './_ui'
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
} from './_types'

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
  vat_pct: null,
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

  const [lines, setLines] = useState<Line[]>(
    initial?.items?.length ? initial.items.map((it, i) => ({ ...it, key: i + 1 })) : [emptyLine(1)]
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function runSearch(q: string) {
    setCustQuery(q)
    if (q.trim().length < 2) return setCustHits([])
    startSearch(async () => setCustHits((await timKhachChoDon(q)) as CustomerHit[]))
  }
  const setLine = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const addLine = () => setLines((ls) => [...ls, emptyLine(Math.max(0, ...ls.map((l) => l.key)) + 1)])
  const removeLine = (key: number) => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls))

  const total = lines.reduce((s, l) => s + (l.is_gift ? 0 : (Number(l.quantity) || 0) * (Number(l.unit_price_vat) || 0)), 0)

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
        <div className="space-y-2">
          {lines.map((l) => (
            <div key={l.key} className="rounded-lg border border-slate-100 bg-slate-50/50 p-2">
              <div className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-12 sm:col-span-5">
                  <ProductPicker
                    catalog={catalog}
                    code={l.internal_code}
                    name={l.product_name}
                    onPick={(c) => setLine(l.key, { internal_code: c.internal_code, product_name: c.name, category_l1: c.category_l1, category_l2: c.category_l2 })}
                  />
                </div>
                <input type="number" min={0} className={inp + ' col-span-3 sm:col-span-2 text-right'} value={l.quantity} onChange={(e) => setLine(l.key, { quantity: Number(e.target.value) })} title="Số lượng (DVBT = số lần)" />
                <input type="number" min={0} step={1000} className={inp + ' col-span-4 sm:col-span-2 text-right'} value={l.unit_price_vat} onChange={(e) => setLine(l.key, { unit_price_vat: Number(e.target.value) })} placeholder="Đơn giá" disabled={l.is_gift} title="Đơn giá (sau VAT)" />
                <select
                  className={inp + ' col-span-2 sm:col-span-1 text-right'}
                  value={l.vat_pct ?? ''}
                  onChange={(e) => setLine(l.key, { vat_pct: e.target.value === '' ? null : Number(e.target.value) })}
                  title="Thuế suất VAT"
                >
                  {VAT_OPTS.map((v) => (
                    <option key={v.nhan} value={v.giaTri ?? ''}>{v.nhan}</option>
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
          <div><label className={lbl}>Mã đơn đối tác</label><input className={inp} value={partnerCode} onChange={(e) => setPartnerCode(e.target.value)} placeholder="Shopee / HĐ…" /></div>
          <div><label className={lbl}>Ngày lắp đặt</label><input type="date" className={inp} value={installDate} onChange={(e) => setInstallDate(e.target.value)} /></div>
          <div><label className={lbl}>Tình trạng hàng</label><select className={inp} value={status} onChange={(e) => setStatus(e.target.value)}>{FULFILL_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
          <div><label className={lbl}>Thanh toán</label><select className={inp} value={payment} onChange={(e) => setPayment(e.target.value)}>{PAYMENT_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
          <div><label className={lbl}>Hình thức TT</label><select className={inp} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>{PAYMETHOD_OPTS.map((o) => <option key={o} value={o}>{o || '— chọn —'}</option>)}</select></div>
          <div><label className={lbl}>Mã vận đơn</label><input className={inp} value={shippingCode} onChange={(e) => setShippingCode(e.target.value)} /></div>
          <div className="sm:col-span-1"><label className={lbl}>Tỉnh / TP</label>
            <select className={inp} value={province} onChange={(e) => setProvince(e.target.value)}>
              <option value="">— chọn —</option>
              {province && !TINH_VN.includes(province) && <option value={province}>{province} (cũ)</option>}
              {TINH_VN.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="sm:col-span-3"><label className={lbl}>Địa chỉ giao</label><input className={inp} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
        </div>
        <div className="mt-3"><label className={lbl}>Ghi chú đơn</label><textarea className={inp} rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>

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
