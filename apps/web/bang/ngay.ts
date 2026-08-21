/**
 * Khoảng ngày cho preset lọc. Hàm THUẦN — không React, không DB, test được.
 *
 * ⚠️ KHÔNG dùng `toISOString()`: nó trả giờ UTC, nên từ 00:00–07:00 giờ VN sẽ ra
 * NGÀY HÔM TRƯỚC. Preset "Hôm nay" khi đó sai âm thầm, không ai phát hiện.
 * `ngay.test.ts` có một test chứng minh đúng cái bẫy này.
 */
export type MaPreset = 'homnay' | 'tuannay' | 'thangnay' | 'ngay30'

export const PRESETS: { ma: MaPreset; nhan: string }[] = [
  { ma: 'homnay', nhan: 'Hôm nay' },
  { ma: 'tuannay', nhan: 'Tuần này' },
  { ma: 'thangnay', nhan: 'Tháng này' },
  { ma: 'ngay30', nhan: '30 ngày' },
]

/** Date -> 'YYYY-MM-DD' theo giờ MÁY. */
export function isoNgay(d: Date): string {
  const th = String(d.getMonth() + 1).padStart(2, '0')
  const ng = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${th}-${ng}`
}

/**
 * Khoảng [tu, den] của một preset. Tuần bắt đầu THỨ 2.
 *
 * Dùng `new Date(y, m, d - n)` — Date tự dồn tháng/năm — chứ KHÔNG trừ mili-giây
 * (`- n * 864e5`): trừ mili-giây sai vào ngày đổi giờ. VN không đổi giờ, nhưng gói
 * `bang/` được thiết kế để chép nguyên sang project khác.
 */
export function khoangPreset(ma: MaPreset, homNay: Date): { tu: string; den: string } {
  const den = isoNgay(homNay)
  const y = homNay.getFullYear()
  const m = homNay.getMonth()
  const d = homNay.getDate()
  switch (ma) {
    case 'homnay':
      return { tu: den, den }
    case 'tuannay': {
      const lui = (homNay.getDay() + 6) % 7 // Thứ 2 = 0, Chủ nhật = 6
      return { tu: isoNgay(new Date(y, m, d - lui)), den }
    }
    case 'thangnay':
      return { tu: isoNgay(new Date(y, m, 1)), den }
    case 'ngay30':
      return { tu: isoNgay(new Date(y, m, d - 30)), den }
  }
}
