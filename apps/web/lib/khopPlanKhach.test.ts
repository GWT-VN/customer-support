import { describe, it, expect } from 'vitest'
import { docTenPlan, xepGoiY, sdtChuan, type KhachUngVien } from './khopPlanKhach'

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

const KHACH: KhachUngVien[] = [
  { id: 'k1', ten: 'Anh Ánh',  sdt: '0326463653', tinh: 'Hà Tĩnh', ngayLapSomNhat: '2025-08-28' }, // pii-ok: test data
  { id: 'k2', ten: 'Chị Bình', sdt: '0900000002', tinh: 'Hà Tĩnh', ngayLapSomNhat: '2024-01-05' }, // pii-ok: test data
  { id: 'k3', ten: 'Anh Cường', sdt: '0900000003', tinh: 'Hà Nội',  ngayLapSomNhat: '2025-08-25' }, // pii-ok: test data
]

describe('sdtChuan', () => {
  it('lấy 9 số cuối, bỏ ký tự thừa và mã vùng', () => {
    expect(sdtChuan('0326463653')).toBe('326463653') // pii-ok: test data
    expect(sdtChuan('+84 326 463 653')).toBe('326463653') // pii-ok: test data
    expect(sdtChuan('')).toBe('')
  })
})

describe('xepGoiY', () => {
  it('SĐT trùng thì đứng đầu và luôn được gợi ý', () => {
    const r = xepGoiY({ source_customer_name: 'Chị Bình_Hà Tĩnh', source_phone: '0326463653', bo_may: null }, KHACH) // pii-ok: test data
    expect(r[0].id).toBe('k1')
    expect(r[0].lyDo).toContain('trùng SĐT')
  })

  it('không có SĐT thì khớp theo tỉnh + ngày lắp gần nhau (ca Anh Ng)', () => {
    const r = xepGoiY({ source_customer_name: 'Anh Ng_30A_Hà Tĩnh_Lắp 23/08/2025', source_phone: null, bo_may: 'WH30A' }, KHACH)
    expect(r[0].id).toBe('k1')
    expect(r[0].lyDo).toEqual(expect.arrayContaining(['cùng tỉnh Hà Tĩnh', 'ngày lắp lệch 5 ngày']))
  })

  it('cùng tỉnh nhưng ngày lắp lệch quá xa thì KHÔNG tính là khớp ngày', () => {
    const r = xepGoiY({ source_customer_name: 'X_Hà Tĩnh_Lắp 23/08/2025', source_phone: null, bo_may: null }, KHACH)
    const k2 = r.find((x) => x.id === 'k2')
    expect(k2?.lyDo.some((l) => l.startsWith('ngày lắp'))).toBe(false)
  })

  it('không có manh mối nào thì trả mảng rỗng, không gợi ý bừa', () => {
    expect(xepGoiY({ source_customer_name: 'Anh Cường', source_phone: null, bo_may: null }, KHACH)).toEqual([])
  })

  it('giới hạn số gợi ý trả về', () => {
    const r = xepGoiY({ source_customer_name: 'X_Hà Tĩnh', source_phone: null, bo_may: null }, KHACH, 1)
    expect(r.length).toBe(1)
  })
})
