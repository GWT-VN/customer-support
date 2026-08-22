'use server'

import { revalidatePath } from 'next/cache'
import { traKhachTheoSdt } from '@/lib/tra-khach'
import type { KetQuaTraKhach } from '@/lib/tra-khach-chung'
import type { Kenh } from '@/app/actions'
import { ctkmChoDon, type Bac, type BoiCanhGia, type ChinhSachGia, type Ctkm } from './_ctkm'
import { redirect } from 'next/navigation'
import { dataClient } from '@/lib/nen-tang/db'
import { coTheVaoSales } from '@/lib/nen-tang/gac-cong'
import { requireNhanSu } from '@/lib/nen-tang/phien'
import { ghiAudit } from '@/lib/nen-tang/nhat-ky'
import {
  createSalesOrder,
  updateSalesOrder,
  deleteSalesOrder,
  searchCustomersForPicker,
  findCustomerByPhone,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  isAppCustomer,
} from './_db'
import { tinhKhuyenMai, tongDon } from './_calc'
import { cacBienThe, gomDanhSachTinh } from '@/lib/tinhGom'
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
async function donTang(s: string): Promise<DonRow[]> {
  const db = dataClient()
  const { data } = await db
    .from('customer_purchases')
    .select('order_code, order_date, customer_code, quantity')
    .eq('source_tab', 'DON_TANG')
    .limit(2000)
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

/**
 * Bộ lọc danh sách đơn. Tên tham số theo `docs/CHUAN-FILTER.md` — `ngtu`/`ngden` là
 * tên chuẩn TOÀN APP cho lọc ngày, đừng đặt tên khác.
 */
export type LocDon = {
  ngtu?: string
  ngden?: string
  tt?: string
  tp?: string
  /** Kênh cấp 1 (`sales_order_lines.channel`). */
  kenh?: string
  /** Kênh cấp 2 / chi tiết kênh (`sales_order_lines.channel_detail`). */
  kenh2?: string
  sp?: string
}

/** Danh sách đơn: gộp mirror (sales_order_lines) + đơn app (sales_orders) + đơn tặng, lọc theo tab. */
export async function danhSachDon(q = '', tab = '', loc: LocDon = {}): Promise<DonRow[]> {
  await chanSales()
  const db = dataClient()
  const s = sach(q)
  const onlyTang = tab === 'DON_TANG'
  const map = new Map<string, DonRow>()
  // Đơn TẶNG không có tình trạng / thanh toán / kênh / sản phẩm-lọc-được. Bật một trong
  // các lọc đó mà vẫn trả đơn tặng thì kết quả lẫn lộn -> loại hẳn nhóm đó ra.
  const locNghiepVu = !!(loc.tt || loc.tp || loc.kenh || loc.kenh2 || loc.sp)

  if (!onlyTang) {
    let mq = db
      .from('sales_order_lines')
      .select('order_code, order_date, source_tab, customer_name, province, fulfillment_status, payment_status, amount_vat')
      .order('order_date', { ascending: false, nullsFirst: false })
      .limit(5000)
    if (tab) mq = mq.eq('source_tab', tab)
    if (s) mq = mq.or(`order_code.ilike.%${s}%,customer_name.ilike.%${s}%,product_name.ilike.%${s}%`)
    if (loc.ngtu) mq = mq.gte('order_date', loc.ngtu)
    if (loc.ngden) mq = mq.lte('order_date', loc.ngden)
    if (loc.tt) mq = mq.eq('fulfillment_status', loc.tt)
    if (loc.tp) mq = mq.eq('payment_status', loc.tp)
    if (loc.kenh) mq = mq.eq('channel', loc.kenh)
    if (loc.kenh2) mq = mq.eq('channel_detail', loc.kenh2)
    // internal_code nằm ở DÒNG, không ở đơn -> lọc sản phẩm trả về đơn CÓ CHỨA sản phẩm đó,
    // và line_count/total_vat khi ấy chỉ tính các dòng khớp. Giao diện phải nói rõ chuyện này.
    if (loc.sp) mq = mq.eq('internal_code', loc.sp)
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
      .select('order_id, order_code, order_date, source_tab, customer_name, province, status, payment_status, total_vat')
      .order('order_date', { ascending: false, nullsFirst: false })
      .limit(2000)
    if (tab) aq = aq.eq('source_tab', tab)
    if (loc.ngtu) aq = aq.gte('order_date', loc.ngtu)
    if (loc.ngden) aq = aq.lte('order_date', loc.ngden)
    if (loc.tt) aq = aq.eq('status', loc.tt)
    if (loc.tp) aq = aq.eq('payment_status', loc.tp)
    if (loc.kenh) {
      // Đơn mirror lưu TÊN kênh (`channel` text); đơn app lưu `channel_id` (số) -> phải
      // quy tên sang id, không so thẳng được. Không có id nào khớp thì không có đơn app nào
      // thuộc kênh đó: dùng -1 để truy vấn trả rỗng, thay vì bỏ qua bộ lọc.
      const { data: dc } = await db.from('dim_channel').select('id').eq('channel_l1', loc.kenh)
      const ids = ((dc ?? []) as Array<{ id: number }>).map((r) => r.id)
      aq = aq.in('channel_id', ids.length ? ids : [-1])
    }
    // Lọc theo sản phẩm: đơn app giữ sản phẩm ở `sales_order_items`, không có cột nào trên
    // header để lọc -> lấy trước danh sách order_id có mã đó.
    // Đơn app chỉ có channel_id (kênh cấp 1), không lưu kênh cấp 2 -> lọc cấp 2 thì
    // không đơn app nào khớp. Trả rỗng thay vì lờ bộ lọc đi.
    if (loc.kenh2) aq = aq.in('order_id', ['00000000-0000-0000-0000-000000000000'])
    if (loc.sp) {
      const { data: it } = await db.from('sales_order_items').select('order_id').eq('internal_code', loc.sp)
      const ids = [...new Set(((it ?? []) as Array<{ order_id: string }>).map((r) => r.order_id))]
      aq = aq.in('order_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
    }
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

  if ((!tab || onlyTang) && !locNghiepVu) {
    for (const g of await donTang(s)) {
      if (loc.ngtu && (g.order_date ?? '') < loc.ngtu) continue
      if (loc.ngden && (g.order_date ?? '') > loc.ngden) continue
      map.set(g.order_code, g)
    }
  }

  return [...map.values()]
    .sort((a, b) => (b.order_date ?? '').localeCompare(a.order_date ?? ''))
    .slice(0, 300)
}

/**
 * Kênh có THẬT trong đơn (không lấy cả `dim_channel` để khỏi hiện kênh chưa dùng bao giờ).
 * Gom trùng bằng cách so bản đã bỏ khoảng trắng thừa — xem "một giá trị nhiều cách viết"
 * trong docs/CHUAN-FILTER.md.
 */
export async function kenhTrongDon(): Promise<string[]> {
  await chanSales()
  const db = dataClient()
  const { data } = await db
    .from('sales_order_lines')
    .select('channel')
    .not('channel', 'is', null)
    .limit(5000)
  const set = new Map<string, string>()
  for (const r of (data ?? []) as Array<{ channel: string }>) {
    const v = String(r.channel).trim()
    if (v) set.set(v.toLowerCase(), v)
  }
  return [...set.values()].sort((a, b) => a.localeCompare(b, 'vi'))
}

/**
 * Cặp (kênh cấp 1, kênh cấp 2) có thật trong đơn. Trang dùng để dựng ô lọc cấp 2 và
 * THU HẸP theo cấp 1 đang chọn — chọn "Đại lý" thì cấp 2 chỉ hiện đại lý, không hiện
 * chi tiết của kênh khác.
 */
export async function kenhChiTietTrongDon(): Promise<{ kenh: string; chiTiet: string }[]> {
  await chanSales()
  const db = dataClient()
  const { data } = await db
    .from('sales_order_lines')
    .select('channel, channel_detail')
    .not('channel_detail', 'is', null)
    .limit(5000)
  const set = new Map<string, { kenh: string; chiTiet: string }>()
  for (const r of (data ?? []) as Array<{ channel: string | null; channel_detail: string }>) {
    const ct = String(r.channel_detail).trim()
    if (!ct) continue
    const k = String(r.channel ?? '').trim()
    set.set(`${k.toLowerCase()}|${ct.toLowerCase()}`, { kenh: k, chiTiet: ct })
  }
  return [...set.values()].sort((a, b) => a.chiTiet.localeCompare(b.chiTiet, 'vi'))
}

/** Mã sản phẩm có THẬT trong đơn. Nhãn = mã nội bộ (ngắn), như ô lọc Sản phẩm bên CSKH. */
export async function spTrongDon(): Promise<{ ma: string; ten: string }[]> {
  await chanSales()
  const db = dataClient()
  const { data } = await db
    .from('sales_order_lines')
    .select('internal_code, product_name')
    .not('internal_code', 'is', null)
    .limit(5000)
  const set = new Map<string, string>()
  for (const r of (data ?? []) as Array<{ internal_code: string; product_name: string | null }>) {
    const ma = String(r.internal_code).trim()
    if (!ma) continue
    const ten = String(r.product_name ?? '').trim()
    // Giữ tên ĐẦU TIÊN gặp được: cùng một mã có thể ghi tên hơi khác nhau giữa các dòng.
    if (!set.has(ma) || (!set.get(ma) && ten)) set.set(ma, ten)
  }
  return [...set.entries()].map(([ma, ten]) => ({ ma, ten })).sort((a, b) => a.ma.localeCompare(b.ma))
}

export type KhachRow = {
  customer_code: string
  name: string | null
  phone: string | null
  province: string | null
  total_orders: number | null
  last_order_date: string | null
}

/** Mọi giá trị Tỉnh thô đang có trong `customers` — nguồn để dựng ô lọc và tra biến thể. */
async function tinhThoCuaKhach(db: ReturnType<typeof dataClient>): Promise<string[]> {
  const { data } = await db.from('customers').select('province').not('province', 'is', null).limit(5000)
  return ((data ?? []) as Array<{ province: string }>).map((r) => r.province)
}

/** Danh sách Tỉnh cho ô lọc, đã gom biến thể (HCM / TP. Hồ Chí Minh / Hồ Chí Minh -> một mục). */
export async function tinhTrongKhach(): Promise<string[]> {
  await chanSales()
  return gomDanhSachTinh(await tinhThoCuaKhach(dataClient()))
}

/**
 * Kênh của từng khách, SUY TỪ ĐƠN: `customer_purchases` (có customer_code) nối
 * `sales_order_lines` (có channel) theo `order_code`.
 *
 * Vì sao không đọc `customers.channel_id`: cột đó vừa thêm 21/08 và **đang rỗng toàn bộ**
 * (0/412 khách). Khi nào có người điền thì đọc thẳng cột đó sẽ nhanh hơn.
 * Hai bảng đều nhỏ (822 + 810 dòng) nên gom trong bộ nhớ là đủ.
 */
export async function kenhTheoKhach(): Promise<Map<string, string[]>> {
  await chanSales()
  const db = dataClient()
  const [cp, sol] = await Promise.all([
    db.from('customer_purchases').select('customer_code, order_code').not('customer_code', 'is', null).limit(5000),
    db.from('sales_order_lines').select('order_code, channel').not('channel', 'is', null).limit(5000),
  ])
  const kenhTheoDon = new Map<string, string>()
  for (const r of ((sol.data ?? []) as Array<{ order_code: string; channel: string }>)) {
    if (r.order_code && !kenhTheoDon.has(r.order_code)) kenhTheoDon.set(r.order_code, String(r.channel).trim())
  }
  const ra = new Map<string, string[]>()
  for (const r of ((cp.data ?? []) as Array<{ customer_code: string; order_code: string }>)) {
    const k = kenhTheoDon.get(r.order_code)
    if (!k) continue
    const cur = ra.get(r.customer_code)
    if (cur) { if (!cur.includes(k)) cur.push(k) } else ra.set(r.customer_code, [k])
  }
  return ra
}

export type LocKhach = { tinh?: string; kenh?: string }

export async function danhSachKhach(q = '', loc: LocKhach = {}): Promise<KhachRow[]> {
  await chanSales()
  const db = dataClient()
  const s = sach(q)
  let query = db
    .from('customers')
    // Dùng `province` (KHÔNG `province_moi`): quy ước chung chốt 21/08 là `province` giữ
    // tỉnh hiện hành, và `province_moi` sắp bỏ. Xem SYSTEM.md §8.
    .select('customer_code, name, phone, phone_chuan, province, total_orders, last_order_date')
    .order('last_order_date', { ascending: false, nullsFirst: false })
    .limit(200)
  if (s) query = query.or(`name.ilike.%${s}%,phone.ilike.%${s}%,phone_chuan.ilike.%${s}%,customer_code.ilike.%${s}%`)
  if (loc.tinh) {
    // Một tỉnh có nhiều cách viết trong DB -> khớp MỌI biến thể, không chỉ tên đã gom.
    const bienThe = cacBienThe(loc.tinh, await tinhThoCuaKhach(db))
    query = query.in('province', bienThe.length ? bienThe : ['\u0000'])
  }
  const { data, error } = await query
  if (error) throw error
  let rows = ((data ?? []) as Array<Record<string, unknown>>).map((c) => ({
    customer_code: c.customer_code as string,
    name: (c.name as string) ?? null,
    phone: (c.phone_chuan as string) || (c.phone as string) || null,
    province: (c.province as string) ?? null,
    total_orders: (c.total_orders as number) ?? null,
    last_order_date: (c.last_order_date as string) ?? null,
  }))
  if (loc.kenh) {
    const map = await kenhTheoKhach()
    rows = rows.filter((r) => (map.get(r.customer_code) ?? []).includes(loc.kenh as string))
  }
  return rows
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
  /** Giá/tiền TRƯỚC VAT. Chỉ đơn từ Sheet có sẵn; đơn app = null -> suy từ vat_pct. */
  unit_price_net: number | null
  amount_net: number | null
  /** PHÂN SỐ: 0.08 = 8%. Xem tachVat() trong _calc.ts. */
  vat_pct: number | null
  /** VAT = chịu thuế · KCT = không chịu thuế (muối) · KAD = không áp dụng (bình gas). */
  vat_loai: 'VAT' | 'KCT' | 'KAD' | null
  /** Giá niêm yết 1 đơn vị, ĐÃ GỒM VAT. null = mã chưa có trong bảng giá. */
  gia_niem_yet: number | null
  /** (giá niêm yết × SL) − thành tiền. null = không tính được, hoặc dòng quà. */
  khuyen_mai: number | null
  /** Đơn bán từ Sheet luôn false — quà từ Sheet là cả một đơn DON_TANG riêng. */
  is_gift: boolean
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
  /** Tổng SAU VAT. */
  total_vat: number
  /** Tổng TRƯỚC VAT. */
  total_net: number
  /** Tiền VAT = total_vat - total_net. */
  total_vat_tien: number
  note: string | null
  created_by: string | null
  is_app: boolean
  lines: DonLine[]
}

const MIRROR_COLS =
  'id, source_tab, order_code, partner_order_code, category_l1, category_l2, order_date, channel, channel_detail, customer_name, province, internal_code, product_name, quantity, unit_price_vat, amount_vat, unit_price_net, amount_net, vat_pct, vat_loai, fulfillment_status, payment_status, note'

/**
 * Giá niêm yết theo mã, lấy bản CÒN HIỆU LỰC tại `ngay` (mặc định hôm nay).
 * Bảng `product_price` là GƯƠNG từ Masterdata, chỉ đọc.
 */
async function giaNiemYetTheoMa(
  db: ReturnType<typeof dataClient>,
  maList: string[],
  ngay: string | null
): Promise<Map<string, number>> {
  const ra = new Map<string, number>()
  const ma = [...new Set(maList.filter(Boolean))]
  if (!ma.length) return ra
  const { data } = await db
    .from('product_price')
    .select('internal_code, gia_vat, hieu_luc_tu, hieu_luc_den')
    .in('internal_code', ma)
    .eq('kenh', 'NIEM_YET')
  const moc = ngay || new Date().toISOString().slice(0, 10)
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    const tu = (r.hieu_luc_tu as string) ?? ''
    const den = (r.hieu_luc_den as string) ?? null
    // Đơn CŨ hơn ngày bảng giá bắt đầu có hiệu lực vẫn lấy bảng giá hiện có —
    // thà so với giá đang niêm yết còn hơn bỏ trống cột Khuyến mãi.
    if (den && moc > den) continue
    const gia = Number(r.gia_vat) || 0
    const code = r.internal_code as string
    // Nhiều mốc hiệu lực -> lấy mốc MỚI NHẤT còn áp dụng được.
    if (!ra.has(code) || tu <= moc) ra.set(code, gia)
  }
  return ra
}

/**
 * Chi tiết đơn TẶNG (`source_tab = 'DON_TANG'`) — chỉ tồn tại ở `customer_purchases`.
 * Bảng đó KHÔNG có cột tiền, nên mọi số tiền để 0 và giao diện không bịa ra giá.
 */
async function chiTietDonTang(
  db: ReturnType<typeof dataClient>,
  orderCode: string
): Promise<DonChiTiet | null> {
  const { data } = await db
    .from('customer_purchases')
    .select('id, order_code, order_date, source_tab, customer_code, is_gift, internal_code, product_name, category_l1, category_l2, quantity')
    .eq('order_code', orderCode)
    .order('id', { ascending: true })
  const rows = (data ?? []) as Array<Record<string, unknown>>
  if (rows.length === 0) return null
  const f = rows[0]

  let customer_name: string | null = null
  const cc = (f.customer_code as string) ?? null
  if (cc) {
    const { data: kh } = await db.from('customers').select('name').eq('customer_code', cc).maybeSingle()
    customer_name = ((kh as { name: string } | null)?.name) ?? null
  }

  return {
    order_code: (f.order_code as string) || orderCode,
    order_date: (f.order_date as string) ?? null,
    source_tab: (f.source_tab as string) ?? 'DON_TANG',
    customer_code: cc,
    customer_name,
    province: null,
    address: null,
    channel: null,
    channel_detail: null,
    fulfillment_status: null,
    payment_status: null,
    payment_method: null,
    partner_order_code: null,
    shipping_code: null,
    install_date: null,
    total_vat: 0,
    total_net: 0,
    total_vat_tien: 0,
    note: null,
    created_by: null,
    is_app: false,
    lines: rows.map((r, i) => ({
      key: String(r.id ?? `t${i}`),
      product_name: (r.product_name as string) ?? null,
      internal_code: (r.internal_code as string) ?? null,
      category_l1: (r.category_l1 as string) ?? null,
      category_l2: (r.category_l2 as string) ?? null,
      quantity: (r.quantity as number) ?? null,
      unit_price_vat: null,
      amount_vat: null,
      unit_price_net: null,
      amount_net: null,
      vat_pct: null,
      vat_loai: null,
      gia_niem_yet: null,
      khuyen_mai: null,
      is_gift: !!r.is_gift, // đơn tặng: cờ quà CÓ THẬT ở bảng này
      note: null,
    })),
  }
}

/** Chi tiết 1 đơn: đơn app (sales_orders) -> mirror Sheet (sales_order_lines) -> đơn tặng (customer_purchases). */
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
      unit_price_net: null, // sales_order_items không lưu giá trước VAT
      amount_net: null,     // -> tongDon() suy từ vat_pct
      vat_pct: it.vat_pct == null ? null : Number(it.vat_pct),
      vat_loai: (it.vat_loai as 'VAT' | 'KCT' | 'KAD' | null) ?? null,
      gia_niem_yet: null,
      khuyen_mai: null,
      is_gift: !!it.is_gift,
      note: (it.note as string) ?? null,
    }))
    const giaMap = await giaNiemYetTheoMa(db, lines.map((l) => l.internal_code ?? ''), (header.order_date as string) ?? null)
    for (const l of lines) {
      l.gia_niem_yet = l.internal_code ? giaMap.get(l.internal_code) ?? null : null
      l.khuyen_mai = tinhKhuyenMai(l.gia_niem_yet, l.quantity, l.amount_vat, l.is_gift)
    }
    const tong = tongDon(lines)
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
      total_vat: tong.sauVat, // lấy từ dòng đang hiện, không từ header — lệch thì phải thấy
      total_net: tong.net,
      total_vat_tien: tong.vat,
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
  // Nhánh 3: đơn TẶNG. Danh sách dựng tab Tặng từ `customer_purchases`, nhưng đơn tặng
  // KHÔNG có trong sales_orders lẫn sales_order_lines -> bấm vào là 404. Lỗi CEO báo 21/08.
  if (lr.length === 0) return chiTietDonTang(db, orderCode)
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
    unit_price_net: (r.unit_price_net as number) ?? null,
    amount_net: (r.amount_net as number) ?? null,
    vat_pct: r.vat_pct == null ? null : Number(r.vat_pct),
    vat_loai: (r.vat_loai as 'VAT' | 'KCT' | 'KAD' | null) ?? null,
    gia_niem_yet: null,
    khuyen_mai: null,
    is_gift: false, // đơn bán từ Sheet KHÔNG có dòng quà — quà là đơn DON_TANG riêng
    note: (r.note as string) ?? null,
  }))
  const giaMap = await giaNiemYetTheoMa(db, lines.map((l) => l.internal_code ?? ''), (f.order_date as string) ?? null)
  for (const l of lines) {
    l.gia_niem_yet = l.internal_code ? giaMap.get(l.internal_code) ?? null : null
    l.khuyen_mai = tinhKhuyenMai(l.gia_niem_yet, l.quantity, l.amount_vat, l.is_gift)
  }
  const tong = tongDon(lines)
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
    total_vat: tong.sauVat,
    total_net: tong.net,
    total_vat_tien: tong.vat,
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
    kenh: string | null
    sales_owner: string | null
    email: string | null
    dia_chi_cty: string | null
    sdt_cty: string | null
    nguoi_dai_dien: string | null
    chuc_vu_dai_dien: string | null
    ma_kh: string | null
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
        'customer_code, name, phone, phone_chuan, province, province_moi, address, company_invoice, tax_code, total_orders, total_gift_orders, first_order_date, last_order_date, note, channel_id, sales_owner, email, dia_chi_cty, sdt_cty, email_cty, nguoi_dai_dien, chuc_vu_dai_dien, ma_kh'
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

  // Người phụ trách: hồ sơ hiện TÊN, không hiện email — email là khoá lưu, không phải thứ để đọc.
  let tenNguoiPhuTrach: string | null = (cu.sales_owner as string) ?? null
  if (tenNguoiPhuTrach) {
    const { data: nv } = await db.from('staff').select('ten').eq('email', tenNguoiPhuTrach).maybeSingle()
    const t = (nv as { ten?: string } | null)?.ten
    if (t) tenNguoiPhuTrach = t
  }

  // Tên kênh 2 cấp — hồ sơ hiện chữ, không hiện số id.
  let tenKenh: string | null = null
  if (cu.channel_id != null) {
    const { data: dc } = await db
      .from('dim_channel').select('channel_l1, channel_l2').eq('id', cu.channel_id).maybeSingle()
    const k = dc as { channel_l1?: string; channel_l2?: string | null } | null
    if (k) tenKenh = [k.channel_l1, k.channel_l2].filter(Boolean).join(' · ') || null
  }
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
      kenh: tenKenh,
      sales_owner: tenNguoiPhuTrach,
      email: (cu.email as string) ?? null,
      dia_chi_cty: (cu.dia_chi_cty as string) ?? null,
      sdt_cty: (cu.sdt_cty as string) ?? null,
      nguoi_dai_dien: (cu.nguoi_dai_dien as string) ?? null,
      chuc_vu_dai_dien: (cu.chuc_vu_dai_dien as string) ?? null,
      ma_kh: (cu.ma_kh as string) ?? null,
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


