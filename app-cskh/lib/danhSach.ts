/**
 * Hằng số phân trang + whitelist cột sắp xếp — dùng chung cho các hàm liệt kê
 * trong app/actions.ts.
 *
 * Tách riêng khỏi actions.ts (thay vì export thẳng như bản nháp ban đầu) vì
 * actions.ts có 'use server': Next 16 CHỈ cho phép export async function ở
 * file dạng này — export const giá trị thường (số, mảng…) làm build vỡ ngay
 * ("Only async functions are allowed to be exported in a 'use server' file").
 * Type (KetQuaTrang, TuyChonDanhSach) không bị luật này chặn vì bị xoá lúc
 * biên dịch, nên vẫn khai báo/export thẳng trong actions.ts như cũ.
 */

/** Số dòng mỗi trang — dùng chung cho mọi danh sách có phân trang. */
export const MOI_TRANG = 50

/**
 * Lịch thay lõi (/loi, coreForecast) — bản trước Task 3 dùng .limit(100), không phải 50.
 * Giữ riêng 100 cho hàm này để không "tụt" xuống còn 50 trước khi Task 4 dựng xong nút
 * chuyển trang (nếu dùng chung MOI_TRANG=50, 50 dòng đang xem được ở bản cũ sẽ tạm thời
 * không click tới được).
 */
export const MOI_TRANG_LOI = 100

/** Cột được phép sắp xếp — ngoài danh sách này bị bỏ qua (chống injection). */
export const COT_MAY = ['install_date', 'serial', 'customer_name', 'product_name'] as const
export const COT_TICKET = ['created_at', 'ticket_code', 'state', 'customer_name'] as const
export const COT_LOI = ['han_som', 'serial', 'customer_name'] as const
export const COT_KHACH = ['full_name', 'province'] as const

/**
 * 4 trạng thái bảo hành cho bộ lọc ở trang "/". PHẢI khớp Y HỆT logic phân
 * loại ở components/Badge.tsx (WarrantyBadge) — cố tình KHÔNG có nhánh
 * "không rõ hạn" (co_chinh_sach_bh=false) trong 4 lựa chọn này, đúng theo
 * yêu cầu chỉ lọc 4 trạng thái. Lệch khỏi WarrantyBadge thì lọc "còn hạn"
 * lại ra dòng badge đỏ, mất lòng tin ngay.
 */
export const TINH_TRANG_BH = ['chua_kich_hoat', 'con_han_may', 'het_may_con_loi', 'het_ca_hai'] as const
export type TinhTrangBH = (typeof TINH_TRANG_BH)[number]

export const NHAN_TINH_TRANG_BH: Record<TinhTrangBH, string> = {
  chua_kich_hoat: 'Chưa kích hoạt',
  con_han_may: 'Còn hạn máy',
  het_may_con_loi: 'Hết hạn máy, còn lõi',
  het_ca_hai: 'Hết cả hai',
}
