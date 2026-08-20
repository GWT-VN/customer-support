'use server'

import { redirect } from 'next/navigation'
import { dataClient } from '@/lib/nen-tang/db'
import { coTheVaoSales } from '@/lib/nen-tang/gac-cong'
import { requireNhanSu } from '@/lib/nen-tang/phien'

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

/** Danh sách đơn: gộp mirror (sales_order_lines) + đơn app (sales_orders) theo order_code. */
export async function danhSachDon(q = ''): Promise<DonRow[]> {
  await chanSales()
  const db = dataClient()
  const s = sach(q)

  let mq = db
    .from('sales_order_lines')
    .select('order_code, order_date, source_tab, customer_name, province, fulfillment_status, payment_status, amount_vat')
    .order('order_date', { ascending: false, nullsFirst: false })
    .limit(5000)
  if (s) mq = mq.or(`order_code.ilike.%${s}%,customer_name.ilike.%${s}%,product_name.ilike.%${s}%`)
  const { data: lines, error } = await mq
  if (error) throw error

  const map = new Map<string, DonRow>()
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

  const { data: apps } = await db
    .from('sales_orders')
    .select('order_code, order_date, source_tab, customer_name, province, status, payment_status, total_vat')
    .order('order_date', { ascending: false, nullsFirst: false })
    .limit(2000)
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

  return [...map.values()]
    .sort((a, b) => (b.order_date ?? '').localeCompare(a.order_date ?? ''))
    .slice(0, 200)
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
