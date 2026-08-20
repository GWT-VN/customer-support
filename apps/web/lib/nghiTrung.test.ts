import { describe, it, expect } from 'vitest'
import { chuanHoaTen, capNghiTrung, type KhachTenGon } from './nghiTrung'

const k = (id: string, ten: string, o: Partial<KhachTenGon> = {}): KhachTenGon => ({
  id, full_name: ten, primary_phone: null, province: null,
  so_may: 0, so_ticket: 0, so_plan: 0, customer_code: null, ...o,
})

describe('chuanHoaTen', () => {
  it('gom khoảng trắng thừa, bỏ hoa/thường', () => {
    expect(chuanHoaTen('  Anh   ÁNH  ')).toBe('anh ánh')
  })
  it('bỏ dấu câu để "Anh Ánh/ Anh Ng" và "Anh Ánh - Anh Ng" về cùng dạng', () => {
    expect(chuanHoaTen('Anh Ánh/ Anh Ng')).toBe(chuanHoaTen('Anh Ánh - Anh Ng'))
  })
})

describe('capNghiTrung — đề xuất cặp cần gộp', () => {
  it('hai hồ sơ trùng tên y hệt -> cặp chắc chắn', () => {
    const r = capNghiTrung([k('a', 'Anh Ánh'), k('b', 'Anh Ánh')])
    expect(r).toHaveLength(1)
    expect(r[0].do_chac).toBe('cao')
  })

  // Ca thật trên production: 'Anh Ánh' và 'Anh Ánh/ Anh Ng (Bác Toản)'.
  it('tên này là phần đầu của tên kia -> cặp nghi ngờ', () => {
    const r = capNghiTrung([k('a', 'Anh Ánh'), k('b', 'Anh Ánh/ Anh Ng (Bác Toản)')])
    expect(r).toHaveLength(1)
    expect(r[0].do_chac).toBe('vua')
  })

  it('tên quá ngắn KHÔNG được ghép theo phần đầu — "Anh A" khớp nửa danh bạ', () => {
    expect(capNghiTrung([k('a', 'Anh A'), k('b', 'Anh An Phạm')])).toHaveLength(0)
  })

  it('hai người khác hẳn thì không đề xuất', () => {
    expect(capNghiTrung([k('a', 'Nguyễn Văn A'), k('b', 'Trần Thị B')])).toHaveLength(0)
  })

  it('hai SĐT khác nhau vẫn đề xuất nếu tên trùng — SĐT khác là chuyện thường', () => {
    const r = capNghiTrung([
      k('a', 'Đoàn Văn Hậu', { primary_phone: '0900000011' }),
      k('b', 'Đoàn Văn Hậu', { primary_phone: '0900000022' }),
    ])
    expect(r).toHaveLength(1)
  })

  it('xếp hồ sơ NHIỀU dữ liệu hơn vào vế giữ lại', () => {
    const r = capNghiTrung([
      k('a', 'Anh Ánh', { so_may: 0 }),
      k('b', 'Anh Ánh', { so_may: 2, so_ticket: 1 }),
    ])
    expect(r[0].giu.id).toBe('b')
    expect(r[0].gop.id).toBe('a')
  })

  it('cặp chắc chắn xếp trước cặp nghi ngờ', () => {
    const r = capNghiTrung([
      k('a', 'Trần Hoài Ngân'), k('b', 'Trần Hoài Ngân Heritage'),
      k('c', 'Lê Thị Hà'), k('d', 'Lê Thị Hà'),
    ])
    expect(r[0].do_chac).toBe('cao')
  })

  it('một hồ sơ chỉ xuất hiện trong MỘT cặp — gộp xong cặp kia hết nghĩa', () => {
    const r = capNghiTrung([k('a', 'Anh Ánh'), k('b', 'Anh Ánh'), k('c', 'Anh Ánh')])
    expect(r).toHaveLength(1)
  })

  it('bên Sales bên CS thì nói rõ trong lý do', () => {
    const r = capNghiTrung([
      k('a', 'Chị Mai', { so_may: 2 }),
      k('b', 'Chị Mai', { customer_code: 'KH001' }),
    ])
    expect(r[0].ly_do.join(' ')).toContain('Sales')
  })
})
