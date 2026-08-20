'use server'

import { revalidatePath } from 'next/cache'
import { dataClient } from './db'
import { laAdmin } from './gac-cong'
import { KHONG_DU_QUYEN, chuanBiVaiTroDeGhi, toStaff, type Staff } from './nhan-su-luat'
import { ghiAudit } from './nhat-ky'
import { layNhanVien, requireStaff } from './phien'
import { chuanHoaVaiTro, kiemTraSuaNhanVien, laQuyenAdmin, type VaiTro } from './vai-tro'

/** Danh sách NV đang hoạt động — để chọn người phụ trách. */
export async function listStaff(): Promise<Staff[]> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('staff').select('id, ten, vai_tro, email').eq('hoat_dong', true).order('ten')
  if (error) throw new Error(error.message)
  return (data ?? []).map(toStaff)
}

/** NV ứng với người đang đăng nhập (khớp email) — cho lọc "việc của tôi". */
export async function currentStaff(): Promise<Staff | null> {
  const user = await requireStaff()
  if (!user.email) return null
  const { data, error } = await dataClient()
    .from('staff').select('id, ten, vai_tro, email').eq('email', user.email).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toStaff(data) : null
}

/** Toàn bộ NV kể cả đã khoá — cho màn /nhan-vien. Khác listStaff() vốn chỉ lấy NV đang hoạt động. */
export async function listAllStaff(): Promise<(Staff & { hoat_dong: boolean })[]> {
  await requireStaff()
  if (!(await laAdmin())) throw new Error(KHONG_DU_QUYEN)
  const { data, error } = await dataClient()
    .from('staff').select('id, ten, vai_tro, email, hoat_dong')
    .order('hoat_dong', { ascending: false }).order('vai_tro').order('ten')
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({ ...toStaff(r), hoat_dong: (r as { hoat_dong: boolean }).hoat_dong }))
}

/**
 * Đổi vai trò hoặc bật/tắt hoạt động của một nhân viên.
 *
 * Luật chống khoá chết hệ thống nằm ở lib/nen-tang/vai-tro.ts (có unit test): không
 * tự khoá mình, không tự hạ quyền mình, không hạ/khoá admin cuối cùng.
 */
export async function suaNhanVien(
  id: string,
  patch: { vai_tro?: string[]; hoat_dong?: boolean }
) {
  await requireStaff()
  const toi = await layNhanVien()
  if (!toi || !(await laAdmin())) return { ok: false as const, error: KHONG_DU_QUYEN }

  // Chặn role lạ, khử trùng, áp loại trừ cấp bậc. undefined = không đổi role.
  const kq = chuanBiVaiTroDeGhi(patch.vai_tro)
  if (!kq.ok) return { ok: false as const, error: kq.lyDo }
  const vaiTroMoi: VaiTro[] | undefined = kq.vaiTro

  const db = dataClient()
  const { data: biSua, error: e1 } = await db
    .from('staff').select('id, vai_tro, hoat_dong').eq('id', id).maybeSingle()
  if (e1) return { ok: false as const, error: e1.message }
  if (!biSua) return { ok: false as const, error: 'Không tìm thấy nhân viên.' }

  // Đếm admin đang hoạt động bằng coerce trong JS thay vì .eq('vai_tro','admin')
  // — đúng cho cả cột chuỗi cũ lẫn text[] mới (bảng staff nhỏ, không lo chi phí).
  const { data: dsHoatDong, error: e2 } = await db
    .from('staff').select('vai_tro').eq('hoat_dong', true)
  if (e2) return { ok: false as const, error: e2.message }
  const soAdmin = (dsHoatDong ?? [])
    .filter((r) => laQuyenAdmin((r as { vai_tro: unknown }).vai_tro as string | string[] | null)).length

  const kt = kiemTraSuaNhanVien({
    idNguoiSua: toi.id,
    idBiSua: id,
    vaiTroMoi,
    hoatDongMoi: patch.hoat_dong,
    vaiTroHienTai: chuanHoaVaiTro((biSua as { vai_tro: unknown }).vai_tro as string | string[] | null),
    soAdminDangHoatDong: soAdmin,
  })
  if (!kt.ok) return { ok: false as const, error: kt.lyDo }

  // Ghi TẬP đã chuẩn hoá (không ghi mảng thô từ client).
  const capNhat: { vai_tro?: VaiTro[]; hoat_dong?: boolean } = {}
  if (vaiTroMoi !== undefined) capNhat.vai_tro = vaiTroMoi
  if (patch.hoat_dong !== undefined) capNhat.hoat_dong = patch.hoat_dong

  const { error } = await db.from('staff').update(capNhat).eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  await ghiAudit('sua_nv', `nv:${id}`, capNhat as Record<string, unknown>)
  revalidatePath('/nhan-vien')
  return { ok: true as const }
}

/** Sửa tên hiển thị — người vào lần đầu chỉ có tên tạm lấy từ email. */
export async function doiTenNhanVien(id: string, ten: string) {
  await requireStaff()
  if (!(await laAdmin())) return { ok: false as const, error: KHONG_DU_QUYEN }
  const t = ten.trim()
  if (!t) return { ok: false as const, error: 'Tên không được để trống.' }
  const { error } = await dataClient().from('staff').update({ ten: t }).eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/nhan-vien')
  return { ok: true as const }
}
