import { describe, it, expect } from 'vitest'
import { vungTheoTinh, sinhLichBaoTri, macDinhTheoBoMay } from './lichBaoTri'

const weekday = (iso: string) => new Date(iso + 'T00:00:00Z').getUTCDay() // 0=CN, 6=T7

describe('vungTheoTinh', () => {
  it('nam: HCM + Nam Bộ', () => {
    expect(vungTheoTinh('TP Hồ Chí Minh')).toBe('nam')
    expect(vungTheoTinh('Bình Dương')).toBe('nam')
    expect(vungTheoTinh('Cần Thơ')).toBe('nam')
  })
  it('bac: Hà Nội, Đà Nẵng, trống', () => {
    expect(vungTheoTinh('Hà Nội')).toBe('bac')
    expect(vungTheoTinh('Đà Nẵng')).toBe('bac')
    expect(vungTheoTinh(null)).toBe('bac')
    expect(vungTheoTinh('Nghệ An')).toBe('bac')
  })
})

describe('macDinhTheoBoMay', () => {
  it('WH15A/WH30A -> 4 lần × 3 tháng', () => {
    expect(macDinhTheoBoMay('WH15A')).toEqual({ soLan: 4, chuKy: 3 })
    expect(macDinhTheoBoMay('WH30A')).toEqual({ soLan: 4, chuKy: 3 })
  })
  it('ECO -> 2 lần × 3 tháng', () => {
    expect(macDinhTheoBoMay('WH15A ECO')).toEqual({ soLan: 2, chuKy: 3 })
    expect(macDinhTheoBoMay('WH30AECO')).toEqual({ soLan: 2, chuKy: 3 })
  })
  it('khác/không rõ -> null', () => {
    expect(macDinhTheoBoMay('CTS10')).toBeNull()
    expect(macDinhTheoBoMay(null)).toBeNull()
  })
})

describe('sinhLichBaoTri', () => {
  it('đúng số lượt', () => {
    expect(sinhLichBaoTri('2026-01-15', 3, 4, 'bac').length).toBe(4)
  })

  it('chu kỳ null = chỉ 1 lượt', () => {
    expect(sinhLichBaoTri('2026-01-15', null, 5, 'bac').length).toBe(1)
  })

  it('bac: không lượt nào rơi T7/CN', () => {
    for (const iso of sinhLichBaoTri('2026-02-10', 1, 12, 'bac')) {
      expect([1, 2, 3, 4, 5]).toContain(weekday(iso))
    }
  })

  it('nam: không lượt nào rơi CN (nhưng cho phép T7)', () => {
    const ds = sinhLichBaoTri('2026-02-10', 1, 12, 'nam')
    for (const iso of ds) expect(weekday(iso)).not.toBe(0)
  })

  it('dời tới ngày làm khi bắt đầu rơi ngày nghỉ', () => {
    const tuan = Array.from({ length: 7 }, (_, i) => `2026-02-0${i + 1}`)
    const cn = tuan.find((d) => weekday(d) === 0)!  // chắc chắn có 1 CN trong 7 ngày
    expect(weekday(sinhLichBaoTri(cn, null, 1, 'nam')[0])).not.toBe(0)
    const t7 = tuan.find((d) => weekday(d) === 6)!
    expect([1, 2, 3, 4, 5]).toContain(weekday(sinhLichBaoTri(t7, null, 1, 'bac')[0]))
  })

  it('mốc suy ra KHÔNG nhảy sang tháng khác (ca 30/11/2026, lỗi CEO báo)', () => {
    // 30/11 + 3 tháng -> 30/02 -> kẹp 28/02/2027 (Chủ nhật). Trước đây dời TỚI
    // thành 01/03 nên bảng đọc ra T11 · T3 · T5 · T8, trông như lệch chu kỳ.
    const ds = sinhLichBaoTri('2026-11-30', 3, 4, 'bac')
    expect(ds).toEqual(['2026-11-30', '2027-02-26', '2027-05-31', '2027-08-30'])
    for (const iso of ds) expect([1, 2, 3, 4, 5]).toContain(weekday(iso))
  })

  it('mốc suy ra luôn đúng tháng kỳ vọng (12 lượt × 1 tháng)', () => {
    const ds = sinhLichBaoTri('2026-01-30', 1, 12, 'bac')   // 30/01/2026 là Thứ 6
    ds.forEach((iso, i) => {
      const thangKyVong = (0 + i) % 12                       // T1 + i
      expect(new Date(iso + 'T00:00:00Z').getUTCMonth()).toBe(thangKyVong)
    })
  })

  it('ngày BẮT ĐẦU vẫn chỉ dời TỚI (không lùi về quá khứ)', () => {
    // 31/01/2026 là Thứ 7: giữ-tháng sẽ muốn lùi, nhưng lượt đầu là ngày người
    // nhập chọn nên phải dời TỚI (02/02) chứ không được lùi về 30/01.
    expect(weekday('2026-01-31')).toBe(6)
    expect(sinhLichBaoTri('2026-01-31', null, 1, 'bac')[0]).toBe('2026-02-02')
  })

  it('cách nhau đúng số tháng (mốc chưa dời)', () => {
    const ds = sinhLichBaoTri('2026-03-16', 3, 3, 'bac') // 16/3 là Thứ 2
    // lượt kế ~ 16/6, ~16/9 (có thể lệch 1-2 ngày do dời cuối tuần)
    expect(ds[0].startsWith('2026-03')).toBe(true)
    expect(ds[1].startsWith('2026-06')).toBe(true)
    expect(ds[2].startsWith('2026-09')).toBe(true)
  })
})
