'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { coTheVaoSales, dataClient, requireNhanSu } from '@/lib/supabase'
import {
  createSalesOrder,
  updateSalesOrder,
  deleteSalesOrder,
  searchCustomersForPicker,
  findCustomerByPhone,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from './_db'
import type { NewOrderInput, CustomerInput } from './_types'

/** Gác khu Sales: nền tảng (mọi nhân sự) + phải có vai trò Sales. */
async function chanSales() {
  await requireNhanSu()
  if (!(await coTheVaoSales())) redirect('/?loi=khong_du_quyen')
}

function sach(q: string): string {
  return q.replace(/[,%()\\*]/g, ' ').trim().slice(0, 80)
}

export type DonRow = {
  order_code: string
  order_date: string | null
  source_tab: string | null
  customer_name: string | null
  province: string | null
  fulfillment_status: string | null
  payment_status: string | null
  line_count: number
  total_vat: number
  is_app: boolean
}

/** Đơn TẶNG (DON_TANG) từ customer_purchases, gộp theo order_code. */
async function donTang(s: string, tu = '', den = ''): Promise<DonRow[]> {
  const db = dataClient()
  let gq = db
    .from('customer_purchases')
    .select('order_code, order_date, customer_code, quantity')
    .eq('source_tab', 'DON_TANG')
    .limit(2000)
  if (tu) gq = gq.gte('order_date', tu)
  if (den) gq = gq.lte('order_date', den)
  const { data } = await gq
  const rows = (data ?? []) as Array<Record<string, unknown>>
  if (!rows.length) return []
  const codes = [...new Set(rows.map((r) => r.customer_code as string).filter(Boolean))]
  const nameByCode = new Map<string, string>()
  if (codes.length) {
    const { data: custs } = await db.from('customers').select('customer_code, name').in('customer_code', codes)
    for (const c of (custs ?? []) as Array<Record<string, unknown>>) nameByCode.set(c.customer_code as string, (c.name as string) ?? '')
  }
  const map = new Map<string, DonRow>()
  for (const r of rows) {
    const key = (r.order_code as string) || '(không mã)'
    const cur = map.get(key)
    if (!cur) {
      map.set(key, {
        order_code: key,
        order_date: (r.order_date as string) ?? null,
        source_tab: 'DON_TANG',
        customer_name: r.customer_code ? nameByCode.get(r.customer_code as string) ?? null : null,
        province: null,
        fulfillment_status: null,
        payment_status: null,
        line_count: 1,
        total_vat: 0,
        is_app: false,
      })
    } else cur.line_count += 1
  }
  const sl = s.toLowerCase()
  const all = [...map.values()]
  return s ? all.filter((g) => g.order_code.toLowerCase().includes(sl) || (g.customer_name ?? '').toLowerCase().includes(sl)) : all
}

/** Danh sách đơn: gộp mirror (sales_order_lines) + đơn app (sales_orders) + đơn tặng; lọc tab + ngày + trạng thái. */
export async function danhSachDon(q = '', tab = '', tu = '', den = '', tt = '', tp = ''): Promise<DonRow[]> {
  await chanSales()
  const db = dataClient()
  const s = sach(q)
  const onlyTang = tab === 'DON_TANG'
  const coLocTrangThai = !!(tt || tp)
  const map = new Map<string, DonRow>()

  if (!onlyTang) {
    let mq = db
      .from('sales_order_lines')
      .select('order_code, order_date, source_tab, customer_name, province, fulfillment_status, payment_status, amount_vat')
      .order('order_date', { ascending: false, nullsFirst: false })
      .limit(5000)
    if (tab) mq = mq.eq('source_tab', tab)
    if (tu) mq = mq.gte('order_date', tu)
    if (den) mq = mq.lte('order_date', den)
    if (tt) mq = mq.ilike('fulfillment_status', `%${tt}%`)
    if (tp) mq = mq.ilike('payment_status', `%${tp}%`)
    if (s) mq = mq.or(`order_code.ilike.%${s}%,customer_name.ilike.%${s}%,product_name.ilike.%${s}%`)
    const { data: lines, error } = await mq
    if (error) throw error
    for (const r of (lines ?? []) as Array<Record<string, unknown>>) {
      const key = (r.order_code as string) || '(không mã)'
      const amt = Number(r.amount_vat) || 0
      const cur = map.get(key)
      if (!cur) {
        map.set(key, {
          order_code: key,
          order_date: (r.order_date as string) ?? null,
          source_tab: (r.source_tab as string) ?? null,
          customer_name: (r.customer_name as string) ?? null,
          province: (r.province as string) ?? null,
          fulfillment_status: (r.fulfillment_status as string) ?? null,
          payment_status: (r.payment_status as string) ?? null,
          line_count: 1,
          total_vat: amt,
          is_app: false,
        })
      } else {
        cur.line_count += 1
        cur.total_vat += amt
      }
    }

    let aq = db
      .from('sales_orders')
      .select('order_code, order_date, source_tab, customer_name, province, status, payment_status, total_vat')
      .order('order_date', { ascending: false, nullsFirst: false })
      .limit(2000)
    if (tab) aq = aq.eq('source_tab', tab)
    if (tu) aq = aq.gte('order_date', tu)
    if (den) aq = aq.lte('order_date', den)
    if (tt) aq = aq.ilike('status', `%${tt}%`)
    if (tp) aq = aq.ilike('payment_status', `%${tp}%`)
    const { data: apps } = await aq
    const sl = s.toLowerCase()
    for (const o of (apps ?? []) as Array<Record<string, unknown>>) {
      const code = o.order_code as string
      if (s && !(code.toLowerCase().includes(sl) || String(o.customer_name ?? '').toLowerCase().includes(sl))) continue
      map.set(code, {
        order_code: code,
        order_date: (o.order_date as string) ?? null,
        source_tab: (o.source_tab as string) ?? null,
        customer_name: (o.customer_name as string) ?? null,
        province: (o.province as string) ?? null,
        fulfillment_status: (o.status as string) ?? null,
        payment_status: (o.payment_status as string) ?? null,
        line_count: 0,
        total_vat: Number(o.total_vat) || 0,
        is_app: true,
      })
    }
  }

  if ((!tab || onlyTang) && !coLocTrangThai) {
    for (const g of await donTang(s, tu, den)) map.set(g.order_code, g)
  }

  return [...map.values()]
    .sort((a, b) => (b.order_date ?? '').localeCompare(a.order_date ?? ''))
    .slice(0, 300)
}

export type KhachRow = {
  customer_code: string
  name: string | null
  phone: string | null
  province: string | null
  total_orders: number | null
  last_order_date: string | null
}

export async function danhSachKhach(q = ''): Promise<KhachRow[]> {
  await chanSales()
  const db = dataClient()
  const s = sach(q)
  let query = db
    .from('customers')
    .select('customer_code, name, phone, phone_chuan, province, province_moi, total_orders, last_order_date')
    .order('last_order_date', { ascending: false, nullsFirst: false })
    .limit(200)
  if (s) query = query.or(`name.ilike.%${s}%,phone.ilike.%${s}%,phone_chuan.ilike.%${s}%,customer_code.ilike.%${s}%`)
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as Array<Record<string, unknown>>).map((c) => ({
    customer_code: c.customer_code as string,
    name: (c.name as string) ?? null,
    phone: (c.phone_chuan as string) || (c.phone as string) || null,
    province: (c.province_moi as string) || (c.province as string) || null,
    total_orders: (c.total_orders as number) ?? null,
    last_order_date: (c.last_order_date as string) ?? null,
  }))
}

