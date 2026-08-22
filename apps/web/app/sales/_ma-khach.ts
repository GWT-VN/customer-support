/**
 * Chọn mã khách hệ mới `KH-YYMM-NNNN` cho một người sắp được tạo — phần THUẦN.
 *
 * Tách khỏi `_db.ts` để test được không cần DB, và vì đây là chỗ dễ sai nhất:
 * `cap_ma_kh()` dưới DB chỉ biết lấy số kế tiếp, **nó không tra SĐT**. Gọi thẳng vào
 * là cùng một người được hai mã khi CSKH tạo trước rồi Sales tạo lại — đo production
 * ngày 22/08 đã có 4 cặp như vậy.
 *
 * Mã này là **danh tính người**: từ 22/08 dữ liệu vệ tinh (SĐT phụ, địa chỉ phụ) khoá
 * vào nó. Hai mã cho một người = dữ liệu tách đôi, không báo lỗi, không ai thấy.
 */

/** 9 số cuối — khoá so DUY NHẤT. Hai khu chuẩn hoá SĐT bằng hai hàm khác nhau; 9 số
 *  cuối là thứ duy nhất không phụ thuộc bên nào viết `+84`, `0`, hay dấu cách. */
export function cuoi9(raw: string | null | undefined): string {
  const so = (raw ?? '').replace(/\D/g, '')
  return so.length >= 9 ? so.slice(-9) : ''
}

export type DongCoMa = { sdt: string | null; ma_kh: string | null }

/**
 * Mã đã cấp cho SĐT này, tìm trên CẢ hai bảng. `null` = người mới, gọi `cap_ma_kh()`.
 *
 * CSKH được ưu tiên khi hai bên lệch mã: `cs_customers.ma_kh` có ràng buộc duy nhất,
 * `customers.ma_kh` thì không (5 mã đang dính 2 dòng vì trùng hồ sơ). Chọn bên chặt
 * hơn thì không bao giờ nhặt phải mã đang dùng cho hai người.
 */
export function maDaCap(cs: DongCoMa[], sales: DongCoMa[], phone: string | null | undefined): string | null {
  const k = cuoi9(phone)
  if (!k) return null
  const tim = (ds: DongCoMa[]) => ds.find((r) => r.ma_kh && cuoi9(r.sdt) === k)?.ma_kh ?? null
  return tim(cs) ?? tim(sales)
}
