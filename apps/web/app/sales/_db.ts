import 'server-only'
import { dataClient } from '@/lib/nen-tang/db'
import { deriveSourceTab, TAB_LETTER, phoneChuan, lineAmount, isMaintenance, yymmdd, nextSeqCode } from './_calc'
import type { CatalogPick, ChannelOpt, CustomerInput, NewOrderInput, OrderFormInitial } from './_types'
import { maDaCap, type DongCoMa } from './_ma-khach'

// ───────────── Nguồn cho form ─────────────
export async function listCatalogForPicker(): Promise<CatalogPick[]> {
  const db = dataClient()
  const { data, error } = await db
    .from('catalog_item')
    .select('"Mã nội bộ","Tên ngắn gọn (đề xuất)","Danh mục cấp 1","Danh mục cấp 2","Mã cũ","Mã đối tác/Kho",vat_pct,vat_loai')
  if (error) throw error
  return ((data ?? []) as Array<Record<string, string | null>>)
    .map((r) => ({
      internal_code: (r['Mã nội bộ'] ?? '').trim(),
      name: (r['Tên ngắn gọn (đề xuất)'] || r['Mã nội bộ'] || '').trim(),
      category_l1: r['Danh mục cấp 1'],
      category_l2: r['Danh mục cấp 2'],
      ma_cu: r['Mã cũ'],
      ma_doitac: r['Mã đối tác/Kho'],
      vat_pct: r.vat_pct == null ? null : Number(r.vat_pct),
      vat_loai: (r.vat_loai as 'VAT' | 'KCT' | 'KAD' | null) ?? null,
    }))
    .filter((r) => r.internal_code)
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
}

export async function listChannels(): Promise<ChannelOpt[]> {
  const db = dataClient()
  const { data } = await db
    .from('dim_channel')
    .select('id, channel_l1, channel_l2')
    .order('sort_order', { ascending: true, nullsFirst: false })
  return (data ?? []) as ChannelOpt[]
}

function sach(q: string): string {
  return q.replace(/[,%()\\*]/g, ' ').trim().slice(0, 80)
}

export async function searchCustomersForPicker(q: string) {
  const db = dataClient()
  const s = sach(q)
  let query = db
    .from('customers')
    .select('customer_code, name, phone, phone_chuan, province, province_moi')
    .limit(20)
  if (s) query = query.or(`name.ilike.%${s}%,phone.ilike.%${s}%,phone_chuan.ilike.%${s}%,customer_code.ilike.%${s}%`)
  const { data } = await query
  return data ?? []
}

// ───────────── Sinh mã đơn (không đụng cả 2 bảng) ─────────────
async function nextOrderCode(
  db: ReturnType<typeof dataClient>,
  ymd: string,
  letter: string
): Promise<string> {
  const prefix = `${ymd}-${letter}`
  const [a, b] = await Promise.all([
    db.from('sales_orders').select('order_code').ilike('order_code', `${prefix}%`),
    db.from('sales_order_lines').select('order_code').ilike('order_code', `${prefix}%`),
  ])
  const codes = [...(a.data ?? []), ...(b.data ?? [])].map((r) => (r as { order_code: string }).order_code)
  return nextSeqCode(codes, prefix)
}

function buildItems(input: NewOrderInput, orderId?: string) {
  return input.items.map((it, idx) => {
    const qty = Number(it.quantity) || 0
    const price = Number(it.unit_price_vat) || 0
    return {
      ...(orderId ? { order_id: orderId } : {}),
      line_no: idx + 1,
      internal_code: it.internal_code || null,
      product_name: it.product_name || null,
      category_l1: it.category_l1 || null,
      category_l2: it.category_l2 || null,
      quantity: qty,
      unit_price_vat: price,
      amount_vat: lineAmount(qty, price, !!it.is_gift),
      is_gift: !!it.is_gift,
      is_maintenance: isMaintenance(it.internal_code),
      vat_pct: it.vat_pct == null ? null : Number(it.vat_pct),
      vat_loai: it.vat_loai ?? null,
      note: it.note || null,
    }
  })
}

// ───────────── Tạo đơn ─────────────

/**
 * Các ô Sheet bổ sung 22/08. Gom một chỗ để đường TẠO và đường SỬA không bao giờ lệch —
 * đúng lỗi CEO bắt được ở màn khách (màn tạo tự viết insert riêng, màn sửa gọi hàm chung).
 */