/**
 * Bọc một thao tác GHI của Sales bằng nhật ký — ghi cả khi THÀNH CÔNG lẫn khi HỎNG.
 *
 * Vì sao phải ghi cả lúc hỏng (luật rút ra 22/08, phiên CSKH trả giá): đường ghi chỉ ghi
 * nhật ký sau khi insert thành công thì lúc tính năng gãy, nó **không để lại dấu vết nào**
 * — 0 dòng dữ liệu, 0 dòng nhật ký, im lặng tuyệt đối. Bên CSKH nút "thêm SĐT phụ" hỏng
 * suốt một thời gian dài mà không ai biết, phải suy gián tiếp mới lần ra.
 *
 * Vì sao Sales cần gấp: lộ trình bỏ Google Sheet (§8, rủi ro 1) — Sheet đang là lưới an toàn
 * vì Google giữ lịch sử phiên bản, ai lỡ tay còn khôi phục được. Bỏ Sheet là mất lưới đó,
 * nên **nhật ký sửa/xoá đơn phải có TRƯỚC**, không làm sau.
 *
 * Nhật ký không bao giờ được làm hỏng thao tác chính: `ghiAudit` đã tự nuốt lỗi bên trong.
 */
async function ghiLai<T>(
  hanhDong: string,
  doiTuong: string,
  chiTiet: Record<string, unknown>,
  viec: () => Promise<T>
): Promise<Kq<T extends object ? T : never> | { ok: false; error: string }> {
  try {
    const kq = await viec()
    await ghiAudit(hanhDong, doiTuong, chiTiet)
    return { ok: true, ...(kq as object) } as Kq<T extends object ? T : never>
  } catch (e) {
    const loi = e instanceof Error ? e.message : String(e)
    await ghiAudit(hanhDong, doiTuong, { ...chiTiet, loi }, 'loi')
    return { ok: false, error: loi }
  }
}

