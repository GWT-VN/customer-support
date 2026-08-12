import { describe, it, expect } from 'vitest'
import { tachTu, goiYGomTu } from './goiYNhom'

describe('tachTu', () => {
  it('thường hoá + tách theo ký tự không phải chữ/số, bỏ từ 1 ký tự', () => {
    expect(tachTu('Máy bị RÒ RỈ nước!!')).toEqual(['máy', 'bị', 'rò', 'rỉ', 'nước'])
    expect(tachTu('Lỗi E4, không nhận bình 2L')).toEqual(['lỗi', 'e4', 'không', 'nhận', 'bình', '2l'])
  })
})

describe('goiYGomTu', () => {
  it('gợi ý cụm lặp ở ≥3 ticket, ưu tiên cụm 2 từ', () => {
    const ds = [
      { ticket_code: 'A', description: 'Máy bị rò rỉ nước ở đáy' },
      { ticket_code: 'B', description: 'khách báo rò rỉ nước' },
      { ticket_code: 'C', description: 'phát hiện rò rỉ chỗ van' },
      { ticket_code: 'D', description: 'wifi không kết nối được' },
    ]
    const cum = goiYGomTu(ds, 3)
    const rori = cum.find((c) => c.tu === 'rò rỉ')
    expect(rori).toBeDefined()
    expect(rori!.so).toBe(3)
    expect(rori!.tickets).toEqual(['A', 'B', 'C'])
    // wifi chỉ 1 ticket -> dưới ngưỡng, không gợi ý
    expect(cum.find((c) => c.tu.includes('wifi'))).toBeUndefined()
  })

  it('đếm theo TICKET, một ticket lặp từ nhiều lần chỉ tính 1', () => {
    const ds = [
      { ticket_code: 'A', description: 'màn hình màn hình màn hình đơ' },
      { ticket_code: 'B', description: 'màn hình sọc' },
    ]
    const cum = goiYGomTu(ds, 2)
    const mh = cum.find((c) => c.tu === 'màn hình')
    expect(mh).toBeDefined()
    expect(mh!.so).toBe(2)
  })

  it('bỏ từ đơn khi đã có cụm cụ thể phủ phần lớn ticket của nó', () => {
    const ds = [
      { ticket_code: 'A', description: 'rò rỉ đáy máy' },
      { ticket_code: 'B', description: 'rò rỉ cổng' },
      { ticket_code: 'C', description: 'rò rỉ van' },
    ]
    const cum = goiYGomTu(ds, 3)
    // cụm "rò rỉ" giữ lại; từ đơn "rò"/"rỉ" bị loại vì trùng ≥70%
    expect(cum.map((c) => c.tu)).toContain('rò rỉ')
    expect(cum.map((c) => c.tu)).not.toContain('rò')
    expect(cum.map((c) => c.tu)).not.toContain('rỉ')
  })

  it('bỏ qua ticket không có mô tả, không lỗi', () => {
    const ds = [
      { ticket_code: 'A', description: null },
      { ticket_code: 'B', description: 'mùi clo' },
    ]
    expect(goiYGomTu(ds, 3)).toEqual([])
  })
})
