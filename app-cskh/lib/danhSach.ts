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

/** Cột được phép sắp xếp — ngoài danh sách này bị bỏ qua (chống injection). */
export const COT_MAY = ['install_date', 'serial', 'customer_name', 'product_name'] as const
export const COT_TICKET = ['created_at', 'ticket_code', 'state', 'customer_name'] as const
export const COT_LOI = ['han_som', 'serial', 'customer_name'] as const
export const COT_KHACH = ['full_name', 'province'] as const
