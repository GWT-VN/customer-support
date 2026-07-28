'use server'

import { revalidatePath } from 'next/cache'
import { dataClient, requireStaff } from '@/lib/supabase'

export type Machine = {
  serial: string
  internal_code: string | null
  product_name: string | null
  category_l2: string | null
  customer_id: string | null
  customer_name: string | null
  primary_phone: string | null
  needs_phone: boolean | null
  install_date: string | null
  status: string
  warranty_activated: boolean
  warranty_start: string | null
  warranty_full_end: string | null
  warranty_core_end: string | null
  con_han_may: boolean | null
  con_han_loi: boolean | null
  co_chinh_sach_bh: boolean
}

/** Tra máy theo serial / tên khách / SĐT. Rỗng -> 50 máy lắp gần nhất. */
export async function searchMachines(q: string): Promise<Machine[]> {
  await requireStaff()
  const db = dataClient()
  let query = db.from('v_installed_base').select('*')

  const term = q.trim()
  if (term) {
    // ilike an toàn: escape % và _ để người dùng gõ ký tự đó không thành wildcard
    const safe = term.replace(/[%_]/g, (c) => '\\' + c)
    query = query.or(
      `serial.ilike.%${safe}%,customer_name.ilike.%${safe}%,primary_phone.ilike.%${safe}%`
    )
  }

  const { data, error } = await query
    .order('install_date', { ascending: false, nullsFirst: false })
    .limit(50)
  if (error) throw new Error(error.message)
  return (data ?? []) as Machine[]
}

export async function getMachine(serial: string): Promise<Machine | null> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('v_installed_base').select('*').eq('serial', serial).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Machine) ?? null
}

/** Kích hoạt bảo hành. RPC tự tính full_end/core_end từ product_warranty. */
export async function activateWarranty(serial: string, startDate: string) {
  await requireStaff()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { ok: false as const, error: 'Ngày không hợp lệ.' }
  }
  const { error } = await dataClient().rpc('activate_warranty', {
    p_serial: serial,
    p_start: startDate,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/')
  revalidatePath(`/may/${encodeURIComponent(serial)}`)
  return { ok: true as const }
}

export type Contact = {
  id: string
  phone: string | null
  contact_name: string | null
  role: string | null
  is_primary: boolean
  zalo_ok: boolean
}

export type Customer = {
  id: string
  full_name: string
  primary_phone: string | null
  source: string | null
  province: string | null
  address: string | null
  needs_phone: boolean
  notes: string | null
}

export async function getCustomer(id: string) {
  await requireStaff()
  const db = dataClient()
  const [{ data: c, error: e1 }, { data: contacts, error: e2 }] = await Promise.all([
    db.from('cs_customers').select('*').eq('id', id).maybeSingle(),
    db.from('customer_contacts').select('*').eq('customer_id', id).order('is_primary', { ascending: false }),
  ])
  if (e1) throw new Error(e1.message)
  if (e2) throw new Error(e2.message)
  return { customer: (c as Customer) ?? null, contacts: (contacts ?? []) as Contact[] }
}

export async function updateCustomer(id: string, patch: Partial<Customer>) {
  await requireStaff()
  const allowed = {
    full_name: patch.full_name,
    primary_phone: patch.primary_phone || null,
    province: patch.province || null,
    address: patch.address || null,
  }
  // Sửa được SĐT hợp lệ -> hạ cờ needs_phone + xoá ghi chú lỗi
  const { error } = await dataClient()
    .from('cs_customers')
    .update(
      allowed.primary_phone && /^0\d{9,10}$/.test(allowed.primary_phone)
        ? { ...allowed, needs_phone: false, notes: null }
        : allowed
    )
    .eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/khach/${id}`)
  revalidatePath('/')
  return { ok: true as const }
}

export async function addContact(customerId: string, c: Omit<Contact, 'id'>) {
  await requireStaff()
  const { error } = await dataClient().from('customer_contacts').insert({
    customer_id: customerId,
    phone: c.phone || null,
    contact_name: c.contact_name || null,
    role: c.role || null,
    is_primary: c.is_primary,
    zalo_ok: c.zalo_ok,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/khach/${customerId}`)
  return { ok: true as const }
}

