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
import { dataClient } from '@/lib/nen-tang/db'
import type { LienKet } from '@/lib/work'
import { requireNhanSu } from '@/lib/nen-tang/phien'
import { chuanHoaEmail } from '@/lib/nen-tang/vao-cua'
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
  links: LienKet[]
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
  links: LienKet[]
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

/**
 * Kết quả của server action gọi từ trình duyệt.
 *
 * VÌ SAO TRẢ VỀ CHỨ KHÔNG NÉM: Next CHE mọi lỗi ném ra từ server action khi
 * chạy production, thay bằng "An error occurred in the Server Components
 * render. The specific message is omitted…". Người dùng đáng ra phải đọc được
 * "Không có quyền xem việc này" hay "Việc phải còn ít nhất 1 người phụ trách"
 * thì lại nhận một đoạn tiếng Anh vô nghĩa. Nên mọi thông điệp dành cho người
 * dùng đi qua đường trả-về, không đi qua đường ném.
 */
export type KQ<T> = { ok: true; duLieu: T } | { ok: false; loi: string }

async function boc<T>(fn: () => Promise<T>): Promise<KQ<T>> {
  try {
    return { ok: true, duLieu: await fn() }
  } catch (e) {
    return { ok: false, loi: e instanceof Error ? e.message : 'Thao tác không thành công' }
  }
}

// ── Đọc ─────────────────────────────────────────────────────────────────────
export async function nenTang(): Promise<NenTang> {
  return goi<NenTang>('work_nen_tang', {})
}

export async function vieCcuaToi(): Promise<ViecRow[]> {
  return (await goi<ViecRow[]>('work_viec_cua_toi', {})) ?? []
}

/** Bản cho TRÌNH DUYỆT — trả lỗi thay vì ném (xem ghi chú ở KQ<T>). */
export async function bangTeamKQ(loc: Parameters<typeof bangTeam>[0] = {}): Promise<KQ<ViecTeamRow[]>> {
  return boc(() => bangTeam(loc))
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

export async function chiTietViec(id: number): Promise<KQ<ChiTietViec>> {
  return boc(() => goi<ChiTietViec>('work_chi_tiet_viec', { p_task_id: id }))
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
}): Promise<KQ<{ id: number; ref: string }>> {
  return boc(async () => {
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
  })
}

export async function doiTrangThai(id: number, status: string): Promise<KQ<void>> {
  return boc(async () => {
    await goi<void>('work_doi_trang_thai', { p_task_id: id, p_status: status })
    lamMoi()
  })
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
}): Promise<KQ<void>> {
  return boc(async () => {
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
  })
}

export async function ganNguoi(taskId: number, staffId: string, role = 'doer'): Promise<KQ<void>> {
  return boc(async () => {
    await goi<void>('work_gan_nguoi', { p_task_id: taskId, p_staff_id: staffId, p_role: role })
    lamMoi()
  })
}

export async function boNguoi(taskId: number, staffId: string): Promise<KQ<void>> {
  return boc(async () => {
    await goi<void>('work_bo_nguoi', { p_task_id: taskId, p_staff_id: staffId })
    lamMoi()
  })
}

export async function themBinhLuan(taskId: number, body: string): Promise<KQ<void>> {
  return boc(async () => {
    await goi<void>('work_them_binh_luan', { p_task_id: taskId, p_body: body })
    lamMoi()
  })
}

// ── Gắn khách / ticket / đơn ────────────────────────────────────────────────

/**
 * Gợi ý để chọn. Trả tối đa 8 dòng; dưới 2 ký tự thì không tìm.
 *
 * Truyền `taskId` để RPC thu hẹp ticket/đơn về đúng khách việc đó đã gắn — chọn
 * khách rồi mà vẫn phải lội qua 428 đơn của mọi người là vô nghĩa.
 */
export async function timErp(loai: string, tuKhoa: string, taskId?: number): Promise<KQ<GoiYErp[]>> {
  return boc(() => goi<GoiYErp[]>('work_tim_erp', {
    p_loai: loai, p_tu_khoa: tuKhoa, p_task_id: taskId ?? null,
  }))
}

