/**
 * Luật vào cửa app CSKH — HÀM THUẦN: không đụng DB, không import gì.
 *
 * Đây là chỗ DUY NHẤT chứa luật. Mọi đường đăng nhập (Google, mật khẩu) đều
 * phải đi qua đây, nếu không thì chặn một đường còn đường kia vẫn hở.
 *
 * Spec: docs/specs/2026-07-28-dang-nhap-google-va-deploy-vercel.md mục 4
 */

export const DOMAIN_CONG_TY = '@gwt.vn'

/** Dòng tương ứng trong cs_staff, hoặc null nếu chưa có ai ghi */
export type DongStaff = { hoat_dong: boolean } | null

export type KetQuaVaoCua =
  | { duocVao: true; nguon: 'cs_staff' | 'domain' }
  | { duocVao: false; lyDo: 'bi_khoa' | 'ngoai_danh_sach' }

export function chuanHoaEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

export function xetLuatVaoCua(email: string, dong: DongStaff): KetQuaVaoCua {
  const e = chuanHoaEmail(email)

  // Luật 1 & 2 — có tên trong bảng thì BẢNG quyết định, kể cả email @gwt.vn.
  // Thứ tự này quan trọng: hoat_dong=false phải thắng luật domain bên dưới,
  // đó chính là cơ chế khoá người nghỉ việc.
  if (dong) {
    return dong.hoat_dong
      ? { duocVao: true, nguon: 'cs_staff' }
      : { duocVao: false, lyDo: 'bi_khoa' }
  }

  // Luật 3 — chưa có tên nhưng đúng domain công ty
  if (e.endsWith(DOMAIN_CONG_TY)) return { duocVao: true, nguon: 'domain' }

  // Luật 4
  return { duocVao: false, lyDo: 'ngoai_danh_sach' }
}