export async function deleteContact(id: string, customerId: string) {
  await requireStaff()
  const { error } = await dataClient().from('customer_contacts').delete().eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/khach/${customerId}`)
  return { ok: true as const }
}

// ── Lịch thay lõi (Phase 3) ─────────────────────────────────────────────────
export type CoreDue = {
  serial: string
  internal_code: string | null
  product_name: string | null
  filter_code: string
  filter_name: string | null
  chu_ky_raw: string | null
  thang_min: number
  thang_max: number
  install_date: string | null
  lan_thay_gan_nhat: string | null
  moc_tinh: string | null
  han_som: string | null
  han_muon: string | null
  con_bao_nhieu_ngay: number | null
  tinh_trang: string
  customer_id: string | null
  customer_name: string | null
  primary_phone: string | null
  needs_phone: boolean | null
}

/**
 * Lịch thay lõi. Mặc định "sắp đến hạn" — đó là danh sách gọi được ngay.
 *
 * ⚠️ "QUÁ HẠN" KHÔNG chắc khách cần thay: filter_replacement mới bắt đầu ghi, nên máy cũ
 * nào chưa từng log đều hiện quá hạn dù thực tế GWT đã thay rồi. Dùng làm danh sách XÁC MINH.
 */
export async function coreForecast(tinhTrang: string, q: string): Promise<CoreDue[]> {
  await requireStaff()
  let query = dataClient().from('v_core_forecast').select('*')

  if (tinhTrang) query = query.eq('tinh_trang', tinhTrang)
  const term = q.trim()
  if (term) {
    const safe = term.replace(/[%_]/g, (c) => '\\' + c)
    query = query.or(
      `serial.ilike.%${safe}%,customer_name.ilike.%${safe}%,primary_phone.ilike.%${safe}%,` +
        `filter_code.ilike.%${safe}%,product_name.ilike.%${safe}%`
    )
  }
  const { data, error } = await query
    .order('con_bao_nhieu_ngay', { ascending: true, nullsFirst: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return (data ?? []) as CoreDue[]
}

export async function coreCounts() {
  await requireStaff()
  const db = dataClient()
  const keys = ['QUÁ HẠN', 'sắp đến hạn (≤30 ngày)', 'còn hạn']
  const out: Record<string, number> = {}
  await Promise.all(
    keys.map(async (k) => {
      const { count } = await db
        .from('v_core_forecast').select('*', { count: 'exact', head: true }).eq('tinh_trang', k)
      out[k] = count ?? 0
    })
  )
  return out
}

/** Lịch sử thay lõi của 1 máy — hiện ở trang chi tiết máy. */
export async function replacementsOfSerial(serial: string) {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('filter_replacement').select('*').eq('serial', serial)
    .order('replaced_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as { id: string; filter_code: string; replaced_at: string; note: string | null }[]
}

/** Ghi 1 lần thay lõi. Đây là thứ làm v_core_forecast chính xác dần lên. */
export async function logReplacement(input: {
  serial: string
  filter_code: string
  replaced_at: string
  note?: string
}) {
  await requireStaff()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.replaced_at)) {
    return { ok: false as const, error: 'Ngày không hợp lệ.' }
  }
  if (input.replaced_at > new Date().toISOString().slice(0, 10)) {
    return { ok: false as const, error: 'Không ghi được ngày thay ở tương lai.' }
  }
  const { error } = await dataClient().from('filter_replacement').insert({
    serial: input.serial,
    filter_code: input.filter_code,
    replaced_at: input.replaced_at,
    note: input.note || null,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/loi')
  revalidatePath(`/may/${encodeURIComponent(input.serial)}`)
  return { ok: true as const }
}

export async function deleteReplacement(id: string, serial: string) {
  await requireStaff()
  const { error } = await dataClient().from('filter_replacement').delete().eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/loi')
  revalidatePath(`/may/${encodeURIComponent(serial)}`)
  return { ok: true as const }
}

// ── Tickets (Phase 1) ───────────────────────────────────────────────────────
export type Ticket = {
  ticket_code: string
  state: 'Open' | 'Done' | 'Cancel'
  ticket_type: string | null
  description: string | null
  last_note: string | null
  khan: boolean
  province: string | null
  created_at: string
  serial: string | null
  source_serial: string | null
  product_name: string | null
  internal_code: string | null
  may_khong_trong_he_thong: boolean
  customer_id: string | null
  customer_name: string | null
  primary_phone: string | null
  warranty_activated: boolean | null
  warranty_full_end: string | null
  con_han_may: boolean | null
  con_han_loi: boolean | null
}

/** Tra ticket theo mã / serial / tên khách / SĐT / nội dung. Rỗng -> 50 ticket mới nhất.
 *  onlyKhan=true -> chỉ ticket đánh dấu Khẩn (khách khó chịu / cần gấp). */
export async function searchTickets(q: string, state?: string, onlyKhan?: boolean): Promise<Ticket[]> {
  await requireStaff()
  let query = dataClient().from('v_tickets').select('*')

  const term = q.trim()
  if (term) {
    const safe = term.replace(/[%_]/g, (c) => '\\' + c)
    query = query.or(
      `ticket_code.ilike.%${safe}%,source_serial.ilike.%${safe}%,customer_name.ilike.%${safe}%,` +
        `primary_phone.ilike.%${safe}%,description.ilike.%${safe}%,ticket_type.ilike.%${safe}%`
    )
  }
  if (state) query = query.eq('state', state)
  if (onlyKhan) query = query.eq('khan', true)

  // Khẩn lên đầu, rồi mới nhất trước.
  const { data, error } = await query
    .order('khan', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  return (data ?? []) as Ticket[]
}

/** Ticket của 1 máy — dùng ở trang chi tiết máy. */
export async function ticketsOfSerial(serial: string): Promise<Ticket[]> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('v_tickets').select('*').eq('serial', serial)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Ticket[]
}

/** Ticket của 1 khách — dùng ở trang khách. */
export async function ticketsOfCustomer(customerId: string): Promise<Ticket[]> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('v_tickets').select('*').eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Ticket[]
}

export async function getTicket(code: string): Promise<Ticket | null> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('v_tickets').select('*').eq('ticket_code', code).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Ticket) ?? null
}

/** Đổi trạng thái / cờ Khẩn / ghi chú tóm tắt. */
export async function updateTicket(
  code: string,
  patch: { state?: string; last_note?: string; khan?: boolean }
) {
  await requireStaff()
  if (patch.state && !['Open', 'Done', 'Cancel'].includes(patch.state)) {
    return { ok: false as const, error: 'Trạng thái không hợp lệ.' }
  }
  const { error } = await dataClient().from('tickets').update(patch).eq('ticket_code', code)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/ticket')
  revalidatePath(`/ticket/${code}`)
  return { ok: true as const }
}

// ── Nhật ký ghi chú ticket (Đợt 1) ──────────────────────────────────────────
export type TicketNote = {
  id: string
  noi_dung: string
  tac_gia: string | null
  created_at: string
}

/** Các ghi chú của 1 ticket, mới nhất trước. */
export async function listTicketNotes(code: string): Promise<TicketNote[]> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('ticket_note').select('id, noi_dung, tac_gia, created_at')
    .eq('ticket_code', code)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as TicketNote[]
}

/** Thêm 1 dòng nhật ký. Người ghi = email đăng nhập. */
export async function addTicketNote(code: string, noiDung: string) {
  const user = await requireStaff()
  const text = noiDung.trim()
  if (!text) return { ok: false as const, error: 'Nhập nội dung ghi chú.' }
  const { error } = await dataClient()
    .from('ticket_note')
    .insert({ ticket_code: code, noi_dung: text, tac_gia: user.email ?? null })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/ticket/${code}`)
  return { ok: true as const }
}

