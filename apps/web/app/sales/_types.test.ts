import { describe, it, expect } from 'vitest'
import { VAT_OPTS, maVat, nhanVat } from './_types'

describe('nhanVat — nhãn hiển thị', () => {
  it('KCT và KAD hiện đúng nhãn, KHÔNG hiện 0%', () => {
    // Ba thứ này cùng ra tiền thuế 0 nhưng là ba nhóm khác nhau — CEO chốt 21/08.
    expect(nhanVat(0, 'KCT')).toBe('KCT')
    expect(nhanVat(0, 'KAD')).toBe('KAD')
    expect(nhanVat(0, 'VAT')).toBe('0%')
  })
  it('thuế suất hiện theo phần trăm dù dữ liệu ghi kiểu nào', () => {
    expect(nhanVat(0.08, 'VAT')).toBe('8%')
    expect(nhanVat(8, 'VAT')).toBe('8%')
    expect(nhanVat(0.1, 'VAT')).toBe('10%')
  })
  it('chưa xếp loại -> gạch ngang, không đoán', () => {
    expect(nhanVat(null, null)).toBe('—')
  })
  it('loai thắng pct: KCT thì kể cả pct lạ vẫn là KCT', () => {
    expect(nhanVat(0.08, 'KCT')).toBe('KCT')
  })
})

describe('maVat — khoá dropdown', () => {
  it('dựng lại đúng mục đang chọn', () => {
    expect(maVat(0.08, 'VAT')).toBe('VAT:0.08')
    expect(maVat(0, 'VAT')).toBe('VAT:0')
    expect(maVat(0, 'KCT')).toBe('KCT')
    expect(maVat(0, 'KAD')).toBe('KAD')
    expect(maVat(null, null)).toBe('')
  })
  it('dữ liệu cũ ghi 8 thay vì 0.08 vẫn chọn đúng mục', () => {
    expect(maVat(8, 'VAT')).toBe('VAT:0.08')
  })
  it('mọi mã dropdown đều dựng lại được từ (pct, loai) của nó', () => {
    for (const v of VAT_OPTS) expect(maVat(v.pct, v.loai)).toBe(v.ma)
  })
})
