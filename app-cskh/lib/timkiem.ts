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

/** PostgREST dùng dấu phẩy và ngoặc làm cú pháp .or() — phải bỏ khỏi từ khoá. */
export function antoanChoOr(kw: string): string {
  return kw.replace(/[,()%*]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Mẫu regex khớp theo ĐẦU TỪ, dùng cho cột đã bỏ dấu (ten_kd) với toán tử
 * `imatch` của PostgREST (`~*` của Postgres).
 *
 * Vì sao KHÔNG dùng ilike %...% cho tên người: `%huong%` khớp cả chuỗi con GIỮA
 * từ, nên gõ "huong" ra luôn Phương / Phượng / Thương / Thường (đo trên DB thật:
 * 41 dòng, trong đó 21 dòng sai — Chị Minh Phương, Nguyễn Hải Thường, cả CÔNG TY
 * ... THƯƠNG MẠI...). `\m` = mốc đầu từ của Postgres -> chỉ còn 20 dòng Hương/Hường.
 *
 * Vẫn gõ được một phần tên: "\mle thi" khớp "Lê Thị Thu Hường" vì mốc đầu từ chỉ
 * ràng buộc chỗ BẮT ĐẦU, phần đuôi vẫn khớp lỏng.
 *
 * ⚠️ BẮT BUỘC thoát ký tự regex: người dùng gõ "[" là Postgres báo regex hỏng và
 * PostgREST trả HTTP 400 (đã thử trên API thật) — trang sẽ vỡ chứ không ra rỗng.
 * Gọi SAU antoanChoOr() để dấu phẩy đã bị bỏ, không phá cú pháp .or().
 */
export function mauDauTu(kw: string): string {
  return '\\m' + kw.replace(/[\\^$.|?*+()[\]{}]/g, '\\$&')
}
