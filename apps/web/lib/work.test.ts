import { describe, it, expect } from 'vitest'
import {
  nhomTheoHan, nhanHan, gomTheoHan, soNgayToiHan, chuTat,
  isoTuOInput, inputTuIso, moTaNhatKy, THU_TU_NHOM,
} from './work'

// Mốc cố định: 15/09/2026 lúc 10:00 giờ địa phương.
const BAY_GIO = new Date(2026, 8, 15, 10, 0, 0)
/** Hạn tại giờ địa phương, lệch `ngay` ngày so với BAY_GIO. */
const han = (ngay: number, gio = 12, phut = 0) =>
  new Date(2026, 8, 15 + ngay, gio, phut).toISOString()

describe('nhomTheoHan', () => {
  it('không có hạn -> khong_han', () => {
    expect(nhomTheoHan(null, BAY_GIO)).toBe('khong_han')
    expect(nhomTheoHan(undefined, BAY_GIO)).toBe('khong_han')
  })
  it('hôm qua trở về trước -> qua_han', () => {
    expect(nhomTheoHan(han(-1), BAY_GIO)).toBe('qua_han')
    expect(nhomTheoHan(han(-30), BAY_GIO)).toBe('qua_han')
  })
  it('cùng NGÀY là hôm nay, kể cả giờ đã trôi qua', () => {
    expect(nhomTheoHan(han(0, 23, 59), BAY_GIO)).toBe('hom_nay')
    expect(nhomTheoHan(han(0, 0, 1), BAY_GIO)).toBe('hom_nay')   // 00:01 sáng nay, đã qua giờ
  })
  it('1..7 ngày -> tuan_nay, từ ngày thứ 8 -> sap_toi', () => {
    expect(nhomTheoHan(han(1), BAY_GIO)).toBe('tuan_nay')
    expect(nhomTheoHan(han(7), BAY_GIO)).toBe('tuan_nay')
    expect(nhomTheoHan(han(8), BAY_GIO)).toBe('sap_toi')
  })
  it('sát ranh giới nửa đêm: 00:30 ngày mai KHÔNG phải hôm nay', () => {
    expect(nhomTheoHan(han(1, 0, 30), BAY_GIO)).toBe('tuan_nay')
    expect(nhomTheoHan(han(0, 23, 30), BAY_GIO)).toBe('hom_nay')
  })
})

describe('soNgayToiHan', () => {
  it('tính theo ngày chứ không theo 24 giờ', () => {
    // chỉ cách 2 tiếng nhưng đã sang ngày mới -> 1 ngày
    expect(soNgayToiHan(new Date(2026, 8, 16, 0, 30), new Date(2026, 8, 15, 22, 30))).toBe(1)
    // cách 13 tiếng nhưng vẫn cùng ngày -> 0
    expect(soNgayToiHan(new Date(2026, 8, 15, 23, 0), new Date(2026, 8, 15, 10, 0))).toBe(0)
  })
})

describe('nhanHan', () => {
  it('nhãn theo khoảng cách', () => {
    expect(nhanHan(null, BAY_GIO)).toBe('')
    expect(nhanHan(han(0), BAY_GIO)).toBe('Hôm nay')
    expect(nhanHan(han(1), BAY_GIO)).toBe('Ngày mai')
    expect(nhanHan(han(3), BAY_GIO)).toBe('3 ngày nữa')
    expect(nhanHan(han(-1), BAY_GIO)).toBe('Quá hạn hôm qua')
    expect(nhanHan(han(-5), BAY_GIO)).toBe('Quá hạn 5 ngày')
  })
  it('xa hơn 1 tuần thì hiện ngày/tháng', () => {
    expect(nhanHan(han(20), BAY_GIO)).toBe('05/10')
  })
})

describe('gomTheoHan', () => {
  const ds = [
    { id: 1, due_at: han(-2) }, { id: 2, due_at: null }, { id: 3, due_at: han(0) },
    { id: 4, due_at: han(3) }, { id: 5, due_at: han(40) }, { id: 6, due_at: han(-9) },
  ]
  it('bỏ nhóm rỗng, giữ đúng thứ tự ưu tiên', () => {
    const g = gomTheoHan(ds, BAY_GIO)
    expect(g.map((x) => x.nhom)).toEqual(['qua_han', 'hom_nay', 'tuan_nay', 'sap_toi', 'khong_han'])
    expect(g[0].viec.map((v) => v.id)).toEqual([1, 6])   // giữ thứ tự đầu vào
  })
  it('danh sách rỗng -> không có nhóm nào', () => {
    expect(gomTheoHan([], BAY_GIO)).toEqual([])
  })
  it('không làm mất việc nào', () => {
    const g = gomTheoHan(ds, BAY_GIO)
    expect(g.reduce((n, x) => n + x.viec.length, 0)).toBe(ds.length)
  })
  it('mọi nhóm sinh ra đều nằm trong THU_TU_NHOM', () => {
    for (const g of gomTheoHan(ds, BAY_GIO)) expect(THU_TU_NHOM).toContain(g.nhom)
  })
})

describe('chuTat', () => {
  it('lấy chữ đầu của từ đầu và từ cuối', () => {
    expect(chuTat('Nguyễn Văn An')).toBe('NA')
    expect(chuTat('Bella')).toBe('BE')
    expect(chuTat('  Trần   Thị   Bích  ')).toBe('TB')
  })
  it('rỗng -> dấu hỏi', () => {
    expect(chuTat('')).toBe('?')
    expect(chuTat(null)).toBe('?')
  })
})

describe('isoTuOInput / inputTuIso', () => {
  it('đi vòng tròn không lệch giờ địa phương', () => {
    const iso = isoTuOInput('2026-08-20T17:30')
    expect(iso).not.toBeNull()
    expect(inputTuIso(iso)).toBe('2026-08-20T17:30')
  })
  it('giá trị rỗng/hỏng -> null hoặc chuỗi rỗng', () => {
    expect(isoTuOInput('')).toBeNull()
    expect(isoTuOInput('lung tung')).toBeNull()
    expect(inputTuIso(null)).toBe('')
    expect(inputTuIso('lung tung')).toBe('')
  })
})

describe('moTaNhatKy', () => {
  it('dịch verb sang tiếng Việt', () => {
    expect(moTaNhatKy('created', null)).toBe('tạo việc')
    expect(moTaNhatKy('status_changed', { status: 'done' })).toBe('đổi trạng thái → Xong')
    expect(moTaNhatKy('assigned', { ten: 'Bella', role: 'reviewer' })).toBe('gán Bella · Nghiệm thu')
    expect(moTaNhatKy('commented', {})).toBe('bình luận')
  })
  it('updated liệt kê đúng những gì đã đổi', () => {
    expect(moTaNhatKy('updated', { title: 'x', priority: 1 })).toBe('sửa tiêu đề, ưu tiên')
    expect(moTaNhatKy('updated', {})).toBe('sửa việc')
  })
  it('verb lạ thì trả nguyên văn, không vỡ', () => {
    expect(moTaNhatKy('chua_biet', null)).toBe('chua_biet')
  })
})