// ---------- Chi tiết đơn ----------
export type DonLine = {
  key: string
  product_name: string | null
  internal_code: string | null
  category_l1: string | null
  category_l2: string | null
  quantity: number | null
  unit_price_vat: number | null
  amount_vat: number | null
  note: string | null
}

export type DonChiTiet = {
  order_code: string
  order_date: string | null
  source_tab: string | null
  customer_code: string | null
  customer_name: string | null
  province: string | null
  address: string | null
  channel: string | null
  channel_detail: string | null
  fulfillment_status: string | null
  payment_status: string | null
  payment_method: string | null
  partner_order_code: string | null
  shipping_code: string | null
  install_date: string | null
  total_vat: number
  note: string | null
  created_by: string | null
  is_app: boolean
  lines: DonLine[]
}

const MIRROR_COLS =
  'id, source_tab, order_code, partner_order_code, category_l1, category_l2, order_date, channel, channel_detail, customer_name, province, internal_code, product_name, quantity, unit_price_vat, amount_vat, fulfillment_status, payment_status, note'

/** Chi tiết 1 đơn: ưu tiên đơn app (sales_orders + items), fallback mirror (sales_order_lines). */
export async function chiTietDon(orderCode: string): Promise<DonChiTiet | null> {
  await chanSales()
  const db = dataClient()

  // 1) Đơn tạo từ app
  const { data: h } = await db.from('sales_orders').select('*').eq('order_code', orderCode).maybeSingle()
  if (h) {
    const header = h as Record<string, unknown>
    const { data: items } = await db
      .from('sales_order_items')
      .select('*')
      .eq('order_id', header.order_id as string)
      .order('line_no', { ascending: true })
    const lines: DonLine[] = ((items ?? []) as Array<Record<string, unknown>>).map((it, i) => ({
      key: (it.item_id as string) || (it.id as string) || `it${i}`,
      product_name: (it.product_name as string) ?? null,
      internal_code: (it.internal_code as string) ?? null,
      category_l1: (it.category_l1 as string) ?? null,
      category_l2: (it.category_l2 as string) ?? null,
      quantity: (it.quantity as number) ?? null,
      unit_price_vat: (it.unit_price_vat as number) ?? null,
      amount_vat: (it.amount_vat as number) ?? null,
      note: (it.note as string) ?? null,
    }))
    return {
      order_code: header.order_code as string,
      order_date: (header.order_date as string) ?? null,
      source_tab: (header.source_tab as string) ?? null,
      customer_code: (header.customer_code as string) ?? null,
      customer_name: (header.customer_name as string) ?? null,
      province: (header.province as string) ?? null,
      address: (header.address as string) ?? null,
      channel: null,
      channel_detail: null,
      fulfillment_status: (header.status as string) ?? null,
      payment_status: (header.payment_status as string) ?? null,
      payment_method: (header.payment_method as string) ?? null,
      partner_order_code: (header.partner_order_code as string) ?? null,
      shipping_code: (header.shipping_code as string) ?? null,
      install_date: (header.install_date as string) ?? null,
      total_vat: Number(header.total_vat) || 0,
      note: (header.note as string) ?? null,
      created_by: (header.created_by as string) ?? null,
      is_app: true,
      lines,
    }
  }

  // 2) Đơn mirror (từ Google Sheet)
  const { data: rows, error } = await db
    .from('sales_order_lines')
    .select(MIRROR_COLS)
    .eq('order_code', orderCode)
    .order('id', { ascending: true })
  if (error) throw error
  const lr = (rows ?? []) as Array<Record<string, unknown>>
  if (lr.length === 0) return null
  const f = lr[0]
  const lines: DonLine[] = lr.map((r, i) => ({
    key: (r.id as string) || `l${i}`,
    product_name: (r.product_name as string) ?? null,
    internal_code: (r.internal_code as string) ?? null,
    category_l1: (r.category_l1 as string) ?? null,
    category_l2: (r.category_l2 as string) ?? null,
    quantity: (r.quantity as number) ?? null,
    unit_price_vat: (r.unit_price_vat as number) ?? null,
    amount_vat: (r.amount_vat as number) ?? null,
    note: (r.note as string) ?? null,
  }))
  return {
    order_code: (f.order_code as string) || orderCode,
    order_date: (f.order_date as string) ?? null,
    source_tab: (f.source_tab as string) ?? null,
    customer_code: null,
    customer_name: (f.customer_name as string) ?? null,
    province: (f.province as string) ?? null,
    address: null,
    channel: (f.channel as string) ?? null,
    channel_detail: (f.channel_detail as string) ?? null,
    fulfillment_status: (f.fulfillment_status as string) ?? null,
    payment_status: (f.payment_status as string) ?? null,
    payment_method: null,
    partner_order_code: (f.partner_order_code as string) ?? null,
    shipping_code: null,
    install_date: null,
    total_vat: lr.reduce((s, r) => s + (Number(r.amount_vat) || 0), 0),
    note: null,
    created_by: null,
    is_app: false,
    lines,
  }
}