export async function taoDon(input: NewOrderInput): Promise<Kq<{ order_code: string }>> {
  await chanSales()
  const err = validateOrder(input)
  if (err) return { ok: false, error: err }
  const kq = await ghiLai('sales_tao_don', '(mã cấp khi lưu)',
    { khach: input.customer_code, so_dong: input.items.length },
    async () => createSalesOrder(input, await emailHienTai()))
  if (kq.ok) revalidatePath('/sales')
  return kq
}

export async function suaDon(orderCode: string, input: NewOrderInput): Promise<Kq<{ order_code: string }>> {
  await chanSales()
  const err = validateOrder(input)
  if (err) return { ok: false, error: err }
  const kq = await ghiLai('sales_sua_don', `don:${orderCode}`,
    { so_dong: input.items.length },
    () => updateSalesOrder(orderCode, input))
  if (kq.ok) {
    revalidatePath('/sales')
    revalidatePath(`/sales/don/${orderCode}`)
  }
  return kq
}

export async function xoaDon(orderCode: string): Promise<Kq> {
  await chanSales()
  const kq = await ghiLai('sales_xoa_don', `don:${orderCode}`, {},
    async () => { await deleteSalesOrder(orderCode); return {} })
  if (kq.ok) revalidatePath('/sales')
  return kq
}

