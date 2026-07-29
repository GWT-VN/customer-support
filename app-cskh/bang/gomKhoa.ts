/**
 * Lấy TOÀN BỘ khoá dòng khớp bộ lọc, không chỉ trang đang xem.
 *
 * ⚠️ PostgREST/Supabase chặn cứng 1000 dòng MỖI REQUEST (`db-max-rows`). Đặt
 * `.limit(2000)` KHÔNG báo lỗi — nó lặng lẽ trả về 1000. Đã dính đúng bẫy này
 * trên dự án GWT: bấm "chọn tất cả 1891 serial" ra 1000, giao diện không hề
 * biết bị cắt nên vẫn mời bấm lại mãi.
 *
 * Nên phải lấy theo LÔ 1000 rồi ghép. Cột dùng `.range()` chứ `.limit()` thì
 * không lấy được lô thứ hai trở đi.
 *
 * Bên gọi so số khoá nhận được với tổng để biết có bị cắt ở trần `toiDa` không
 * — nếu bị thì PHẢI nói ra chứ không im lặng.
 */
export const MOI_LO = 1000

/** Trần mặc định cho một lượt chọn. Đổi theo quy mô dự án. */
export const TOI_DA_CHON_MAC_DINH = 2000

export async function gomKhoa<T>(
  /** Gọi lại ĐÚNG hàm liệt kê của trang — đừng viết truy vấn lọc riêng. */
  layLo: (trang: number, moiTrang: number) => Promise<{ rows: T[]; tong: number }>,
  khoaCua: (r: T) => string,
  toiDa = TOI_DA_CHON_MAC_DINH
): Promise<string[]> {
  const ra: string[] = []
  for (let trang = 1; ra.length < toiDa; trang++) {
    const { rows, tong } = await layLo(trang, MOI_LO)
    for (const r of rows) ra.push(khoaCua(r))
    // Hết dòng, hoặc lô cuối trả về non-đầy -> không còn gì để lấy.
    if (ra.length >= tong || rows.length < MOI_LO) break
  }
  return ra.slice(0, toiDa)
}
