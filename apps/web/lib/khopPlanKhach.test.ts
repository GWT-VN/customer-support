import { describe, it, expect } from 'vitest'
import { docTenPlan } from './khopPlanKhach'

describe('docTenPlan', () => {
  it('đọc đủ tỉnh + bộ máy + ngày lắp từ tên thư mục', () => {
    expect(docTenPlan('Anh Ng_30A_Hà Tĩnh_Lắp 23/08/2025')).toEqual({
      tinh: 'Hà Tĩnh', boMay: 'WH30A', ngayLap: '2025-08-23',
    })
  })

  it('nhận dạng bộ máy viết đủ và viết tắt, có/không ECO', () => {
    expect(docTenPlan('Anh A_WH15A_Hà Nội').boMay).toBe('WH15A')
    expect(docTenPlan('Anh B - 15A ECO - Hà Nội').boMay).toBe('WH15A ECO')
    expect(docTenPlan('Chị C_WH30AECO_Đà Nẵng').boMay).toBe('WH30A ECO')
  })

  it('đọc tỉnh không dấu và có tiền tố TP/Tỉnh', () => {
    expect(docTenPlan('Anh D - ha tinh').tinh).toBe('Hà Tĩnh')
    expect(docTenPlan('Anh E_TP. Hồ Chí Minh').tinh).toBe('Hồ Chí Minh')
  })

  it('đọc ngày ở nhiều dạng, kể cả 1 chữ số và gạch ngang', () => {
    expect(docTenPlan('X_Lắp 5/1/2025').ngayLap).toBe('2025-01-05')
    expect(docTenPlan('X_23-08-2025').ngayLap).toBe('2025-08-23')
  })

  it('không có manh mối thì trả null, không đoán bừa', () => {
    expect(docTenPlan('Anh Cường')).toEqual({ tinh: null, boMay: null, ngayLap: null })
    expect(docTenPlan(null)).toEqual({ tinh: null, boMay: null, ngayLap: null })
  })

  it('bỏ qua ngày vô lý (32/13) thay vì sinh ngày sai', () => {
    expect(docTenPlan('X_Lắp 32/13/2025').ngayLap).toBeNull()
  })
})
