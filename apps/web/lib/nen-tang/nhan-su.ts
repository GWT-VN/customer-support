'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { authClient, dataClient } from './db'
import {
  KHONG_DU_QUYEN, chuanBiVaiTroDeGhi, kiemTraLoiMoi, kiemTraXoaNhanSu, locThamChieuChan,
  sinhMatKhauBanDau, toStaff, type Staff, type ThamChieuStaff,
} from './nhan-su-luat'
import { coQuyen } from './kiem-quyen'
import { ghiAudit } from './nhat-ky'
import { layNhanVien, requireStaff } from './phien'
import { chuanHoaVaiTro, kiemTraSuaNhanVien, laQuyenAdmin, type VaiTro } from './vai-tro'
import { DOMAIN_CONG_TY, chuanHoaEmail } from './vao-cua'

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

  // Tài khoản đăng nhập là việc RIÊNG, làm sau khi đã ghi tên vào staff. Hỏng ở
  // bước này thì lời mời vẫn còn giá trị — admin bấm "cấp mật khẩu mới" là xong,
  // không phải mời lại từ đầu.
  const tk = await taoTaiKhoanNeuCan(kt.email)
  revalidatePath('/nhan-vien')
  return { ok: true as const, ...tk }
}

/**
 * Tạo tài khoản đăng nhập kèm MẬT KHẨU BAN ĐẦU cho người vừa được mời.
 *
 * CEO chốt 21/08: chỉ áp cho email NGOÀI @gwt.vn. Người dùng email công ty vẫn
 * đi đường Google như cũ — họ đã có sẵn danh tính, cấp thêm mật khẩu chỉ đẻ ra
 * một chìa khoá nữa để mất.
 *
 * Cờ `phai_doi_mat_khau` là thứ khiến mật khẩu này dùng được đúng một lần: lần
 * đăng nhập đầu bị chặn ở màn đổi mật khẩu, đổi xong admin hết biết mật khẩu.
 */
async function taoTaiKhoanNeuCan(
  email: string
): Promise<{ matKhau: string | null; ghiChu: string }> {
  if (email.endsWith(DOMAIN_CONG_TY)) {
    return {
      matKhau: null,
      ghiChu: `Email công ty ${DOMAIN_CONG_TY} — họ bấm “Đăng nhập bằng Google” là vào được, không cần mật khẩu.`,
    }
  }

  const db = dataClient()
  const { data: daCo } = await db.rpc('nen_tang_co_tai_khoan', { p_email: email })
  if (daCo) {
    return {
      matKhau: null,
      ghiChu: 'Email này đã có tài khoản đăng nhập từ trước — họ dùng mật khẩu cũ. '
        + 'Quên thì bấm “Quên mật khẩu?” ở trang đăng nhập, hoặc bấm “cấp mật khẩu mới” ở dòng của họ.',
    }
  }

  const matKhau = sinhMatKhauBanDau()
  const { error } = await db.auth.admin.createUser({
    email,
    password: matKhau,
    email_confirm: true,
    user_metadata: { phai_doi_mat_khau: true },
  })
  if (error) {
    return {
      matKhau: null,
      ghiChu: `Đã thêm vào danh sách nhưng CHƯA tạo được tài khoản đăng nhập (${error.message}). `
        + 'Bấm “cấp mật khẩu mới” ở dòng của họ để thử lại.',
    }
  }

  await ghiAudit('tao_tai_khoan', `email:${email}`, { phai_doi_mat_khau: true })
  return { matKhau, ghiChu: '' }
}

/**
 * Cấp một mật khẩu ban đầu MỚI và bắt đổi lại ở lần đăng nhập kế tiếp.
 *
 * Khác nút "gửi lại mật khẩu" ở chỗ KHÔNG cần email đi được: admin đọc mật khẩu
 * cho người kia qua Zalo/điện thoại. Đây là đường thoát cho ca SMTP chưa cấu
 * hình, hoặc người được mời không mở được hộp thư.
 *
 * Đổi lại: admin BIẾT mật khẩu này trong khoảng thời gian trước khi người kia
 * đăng nhập. Đó là lý do cờ phai_doi_mat_khau bật lên cùng lúc.
 */