// ---------- Khách 360 (Sales + CS) ----------
export type KhachChiTiet = {
  customer: {
    customer_code: string
    name: string | null
    phone: string | null
    province: string | null
    address: string | null
    company_invoice: string | null
    tax_code: string | null
    total_orders: number | null
    total_gift_orders: number | null
    first_order_date: string | null
    last_order_date: string | null
    note: string | null
  }
  daNoiCS: boolean
  purchases: Array<{
    key: string
    order_code: string | null
    order_date: string | null
    source_tab: string | null
    is_gift: boolean
    product_name: string | null
    internal_code: string | null
    category_l1: string | null
    category_l2: string | null
    quantity: number | null
  }>
  machines: Array<{
    serial: string
    internal_code: string | null
    model_freetext: string | null
    install_date: string | null
    install_address: string | null
    status: string | null
    full_end: string | null
    core_end: string | null
  }>
  maintenance: Array<{
    key: string
    loai_goi: string | null
    bo_may: string | null
    ngay_ky_hd: string | null
    so_nam: number | null
    chu_ky_thang: number | null
    trang_thai: string | null
  }>
  tickets: Array<{
    ticket_code: string
    ticket_type: string | null
    state: string | null
    description: string | null
    khan: boolean
    created_at: string | null
  }>
}

