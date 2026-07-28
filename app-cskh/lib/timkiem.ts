/**
 * Tìm kiếm và sắp xếp — HÀM THUẦN, không đụng DB, không import gì.
 *
 * boDau() phải khớp ĐÚNG với hàm khong_dau() dưới Postgres
 * (supabase-cskh/migrations/06_tim_kiem_khong_dau.sql). Lệch nhau là gõ ra
 * kết quả rỗng mà không ai hiểu vì sao.
 */

export function boDau(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // bỏ dấu thanh + dấu mũ
    .replace(/đ/g, 'd')               // U+0111 KHÔNG decompose được bằng NFD
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

/** Chuẩn hoá chuỗi người dùng gõ trước khi đưa vào truy vấn. */
export function chuanHoaTuKhoa(q: string): string {
  return boDau(q).trim().replace(/\s+/g, ' ')
}

export type SapXep = { cot: string; tang: boolean }

/**
 * Cột sắp xếp lấy từ URL mà đưa thẳng vào .order() là lỗ hổng.
 * Ngoài danh sách trắng thì bỏ qua, rơi về mặc định.
 */
export function sapXepHopLe(
  cot: string | undefined,
  chieu: string | undefined,
  choPhep: readonly string[],
  macDinh: SapXep
): SapXep {
  if (!cot || !choPhep.includes(cot)) return macDinh
  return { cot, tang: chieu === 'asc' }
}