export async function taoKhach(input: CustomerInput): Promise<Kq<{ customer_code: string }>> {
  await chanSales()
  if (!input.name?.trim() && !input.phone?.trim()) return { ok: false, error: 'Cần ít nhất Tên hoặc SĐT.' }
  const kq = await ghiLai('sales_tao_khach', '(mã cấp khi lưu)',
    { co_sdt: !!input.phone?.trim() },
    () => createCustomer(input))
  if (kq.ok) revalidatePath('/sales/khach')
  return kq
}

export async function suaKhach(code: string, input: CustomerInput): Promise<Kq<{ customer_code: string }>> {
  await chanSales()
  const kq = await ghiLai('sales_sua_khach', `khach:${code}`,
    { tu_sheet: !isAppCustomer(code) },
    async () => { await updateCustomer(code, input); return { customer_code: code } })
  if (kq.ok) {
    revalidatePath('/sales/khach')
    revalidatePath(`/sales/khach/${code}`)
  }
  return kq
}

export async function xoaKhach(code: string): Promise<Kq> {
  await chanSales()
  const kq = await ghiLai('sales_xoa_khach', `khach:${code}`, {},
    async () => { await deleteCustomer(code); return {} })
  if (kq.ok) revalidatePath('/sales/khach')
  return kq
}


