import { describe, it, expect } from 'vitest'
import {
  kiemTraGop, moTaGop, soSanhKhach, truongOLai, nguonKhach,
  type KhachGon, type KhachDayDu,
} from './gopKhach'

const k = (o: Partial<KhachGon> & { id: string }): KhachGon => ({
  full_name: 'Khách', primary_phone: null, address: null, so_may: 0, so_ticket: 0, so_plan: 0, ...o,
})

const kd = (o: Partial<KhachDayDu> & { id: string }): KhachDayDu => ({
  full_name: 'Khách', primary_phone: null, address: null, so_may: 0, so_ticket: 0, so_plan: 0,
  province: null, customer_code: null, ten_kenh: null, source: null, partner_ref: null,
  notes: null, so_lien_he: 0, created_at: null, ...o,
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

describe('nguonKhach — hồ sơ này từ đâu ra', () => {
  it('có máy đã lắp -> CS', () => {
    expect(nguonKhach(kd({ id: 'a', so_may: 2 }))).toContain('CS')
  })
  it('có mã KH -> Sales', () => {
    expect(nguonKhach(kd({ id: 'a', customer_code: 'KH00131' }))).toContain('Sales')
  })
  it('có lịch bảo trì -> Bảo trì; có ticket -> Ticket', () => {
    const n = nguonKhach(kd({ id: 'a', so_plan: 1, so_ticket: 3 }))
    expect(n).toContain('Bảo trì')
    expect(n).toContain('Ticket')
  })
  it('một hồ sơ có thể đến từ nhiều nguồn cùng lúc', () => {
    expect(nguonKhach(kd({ id: 'a', so_may: 1, customer_code: 'KH1', so_plan: 1 })))
      .toEqual(['CS', 'Sales', 'Bảo trì'])
  })
  it('hồ sơ rỗng nói rõ là chưa có dữ liệu, không trả mảng rỗng', () => {
    expect(nguonKhach(kd({ id: 'a' }))).toEqual(['Chưa có dữ liệu'])
  })
  // Cột `source` là chữ tự do người nhập gõ — không được dùng để suy nguồn.
  it('KHÔNG suy nguồn từ cột source', () => {
    expect(nguonKhach(kd({ id: 'a', source: 'Shopee' }))).toEqual(['Chưa có dữ liệu'])
  })
})

describe('soSanhKhach — bấm xong thì giá trị bên gộp đi đâu', () => {
  it('bản giữ trống, bản gộp có -> lấp chỗ trống', () => {
    const d = soSanhKhach(kd({ id: 'a' }), kd({ id: 'b', province: 'Hà Tĩnh' }))
    expect(d.find((x) => x.nhan === 'Tỉnh/TP')?.ketCuc).toBe('lap-cho-trong')
  })

  // Đây là ca CEO lo: cả hai đều có mã KH khác nhau.
  it('cả hai đều có mã KH khác nhau -> giá trị bên gộp Ở LẠI hồ sơ bị ẩn', () => {
    const d = soSanhKhach(
      kd({ id: 'a', customer_code: 'KH00131' }),
      kd({ id: 'b', customer_code: 'KA000007' }),
    )
    expect(d.find((x) => x.nhan === 'Mã KH (nối Sales)')?.ketCuc).toBe('o-lai-ho-so-an')
  })

  it('tên/SĐT/địa chỉ/ghi chú khác nhau -> được ghi vào ghi chú, không mất', () => {
    const d = soSanhKhach(
      kd({ id: 'a', full_name: 'Anh Ánh', address: 'Thôn 4' }),
      kd({ id: 'b', full_name: 'Anh Ánh (Bác Toản)', address: 'Số 12 Trần Phú' }),
    )
    expect(d.find((x) => x.nhan === 'Tên')?.ketCuc).toBe('ghi-vao-ghi-chu')
    expect(d.find((x) => x.nhan === 'Địa chỉ')?.ketCuc).toBe('ghi-vao-ghi-chu')
  })

  it('giống nhau thì không đánh dấu khác', () => {
    const d = soSanhKhach(kd({ id: 'a', province: 'Hà Nội' }), kd({ id: 'b', province: 'Hà Nội' }))
    expect(d.find((x) => x.nhan === 'Tỉnh/TP')?.khac).toBe(false)
  })

  it('bản gộp trống thì không có gì để bàn, kể cả khi bản giữ có', () => {
    const d = soSanhKhach(kd({ id: 'a', province: 'Hà Nội' }), kd({ id: 'b' }))
    expect(d.find((x) => x.nhan === 'Tỉnh/TP')?.ketCuc).toBe('giong-nhau')
  })

  it('khoảng trắng thừa không bị tính là khác nhau', () => {
    const d = soSanhKhach(kd({ id: 'a', province: 'Hà Nội' }), kd({ id: 'b', province: '  Hà Nội  ' }))
    expect(d.find((x) => x.nhan === 'Tỉnh/TP')?.khac).toBe(false)
  })
})

describe('truongOLai — danh sách phải chìa ra trước khi bấm gộp', () => {
  it('liệt kê đúng các trường không mang sang được', () => {
    const giu = kd({ id: 'a', customer_code: 'KH1', province: 'Hà Nội', source: 'Trực tiếp' })
    const gop = kd({ id: 'b', customer_code: 'KA2', province: 'Hà Tĩnh', source: 'Shopee' })
    expect(truongOLai(giu, gop)).toEqual(['Tỉnh/TP', 'Mã KH (nối Sales)', 'Nguồn'])
  })
  it('không có gì xung đột thì trả danh sách rỗng', () => {
    expect(truongOLai(kd({ id: 'a', province: 'Hà Nội' }), kd({ id: 'b' }))).toEqual([])
  })
  it('tên và địa chỉ KHÔNG nằm trong danh sách này — chúng được ghi vào ghi chú', () => {
    const r = truongOLai(
      kd({ id: 'a', full_name: 'A', address: 'X' }),
      kd({ id: 'b', full_name: 'B', address: 'Y' }),
    )
    expect(r).toEqual([])
  })
})
