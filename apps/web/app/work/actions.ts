'use server'

/**
 * Server actions khu Work — gọi RPC public bọc schema `work` (work_*).
 *
 * Vì sao qua RPC: PostgREST chỉ phục vụ schema được expose (mặc định `public`),
 * còn bảng `work.*` cố tình KHÔNG expose. RPC `security definer` là cửa duy nhất.
 *
 * Mọi action gọi requireNhanSu() trước (cổng nền tảng: mọi nhân sự đang hoạt động),
 * rồi dùng dataClient() (service_role, chỉ chạy trên server). Email lấy từ session
 * đã xác minh — KHÔNG bao giờ nhận email từ tham số client.
 */
import { requireNhanSu, dataClient } from '@/lib/supabase'
import { chuanHoaEmail } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export type NguoiLam = { staff_id: string; ten: string; email: string; role: string }

export type ViecRow = {
  id: number
  ref: string
  title: string
  description: string | null
  status: string
  priority: number
  start_at: string | null
  due_at: string | null
  team_id: number | null
  team_name: string | null
  team_color: string | null
  my_role: string | null
  sub_n: number
  assignees: NguoiLam[]
}

export type ViecTeamRow = Omit<ViecRow, 'description' | 'start_at' | 'my_role'> & {
  creator_ten: string | null
}

export type NenTang = {
  me: { id: string; ten: string; email: string; vai_tro: string[] } | null
  teams: { id: number; key: string; name: string; color: string | null }[]
  nhan_su: { id: string; ten: string; email: string }[]
  projects: { id: number; name: string; team_id: number | null }[]
}

export type ChiTietViec = {
  task: {
    id: number; ref: string; title: string; description: string | null
    status: string; priority: number; visibility: string
    start_at: string | null; due_at: string | null; completed_at: string | null
    team_id: number | null; parent_id: number | null; origin: string
    team_name: string | null; team_color: string | null
    creator_ten: string | null; created_at: string
  }
  assignees: NguoiLam[]
  co_the_sua: boolean
  comments: { id: number; body: string; ten: string | null; created_at: string }[]
  activity: { id: number; verb: string; payload: Record<string, unknown> | null; ten: string | null; created_at: string }[]
  subtasks: { id: number; ref: string; title: string; status: string }[]
}

/** Email của người đang đăng nhập — nguồn danh tính DUY NHẤT cho mọi RPC dưới đây. */
async function emailHienTai(): Promise<string> {
  const u = await requireNhanSu()
  return chuanHoaEmail(u.email)
}

/** Gọi RPC + ném lỗi kèm thông điệp gốc từ Postgres (đã là tiếng Việt). */
async function goi<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const email = await emailHienTai()
  const { data, error } = await dataClient().rpc(fn, { p_email: email, ...args })
  if (error) throw new Error(error.message)
  return data as T
}

// ── Đọc ─────────────────────────────────────────────────────────────────────
export async function nenTang(): Promise<NenTang> {
  return goi<NenTang>('work_nen_tang', {})
}

export async function vieCcuaToi(): Promise<ViecRow[]> {
  return (await goi<ViecRow[]>('work_viec_cua_toi', {})) ?? []
}

export async function bangTeam(loc: {
  team_id?: number | null
  assignee?: string | null
  status?: string | null
  q?: string | null
} = {}): Promise<ViecTeamRow[]> {
  return (await goi<ViecTeamRow[]>('work_bang_team', {
    p_team_id: loc.team_id ?? null,
    p_assignee: loc.assignee ?? null,
    p_status: loc.status ?? null,
    p_q: loc.q ?? null,
  })) ?? []
}

export async function chiTietViec(id: number): Promise<ChiTietViec> {
  return goi<ChiTietViec>('work_chi_tiet_viec', { p_task_id: id })
}

// ── Ghi ─────────────────────────────────────────────────────────────────────
function lamMoi() {
  revalidatePath('/work')
  revalidatePath('/work/team')
}

export async function taoViec(input: {
  title: string
  description?: string | null
  priority?: number
  due?: string | null
  start?: string | null
  team_id?: number | null
  parent_id?: number | null
  assignees?: { staff_id: string; role: string }[]
  visibility?: string
}): Promise<{ id: number; ref: string }> {
  const kq = await goi<{ id: number; ref: string }>('work_tao_viec', {
    p_title: input.title,
    p_priority: input.priority ?? 3,
    p_due: input.due ?? null,
    p_team_id: input.team_id ?? null,
    p_description: input.description ?? null,
    p_start: input.start ?? null,
    p_parent_id: input.parent_id ?? null,
    p_assignees: input.assignees?.length ? input.assignees : null,
    p_visibility: input.visibility ?? 'team',
  })
  lamMoi()
  return kq
}