/**
 * Tra SĐT xem đã có khách chưa — DÙNG CHUNG hàm với CSKH (`traKhachTheoSdt`).
 *
 * Không gọi `traKhachChung()` của CS: hàm đó gác bằng quyền `cs.khach.xem`, nhân viên Sales
 * không có. Mỗi khu gác bằng quyền khu mình rồi mới gọi vào lõi chung — đúng luật ghi trong
 * `lib/khach-lien-he.ts`. Lõi chung thì phải là MỘT, nếu không hai khu tra ra hai kết quả
 * khác nhau cho cùng một số.
 */
export async function traSdtSales(sdt: string): Promise<KetQuaTraKhach> {
  await chanSales()
  return traKhachTheoSdt(sdt)
}

/** dim_channel 2 cấp cho ô chọn kênh. */
export async function kenhChonDuoc(): Promise<Kenh[]> {
  await chanSales()
  const { data } = await dataClient()
    .from('dim_channel')
    .select('id, channel_l1, channel_l2')
    .order('channel_l1')
    .order('channel_l2')
  return ((data ?? []) as Array<Record<string, unknown>>).map((d) => ({
    id: d.id as number,
    channel_l1: (d.channel_l1 as string) ?? '',
    channel_l2: (d.channel_l2 as string) ?? null,
  }))
}

