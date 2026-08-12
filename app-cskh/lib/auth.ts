/**
 * Luật vào cửa app CSKH — HÀM THUẦN: không đụng DB, không import gì.
 *
 * Đây là chỗ DUY NHẤT chứa luật. Mọi đường đăng nhập (Google, mật khẩu) đều
 * phải đi qua đây, nếu không thì chặn một đường còn đường kia vẫn hở.
 *
 * Spec: docs/specs/2026-07-28-dang-nhap-google-va-deploy-vercel.md mục 4
 */

export const DOMAIN_CONG_TY = '@gwt.vn'

/** Vai trò được vào app CSKH. Sales thuần / chưa gán vai trò CS -> chặn. */
export const VAI_TRO_CSKH = ['admin', 'cs', 'cs_manager'] as const

/** Dòng tương ứng trong staff, hoặc null nếu chưa có ai ghi */
export type DongStaff = { hoat_dong: boolean; vai_tro: string[] } | null

export type KetQuaVaoCua =
  | { duocVao: true; nguon: 'staff' }
  | { duocVao: false; lyDo: 'bi_khoa' | 'ngoai_danh_sach' | 'cho_duyet' | 'ngoai_cs' }

export function chuanHoaEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

export function xetLuatVaoCua(email: string, dong: DongStaff): KetQuaVaoCua {
  const e = chuanHoaEmail(email)

  // Luật 1 & 2 — có tên trong bảng thì BẢNG quyết định, kể cả email @gwt.vn.
  // Thứ tự này quan trọng: hoat_dong=false phải thắng luật domain bên dưới,
  // đó chính là cơ chế khoá người nghỉ việc.
  if (dong) {
    if (!dong.hoat_dong) return { duocVao: false, lyDo: 'bi_khoa' }
    // Đang bật NHƯNG phải có vai trò CS mới vào app CSKH — chặn Sales thuần
    // (sales/sales_manager) và người chưa được gán vai trò CS nào.
    const laNhanSuCs = dong.vai_tro.some((r) => (VAI_TRO_CSKH as readonly string[]).includes(r))
    if (!laNhanSuCs) return { duocVao: false, lyDo: 'ngoai_cs' }
    return { duocVao: true, nguon: 'staff' }
  }

  // Luật 3 — đúng domain công ty nhưng CHƯA có hồ sơ: tạo hồ sơ CHỜ DUYỆT,
  // KHÔNG tự cấp quyền vào. Admin phải bật hoat_dong ở /nhan-vien mới vào được.
  if (e.endsWith(DOMAIN_CONG_TY)) return { duocVao: false, lyDo: 'cho_duyet' }

  // Luật 4
  return { duocVao: false, lyDo: 'ngoai_danh_sach' }
}