export async function doiTrangThai(id: number, status: string): Promise<void> {
  await goi<void>('work_doi_trang_thai', { p_task_id: id, p_status: status })
  lamMoi()
}

export async function suaViec(id: number, input: {
  title?: string | null
  description?: string | null
  priority?: number | null
  due?: string | null
  team_id?: number | null
  visibility?: string | null
  xoa_due?: boolean
  xoa_team?: boolean
}): Promise<void> {
  await goi<void>('work_sua_viec', {
    p_task_id: id,
    p_title: input.title ?? null,
    p_description: input.description ?? null,
    p_priority: input.priority ?? null,
    p_due: input.due ?? null,
    p_team_id: input.team_id ?? null,
    p_visibility: input.visibility ?? null,
    p_xoa_due: input.xoa_due ?? false,
    p_xoa_team: input.xoa_team ?? false,
  })
  lamMoi()
}

export async function ganNguoi(taskId: number, staffId: string, role = 'doer'): Promise<void> {
  await goi<void>('work_gan_nguoi', { p_task_id: taskId, p_staff_id: staffId, p_role: role })
  lamMoi()
}

export async function boNguoi(taskId: number, staffId: string): Promise<void> {
  await goi<void>('work_bo_nguoi', { p_task_id: taskId, p_staff_id: staffId })
  lamMoi()
}

export async function themBinhLuan(taskId: number, body: string): Promise<void> {
  await goi<void>('work_them_binh_luan', { p_task_id: taskId, p_body: body })
  lamMoi()
}

// ── Việc tự sinh từ ERP ─────────────────────────────────────────────────────
export type LuatTuSinh = {
  key: string
  name: string
  mo_ta: string | null
  nguon: string
  active: boolean
  priority: number
  team_key: string | null
  han_ngay: number
  max_moi_lan: number
  last_run_at: string | null
  last_created: number
  nguoi_nhan: string | null
  nguoi_nhan_ten: string | null
}

export type ManTuSinh = {
  luat: LuatTuSinh[]
  la_quan_ly: boolean
  nhan_su: { id: string; ten: string }[]
  gan_day: (ViecTeamRow & { origin_ref: string | null; created_at: string })[]
}

export async function manTuSinh(): Promise<ManTuSinh> {
  return goi<ManTuSinh>('work_luat_tu_sinh', {})
}

/** Chạy bộ quét ngay. Chỉ cấp quản lý — RPC tự chặn, đây chỉ là đường gọi. */
export async function chayTuSinh(): Promise<{ luat: string; da_tao: number }[]> {
  const kq = await goi<{ luat: string; da_tao: number }[]>('work_chay_tu_sinh', {})
  lamMoi()
  revalidatePath('/work/tu-sinh')
  return kq ?? []
}

export async function batTatLuat(key: string, active: boolean): Promise<void> {
  await goi<void>('work_bat_tat_luat', { p_key: key, p_active: active })
  revalidatePath('/work/tu-sinh')
}

export async function doiNguoiNhan(key: string, staffId: string | null): Promise<void> {
  await goi<void>('work_doi_nguoi_nhan', { p_key: key, p_staff_id: staffId })
  revalidatePath('/work/tu-sinh')
}

// ── Thao tác hàng loạt ──────────────────────────────────────────────────────
export type KetQuaHangLoat = { da_sua: number; bo_qua: number }

/**
 * Sửa nhiều việc một lượt. Trường nào bỏ trống thì không đụng tới.
 * Việc không có quyền sửa bị bỏ qua và đếm vào `bo_qua` — không ném lỗi,
 * vì chọn 20 việc mà 2 cái không có quyền thì vẫn nên làm 18 cái kia.
 */
export async function hangLoat(ids: number[], input: {
  status?: string | null
  gan_ai?: string | null
  gan_vai?: string
  bo_ai?: string | null
  priority?: number | null
  due?: string | null
  xoa_due?: boolean
  team_id?: number | null
  xoa_team?: boolean
}): Promise<KetQuaHangLoat> {
  const kq = await goi<KetQuaHangLoat>('work_hang_loat', {
    p_ids: ids,
    p_status: input.status ?? null,
    p_gan_ai: input.gan_ai ?? null,
    p_gan_vai: input.gan_vai ?? 'doer',
    p_bo_ai: input.bo_ai ?? null,
    p_priority: input.priority ?? null,
    p_due: input.due ?? null,
    p_xoa_due: input.xoa_due ?? false,
    p_team_id: input.team_id ?? null,
    p_xoa_team: input.xoa_team ?? false,
  })
  lamMoi()
  revalidatePath('/work/tu-sinh')
  return kq
}
