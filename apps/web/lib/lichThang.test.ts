import { describe, it, expect } from 'vitest'
import { thangKe, oCuaThang } from './lichThang'

describe('thangKe', () => {
  it('lùi một tháng', () => {
    expect(thangKe('2026-09', -1)).toBe('2026-08')
  })
  it('tiến một tháng', () => {
    expect(thangKe('2026-09', 1)).toBe('2026-10')
  })
  it('lùi qua đầu năm', () => {
    expect(thangKe('2026-01', -1)).toBe('2025-12')
  })
  it('tiến qua cuối năm', () => {
    expect(thangKe('2026-12', 1)).toBe('2027-01')
  })
  it('tháng luôn có 2 chữ số', () => {
    expect(thangKe('2026-10', -1)).toBe('2026-09')
  })
})

describe('oCuaThang', () => {
  it('số ô luôn chia hết cho 7', () => {
    expect(oCuaThang('2026-09').length % 7).toBe(0)
    expect(oCuaThang('2026-02').length % 7).toBe(0)
  })
  it('có đủ số ngày của tháng', () => {
    expect(oCuaThang('2026-09').filter((o) => o !== null)).toHaveLength(30)
    expect(oCuaThang('2026-02').filter((o) => o !== null)).toHaveLength(28)
  })
  it('tuần bắt đầu Thứ 2 — 01/09/2026 là Thứ 3 nên có đúng 1 ô đệm trước', () => {
    const o = oCuaThang('2026-09')
    expect(o[0]).toBeNull()
    expect(o[1]).toBe(1)
  })
  it('tháng bắt đầu đúng Thứ 2 thì không đệm — 01/06/2026 là Thứ 2', () => {
    expect(oCuaThang('2026-06')[0]).toBe(1)
  })
  it('năm nhuận: tháng 2/2028 có 29 ngày', () => {
    expect(oCuaThang('2028-02').filter((o) => o !== null)).toHaveLength(29)
  })
})
