/**
 * Tính lưới lịch tháng. Tách khỏi component vì phần này là số học thuần (đệm đầu
 * tuần, tháng nhuận, nhảy năm) — chỗ dễ sai nhất mà lại dễ test nhất.
 * Tuần bắt đầu Thứ 2 theo lệ Việt Nam.
 */

/** Nhảy `buoc` tháng từ `thang` (dạng `YYYY-MM`). Số âm là lùi. */
export function thangKe(thang: string, buoc: number): string {
  const [y, m] = thang.split('-').map(Number)
  const idx = y * 12 + (m - 1) + buoc
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`
}

/** Tháng hiện tại dạng `YYYY-MM` — cho nút "Tháng này". */
export function thangHienTai(): string {
  return new Date().toISOString().slice(0, 7)
}

/** Các ô của lưới: `null` là ô đệm, số là ngày. Độ dài luôn chia hết cho 7. */
export function oCuaThang(thang: string): (number | null)[] {
  const [y, m] = thang.split('-').map(Number)
  const soNgay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const thu1 = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7 // 0 = Thứ 2

  const o: (number | null)[] = []
  for (let i = 0; i < thu1; i++) o.push(null)
  for (let d = 1; d <= soNgay; d++) o.push(d)
  while (o.length % 7 !== 0) o.push(null)
  return o
}

/** `2026-09` + ngày 5 -> `2026-09-05`, để nhét vào đường dẫn `?ngay=`. */
export function ngayDayDu(thang: string, ngay: number): string {
  return `${thang}-${String(ngay).padStart(2, '0')}`
}