/**
 * Gom mọi thứ cần để tự bắt giá cho một khách — CEO chốt: *"Khi lên đơn hàng các khách này
 * trong tháng sẽ tự bắt được ctkm/chiết khấu đang áp dụng"*.
 *
 * Gọi MỘT lần lúc chọn khách, không gọi lại theo từng dòng hàng: một đơn 5 dòng mà mỗi dòng
 * một vòng gọi server là 5 lần chờ, trong khi dữ liệu y hệt nhau.
 */
export async function boiCanhGia(
  customerCode: string | null,
  channelIdTruyenVao: number | null,
  ngay: string
): Promise<BoiCanhGia> {
  await chanSales()
  const db = dataClient()

  let bac: Bac | null = null
  let channelId = channelIdTruyenVao

  if (customerCode) {
    const [{ data: bacRow }, { data: kh }] = await Promise.all([
      db.from('sales_bac_khach').select('bac')
        .eq('customer_code', customerCode).is('hieu_luc_den', null).maybeSingle(),
      db.from('customers').select('channel_id').eq('customer_code', customerCode).maybeSingle(),
    ])
    if (bacRow) bac = (bacRow as { bac: Bac }).bac
    if (channelId == null) channelId = ((kh as { channel_id: number | null } | null)?.channel_id) ?? null
  }

  const [cs, gia, ct, ctKenh, ctSp] = await Promise.all([
    db.from('sales_chinh_sach_gia').select('*').eq('trang_thai', 'ban_hanh'),
    db.from('product_price').select('internal_code, gia_vat').eq('kenh', 'NIEM_YET'),
    db.from('sales_ctkm').select('id, ten, tu_ngay, den_ngay, kieu_giam, muc_chung, giam_toi_da, trang_thai')
      .eq('trang_thai', 'ban_hanh'),
    db.from('sales_ctkm_kenh').select('ctkm_id, channel_id'),
    db.from('sales_ctkm_sp').select('ctkm_id, internal_code, muc'),
  ])

  const niemYet: Record<string, number> = {}
  for (const g of ((gia.data ?? []) as Array<Record<string, unknown>>)) {
    const ma = g.internal_code as string
    const v = Number(g.gia_vat)
    if (ma && Number.isFinite(v)) niemYet[ma] = v
  }

  const kenhTheoCtkm = new Map<string, number[]>()
  for (const k of ((ctKenh.data ?? []) as Array<Record<string, unknown>>)) {
    const id = k.ctkm_id as string
    if (!kenhTheoCtkm.has(id)) kenhTheoCtkm.set(id, [])
    kenhTheoCtkm.get(id)!.push(Number(k.channel_id))
  }
  const spTheoCtkm = new Map<string, Record<string, number>>()
  for (const s of ((ctSp.data ?? []) as Array<Record<string, unknown>>)) {
    const id = s.ctkm_id as string
    if (!spTheoCtkm.has(id)) spTheoCtkm.set(id, {})
    spTheoCtkm.get(id)![s.internal_code as string] = Number(s.muc)
  }

  const dsCtkm: Ctkm[] = ((ct.data ?? []) as Array<Record<string, unknown>>).map((c) => ({
    id: c.id as string,
    ten: c.ten as string,
    tu_ngay: c.tu_ngay as string,
    den_ngay: (c.den_ngay as string) ?? null,
    kieu_giam: c.kieu_giam as Ctkm['kieu_giam'],
    muc_chung: c.muc_chung == null ? null : Number(c.muc_chung),
    giam_toi_da: c.giam_toi_da == null ? null : Number(c.giam_toi_da),
    trang_thai: c.trang_thai as string,
    kenh: kenhTheoCtkm.get(c.id as string) ?? [],
  }))

  const { chon, khac } = ctkmChoDon(dsCtkm, ngay, channelId)

  return {
    bac,
    channel_id: channelId,
    chinhSach: ((cs.data ?? []) as unknown) as ChinhSachGia[],
    ctkm: chon ? { ...chon, sp: spTheoCtkm.get(chon.id) ?? {} } : null,
    soCtkmKhac: khac.length,
    niemYet,
  }
}

