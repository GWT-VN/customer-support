/**
 * Dời lịch DÂY CHUYỀN khi bảo trì làm trễ.
 *
 * `ghiKetQuaBaoTri()` (app/actions.ts) tính ngày mới cho các lượt CHƯA làm bằng đúng
 * biểu thức dưới đây:
 *     sinhLichBaoTri(ngayThuc, chuKy, soLuotConLai + 1, vung).slice(1)
 * `+1` rồi `.slice(1)` vì phần tử đầu là chính ngày thực (lượt vừa làm), không phải mốc sau.
 *
 * File này ghim phép tính đó lại. Không chạm DB — phần ghi xuống bảng vẫn phải xem tận nơi.
 */
import { describe, expect, it } from 'vitest'
import { sinhLichBaoTri } from './lichBaoTri'

/** Đúng biểu thức `ghiKetQuaBaoTri()` dùng, tách ra để test được. */
function mocSauKhiLamTre(ngayThuc: string, chuKy: number, soLuotConLai: number, vung: 'bac' | 'nam') {
  return sinhLichBaoTri(ngayThuc, chuKy, soLuotConLai + 1, vung).slice(1)
}

describe('dời lịch dây chuyền khi làm trễ', () => {
  it('ca CEO nêu: hẹn 01/08 nhưng làm 10/08 -> lượt sau tính từ 10/08, không phải 01/08', () => {
    const moc = mocSauKhiLamTre('2026-08-10', 3, 3, 'bac')
    expect(moc).toHaveLength(3)
    // 10/08 + 3 tháng = 10/11/2026 (thứ Ba, không phải ngày nghỉ) -> giữ nguyên.
    expect(moc[0]).toBe('2026-11-10')
    // Mốc kế tiếp cách nhau đúng chu kỳ, KHÔNG quay lại bám ngày hẹn cũ (01/…).
    for (const m of moc) expect(m.slice(8, 10)).not.toBe('01')
  })

  it('sinh đúng SỐ mốc bằng số lượt còn lại — không thừa, không thiếu', () => {
    expect(mocSauKhiLamTre('2026-08-10', 3, 1, 'bac')).toHaveLength(1)
    expect(mocSauKhiLamTre('2026-08-10', 3, 5, 'bac')).toHaveLength(5)
    expect(mocSauKhiLamTre('2026-08-10', 3, 0, 'bac')).toHaveLength(0)
  })

  it('mốc đầu tiên luôn SAU ngày thực làm, không rơi vào quá khứ', () => {
    for (const ngay of ['2026-08-10', '2026-01-31', '2026-11-30', '2026-02-28']) {
      const moc = mocSauKhiLamTre(ngay, 3, 3, 'bac')
      expect(moc[0] > ngay).toBe(true)
    }
  })

  it('làm trễ vào ngày nghỉ vẫn ra mốc là ngày làm việc', () => {
    // 2026-08-15 là thứ Bảy. Miền Bắc nghỉ Chủ nhật; mốc sinh ra không được rơi vào ngày nghỉ.
    const moc = mocSauKhiLamTre('2026-08-15', 3, 3, 'bac')
    for (const m of moc) {
      const thu = new Date(m + 'T00:00:00Z').getUTCDay()
      expect(thu).not.toBe(0) // Chủ nhật
    }
  })
})
