/**
 * Suy loại máy POU/POE từ tên bộ máy — nhánh dự phòng khi plan không có serial.
 *
 * Lý do có nhánh này: đo prod 21/08/2026, 0/79 plan bảo trì có `serial` nên đường suy chính
 * (serial → kho → danh mục cấp 2) chưa ra kết quả lần nào; 63/79 plan lại CÓ `bo_may`.
 */
import { describe, expect, it } from 'vitest'
import { loaiMayTheoBoMay } from './lichBaoTri'

describe('loaiMayTheoBoMay', () => {
  it('WH15A/WH30A và bản ECO đều là POE (hệ lọc tổng) — CEO chốt 21/08/2026', () => {
    // 4 giá trị này phủ đúng 63/79 plan đang có trên production.
    expect(loaiMayTheoBoMay('WH30A')).toBe('POE')       // 37 plan
    expect(loaiMayTheoBoMay('WH15A')).toBe('POE')       // 20 plan
    expect(loaiMayTheoBoMay('WH30A ECO')).toBe('POE')   // 4 plan
    expect(loaiMayTheoBoMay('WH15A ECO')).toBe('POE')   // 2 plan
  })

  it('nhận cả cách gõ lệch: thường, thừa khoảng trắng', () => {
    expect(loaiMayTheoBoMay('wh30a')).toBe('POE')
    expect(loaiMayTheoBoMay('  WH 30A  ECO ')).toBe('POE')
    expect(loaiMayTheoBoMay('Bộ WH15A lắp 2026')).toBe('POE')
  })

  it('trống / không rõ -> null để form hiện ĐỦ 4 chỉ số, không đoán bừa', () => {
    expect(loaiMayTheoBoMay(null)).toBeNull()
    expect(loaiMayTheoBoMay(undefined)).toBeNull()
    expect(loaiMayTheoBoMay('')).toBeNull()
    expect(loaiMayTheoBoMay('   ')).toBeNull()
    // 16/79 plan đang trống ô bộ máy -> phải rơi vào nhánh an toàn này.
    expect(loaiMayTheoBoMay('Máy lọc bàn')).toBeNull()
    expect(loaiMayTheoBoMay('GN610')).toBeNull()
  })

  it('KHÔNG tự nhận thành POU — chưa có căn cứ nào cho POU ở ô bộ máy', () => {
    for (const s of ['WH30A', 'WH15A ECO', 'GN610', '']) {
      expect(loaiMayTheoBoMay(s)).not.toBe('POU')
    }
  })
})
