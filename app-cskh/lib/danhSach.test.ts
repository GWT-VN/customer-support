import { describe, expect, it } from 'vitest'
import { tenModel } from './danhSach'

describe('tenModel — rút tên sản phẩm về mã máy cho ô lọc', () => {
  // 18 tên dưới đây lấy NGUYÊN VĂN từ v_installed_base trên DB thật (2026-07-29),
  // không bịa — đây là toàn bộ danh sách đang hiện trong ô chọn "Sản phẩm".
  const THAT: [string, string, string][] = [
    ['WH15A', 'Hệ thống lọc nước GE WH15A', 'WH15A'],
    ['WH30A', 'Hệ thống lọc nước GE WH30A', 'WH30A'],
    ['GEUT-50B04-G', 'Máy lọc nước GE B04', 'B04'],
    ['CTD50NG', 'Máy lọc nước GE CTD50', 'CTD50'],
    ['CTS10NB', 'Máy lọc nước GE CTS10 (màu đen)', 'CTS10 (màu đen)'],
    ['CTS10NW', 'Máy lọc nước GE CTS10 (màu trắng)', 'CTS10 (màu trắng)'],
    ['CTS20NG', 'Máy lọc nước GE CTS20', 'CTS20'],
    ['GTUN-8500XDS-G', 'Máy lọc nước GE DN810', 'DN810'],
    ['GCUN-02VNT01', 'Máy lọc nước GE GCUN-02VNT01', 'GCUN-02VNT01'],
    ['GPUN-4000XEN-G', 'Máy lọc nước GE GN610', 'GN610'],
    ['GTUN-5800EN-G', 'Máy lọc nước GE GN620', 'GN620'],
    ['GTUN-8600VNHP', 'Máy lọc nước GE GTUN-8600VNHP', 'GTUN-8600VNHP'],
    ['GTUN-8600HP-G', 'Máy lọc nước GE USH10', 'USH10'],
    ['GTEC-15A01-G', 'Thiết bị làm mềm nước trung tâm GE GTEC-15A01-G', 'GTEC-15A01-G'],
    ['GTEC-30A01-G', 'Thiết bị làm mềm nước trung tâm GE GTEC-30A01-G', 'GTEC-30A01-G'],
    ['GTEF-15A01-G', 'Thiết bị lọc nước trung tâm GE GTEF-15A01-G', 'GTEF-15A01-G'],
    ['GTEF-30A01-G', 'Thiết bị lọc nước trung tâm GE GTEF-30A01-G', 'GTEF-30A01-G'],
    ['GTEP-50A01-G', 'Thiết bị tiền lọc GE GTEP-50A01-G', 'GTEP-50A01-G'],
  ]

  it.each(THAT)('%s: "%s" -> "%s"', (ma, day, gon) => {
    expect(tenModel(day, ma)).toBe(gon)
  })

  it('không dòng nào rút ra chuỗi rỗng hay quá dài', () => {
    for (const [ma, day] of THAT) {
      const gon = tenModel(day, ma)
      expect(gon.length).toBeGreaterThan(0)
      expect(gon.length).toBeLessThanOrEqual(20)
    }
  })

  it('mã nhà máy KHÁC mã CS ở 4 sản phẩm — lý do không dùng internal_code làm nhãn', () => {
    // Nếu ai đó sau này đổi sang hiện internal_code, test này vỡ và nhắc lại vì sao.
    expect(tenModel('Máy lọc nước GE GN610', 'GPUN-4000XEN-G')).toBe('GN610')
    expect(tenModel('Máy lọc nước GE DN810', 'GTUN-8500XDS-G')).toBe('DN810')
    expect(tenModel('Máy lọc nước GE USH10', 'GTUN-8600HP-G')).toBe('USH10')
    expect(tenModel('Máy lọc nước GE B04', 'GEUT-50B04-G')).toBe('B04')
  })

  it('tên không theo khuôn "… GE <mã>" thì giữ nguyên, không cắt bậy', () => {
    expect(tenModel('Máy lọc nước Kangaroo KG100', 'X1')).toBe('Máy lọc nước Kangaroo KG100')
    expect(tenModel('GE', 'X2')).toBe('GE')
  })

  it('thiếu tên thì rơi về mã nội bộ', () => {
    expect(tenModel(null, 'CTS20NG')).toBe('CTS20NG')
  })

  it('tên kết thúc bằng " GE " (dữ liệu bẩn) thì giữ nguyên chứ không ra rỗng', () => {
    expect(tenModel('Máy lọc nước GE ', 'CTS20NG')).toBe('Máy lọc nước GE ')
  })
})
