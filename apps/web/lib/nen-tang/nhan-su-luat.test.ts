import { describe, expect, it } from 'vitest'
import { chuanBiVaiTroDeGhi, kiemTraLoiMoi } from './nhan-su-luat'

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

describe('kiemTraLoiMoi — admin mời người ngoài domain', () => {
  it('email hợp lệ + vai trò hợp lệ thì qua, email được hạ chữ thường', () => {
    expect(kiemTraLoiMoi('  CTV.Nam@Gmail.com ', ['ctv_lap_dat']))
      .toEqual({ ok: true, email: 'ctv.nam@gmail.com', vaiTro: ['ctv_lap_dat'] })
  })

  it('email rỗng hoặc sai định dạng thì chặn', () => {
    expect(kiemTraLoiMoi('', ['ctv_lap_dat'])).toEqual({ ok: false, lyDo: 'Email không hợp lệ.' })
    expect(kiemTraLoiMoi('khong-phai-email', ['ctv_lap_dat'])).toEqual({ ok: false, lyDo: 'Email không hợp lệ.' })
    expect(kiemTraLoiMoi('a@b', ['ctv_lap_dat'])).toEqual({ ok: false, lyDo: 'Email không hợp lệ.' })
  })

  it('bắt buộc chọn ít nhất một vai trò — mời vào mà không vai trò là tài khoản trống', () => {
    expect(kiemTraLoiMoi('ctv@gmail.com', [])).toEqual({ ok: false, lyDo: 'Phải chọn ít nhất một vai trò.' })
  })

  it('vai trò lạ bị chặn', () => {
    expect(kiemTraLoiMoi('ctv@gmail.com', ['superuser'])).toEqual({ ok: false, lyDo: 'Vai trò không hợp lệ.' })
  })

  it('áp luật loại trừ cấp bậc ngay lúc mời', () => {
    expect(kiemTraLoiMoi('x@gmail.com', ['ky_thuat', 'ctv_lap_dat']))
      .toEqual({ ok: true, email: 'x@gmail.com', vaiTro: ['ky_thuat'] })
  })

  it('KHÔNG cho mời thẳng vào quyền quản trị — phải gán riêng sau', () => {
    expect(kiemTraLoiMoi('x@gmail.com', ['admin']))
      .toEqual({ ok: false, lyDo: 'Không mời thẳng vào quyền quản trị. Mời trước, gán quyền sau.' })
  })
})
