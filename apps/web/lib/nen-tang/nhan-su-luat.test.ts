import { describe, expect, it } from 'vitest'
import {
  chuanBiVaiTroDeGhi, kiemTraLoiMoi, kiemTraXoaNhanSu, locThamChieuChan,
  moTaThamChieu, sinhMatKhauBanDau,
} from './nhan-su-luat'

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

describe('locThamChieuChan — chỗ nào thật sự chặn xoá', () => {
  it('bỏ qua log lệch quyền, thông báo và kênh thông báo', () => {
    expect(locThamChieuChan([
      { bang: 'nhat_ky_lech_quyen', cot: 'staff_id', so_dong: 12 },
      { bang: 'work.notification', cot: 'staff_id', so_dong: 3 },
      { bang: 'work.staff_channel', cot: 'staff_id', so_dong: 1 },
    ])).toEqual([])
  })

  it('gộp nhiều cột của CÙNG một bảng thành một dòng', () => {
    expect(locThamChieuChan([
      { bang: 'tickets', cot: 'cs_phu_trach', so_dong: 2 },
      { bang: 'tickets', cot: 'ky_thuat', so_dong: 1 },
    ])).toEqual([{ bang: 'tickets', so_dong: 3 }])
  })

  it('bỏ dòng đếm ra 0', () => {
    expect(locThamChieuChan([{ bang: 'work.task', cot: 'creator_id', so_dong: 0 }])).toEqual([])
  })
})

describe('moTaThamChieu — câu cho người đọc', () => {
  it('dịch tên bảng sang tiếng Việt', () => {
    expect(moTaThamChieu([{ bang: 'tickets', so_dong: 3 }, { bang: 'work.task', so_dong: 1 }]))
      .toBe('3 ticket, 1 việc đã tạo')
  })

  it('bảng lạ thì giữ nguyên tên, không vỡ', () => {
    expect(moTaThamChieu([{ bang: 'bang_moi_nao_do', so_dong: 2 }])).toBe('2 bang_moi_nao_do')
  })
})

describe('kiemTraXoaNhanSu — chỉ cho xoá ca "mời nhầm, chưa làm gì"', () => {
  const co = { idNguoiXoa: 'toi', idBiXoa: 'ho', vaiTroBiXoa: [] as never[], thamChieu: [] }

  it('sạch tham chiếu thì cho xoá', () => {
    expect(kiemTraXoaNhanSu(co)).toEqual({ ok: true })
  })

  it('không tự xoá chính mình', () => {
    expect(kiemTraXoaNhanSu({ ...co, idBiXoa: 'toi' }))
      .toEqual({ ok: false, lyDo: 'Không tự xoá tài khoản của chính mình.' })
  })

  it('không xoá người còn giữ quyền quản trị toàn quyền', () => {
    const r = kiemTraXoaNhanSu({ ...co, vaiTroBiXoa: ['admin'] })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.lyDo).toContain('Quản trị toàn quyền')
  })

  it('còn dữ liệu nghiệp vụ thì từ chối và NÓI RÕ còn gì', () => {
    const r = kiemTraXoaNhanSu({
      ...co,
      thamChieu: [{ bang: 'tickets', cot: 'cs_phu_trach', so_dong: 3 }],
    })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.lyDo).toContain('3 ticket')
    expect(r.ok === false && r.lyDo).toContain('KHOÁ')
  })

  it('chỉ có log/thông báo thì VẪN cho xoá — đó là ca mở app một lần rồi thôi', () => {
    expect(kiemTraXoaNhanSu({
      ...co,
      thamChieu: [
        { bang: 'nhat_ky_lech_quyen', cot: 'staff_id', so_dong: 5 },
        { bang: 'work.notification', cot: 'staff_id', so_dong: 2 },
      ],
    })).toEqual({ ok: true })
  })

  it('luật tự xoá mình THẮNG cả luật tham chiếu — báo đúng lý do gần nhất', () => {
    const r = kiemTraXoaNhanSu({
      ...co,
      idBiXoa: 'toi',
      thamChieu: [{ bang: 'tickets', cot: 'cs_phu_trach', so_dong: 9 }],
    })
    expect(r).toEqual({ ok: false, lyDo: 'Không tự xoá tài khoản của chính mình.' })
  })
})

describe('sinhMatKhauBanDau — mật khẩu đọc qua điện thoại được', () => {
  it('đúng khuôn Gwt-xxxx-xxxx-xxxx', () => {
    expect(sinhMatKhauBanDau()).toMatch(/^Gwt-[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/)
  })

  it('không chứa ký tự dễ đọc nhầm 0 o 1 l i', () => {
    const mau = Array.from({ length: 200 }, () => sinhMatKhauBanDau()).join('')
    expect(mau.slice(3)).not.toMatch(/[01oli]/)
  })

  it('mỗi lần một khác', () => {
    const bo = new Set(Array.from({ length: 50 }, () => sinhMatKhauBanDau()))
    expect(bo.size).toBe(50)
  })
})
