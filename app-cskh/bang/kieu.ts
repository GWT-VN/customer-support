import type { SapXep } from './timkiem'

export type { SapXep }

/** Kết quả một trang: dữ liệu + tổng số dòng thật (để tính tổng số trang). */
export type KetQuaTrang<T> = {
  rows: T[]
  tong: number
  trang: number
  soTrang: number
  /**
   * Cột/chiều máy chủ THỰC SỰ đã dùng, tức kết quả của sapXepHopLe() SAU khi
   * lọc whitelist — không phải giá trị thô trên URL.
   *
   * Giao diện phải hiện đúng cái này, KHÔNG được tự đọc lại ?cot= : gõ tay
   * ?cot=mat_khau thì bảng sắp theo mặc định, mà chip đọc URL sẽ khoe
   * "mat_khau" — nói sai điều đang xảy ra tệ hơn không nói.
   */
  sapXep: SapXep
}

/** Tuỳ chọn chung cho các hàm liệt kê có phân trang + sắp xếp. */
export type TuyChonDanhSach = {
  trang?: number
  cot?: string
  chieu?: string
  /**
   * Ghi đè số dòng mỗi trang. CHỈ dùng cho "chọn tất cả khớp bộ lọc" — gomKhoa()
   * gọi lại ĐÚNG hàm liệt kê với một trang thật to rồi rút khoá.
   *
   * Vì sao không viết truy vấn riêng chỉ lấy khoá: bộ lọc sẽ bị chép làm hai bản
   * và sớm muộn lệch nhau. Lúc đó người dùng thấy "91 dòng" trên màn hình nhưng
   * bấm chọn tất cả lại ra 87 — không ai phát hiện cho tới khi sửa nhầm.
   */
  moiTrang?: number
}

/**
 * Bộ lọc hiện hành của trang, dạng nguyên khối searchParams — q, tt, sp, cot,
 * chieu… KHÔNG chứa `trang`.
 *
 * Phải tuần tự hoá được để truyền từ Server Component xuống Client Component
 * làm tham số cho Server Action.
 */
export type ThamSoLoc = Record<string, string | undefined>
