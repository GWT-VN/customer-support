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
    db.from('customers').select('*').eq('id', id).maybeSingle(),
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
    .from('customers')
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

/** Khách cần dọn: thiếu/lỗi SĐT HOẶC thiếu địa chỉ. Di trú Odoo không lấp được, phải sửa tay. */
export async function listToFix(): Promise<(Customer & { machines: number })[]> {
  await requireStaff()
  const db = dataClient()
  const { data, error } = await db
    .from('customers')
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
