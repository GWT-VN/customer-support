import { describe, expect, it } from 'vitest'
import { cuoi9So, nhanKetQuaTra, type KetQuaTraKhach } from './tra-khach'

describe('cuoi9So — khoá so khớp dùng chung hai khu', () => {
  it('mọi cách viết cùng một số đều ra CÙNG 9 số cuối', () => {
    const mong = '912345678'
    for (const s of [
      '0912345678',       // pii-ok — số bịa, dãy liên tiếp
      '912345678',        // pii-ok
      '+84912345678',     // pii-ok
      '84912345678',      // pii-ok
      '091 234 5678',     // pii-ok
      '091-234-5678',     // pii-ok
      '(091) 234.5678',   // pii-ok
    ]) expect(cuoi9So(s)).toBe(mong)
  })

  it('số 11 chữ số (đầu số cũ) vẫn lấy đúng 9 đuôi', () => {
    expect(cuoi9So('01234567890')).toBe('234567890')   // pii-ok
  })

  it('chuỗi ngắn/rỗng trả về nguyên phần số — hàm tra tự chặn khi < 9', () => {
    expect(cuoi9So('0912')).toBe('0912')
    expect(cuoi9So('')).toBe('')
    expect(cuoi9So(null)).toBe('')
    expect(cuoi9So(undefined)).toBe('')
    expect(cuoi9So('gọi lễ tân')).toBe('')
  })
})

describe('nhanKetQuaTra — hai khu phải nói CÙNG một câu', () => {
  const nen: KetQuaTraKhach = { khop: [], cs: null, sales: null, quaSdtPhu: false, nhieuHoSo: false }

  it('không khớp -> null (khách mới thật)', () => {
    expect(nhanKetQuaTra(nen)).toBeNull()
  })

  it('chỉ khớp CS -> vẫn là khách CŨ (đúng ca CEO nêu: chưa có bên Sales)', () => {
    const s = nhanKetQuaTra({ ...nen, khop: ['cs'] })
    expect(s).toContain('CSKH')
    expect(s).toContain('CŨ')
  })

  it('chỉ khớp Sales -> khách cũ', () => {
    expect(nhanKetQuaTra({ ...nen, khop: ['sales'] })).toContain('Sales')
  })

  it('khớp cả hai -> nói rõ đừng tạo mới', () => {
    expect(nhanKetQuaTra({ ...nen, khop: ['cs', 'sales'] })).toContain('đừng tạo mới')
  })

  it('NHIỀU hồ sơ cùng SĐT thì phải cảnh báo, KHÔNG được lặng lẽ chọn hộ', () => {
    // Đo prod 22/08: 5 người bị tạo trùng hồ sơ bên Sales do Google Sheet ăn mất số 0 đầu SĐT;
    // hồ sơ "mất số 0" có 0 lịch sử mua. Chọn nhầm nó là nhân viên thấy khách cũ mà hồ sơ trắng.
    const s = nhanKetQuaTra({ ...nen, khop: ['sales'], nhieuHoSo: true })
    expect(s).toContain('NHIỀU hồ sơ')
    expect(s).toContain('gộp')
    // Ca thường thì không được doạ người dùng bằng cảnh báo thừa.
    expect(nhanKetQuaTra({ ...nen, khop: ['sales'] })).not.toContain('NHIỀU hồ sơ')
  })

  it('khớp qua SĐT phụ thì PHẢI nói ra, không được im', () => {
    // Im chỗ này là người nhập thấy tên khách lạ hoắc mà không hiểu vì sao lại khớp.
    expect(nhanKetQuaTra({ ...nen, khop: ['cs'], quaSdtPhu: true })).toContain('SĐT phụ')
    expect(nhanKetQuaTra({ ...nen, khop: ['cs'], quaSdtPhu: false })).not.toContain('SĐT phụ')
  })
})
