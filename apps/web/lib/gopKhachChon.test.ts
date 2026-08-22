import { describe, it, expect } from 'vitest'
import { macDinhLuaChon, dungPChon, truongKhongCoChoChua, TRUONG_GOP } from './gopKhachChon'
import type { KhachDayDu } from './gopKhach'

// SĐT trong test là số GIẢ dải 090000000x.
const kd = (o: Partial<KhachDayDu> & { id: string }): KhachDayDu => ({
  full_name: 'Khách', primary_phone: null, address: null, so_may: 0, so_ticket: 0, so_plan: 0,
  province: null, customer_code: null, channel_id: null, ten_kenh: null, source: null,
  partner_ref: null, notes: null, ten_cty: null, mst: null, dia_chi_cty: null,
  sdt_cty: null, email_cty: null, address_truoc_sap_nhap: null,
  province_truoc_sap_nhap: null, sdt_phu: [], dia_chi_phu: [],
  so_lien_he: 0, created_at: null, ...o,
})

describe('macDinhLuaChon — mặc định phải AN TOÀN, không mất gì', () => {
  it('bản giữ trống thì lấy giá trị bản gộp', () => {
    const lc = macDinhLuaChon(kd({ id: 'a' }), kd({ id: 'b', province: 'Hà Tĩnh' }))
    expect(lc.truong.province).toBe('gop')
  })

  it('cả hai đều có thì mặc định giữ bên GIỮ — không tự ý ghi đè', () => {
    const lc = macDinhLuaChon(
      kd({ id: 'a', customer_code: 'KH1' }),
      kd({ id: 'b', customer_code: 'KA2' }),
    )
    expect(lc.truong.customer_code).toBe('giu')
  })

  // Đây là điểm CEO nêu: hai SĐT của một người là số chính + số phụ, không phải xung đột.
  it('hai bên hai SĐT khác nhau -> mặc định GIỮ LẠI số kia thành số phụ', () => {
    const lc = macDinhLuaChon(
      kd({ id: 'a', primary_phone: '0900000011' }),
      kd({ id: 'b', primary_phone: '0900000022' }),
    )
    expect(lc.sdtPhuGiuLai).toBe(true)
  })

  it('chỉ một bên có SĐT thì không có số phụ nào để giữ', () => {
    const lc = macDinhLuaChon(kd({ id: 'a', primary_phone: '0900000011' }), kd({ id: 'b' }))
    expect(lc.sdtPhuGiuLai).toBe(false)
  })

  it('hai địa chỉ khác nhau -> mặc định giữ địa chỉ kia, chưa gán loại', () => {
    const lc = macDinhLuaChon(
      kd({ id: 'a', address: '12 Ô Chợ Dừa' }),
      kd({ id: 'b', address: '384 Hoàng Diệu' }),
    )
    expect(lc.diaChiThem).toBe('khac')
  })

  it('địa chỉ giống hệt nhau thì không đẻ địa chỉ phụ', () => {
    const lc = macDinhLuaChon(kd({ id: 'a', address: 'X' }), kd({ id: 'b', address: 'X' }))
    expect(lc.diaChiThem).toBe('bo')
  })
})