export type KhachTrung = { sdt9: string; ma: string[]; ten: (string | null)[] }

/**
 * Đếm khách trùng SĐT — CEO chốt 22/08 chọn **đếm + cảnh báo**, không đặt ràng buộc
 * duy nhất ở DB.
 *
 * Vì sao không chặn cứng: `customers` do Apps Script upsert **theo lô**; một SĐT trùng
 * là **gãy cả lô sync**, mà lỗi thật lại nằm ở một ô SĐT trong tab đơn từ mấy tuần trước
 * — báo lỗi ở chỗ cách xa nguyên nhân thì người sửa phải mò ngược. Đếm rồi chỉ thẳng
 * mã nào thì sửa được ngay.
 *
 * So theo **9 SỐ CUỐI**: đó là cách duy nhất bắt được cặp `0xxxxxxxxx` và
 * cùng số đó bị mất số 0 đầu,
 * tức đúng loại trùng mà Google Sheet đẻ ra khi ăn mất số 0 đầu.
 */
export async function khachTrungSdt(): Promise<KhachTrung[]> {
  await chanSales()
  const { data } = await dataClient()
    .from('customers')
    .select('customer_code, name, phone')
    .not('phone', 'is', null)
    .limit(5000)

  const nhom = new Map<string, { ma: string[]; ten: (string | null)[] }>()
  for (const r of ((data ?? []) as Array<Record<string, unknown>>)) {
    const so = String(r.phone ?? '').replace(/\D/g, '')
    if (so.length < 9) continue
    const k = so.slice(-9)
    if (!nhom.has(k)) nhom.set(k, { ma: [], ten: [] })
    nhom.get(k)!.ma.push(r.customer_code as string)
    nhom.get(k)!.ten.push((r.name as string) ?? null)
  }
  return [...nhom.entries()]
    .filter(([, v]) => v.ma.length > 1)
    .map(([sdt9, v]) => ({ sdt9, ...v }))
    .sort((a, b) => b.ma.length - a.ma.length)
}