/** Máy 1 khách đã lắp — dùng ở trang khách. */
export async function machinesOfCustomer(customerId: string): Promise<Machine[]> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('v_installed_base').select('*').eq('customer_id', customerId)
    .order('install_date', { ascending: false, nullsFirst: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Machine[]
}

/** Tạo ticket mới. Mã tự sinh GWT-YYnnnn theo năm hiện tại. */
export async function createTicket(input: {
  serial?: string
  customer_id?: string
  ticket_type: string
  description: string
  province?: string
}) {
  await requireStaff()
  if (!input.ticket_type?.trim()) return { ok: false as const, error: 'Chọn loại ticket.' }
  if (!input.description?.trim()) return { ok: false as const, error: 'Nhập mô tả sự cố.' }

  const db = dataClient()
  const yy = String(new Date().getFullYear()).slice(2)

  // lấy số lớn nhất của năm nay rồi +1 (mã GWT-YYnnnn)
  const { data: last, error: e1 } = await db
    .from('tickets').select('ticket_code')
    .like('ticket_code', `GWT-${yy}%`)
    .order('ticket_code', { ascending: false }).limit(1)
  if (e1) return { ok: false as const, error: e1.message }

  const next = last?.length ? parseInt(last[0].ticket_code.slice(-4), 10) + 1 : 1
  const code = `GWT-${yy}${String(next).padStart(4, '0')}`

  const { error } = await db.from('tickets').insert({
    ticket_code: code,
    serial: input.serial || null,
    source_serial: input.serial || null,
    customer_id: input.customer_id || null,
    ticket_type: input.ticket_type.trim(),
    description: input.description.trim(),
    province: input.province || null,
    state: 'Open',
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/ticket')
  return { ok: true as const, code }
}

/** Các loại ticket đã dùng — gợi ý cho form tạo mới (Odoo có 18 loại). */
export async function ticketTypes(): Promise<string[]> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('tickets').select('ticket_type').not('ticket_type', 'is', null)
  if (error) throw new Error(error.message)
  return [...new Set((data ?? []).map((r) => (r as { ticket_type: string }).ticket_type))].sort()
}

/** Khách cần dọn: thiếu/lỗi SĐT HOẶC thiếu địa chỉ. Di trú Odoo không lấp được, phải sửa tay. */
export async function listToFix(): Promise<(Customer & { machines: number })[]> {
  await requireStaff()
  const db = dataClient()
  const { data, error } = await db
    .from('cs_customers')
    .select('*')
    .or('needs_phone.eq.true,address.is.null')
    .order('full_name')
  if (error) throw new Error(error.message)
  const customers = (data ?? []) as Customer[]

  // đếm máy mỗi khách -> biết khách nào đáng ưu tiên
  const { data: ibs, error: e2 } = await db
    .from('installed_base')
    .select('customer_id')
    .in('customer_id', customers.map((c) => c.id))
  if (e2) throw new Error(e2.message)

  const count = new Map<string, number>()
  for (const r of ibs ?? []) {
    const id = (r as { customer_id: string }).customer_id
    count.set(id, (count.get(id) ?? 0) + 1)
  }
  return customers.map((c) => ({ ...c, machines: count.get(c.id) ?? 0 }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — nhóm lỗi + báo cáo lãnh đạo / công ty mẹ
// ─────────────────────────────────────────────────────────────────────────────

export type MucDo = 'an_toan' | 'nghiem_trong' | 'thuong' | 'nhe' | 'khong_loi'

export type IssueReport = {
  code: string
  ten: string
  muc_do: MucDo
  bao_hang: boolean
  mo_ta: string | null
  thu_tu: number
  so_ticket: number
  dang_mo: number
  da_xong: number
  da_huy: number
  so_khach: number
  so_may: number
  so_model: number
  cac_model: string | null
  som_nhat: string | null
  gan_nhat: string | null
  trong_90_ngay: number
}

export type TicketIssue = {
  ticket_code: string
  group_code: string
  nguon: string
  nhom_ten: string
  muc_do: MucDo
  state: string
  ticket_type: string | null
  description: string | null
  created_at: string
  serial: string | null
  internal_code: string | null
  product_name: string | null
  customer_id: string | null
  customer_name: string | null
  primary_phone: string | null
}

/** Thứ tự ưu tiên đọc báo cáo: an toàn trước hết, "không lỗi" xuống cuối. */
const UU_TIEN: Record<MucDo, number> = {
  an_toan: 1, nghiem_trong: 2, thuong: 3, nhe: 4, khong_loi: 5,
}

/** Báo cáo nhóm lỗi. baoHangOnly=true -> chỉ nhóm gửi công ty mẹ. */
export async function issueReport(baoHangOnly = false): Promise<IssueReport[]> {
  await requireStaff()
  let q = dataClient().from('v_issue_report').select('*').gt('so_ticket', 0)
  if (baoHangOnly) q = q.eq('bao_hang', true)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return ((data ?? []) as IssueReport[]).sort(
    (a, b) => UU_TIEN[a.muc_do] - UU_TIEN[b.muc_do] || b.so_ticket - a.so_ticket
  )
}

/** Ticket trong một nhóm lỗi — để soi bằng chứng, không tin số liệu suông. */
export async function ticketsInGroup(groupCode: string): Promise<TicketIssue[]> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('v_ticket_issue').select('*')
    .eq('group_code', groupCode)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as TicketIssue[]
}

/** Nhóm lỗi của MỘT ticket — nhúng vào trang chi tiết ticket. */
export async function groupsOfTicket(ticketCode: string): Promise<TicketIssue[]> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('v_ticket_issue').select('*').eq('ticket_code', ticketCode)
  if (error) throw new Error(error.message)
  return ((data ?? []) as TicketIssue[]).sort((a, b) => UU_TIEN[a.muc_do] - UU_TIEN[b.muc_do])
}

export type ChuaPhanNhom = {
  ticket_code: string
  state: string
  ticket_type: string | null
  description: string | null
  created_at: string
  serial: string | null
  ly_do: string
}

/** Ticket chưa vào nhóm nào — việc cần người làm, không gom mù được. */
export async function ticketsChuaPhanNhom(): Promise<ChuaPhanNhom[]> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('v_ticket_chua_phan_nhom').select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as ChuaPhanNhom[]
}