export async function chiTietKhach(customerCode: string): Promise<KhachChiTiet | null> {
  await chanSales()
  const db = dataClient()

  const [{ data: c, error: cErr }, { data: purchases }, { data: cs }] = await Promise.all([
    db
      .from('customers')
      .select(
        'customer_code, name, phone, phone_chuan, province, province_moi, address, company_invoice, tax_code, total_orders, total_gift_orders, first_order_date, last_order_date, note'
      )
      .eq('customer_code', customerCode)
      .maybeSingle(),
    db
      .from('customer_purchases')
      .select('id, order_code, order_date, source_tab, is_gift, internal_code, product_name, category_l1, category_l2, quantity')
      .eq('customer_code', customerCode)
      .order('order_date', { ascending: false, nullsFirst: false }),
    db.from('cs_customers').select('id, customer_code').eq('customer_code', customerCode).maybeSingle(),
  ])
  if (cErr) throw cErr
  if (!c) return null
  const cu = c as Record<string, unknown>
  const csRow = (cs as { id: string } | null) ?? null

  let machines: KhachChiTiet['machines'] = []
  let maintenance: KhachChiTiet['maintenance'] = []
  let tickets: KhachChiTiet['tickets'] = []

  if (csRow?.id) {
    const [ib, mp, tk] = await Promise.all([
      db
        .from('installed_base')
        .select('serial, internal_code, model_freetext, install_date, install_address, status')
        .eq('customer_id', csRow.id),
      db
        .from('maintenance_plan')
        .select('id, serial, bo_may, loai_goi, ngay_ky_hd, so_nam, chu_ky_thang, trang_thai')
        .eq('customer_id', csRow.id),
      db
        .from('tickets')
        .select('ticket_code, serial, ticket_type, state, description, last_note, khan, created_at')
        .eq('customer_id', csRow.id)
        .order('created_at', { ascending: false, nullsFirst: false }),
    ])
    const ibRows = (ib.data ?? []) as Array<Record<string, unknown>>
    const serials = ibRows.map((m) => m.serial as string).filter(Boolean)
    const warrantyBySerial = new Map<string, Record<string, unknown>>()
    if (serials.length) {
      const { data: wData } = await db
        .from('warranty')
        .select('serial, full_end, core_end')
        .in('serial', serials)
      for (const w of (wData ?? []) as Array<Record<string, unknown>>) warrantyBySerial.set(w.serial as string, w)
    }
    machines = ibRows.map((m) => {
      const w = warrantyBySerial.get(m.serial as string)
      return {
        serial: m.serial as string,
        internal_code: (m.internal_code as string) ?? null,
        model_freetext: (m.model_freetext as string) ?? null,
        install_date: (m.install_date as string) ?? null,
        install_address: (m.install_address as string) ?? null,
        status: (m.status as string) ?? null,
        full_end: (w?.full_end as string) ?? null,
        core_end: (w?.core_end as string) ?? null,
      }
    })
    maintenance = ((mp.data ?? []) as Array<Record<string, unknown>>).map((m, i) => ({
      key: (m.id as string) || `mp${i}`,
      loai_goi: (m.loai_goi as string) ?? null,
      bo_may: (m.bo_may as string) ?? null,
      ngay_ky_hd: (m.ngay_ky_hd as string) ?? null,
      so_nam: (m.so_nam as number) ?? null,
      chu_ky_thang: (m.chu_ky_thang as number) ?? null,
      trang_thai: (m.trang_thai as string) ?? null,
    }))
    tickets = ((tk.data ?? []) as Array<Record<string, unknown>>).map((t) => ({
      ticket_code: t.ticket_code as string,
      ticket_type: (t.ticket_type as string) ?? null,
      state: (t.state as string) ?? null,
      description: (t.description as string) || (t.last_note as string) || null,
      khan: !!t.khan,
      created_at: (t.created_at as string) ?? null,
    }))
  }

  return {
    customer: {
      customer_code: cu.customer_code as string,
      name: (cu.name as string) ?? null,
      phone: (cu.phone_chuan as string) || (cu.phone as string) || null,
      province: (cu.province_moi as string) || (cu.province as string) || null,
      address: (cu.address as string) ?? null,
      company_invoice: (cu.company_invoice as string) ?? null,
      tax_code: (cu.tax_code as string) ?? null,
      total_orders: (cu.total_orders as number) ?? null,
      total_gift_orders: (cu.total_gift_orders as number) ?? null,
      first_order_date: (cu.first_order_date as string) ?? null,
      last_order_date: (cu.last_order_date as string) ?? null,
      note: (cu.note as string) ?? null,
    },
    daNoiCS: !!csRow,
    purchases: ((purchases ?? []) as Array<Record<string, unknown>>).map((p, i) => ({
      key: (p.id as string) || `p${i}`,
      order_code: (p.order_code as string) ?? null,
      order_date: (p.order_date as string) ?? null,
      source_tab: (p.source_tab as string) ?? null,
      is_gift: !!p.is_gift,
      product_name: (p.product_name as string) ?? null,
      internal_code: (p.internal_code as string) ?? null,
      category_l1: (p.category_l1 as string) ?? null,
      category_l2: (p.category_l2 as string) ?? null,
      quantity: (p.quantity as number) ?? null,
    })),
    machines,
    maintenance,
    tickets,
  }
}