function oSheetBoSung(input: NewOrderInput) {
  const so = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? null : Math.round(v))
  const chu = (v: string | null | undefined) => (v ?? '').trim() || null
  return {
    channel_detail: chu(input.channel_detail),
    qua_tang: chu(input.qua_tang),
    su_dung_qua_tang: chu(input.su_dung_qua_tang),
    tracking_url: chu(input.tracking_url),
    kich_hoat_bh: !!input.kich_hoat_bh,
    email: chu(input.email),
    tien_coc: so(input.tien_coc),
    gui_hdsd: !!input.gui_hdsd,
    xuat_hoa_don: !!input.xuat_hoa_don,
    da_doi_soat: !!input.da_doi_soat,
    ngay_doi_soat: input.ngay_doi_soat || null,
    so_hd: chu(input.so_hd),
    ten_goi_khach: chu(input.ten_goi_khach),
    ten_folder: chu(input.ten_folder),
    ten_khach_theo_doi: chu(input.ten_khach_theo_doi),
    tien_se_thu: so(input.tien_se_thu),
    bien_ban_xac_nhan: !!input.bien_ban_xac_nhan,
    bao_cao_lap_dat: !!input.bao_cao_lap_dat,
    tien_do_lap_dat: chu(input.tien_do_lap_dat),
    ngay_hoan_thanh_lap: input.ngay_hoan_thanh_lap || null,
    tu_dien: chu(input.tu_dien),
    version: chu(input.version),
    nghe_nghiep: chu(input.nghe_nghiep),
    ngay_sinh: input.ngay_sinh || null,
    gioi_tinh: chu(input.gioi_tinh),
    do_tuoi: chu(input.do_tuoi),
    loai_nha: chu(input.loai_nha),
    tinh_trang_nha: chu(input.tinh_trang_nha),
    cong_ty_xuat_hd: chu(input.cong_ty_xuat_hd),
    mst: chu(input.mst),
    dia_chi_xuat_hd: chu(input.dia_chi_xuat_hd),
  }
}

export async function createSalesOrder(
  input: NewOrderInput,
  createdBy: string | null
): Promise<{ order_code: string }> {
  const db = dataClient()
  if (!input.items.length) throw new Error('Đơn phải có ít nhất 1 sản phẩm.')
  const source_tab = deriveSourceTab(input.items)
  const letter = TAB_LETTER[source_tab] ?? 'O'
  const ymd = yymmdd(input.order_date)
  const items = buildItems(input)
  const total = items.reduce((s, i) => s + i.amount_vat, 0)

  for (let attempt = 0; attempt < 6; attempt++) {
    const order_code = await nextOrderCode(db, ymd, letter)
    const { data: ord, error } = await db
      .from('sales_orders')
      .insert({
        order_code,
        source_tab,
        customer_code: input.customer_code || null,
        phone: input.phone || null,
        customer_name: input.customer_name || null,
        address: input.address || null,
        province: input.province || null,
        order_date: input.order_date,
        channel_id: input.channel_id || null,
        partner_order_code: input.partner_order_code || null,
        status: input.status || null,
        payment_status: input.payment_status || null,
        payment_method: input.payment_method || null,
        shipping_code: input.shipping_code || null,
        install_date: input.install_date || null,
        ...oSheetBoSung(input),
        total_vat: total,
        note: input.note || null,
        created_by: createdBy,
      })
      .select('order_id, order_code')
      .single()
    if (error) {
      if ((error as { code?: string }).code === '23505') continue // đua mã -> thử lại
      throw error
    }
    const rows = items.map((it) => ({ ...it, order_id: ord.order_id }))
    const { error: e2 } = await db.from('sales_order_items').insert(rows)
    if (e2) {
      await db.from('sales_orders').delete().eq('order_id', ord.order_id) // tránh mồ côi
      throw e2
    }
    return { order_code: ord.order_code }
  }
  throw new Error('Không sinh được mã đơn (đụng mã liên tục). Thử lại.')
}

