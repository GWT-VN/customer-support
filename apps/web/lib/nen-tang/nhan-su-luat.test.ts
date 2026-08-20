import { describe, expect, it } from 'vitest'
import { chuanBiVaiTroDeGhi } from './nhan-su-luat'

describe('chuanBiVaiTroDeGhi — chuẩn hoá TẬP vai trò trước khi ghi DB', () => {
  it('undefined nghĩa là KHÔNG đổi vai trò', () => {
    expect(chuanBiVaiTroDeGhi(undefined)).toEqual({ ok: true, vaiTro: undefined })
  })

  it('chặn vai trò lạ, không ghi gì cả', () => {
    expect(chuanBiVaiTroDeGhi(['cs', 'superuser'])).toEqual({ ok: false, lyDo: 'Vai trò không hợp lệ.' })
  })

  it('áp loại trừ cấp bậc: tick cả cs lẫn cs_manager thì chỉ ghi cs_manager', () => {
    expect(chuanBiVaiTroDeGhi(['cs', 'cs_manager'])).toEqual({ ok: true, vaiTro: ['cs_manager'] })
  })

  it('KHÔNG đụng kiêm nhiệm khác bộ phận', () => {
    expect(chuanBiVaiTroDeGhi(['cs', 'sales'])).toEqual({ ok: true, vaiTro: ['cs', 'sales'] })
    expect(chuanBiVaiTroDeGhi(['cs_manager', 'sales_manager']))
      .toEqual({ ok: true, vaiTro: ['cs_manager', 'sales_manager'] })
  })

  it('khử trùng lặp và sắp theo thứ tự khai báo', () => {
    expect(chuanBiVaiTroDeGhi(['sales', 'admin', 'sales'])).toEqual({ ok: true, vaiTro: ['admin', 'sales'] })
  })

  it('mảng rỗng là hợp lệ — gỡ hết vai trò của một người', () => {
    expect(chuanBiVaiTroDeGhi([])).toEqual({ ok: true, vaiTro: [] })
  })

  it('nhận 7 vai trò mới', () => {
    expect(chuanBiVaiTroDeGhi(['ceo', 'tai_chinh'])).toEqual({ ok: true, vaiTro: ['ceo', 'tai_chinh'] })
  })
})
