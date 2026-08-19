import { describe, it, expect } from 'vitest'
import { kiemTraGop, moTaGop, type KhachGon } from './gopKhach'

const k = (o: Partial<KhachGon> & { id: string }): KhachGon => ({
  full_name: 'Khách', primary_phone: null, address: null, so_may: 0, so_ticket: 0, so_plan: 0, ...o,
})

describe('kiemTraGop', () => {
  it('chặn gộp khách với chính nó', () => {
    const a = k({ id: 'x' })
    expect(kiemTraGop(a, a)).toEqual({ ok: false, lyDo: 'Không thể gộp một khách với chính nó.' })
  })

  it('cho gộp 2 khách khác nhau', () => {
    expect(kiemTraGop(k({ id: 'a' }), k({ id: 'b' }))).toEqual({ ok: true })
  })

  it('cảnh báo khi bản bị gộp mới là bản có nhiều dữ liệu hơn', () => {
    const giu = k({ id: 'a', so_may: 0 })
    const gop = k({ id: 'b', so_may: 3 })
    const r = kiemTraGop(giu, gop)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.lyDo).toContain('nhiều dữ liệu hơn')
  })

  it('cho gộp khi bản bị gộp có dữ liệu bằng bản giữ lại', () => {
    const giu = k({ id: 'a', so_may: 2, so_ticket: 1 })
    const gop = k({ id: 'b', so_may: 2, so_ticket: 1 })
    expect(kiemTraGop(giu, gop)).toEqual({ ok: true })
  })
})

describe('moTaGop', () => {
  it('nêu rõ cái gì chuyển đi và cái gì được lấp thêm', () => {
    const giu = k({ id: 'a', full_name: 'Anh Long', primary_phone: '0900000001', so_may: 2 })
    const gop = k({ id: 'b', full_name: 'Anh Long/ Anh Lâm', address: 'Số 12 Đường Lê Lợi' })
    const s = moTaGop(giu, gop)
    expect(s).toContain('Anh Long/ Anh Lâm')
    expect(s).toContain('Anh Long')
    expect(s).toContain('địa chỉ')
  })
})