// ───────────── Sửa đơn ─────────────
export async function updateSalesOrder(orderCode: string, input: NewOrderInput): Promise<{ order_code: string }> {
  const db = dataClient()
  if (!input.items.length) throw new Error('Đơn phải có ít nhất 1 sản phẩm.')
  const { data: existing } = await db.from('sales_orders').select('order_id').eq('order_code', orderCode).maybeSingle()
  if (!existing) throw new Error('Không tìm thấy đơn để sửa (chỉ sửa được đơn tạo từ app).')
  const orderId = (existing as { order_id: string }).order_id
  const source_tab = deriveSourceTab(input.items)
  const items = buildItems(input, orderId)
  const total = items.reduce((s, i) => s + i.amount_vat, 0)

  const { error: eU } = await db
    .from('sales_orders')
    .update({
      source_tab,
      customer_code: input.customer_code || null,
      phone: input.phone || null,
      customer_name: input.customer_name || null,
      address: input.address || null,
      province: input.province || null,
      order_date: input.order_date,
      channel_id: input.channel_id || null,
      partner_order_code: input.partner_order_code || null,
      status: input.status || null,
      payment_status: input.payment_status || null,
      payment_method: input.payment_method || null,
      shipping_code: input.shipping_code || null,
      install_date: input.install_date || null,
      ...oSheetBoSung(input),
      total_vat: total,
      note: input.note || null,
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId)
  if (eU) throw eU

  await db.from('sales_order_items').delete().eq('order_id', orderId) // thay toàn bộ dòng
  const { error: eI } = await db.from('sales_order_items').insert(items)
  if (eI) throw eI
  return { order_code: orderCode }
}

export async function deleteSalesOrder(orderCode: string): Promise<void> {
  const db = dataClient()
  const { data: existing } = await db.from('sales_orders').select('order_id').eq('order_code', orderCode).maybeSingle()
  if (!existing) throw new Error('Chỉ xoá được đơn tạo từ app (đơn từ Google Sheet không xoá ở đây).')
  const orderId = (existing as { order_id: string }).order_id
  await db.from('sales_order_items').delete().eq('order_id', orderId)
  const { error } = await db.from('sales_orders').delete().eq('order_id', orderId)
  if (error) throw error
}

/** Đọc đơn app -> dữ liệu điền form sửa. Null nếu không phải đơn app. */
export async function getOrderForEdit(orderCode: string): Promise<OrderFormInitial | null> {
  const db = dataClient()
  const { data: h } = await db.from('sales_orders').select('*').eq('order_code', orderCode).maybeSingle()
  if (!h) return null
  const header = h as Record<string, unknown>
  const { data: items } = await db
    .from('sales_order_items')
    .select('*')
    .eq('order_id', header.order_id as string)
    .order('line_no', { ascending: true })
  return {
    customer_code: (header.customer_code as string) ?? null,
    phone: (header.phone as string) ?? null,
    customer_name: (header.customer_name as string) ?? null,
    address: (header.address as string) ?? null,
    province: (header.province as string) ?? null,
    order_date: ((header.order_date as string) ?? '').slice(0, 10),
    channel_id: (header.channel_id as number) ?? null,
    partner_order_code: (header.partner_order_code as string) ?? null,
    status: (header.status as string) ?? null,
    payment_status: (header.payment_status as string) ?? null,
    payment_method: (header.payment_method as string) ?? null,
    shipping_code: (header.shipping_code as string) ?? null,
    install_date: ((header.install_date as string) ?? '')?.slice(0, 10) || null,
    channel_detail: (header.channel_detail as string) ?? null,
    qua_tang: (header.qua_tang as string) ?? null,
    su_dung_qua_tang: (header.su_dung_qua_tang as string) ?? null,
    tracking_url: (header.tracking_url as string) ?? null,
    kich_hoat_bh: !!header.kich_hoat_bh,
    email: (header.email as string) ?? null,
    tien_coc: header.tien_coc == null ? null : Number(header.tien_coc),
    gui_hdsd: !!header.gui_hdsd,
    xuat_hoa_don: !!header.xuat_hoa_don,
    da_doi_soat: !!header.da_doi_soat,
    ngay_doi_soat: ((header.ngay_doi_soat as string) ?? '')?.slice(0, 10) || null,
    so_hd: (header.so_hd as string) ?? null,
    ten_goi_khach: (header.ten_goi_khach as string) ?? null,
    ten_folder: (header.ten_folder as string) ?? null,
    ten_khach_theo_doi: (header.ten_khach_theo_doi as string) ?? null,
    tien_se_thu: header.tien_se_thu == null ? null : Number(header.tien_se_thu),
    bien_ban_xac_nhan: !!header.bien_ban_xac_nhan,
    bao_cao_lap_dat: !!header.bao_cao_lap_dat,
    tien_do_lap_dat: (header.tien_do_lap_dat as string) ?? null,
    ngay_hoan_thanh_lap: ((header.ngay_hoan_thanh_lap as string) ?? '')?.slice(0, 10) || null,
    tu_dien: (header.tu_dien as string) ?? null,
    version: (header.version as string) ?? null,
    nghe_nghiep: (header.nghe_nghiep as string) ?? null,
    ngay_sinh: ((header.ngay_sinh as string) ?? '')?.slice(0, 10) || null,
    gioi_tinh: (header.gioi_tinh as string) ?? null,
    do_tuoi: (header.do_tuoi as string) ?? null,
    loai_nha: (header.loai_nha as string) ?? null,
    tinh_trang_nha: (header.tinh_trang_nha as string) ?? null,
    cong_ty_xuat_hd: (header.cong_ty_xuat_hd as string) ?? null,
    mst: (header.mst as string) ?? null,
    dia_chi_xuat_hd: (header.dia_chi_xuat_hd as string) ?? null,
    note: (header.note as string) ?? null,
    items: ((items ?? []) as Array<Record<string, unknown>>).map((it) => ({
      internal_code: (it.internal_code as string) ?? '',
      product_name: (it.product_name as string) ?? '',
      category_l1: (it.category_l1 as string) ?? null,
      category_l2: (it.category_l2 as string) ?? null,
      quantity: Number(it.quantity) || 0,
      unit_price_vat: Number(it.unit_price_vat) || 0,
      is_gift: !!it.is_gift,
      vat_pct: it.vat_pct == null ? null : Number(it.vat_pct),
      vat_loai: (it.vat_loai as 'VAT' | 'KCT' | 'KAD' | null) ?? null,
      note: (it.note as string) ?? null,
    })),
  }
}

// ───────────── Khách app-owned (mã KA) ─────────────
export const APP_CUSTOMER_PREFIX = 'KA'
export function isAppCustomer(code: string | null | undefined): boolean {
  return !!code && code.toUpperCase().startsWith(APP_CUSTOMER_PREFIX)
}

const CUST_COLS =
  'customer_code, name, phone, phone_chuan, address, province, province_moi, company_invoice, tax_code, note, channel_id, email, ngay_sinh, dia_chi_cty, sdt_cty, email_cty, nguoi_dai_dien, chuc_vu_dai_dien, sales_owner'

export async function findCustomerByPhone(phone: string): Promise<{ customer_code: string; name: string | null } | null> {
  const db = dataClient()
  const p = phoneChuan(phone)
  if (!p) return null
  const { data } = await db.from('customers').select('customer_code, name').eq('phone_chuan', p).limit(1).maybeSingle()
  return (data as { customer_code: string; name: string | null } | null) ?? null
}

export async function getCustomerForEdit(code: string): Promise<CustomerInput | null> {
  const db = dataClient()
  const { data } = await db.from('customers').select(CUST_COLS).eq('customer_code', code).maybeSingle()
  if (!data) return null
  const c = data as Record<string, unknown>
  return {
    name: (c.name as string) ?? null,
    phone: (c.phone_chuan as string) || (c.phone as string) || null,
    address: (c.address as string) ?? null,
    province: (c.province_moi as string) || (c.province as string) || null,
    company_invoice: (c.company_invoice as string) ?? null,
    tax_code: (c.tax_code as string) ?? null,
    note: (c.note as string) ?? null,
    channel_id: (c.channel_id as number) ?? null,
    email: (c.email as string) ?? null,
    ngay_sinh: (c.ngay_sinh as string) ?? null,
    dia_chi_cty: (c.dia_chi_cty as string) ?? null,
    sdt_cty: (c.sdt_cty as string) ?? null,
    email_cty: (c.email_cty as string) ?? null,
    nguoi_dai_dien: (c.nguoi_dai_dien as string) ?? null,
    chuc_vu_dai_dien: (c.chuc_vu_dai_dien as string) ?? null,
    sales_owner: (c.sales_owner as string) ?? null,
  }
}

async function nextCustomerCode(db: ReturnType<typeof dataClient>): Promise<string> {
  const { data } = await db
    .from('customers')
    .select('customer_code')
    .ilike('customer_code', 'KA%')
    .order('customer_code', { ascending: false })
    .limit(1)
  const last = (data?.[0] as { customer_code: string } | undefined)?.customer_code
  return nextSeqCode(last ? [last] : [], APP_CUSTOMER_PREFIX, 5)
}

function cleanCustomer(input: CustomerInput) {
  return {
    name: input.name?.trim() || null,
    phone: phoneChuan(input.phone),
    address: input.address?.trim() || null,
    province: input.province?.trim() || null,
    company_invoice: input.company_invoice?.trim() || null,
    tax_code: input.tax_code?.trim() || null,
    note: input.note?.trim() || null,
    ...cleanCustomerAppFields(input),
  }
}

/** Chỉ những ô Apps Script KHÔNG đụng tới — sửa được ngay cả với khách từ Sheet. */
function cleanCustomerAppFields(input: CustomerInput) {
  return {
    channel_id: input.channel_id ?? null,
    email: input.email?.trim() || null,
    ngay_sinh: input.ngay_sinh?.trim() || null,
    dia_chi_cty: input.dia_chi_cty?.trim() || null,
    sdt_cty: input.sdt_cty?.trim() || null,
    email_cty: input.email_cty?.trim() || null,
    nguoi_dai_dien: input.nguoi_dai_dien?.trim() || null,
    chuc_vu_dai_dien: input.chuc_vu_dai_dien?.trim() || null,
    sales_owner: input.sales_owner?.trim() || null,
  }
}

/** Mã khách hệ mới cho người sắp tạo — tra SĐT trước, hết cách mới cấp số mới. */
async function maKhachMoi(db: ReturnType<typeof dataClient>, phone: string | null): Promise<string | null> {
  const [cs, sales] = await Promise.all([
    db.from('cs_customers').select('primary_phone, ma_kh').not('ma_kh', 'is', null).limit(5000),
    db.from('customers').select('phone, ma_kh').not('ma_kh', 'is', null).limit(5000),
  ])
  const doi = (ds: unknown, cot: string): DongCoMa[] =>
    ((ds ?? []) as Array<Record<string, unknown>>).map((r) => ({
      sdt: (r[cot] as string) ?? null,
      ma_kh: (r.ma_kh as string) ?? null,
    }))

  const cu = maDaCap(doi(cs.data, 'primary_phone'), doi(sales.data, 'phone'), phone)
  if (cu) return cu

  // Người mới thật -> bộ cấp số dùng chung (có khoá, hai khu bấm cùng lúc không đụng mã).
  const { data } = await db.rpc('cap_ma_kh')
  return (data as string) ?? null
}

export async function createCustomer(input: CustomerInput): Promise<{ customer_code: string }> {
  const db = dataClient()
  const fields = cleanCustomer(input)
  const ma_kh = await maKhachMoi(db, input.phone)
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = await nextCustomerCode(db)
    const { error } = await db.from('customers').insert({ customer_code: code, ma_kh, ...fields })
    if (error) {
      if ((error as { code?: string }).code === '23505') continue
      throw error
    }
    return { customer_code: code }
  }
  throw new Error('Không sinh được mã khách (đụng mã liên tục). Thử lại.')
}

