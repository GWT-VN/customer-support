import { describe, expect, it } from 'vitest'
import { sapXepHopLe } from '../bang'
import { tenModel, COT_MAY, COT_TICKET, COT_LOI, COT_KHACH } from './danhSach'

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

// Whitelist cột là chuyện RIÊNG của dự án này (bộ bảng dùng chung không biết
// COT_MAY là gì) -> test ở đây chứ không ở bang/.
describe('sapXepHopLe — ?cot=mat_khau trên URL thật (Task 5, bấm tiêu đề cột)', () => {
  // Bằng chứng cụ thể: gõ tay ?cot=mat_khau lên bất kỳ trang liệt kê nào cũng KHÔNG
  // vỡ trang — mat_khau không nằm trong whitelist thật của trang đó nên sapXepHopLe()
  // lặng lẽ rơi về đúng mặc định của trang, y hệt như chưa từng có ?cot= trên URL.
  it('COT_MAY (trang "/") bỏ qua mat_khau, rơi về mặc định install_date desc', () => {
    const macDinh = { cot: 'install_date', tang: false }
    expect(sapXepHopLe('mat_khau', 'asc', COT_MAY, macDinh)).toEqual({ ...macDinh, macDinh: true })
  })

  it('COT_TICKET (trang "/ticket") bỏ qua mat_khau, rơi về mặc định created_at desc', () => {
    const macDinh = { cot: 'created_at', tang: false }
    expect(sapXepHopLe('mat_khau', 'asc', COT_TICKET, macDinh)).toEqual({ ...macDinh, macDinh: true })
  })

  it('COT_LOI (trang "/loi") bỏ qua mat_khau, rơi về mặc định han_som asc', () => {
    const macDinh = { cot: 'han_som', tang: true }
    expect(sapXepHopLe('mat_khau', 'desc', COT_LOI, macDinh)).toEqual({ ...macDinh, macDinh: true })
  })

  it('COT_KHACH (trang "/khach") bỏ qua mat_khau, rơi về mặc định full_name asc', () => {
    const macDinh = { cot: 'full_name', tang: true }
    expect(sapXepHopLe('mat_khau', 'desc', COT_KHACH, macDinh)).toEqual({ ...macDinh, macDinh: true })
  })

  it('cột lạ bị loại thì KHÔNG hiện nút bỏ sắp xếp — URL bẩn không được tính là "đã sắp"', () => {
    expect(sapXepHopLe('mat_khau', 'asc', COT_MAY, { cot: 'install_date', tang: false }).macDinh)
      .toBe(true)
  })
})