export type NhanVienChon = { email: string; ten: string; vai_tro: string[] }

/**
 * Nhân viên để chọn làm "Sales phụ trách" — CEO chốt 22/08: **chọn từ danh sách**,
 * không gõ tay email. Gõ tay là sớm muộn có `an.nguyen@gwt.vn` và `An Nguyễn` cùng
 * chỉ một người, rồi lọc theo người phụ trách ra thiếu.
 *
 * Không dùng `listStaff()` của khu CS: hàm đó đi qua `requireStaff()` — cổng CS —
 * nên **đá văng nhân viên Sales thuần** (đúng lỗi nền tảng đã vá 19/08). Sales gác
 * bằng cổng Sales rồi đọc thẳng bảng dùng chung.
 */
export async function nhanVienChonDuoc(): Promise<NhanVienChon[]> {
  await chanSales()
  const { data } = await dataClient()
    .from('staff')
    .select('ten, email, vai_tro')
    .eq('hoat_dong', true)
    .not('email', 'is', null)
    .order('ten')
  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((r) => ({
      email: (r.email as string) ?? '',
      ten: (r.ten as string) || ((r.email as string) ?? ''),
      vai_tro: Array.isArray(r.vai_tro) ? (r.vai_tro as string[]) : [],
    }))
    .filter((r) => r.email)
}