export async function capMatKhauMoi(id: string) {
  await requireStaff()
  if (!(await coQuyen('he_thong.nhan_su.mat_khau', 'ADMIN'))) {
    return { ok: false as const, error: KHONG_DU_QUYEN }
  }

  const db = dataClient()
  const { data, error: e1 } = await db.from('staff').select('email').eq('id', id).maybeSingle()
  if (e1) return { ok: false as const, error: e1.message }
  const email = chuanHoaEmail((data as { email: string | null } | null)?.email)
  if (!email) return { ok: false as const, error: 'Nhân sự này chưa có email.' }

  const matKhau = sinhMatKhauBanDau()
  const { data: idTk, error: e2 } = await db.rpc('nen_tang_id_tai_khoan', { p_email: email })
  if (e2) return { ok: false as const, error: e2.message }

  const { error } = idTk
    ? await db.auth.admin.updateUserById(idTk as string, {
        password: matKhau,
        user_metadata: { phai_doi_mat_khau: true },
      })
    : await db.auth.admin.createUser({
        email,
        password: matKhau,
        email_confirm: true,
        user_metadata: { phai_doi_mat_khau: true },
      })
  if (error) return { ok: false as const, error: error.message }

  await ghiAudit('cap_mat_khau_moi', `nv:${id}`, { email, tao_moi: !idTk })
  revalidatePath('/nhan-vien')
  return { ok: true as const, matKhau, email }
}

/**
 * Đếm chỗ còn trỏ vào một nhân sự — để nút xoá biết mình có được phép hiện không.
 *
 * Tách khỏi xoaNhanSu() để giao diện hỏi TRƯỚC khi hỏi lại admin: câu xác nhận
 * "xoá hẳn?" chỉ nên hiện khi thật sự xoá được, còn không thì nói luôn vì sao không.
 */
export async function demThamChieuNhanSu(id: string) {
  await requireStaff()
  if (!(await coQuyen('he_thong.nhan_su.xoa', 'ADMIN'))) {
    return { ok: false as const, error: KHONG_DU_QUYEN }
  }
  const { data, error } = await dataClient()
    .rpc('nen_tang_dem_tham_chieu_staff', { p_staff_id: id })
  if (error) return { ok: false as const, error: error.message }
  const tho = (data ?? []) as ThamChieuStaff[]
  return { ok: true as const, thamChieu: tho, chan: locThamChieuChan(tho) }
}

/**
 * Xoá hẳn một nhân sự — CHỈ ca "mời nhầm email, người đó chưa làm gì".
 *
 * Đếm lại tham chiếu NGAY TRƯỚC KHI XOÁ chứ không tin con số giao diện gửi lên:
 * giữa lúc admin đọc câu xác nhận, người kia có thể vừa được giao một việc.
 *
 * Xoá cả tài khoản đăng nhập. Không xoá thì email mời nhầm vẫn còn đường vào:
 * dòng staff mất nhưng auth.users còn, người @gwt.vn lại tự tạo được hồ sơ chờ
 * duyệt ở lần đăng nhập sau.
 */
export async function xoaNhanSu(id: string) {
  await requireStaff()
  const toi = await layNhanVien()
  if (!toi || !(await coQuyen('he_thong.nhan_su.xoa', 'ADMIN'))) {
    return { ok: false as const, error: KHONG_DU_QUYEN }
  }

  const db = dataClient()
  const { data: biXoa, error: e1 } = await db
    .from('staff').select('id, ten, email, vai_tro').eq('id', id).maybeSingle()
  if (e1) return { ok: false as const, error: e1.message }
  if (!biXoa) return { ok: false as const, error: 'Không tìm thấy nhân viên.' }

  const { data: tc, error: e2 } = await db.rpc('nen_tang_dem_tham_chieu_staff', { p_staff_id: id })
  if (e2) return { ok: false as const, error: e2.message }

  const kt = kiemTraXoaNhanSu({
    idNguoiXoa: toi.id,
    idBiXoa: id,
    vaiTroBiXoa: chuanHoaVaiTro((biXoa as { vai_tro: unknown }).vai_tro as string | string[] | null),
    thamChieu: (tc ?? []) as ThamChieuStaff[],
  })
  if (!kt.ok) return { ok: false as const, error: kt.lyDo }

  const email = chuanHoaEmail((biXoa as { email: string | null }).email)
  if (email) {
    const { data: idTk } = await db.rpc('nen_tang_id_tai_khoan', { p_email: email })
    // Tài khoản xoá trước, dòng staff xoá sau. Ngược lại mà bước hai hỏng thì
    // còn một tài khoản đăng nhập không còn hồ sơ nào ứng với nó — mồ côi, và
    // không màn hình nào của app nhìn thấy để dọn.
    if (idTk) {
      const { error } = await db.auth.admin.deleteUser(idTk as string)
      if (error) return { ok: false as const, error: `Không xoá được tài khoản đăng nhập: ${error.message}` }
    }
  }

  const { error } = await db.from('staff').delete().eq('id', id)
  if (error) return { ok: false as const, error: error.message }

  await ghiAudit('xoa_nhan_su', `nv:${id}`, {
    email,
    ten: (biXoa as { ten: string }).ten,
    vai_tro: (biXoa as { vai_tro: unknown }).vai_tro,
  })
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
