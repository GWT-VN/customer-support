import { describe, it, expect } from 'vitest'
import { chuanHoaSdt, sdtChuanMuc, canhBaoSdt } from './sdt'

// Số dùng trong test là số GIẢ dải 090000000x, không phải SĐT khách thật.

describe('chuanHoaSdt', () => {
  it('giữ nguyên SĐT 10 số bắt đầu bằng 0', () => {
    expect(chuanHoaSdt('0900000001').chuan).toBe('0900000001')
  })
  it('đổi 84… và +84… về 0…', () => {
    expect(chuanHoaSdt('84900000001').chuan).toBe('0900000001')
    expect(chuanHoaSdt('+84 900 000 001').chuan).toBe('0900000001')
  })
  it('thêm số 0 cho số 9 chữ số (nguồn Google Sheet)', () => {
    expect(chuanHoaSdt('900000001').chuan).toBe('0900000001')
  })
  it('bỏ mọi ký tự không phải số', () => {
    expect(chuanHoaSdt('090-000.00 01').chuan).toBe('0900000001')
  })
  it('rỗng/null không nổ', () => {
    expect(chuanHoaSdt(null).chuan).toBe('')
    expect(chuanHoaSdt(undefined).hopLe).toBe(false)
  })
  it('cuoi9 là 9 số cuối để đối chiếu', () => {
    expect(chuanHoaSdt('0900000001').cuoi9).toBe('900000001')
  })
})

describe('sdtChuanMuc — luật CEO: đúng 10 số, bắt đầu bằng 0', () => {
  it('đúng chuẩn', () => {
    expect(sdtChuanMuc('0900000001')).toBe(true)
  })
  it('11 số là KHÔNG chuẩn, dù vẫn cho lưu', () => {
    expect(sdtChuanMuc('09000000012')).toBe(false)
  })
  it('84… sau khi chuẩn hoá thành 10 số thì đạt chuẩn', () => {
    expect(sdtChuanMuc('84900000001')).toBe(true)
  })
  it('quá ngắn thì không đạt', () => {
    expect(sdtChuanMuc('090000')).toBe(false)
  })
  it('rỗng thì không đạt', () => {
    expect(sdtChuanMuc('')).toBe(false)
  })
})

describe('canhBaoSdt — cảnh báo chứ không chặn', () => {
  it('SĐT đúng chuẩn thì không cảnh báo', () => {
    expect(canhBaoSdt('0900000001')).toBeNull()
  })
  it('ô rỗng thì không cảnh báo (chỗ khác lo việc bắt buộc)', () => {
    expect(canhBaoSdt('')).toBeNull()
    expect(canhBaoSdt(null)).toBeNull()
  })
  it('nhập 84… thì nhắc dạng chuẩn đã quy đổi', () => {
    expect(canhBaoSdt('84900000001')).toContain('0900000001')
  })
  it('số 11 chữ số thì nói rõ là phải 10 số', () => {
    expect(canhBaoSdt('09000000012')).toContain('10 số')
  })
})
