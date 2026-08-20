import { describe, it, expect } from 'vitest'
import {
  kiemTraGop, moTaGop, dangCo,
  type KhachGon, type KhachDayDu,
} from './gopKhach'

const k = (o: Partial<KhachGon> & { id: string }): KhachGon => ({
  full_name: 'Khách', primary_phone: null, address: null, so_may: 0, so_ticket: 0, so_plan: 0, ...o,
})

const kd = (o: Partial<KhachDayDu> & { id: string }): KhachDayDu => ({
  full_name: 'Khách', primary_phone: null, address: null, so_may: 0, so_ticket: 0, so_plan: 0,
  province: null, customer_code: null, channel_id: null, ten_kenh: null, source: null,
  partner_ref: null, notes: null, ten_cty: null, mst: null, dia_chi_cty: null,
  sdt_cty: null, email_cty: null, address_truoc_sap_nhap: null,
  province_truoc_sap_nhap: null, sdt_phu: [], dia_chi_phu: [],
  so_lien_he: 0, created_at: null, ...o,
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

describe('dangCo — hồ sơ này đang gánh những gì', () => {
  it('có máy đã lắp -> Máy (CS)', () => {
    expect(dangCo(kd({ id: 'a', so_may: 2 }))).toContain('Máy (CS)')
  })
  it('có mã KH -> Đơn Sales', () => {
    expect(dangCo(kd({ id: 'a', customer_code: 'KH00131' }))).toContain('Đơn Sales')
  })
  it('có lịch bảo trì -> Bảo trì; có ticket -> Ticket', () => {
    const n = dangCo(kd({ id: 'a', so_plan: 1, so_ticket: 3 }))
    expect(n).toContain('Lịch bảo trì')
    expect(n).toContain('Ticket')
  })
  it('một hồ sơ có thể đến từ nhiều nguồn cùng lúc', () => {
    expect(dangCo(kd({ id: 'a', so_may: 1, customer_code: 'KH1', so_plan: 1 })))
      .toEqual(['Máy (CS)', 'Đơn Sales', 'Lịch bảo trì'])
  })
  it('hồ sơ rỗng nói rõ là chưa có dữ liệu, không trả mảng rỗng', () => {
    expect(dangCo(kd({ id: 'a' }))).toEqual(['Chưa có dữ liệu'])
  })
  // Cột `source` là chữ tự do người nhập gõ — không được dùng để suy nguồn.
  it('KHÔNG suy nguồn từ cột source', () => {
    expect(dangCo(kd({ id: 'a', source: 'Shopee' }))).toEqual(['Chưa có dữ liệu'])
  })
})
