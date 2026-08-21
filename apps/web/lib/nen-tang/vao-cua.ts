/**
 * Luật vào cửa — HÀM THUẦN: không đụng DB, không import gì.
 *
 * Đây là chỗ DUY NHẤT chứa luật. Mọi đường đăng nhập (Google, mật khẩu) đều
 * phải đi qua đây, nếu không thì chặn một đường còn đường kia vẫn hở.
 *
 * Spec: docs/superpowers/specs/2026-08-20-nen-tang-tai-khoan-phan-quyen-design.md
 */

export const DOMAIN_CONG_TY = '@gwt.vn'

/** Vai trò nhân sự CSKH (nghiệp vụ chăm sóc khách). */
export const VAI_TRO_CSKH = ['admin', 'cs', 'cs_manager'] as const

/**
 * Vai trò được PHÉP vào KHU CS. Gồm nhân sự CSKH + kỹ thuật hiện trường.
 * Kỹ thuật vào được nhưng bị ép về giao diện rút gọn ở tầng app (chỉ lịch của mình).
 * Sales thuần / vai trò khác -> chặn khỏi khu CS (vẫn vào được nền tảng).
 */
export const VAI_TRO_VAO_APP = [...VAI_TRO_CSKH, 'ky_thuat'] as const

/** Dòng tương ứng trong staff, hoặc null nếu chưa có ai ghi */
export type DongStaff = { hoat_dong: boolean; vai_tro: string[] } | null

export type KetQuaVaoCua =
  | { duocVao: true; nguon: 'staff' }
  | { duocVao: false; lyDo: 'bi_khoa' | 'ngoai_danh_sach' | 'cho_duyet' | 'ngoai_cs' }

/**
 * Khu đang xin vào.
 *  - 'cs'       : khu CSKH — cần vai trò trong VAI_TRO_VAO_APP.
 *  - 'nen_tang' : khu chung (Việc/Work và module không phải CS) — mọi nhân sự
 *                 đang hoạt động đều vào được, không cần vai trò cụ thể.
 *
 * Module mới chỉ việc chọn một trong hai khu này, KHÔNG đẻ thêm hàm mới.
 */
export type Khu = 'cs' | 'nen_tang'

/**
 * Cờ trên tài khoản: "mật khẩu hiện tại là mật khẩu admin cấp, chưa được đổi".
 *
 * Nằm ở user_metadata chứ không ở bảng staff vì proxy.ts đọc được nó THẲNG TỪ
 * COOKIE, không phải hỏi database ở Singapore trên mọi lượt chuyển trang.
 */
export const CO_DOI_MAT_KHAU = 'phai_doi_mat_khau'

/** Đường dẫn màn đổi mật khẩu — chỗ DUY NHẤT người còn nợ đổi được phép vào. */
export const DUONG_DOI_MAT_KHAU = '/auth/doi-mat-khau'

/** Header proxy.ts nhét đường dẫn vào, để Server Component đọc lại được. */
export const HEADER_DUONG_DAN = 'x-gwt-duong-dan'

/**
 * Người này còn nợ việc đổi mật khẩu ban đầu không?
 *
 * So sánh === true chứ không ép kiểu: metadata là JSON tự do, chuỗi 'false' hay
 * số 0 lọt vào mà ép kiểu thì luật đảo chiều.
 */
export function conNoDoiMatKhau(meta: Record<string, unknown> | null | undefined): boolean {
  return meta?.[CO_DOI_MAT_KHAU] === true
}

export function chuanHoaEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

/**
 * Bốn luật, thứ tự KHÔNG được đổi:
 *  1&2. Có tên trong bảng thì BẢNG quyết định, kể cả email @gwt.vn. hoat_dong=false
 *       phải THẮNG luật domain bên dưới — đó chính là cơ chế khoá người nghỉ việc.
 *  3.   Đúng domain công ty nhưng CHƯA có hồ sơ -> CHỜ DUYỆT, KHÔNG tự cấp quyền.
 *       Admin phải bật hoat_dong ở /nhan-vien mới vào được.
 *  4.   Còn lại -> ngoài danh sách.
 */
export function xetLuatVao(khu: Khu, email: string, dong: DongStaff): KetQuaVaoCua {
  const e = chuanHoaEmail(email)

  if (dong) {
    if (!dong.hoat_dong) return { duocVao: false, lyDo: 'bi_khoa' }
    if (khu === 'cs') {
      const duocVaoCua = dong.vai_tro.some((r) => (VAI_TRO_VAO_APP as readonly string[]).includes(r))
      if (!duocVaoCua) return { duocVao: false, lyDo: 'ngoai_cs' }
    }
    return { duocVao: true, nguon: 'staff' }
  }

  if (e.endsWith(DOMAIN_CONG_TY)) return { duocVao: false, lyDo: 'cho_duyet' }
  return { duocVao: false, lyDo: 'ngoai_danh_sach' }
}

/** Khu CSKH. Giữ tên cũ để code hiện có không phải sửa. */
export function xetLuatVaoCua(email: string, dong: DongStaff): KetQuaVaoCua {
  return xetLuatVao('cs', email, dong)
}

/** Khu nền tảng (Việc/Work…). Giữ tên cũ để code hiện có không phải sửa. */
export function xetLuatVaoNenTang(email: string, dong: DongStaff): KetQuaVaoCua {
  return xetLuatVao('nen_tang', email, dong)
}