/**
 * Sửa khách. HAI đường, tuỳ khách đến từ đâu:
 *
 * - Khách app (`KA…`): app làm chủ mọi ô -> ghi hết.
 * - Khách Sheet (`KH…`): Apps Script dựng lại tên/SĐT/địa chỉ/tỉnh/công ty/MST/ghi chú
 *   từ đơn mỗi lần chạy `buildKhachHang`. Ghi mấy ô đó là **mất công lặng lẽ** — lần sync
 *   sau bị đè. Nên chỉ ghi những ô Sheet không đụng.
 *
 * Không ném lỗi với khách Sheet nữa (CEO 22/08: hồ sơ phải sửa được). Ràng buộc nằm ở
 * chỗ GHI, không nằm ở chỗ chặn — giao diện khoá sẵn mấy ô kia và nói rõ vì sao.
 * Bỏ được sau chặng B của `docs/sales/LO-TRINH-BO-APPSCRIPT.md`.
 */
export async function updateCustomer(code: string, input: CustomerInput): Promise<void> {
  const db = dataClient()
  const fields = isAppCustomer(code) ? cleanCustomer(input) : cleanCustomerAppFields(input)
  const { error } = await db.from('customers').update(fields).eq('customer_code', code)
  if (error) throw error
}

export async function deleteCustomer(code: string): Promise<void> {
  if (!isAppCustomer(code)) throw new Error('Chỉ xoá được khách tạo từ app (mã KA).')
  const db = dataClient()
  const [orders, cs] = await Promise.all([
    db.from('customer_purchases').select('*', { count: 'exact', head: true }).eq('customer_code', code),
    db.from('cs_customers').select('*', { count: 'exact', head: true }).eq('customer_code', code),
  ])
  if ((orders.count ?? 0) > 0 || (cs.count ?? 0) > 0)
    throw new Error('Khách này đang có đơn / hồ sơ CS liên kết — gỡ liên kết trước khi xoá.')
  const { error } = await db.from('customers').delete().eq('customer_code', code)
  if (error) throw error
}
