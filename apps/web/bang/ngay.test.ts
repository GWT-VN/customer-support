import { describe, it, expect } from 'vitest'
import { isoNgay, khoangPreset } from './ngay'

// Thứ Tư 2026-08-19, 00:30 giờ máy — giờ sớm chính là chỗ toISOString() hay sai.
const thuTu = new Date(2026, 7, 19, 0, 30)

describe('isoNgay', () => {
  it('lấy ngày theo giờ máy, KHÔNG lệch sang hôm trước như toISOString', () => {
    expect(isoNgay(thuTu)).toBe('2026-08-19')
    // Chứng minh cái bẫy có thật: cùng thời điểm đó, UTC đã là ngày hôm trước.
    expect(thuTu.toISOString().slice(0, 10)).toBe('2026-08-18')
  })
  it('đệm 0 cho tháng/ngày một chữ số', () => {
    expect(isoNgay(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('khoangPreset', () => {
  it('hôm nay = đúng một ngày', () => {
    expect(khoangPreset('homnay', thuTu)).toEqual({ tu: '2026-08-19', den: '2026-08-19' })
  })
  it('tuần này bắt đầu THỨ 2', () => {
    expect(khoangPreset('tuannay', thuTu)).toEqual({ tu: '2026-08-17', den: '2026-08-19' })
  })
  it('chủ nhật vẫn thuộc tuần bắt đầu thứ 2 trước đó', () => {
    const chuNhat = new Date(2026, 7, 23, 12, 0)
    expect(khoangPreset('tuannay', chuNhat)).toEqual({ tu: '2026-08-17', den: '2026-08-23' })
  })
  it('thứ 2 thì tuần này bắt đầu từ chính nó', () => {
    const thuHai = new Date(2026, 7, 17, 9, 0)
    expect(khoangPreset('tuannay', thuHai)).toEqual({ tu: '2026-08-17', den: '2026-08-17' })
  })
  it('tháng này bắt đầu ngày 1', () => {
    expect(khoangPreset('thangnay', thuTu)).toEqual({ tu: '2026-08-01', den: '2026-08-19' })
  })
  it('30 ngày tính lùi, qua được mốc đầu tháng', () => {
    expect(khoangPreset('ngay30', thuTu)).toEqual({ tu: '2026-07-20', den: '2026-08-19' })
  })
  it('lùi qua mốc đầu NĂM vẫn đúng', () => {
    expect(khoangPreset('ngay30', new Date(2026, 0, 10, 8, 0))).toEqual({ tu: '2025-12-11', den: '2026-01-10' })
  })
})
