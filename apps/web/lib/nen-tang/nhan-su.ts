'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { authClient, dataClient } from './db'
import { KHONG_DU_QUYEN, chuanBiVaiTroDeGhi, kiemTraLoiMoi, toStaff, type Staff } from './nhan-su-luat'
import { coQuyen } from './kiem-quyen'
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
  if (!(await coQuyen('he_thong.nhan_su.xem', 'ADMIN'))) throw new Error(KHONG_DU_QUYEN)
  const { data, error } = await dataClient()
    .from('staff').select('id, ten, vai_tro, email, hoat_dong')
    // KHÔNG sắp theo vai_tro: tick một ô là đổi khoá sắp xếp, dòng nhảy chỗ ngay
    // giữa lúc đang tick — không theo dõi nổi. Chỉ hoat_dong (người khoá dồn xuống
    // cuối) rồi tên; cả hai đều không đổi khi gán vai trò.
    .order('hoat_dong', { ascending: false }).order('ten')
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
  if (!toi || !(await coQuyen('he_thong.nhan_su.sua', 'ADMIN'))) return { ok: false as const, error: KHONG_DU_QUYEN }

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
  if (!(await coQuyen('he_thong.nhan_su.sua', 'ADMIN'))) return { ok: false as const, error: KHONG_DU_QUYEN }
  const t = ten.trim()
  if (!t) return { ok: false as const, error: 'Tên không được để trống.' }
  const { error } = await dataClient().from('staff').update({ ten: t }).eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/nhan-vien')
  return { ok: true as const }
}

/**
 * Mời một người vào hệ thống bằng email cá nhân — dùng cho CTV lắp đặt, những
 * người không có email công ty.
 *
 * KHÔNG nới DOMAIN_CONG_TY: luật vào cửa vẫn là "có tên trong bảng staff thì
 * vào được". Lời mời chính là việc ghi tên vào bảng đó.
 *
 * hoat_dong=true ngay: admin đã chủ động nhập email và chọn vai trò rồi, bắt
 * duyệt thêm một lần nữa là thừa. Người được mời vẫn phải đăng nhập Google bằng
 * ĐÚNG email đó mới vào được.
 */
export async function moiNhanSu(email: string, vaiTro: string[]) {
  await requireStaff()
  if (!(await coQuyen('he_thong.nhan_su.sua', 'ADMIN'))) return { ok: false as const, error: KHONG_DU_QUYEN }

  const kt = kiemTraLoiMoi(email, vaiTro)
  if (!kt.ok) return { ok: false as const, error: kt.lyDo }

  const db = dataClient()
  const { data: daCo, error: e1 } = await db
    .from('staff').select('id').eq('email', kt.email).maybeSingle()
  if (e1) return { ok: false as const, error: e1.message }
  if (daCo) return { ok: false as const, error: 'Email này đã có trong danh sách nhân viên.' }

  const { error } = await db.from('staff').insert({
    email: kt.email,
    ten: kt.email.split('@')[0],
    vai_tro: kt.vaiTro,
    hoat_dong: true,
  })
  if (error) return { ok: false as const, error: error.message }

  await ghiAudit('moi_nhan_su', `email:${kt.email}`, { vai_tro: kt.vaiTro })
  revalidatePath('/nhan-vien')
  return { ok: true as const }
}

/**
 * Gửi email đặt lại mật khẩu cho một nhân sự.
 *
 * Dùng LẠI đúng luồng "Quên mật khẩu?" ở trang đăng nhập (resetPasswordForEmail
 * -> email recovery -> /auth/doi-mat-khau), chỉ khác là admin bấm hộ. KHÔNG đặt
 * mật khẩu thay người ta: admin không bao giờ được biết mật khẩu của nhân viên.
 *
 * Cần SMTP của Supabase đã cấu hình thì email mới đi. Trên máy local, Mailpit
 * (http://127.0.0.1:54324) hứng hết.
 */
export async function guiLaiMatKhau(id: string) {
  await requireStaff()
  if (!(await coQuyen('he_thong.nhan_su.mat_khau', 'ADMIN'))) return { ok: false as const, error: KHONG_DU_QUYEN }

  const { data, error: e1 } = await dataClient()
    .from('staff').select('email').eq('id', id).maybeSingle()
  if (e1) return { ok: false as const, error: e1.message }
  const email = (data as { email: string | null } | null)?.email
  if (!email) return { ok: false as const, error: 'Nhân sự này chưa có email.' }

  // resetPasswordForEmail cố ý báo THÀNH CÔNG cả khi email không có tài khoản
  // (chống dò email). Không chặn trước ở đây thì nút này nói dối: admin thấy
  // "đã gửi" mà người kia chẳng nhận được gì.
  const { data: coTk, error: e2 } = await dataClient()
    .rpc('nen_tang_co_tai_khoan', { p_email: email })
  if (e2) return { ok: false as const, error: e2.message }
  if (!coTk) {
    return {
      ok: false as const,
      error: 'Người này chưa có tài khoản đăng nhập nên không có mật khẩu để đặt lại. '
        + 'Email @gwt.vn thì bảo họ bấm “Đăng nhập bằng Google” một lần là xong.',
    }
  }

  // Lấy origin từ chính request thay vì đòi thêm biến môi trường: local, preview
  // và production đều tự đúng. Trang login (chạy ở client) dùng window.location.origin
  // cho cùng mục đích — ở Server Action thì không có window.
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const scheme = h.get('x-forwarded-proto') ?? (host?.startsWith('localhost') || host?.startsWith('127.') ? 'http' : 'https')
  if (!host) return { ok: false as const, error: 'Không xác định được địa chỉ trang.' }

  const { error } = await (await authClient()).auth.resetPasswordForEmail(email, {
    redirectTo: `${scheme}://${host}/auth/doi-mat-khau`,
  })
  if (error) return { ok: false as const, error: error.message }

  await ghiAudit('gui_lai_mat_khau', `nv:${id}`, { email })
  return { ok: true as const }
}