export type GoiYErp = { ma: string; nhan: string; phu: string | null }

export async function ganErp(taskId: number, loai: string, ma: string): Promise<KQ<void>> {
  return boc(async () => {
    await goi<void>('work_gan_erp', { p_task_id: taskId, p_loai: loai, p_ma: ma })
    lamMoi()
  })
}

export async function boErp(linkId: number): Promise<KQ<void>> {
  return boc(async () => {
    await goi<void>('work_bo_erp', { p_link_id: linkId })
    lamMoi()
  })
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
  /** Sự kiện phải cũ hơn bao nhiêu GIỜ mới sinh việc. null = không xét. */
  nguong_gio: number | null
  /** Chỉ nhìn sự kiện trong ±n NGÀY quanh hôm nay. null = không xét. */
  cua_so_ngay: number | null
}

/** Một dòng "nếu chạy bây giờ thì sinh cái này" — chỉ xem, không ghi. */
export type ThuLuat = { luat: string; se_sinh: { khoa: string; mo_ta: string; moc: string }[] }

export type ManTuSinh = {
  luat: LuatTuSinh[]
  la_quan_ly: boolean
  nhan_su: { id: string; ten: string }[]
  gan_day: (ViecTeamRow & { origin_ref: string | null; created_at: string })[]
  /** Tổng việc auto trong DB — để nói rõ "bạn thấy 8/20, phần còn lại của người khác". */
  tong_auto: number
}

export async function manTuSinh(): Promise<ManTuSinh> {
  return goi<ManTuSinh>('work_luat_tu_sinh', {})
}

/** Chạy bộ quét ngay. Chỉ cấp quản lý — RPC tự chặn, đây chỉ là đường gọi. */
export async function chayTuSinh(): Promise<KQ<{ luat: string; da_tao: number }[]>> {
  return boc(async () => {
    const kq = await goi<{ luat: string; da_tao: number }[]>('work_chay_tu_sinh', {})
    lamMoi()
    revalidatePath('/work/tu-sinh')
    return kq ?? []
  })
}

export async function batTatLuat(key: string, active: boolean): Promise<KQ<void>> {
  return boc(async () => {
    await goi<void>('work_bat_tat_luat', { p_key: key, p_active: active })
    revalidatePath('/work/tu-sinh')
  })
}

/** Sửa tham số một luật. Trường nào bỏ trống thì giữ nguyên. */
export async function suaLuat(key: string, input: {
  priority?: number | null
  han_ngay?: number | null
  max_moi_lan?: number | null
  nguong_gio?: number | null
  cua_so_ngay?: number | null
  team_key?: string | null
}): Promise<KQ<void>> {
  return boc(async () => {
    await goi<void>('work_sua_luat', {
      p_key: key,
      p_priority: input.priority ?? null,
      p_han_ngay: input.han_ngay ?? null,
      p_max_moi_lan: input.max_moi_lan ?? null,
      p_nguong_gio: input.nguong_gio ?? null,
      p_cua_so_ngay: input.cua_so_ngay ?? null,
      p_team_key: input.team_key ?? null,
    })
    revalidatePath('/work/tu-sinh')
  })
}

/** Xem trước: nếu chạy luật này BÂY GIỜ thì nó sinh những gì. Không ghi gì cả. */
export async function thuLuat(key: string): Promise<KQ<ThuLuat>> {
  return boc(() => goi<ThuLuat>('work_thu_luat', { p_key: key }))
}

export async function doiNguoiNhan(key: string, staffId: string | null): Promise<KQ<void>> {
  return boc(async () => {
    await goi<void>('work_doi_nguoi_nhan', { p_key: key, p_staff_id: staffId })
    revalidatePath('/work/tu-sinh')
  })
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
}): Promise<KQ<KetQuaHangLoat>> {
  return boc(async () => {
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
  })
}