describe('dungPChon — payload gửi xuống RPC', () => {
  const giu = kd({ id: 'a', full_name: 'Chị Mai', primary_phone: '0900000011', address: '12 Ô Chợ Dừa', customer_code: 'KH1' })
  const gop = kd({ id: 'b', full_name: 'Cô Mai', primary_phone: '0900000022', address: '384 Hoàng Diệu', customer_code: 'KA2' })

  it('chọn bên gộp thì giá trị đó vào payload', () => {
    const lc = macDinhLuaChon(giu, gop)
    lc.truong.address = 'gop'
    expect(dungPChon(giu, gop, lc).truong.address).toBe('384 Hoàng Diệu')
  })

  it('chọn bên giữ thì KHÔNG nhét vào payload — để RPC chạy luật cũ', () => {
    const lc = macDinhLuaChon(giu, gop)
    lc.truong.address = 'giu'
    expect(dungPChon(giu, gop, lc).truong.address).toBeUndefined()
  })

  it('SĐT không được chọn làm số chính thì đi vào sdt_phu', () => {
    const lc = macDinhLuaChon(giu, gop)
    lc.truong.primary_phone = 'giu'
    const p = dungPChon(giu, gop, lc)
    expect(p.sdt_phu).toEqual([{ phone: '0900000022', contact_name: 'Cô Mai', role: 'other' }])
  })

  it('đảo lựa chọn SĐT thì số phụ cũng đảo theo', () => {
    const lc = macDinhLuaChon(giu, gop)
    lc.truong.primary_phone = 'gop'
    const p = dungPChon(giu, gop, lc)
    expect(p.truong.primary_phone).toBe('0900000022')
    expect(p.sdt_phu[0].phone).toBe('0900000011')
  })

  it('tắt giữ số phụ thì sdt_phu rỗng', () => {
    const lc = macDinhLuaChon(giu, gop)
    lc.sdtPhuGiuLai = false
    expect(dungPChon(giu, gop, lc).sdt_phu).toEqual([])
  })

  it('địa chỉ không được chọn đi vào dia_chi_them kèm loại', () => {
    const lc = macDinhLuaChon(giu, gop)
    lc.truong.address = 'gop'
    lc.diaChiThem = 'nha'
    const p = dungPChon(giu, gop, lc)
    expect(p.dia_chi_them).toEqual([{ dia_chi: '12 Ô Chợ Dừa', loai: 'nha' }])
  })

  it('chọn bỏ địa chỉ thì không thêm gì', () => {
    const lc = macDinhLuaChon(giu, gop)
    lc.diaChiThem = 'bo'
    expect(dungPChon(giu, gop, lc).dia_chi_them).toEqual([])
  })

  it('channel_id ra SỐ chứ không phải chuỗi — cột là int', () => {
    const lc = macDinhLuaChon(kd({ id: 'a' }), kd({ id: 'b', channel_id: 7 }))
    lc.truong.channel_id = 'gop'
    expect(dungPChon(kd({ id: 'a' }), kd({ id: 'b', channel_id: 7 }), lc).truong.channel_id).toBe(7)
  })

  it('mọi trường trong TRUONG_GOP đều có mặt trong lựa chọn mặc định', () => {
    const lc = macDinhLuaChon(giu, gop)
    for (const t of TRUONG_GOP) expect(lc.truong[t.khoa]).toBeDefined()
  })
})

describe('truongKhongCoChoChua — cảnh báo phải chìa ra trước khi bấm', () => {
  it('mã KH / tỉnh / nguồn đều có ở hai bên và khác nhau -> vào danh sách mất', () => {
    const giu = kd({ id: 'a', customer_code: 'KH1', province: 'Hà Nội', source: 'Trực tiếp' })
    const gop = kd({ id: 'b', customer_code: 'KA2', province: 'Hà Tĩnh', source: 'Shopee' })
    expect(truongKhongCoChoChua(giu, gop)).toEqual(['Tỉnh/TP', 'Mã KH (nối Sales)', 'Nguồn'])
  })

  // Bốn trường này đã có nhà nên KHÔNG được báo là mất, kẻo CS hoảng vô cớ.
  it('SĐT và địa chỉ KHÔNG bị tính là mất — chúng xuống số phụ / địa chỉ phụ', () => {
    const giu = kd({ id: 'a', primary_phone: '0900000011', address: 'X' })
    const gop = kd({ id: 'b', primary_phone: '0900000022', address: 'Y' })
    expect(truongKhongCoChoChua(giu, gop)).toEqual([])
  })

  it('tên và ghi chú KHÔNG bị tính là mất — RPC ghi nguyên văn vào ghi chú', () => {
    const giu = kd({ id: 'a', full_name: 'A', notes: 'ghi chú A' })
    const gop = kd({ id: 'b', full_name: 'B', notes: 'ghi chú B' })
    expect(truongKhongCoChoChua(giu, gop)).toEqual([])
  })

  it('một bên trống thì bên kia lấp vào, không mất gì', () => {
    expect(truongKhongCoChoChua(kd({ id: 'a' }), kd({ id: 'b', province: 'Hà Nội' }))).toEqual([])
  })
})
