'use server'

/**
 * Server actions cho khu Work — gọi RPC public bọc schema `work`
 * (work_viec_cua_toi / work_tao_viec / work_doi_trang_thai).
 *
 * Mọi action gọi requireNhanSu() trước (cổng nền tảng: mọi nhân sự hoạt động),
 * rồi dùng dataClient() (service_role, chỉ server). Email lấy từ session đã xác minh.
 */
import { requireNhanSu, dataClient } from '@/lib/supabase'
import { chuanHoaEmail } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export type ViecRow = {
  id: number
  ref: string
  title: string
  status: string
  priority: number
  due_at: string | null
  team_id: number | null
  team_name: string | null
  team_color: string | null
  my_role: string | null
  sub_n: number
}

async function emailHienTai(): Promise<string> {
  const u = await requireNhanSu()
  return chuanHoaEmail(u.email)
}

export async function vieCcuaToi(): Promise<ViecRow[]> {
  const email = await emailHienTai()
  const { data, error } = await dataClient().rpc('work_viec_cua_toi', { p_email: email })
  if (error) throw error
  return (data ?? []) as ViecRow[]
}

export async function taoViec(input: {
  title: string
  priority?: number
  due?: string | null
  team_id?: number | null
}): Promise<void> {
  const email = await emailHienTai()
  const { error } = await dataClient().rpc('work_tao_viec', {
    p_email: email,
    p_title: input.title,
    p_priority: input.priority ?? 3,
    p_due: input.due ?? null,
    p_team_id: input.team_id ?? null,
  })
  if (error) throw error
  revalidatePath('/work')
}

export async function doiTrangThai(id: number, status: string): Promise<void> {
  const email = await emailHienTai()
  const { error } = await dataClient().rpc('work_doi_trang_thai', {
    p_email: email,
    p_task_id: id,
    p_status: status,
  })
  if (error) throw error
  revalidatePath('/work')
}
