import { describe, it, expect } from 'vitest'
import { vungTheoTinh, sinhLichBaoTri } from './lichBaoTri'

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

  it('cách nhau đúng số tháng (mốc chưa dời)', () => {
    const ds = sinhLichBaoTri('2026-03-16', 3, 3, 'bac') // 16/3 là Thứ 2
    // lượt kế ~ 16/6, ~16/9 (có thể lệch 1-2 ngày do dời cuối tuần)
    expect(ds[0].startsWith('2026-03')).toBe(true)
    expect(ds[1].startsWith('2026-06')).toBe(true)
    expect(ds[2].startsWith('2026-09')).toBe(true)
  })
})