// ═══════════════════════ GHI: đơn + khách (app-owned) ═══════════════════════
type Kq<T = object> = ({ ok: true } & T) | { ok: false; error: string }

async function emailHienTai(): Promise<string | null> {
  return (await requireNhanSu()).email ?? null
}

function validateOrder(input: NewOrderInput): string | null {
  if (!input.items?.length) return 'Chưa thêm sản phẩm nào.'
  if (input.items.some((i) => !i.internal_code)) return 'Có dòng chưa chọn sản phẩm.'
  if (!input.order_date) return 'Thiếu ngày đơn.'
  if (!input.customer_code && !input.phone?.trim() && !input.customer_name?.trim())
    return 'Chọn khách cũ hoặc nhập tên/SĐT khách mới.'
  return null
}

export async function timKhachChoDon(q: string) {
  await chanSales()
  if (!q.trim()) return []
  return searchCustomersForPicker(q)
}

export async function kiemTraSdt(phone: string) {
  await chanSales()
  if (!phone.trim()) return null
  return findCustomerByPhone(phone)
}

export async function taoDon(input: NewOrderInput): Promise<Kq<{ order_code: string }>> {
  await chanSales()
  const err = validateOrder(input)
  if (err) return { ok: false, error: err }
  try {
    const res = await createSalesOrder(input, await emailHienTai())
    revalidatePath('/sales')
    return { ok: true, order_code: res.order_code }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function suaDon(orderCode: string, input: NewOrderInput): Promise<Kq<{ order_code: string }>> {
  await chanSales()
  const err = validateOrder(input)
  if (err) return { ok: false, error: err }
  try {
    const res = await updateSalesOrder(orderCode, input)
    revalidatePath('/sales')
    revalidatePath(`/sales/don/${orderCode}`)
    return { ok: true, order_code: res.order_code }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function xoaDon(orderCode: string): Promise<Kq> {
  await chanSales()
  try {
    await deleteSalesOrder(orderCode)
    revalidatePath('/sales')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function taoKhach(input: CustomerInput): Promise<Kq<{ customer_code: string }>> {
  await chanSales()
  if (!input.name?.trim() && !input.phone?.trim()) return { ok: false, error: 'Cần ít nhất Tên hoặc SĐT.' }
  try {
    const res = await createCustomer(input)
    revalidatePath('/sales/khach')
    return { ok: true, customer_code: res.customer_code }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function suaKhach(code: string, input: CustomerInput): Promise<Kq<{ customer_code: string }>> {
  await chanSales()
  try {
    await updateCustomer(code, input)
    revalidatePath('/sales/khach')
    revalidatePath(`/sales/khach/${code}`)
    return { ok: true, customer_code: code }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function xoaKhach(code: string): Promise<Kq> {
  await chanSales()
  try {
    await deleteCustomer(code)
    revalidatePath('/sales/khach')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
