import { describe, expect, it } from 'vitest'
import { VAI_TRO, apDungLoaiTruCapBac, apDungLoaiTruKhiTick, chuanHoaVaiTro, coQuyenQuanLy, laVaiTroHopLe } from './vai-tro'

describe('danh sách 13 vai trò toàn công ty', () => {
  it('có đủ 13 vai trò, đúng thứ tự khai báo', () => {
    expect([...VAI_TRO]).toEqual([
      'ceo', 'admin',
      'kt_giam_doc', 'ky_thuat', 'ctv_lap_dat',
      'cs_manager', 'cs',
      'sales_manager', 'sales',
      'marketing', 'kho', 'ke_toan', 'tai_chinh',
    ])
  })

  it('7 vai trò mới là hợp lệ nhưng KHÔNG tự nhiên có quyền quản lý', () => {
    for (const v of ['ceo', 'kt_giam_doc', 'ctv_lap_dat', 'marketing', 'kho', 'ke_toan', 'tai_chinh']) {
      expect(laVaiTroHopLe(v), `${v} phải hợp lệ`).toBe(true)
      expect(coQuyenQuanLy([v]), `${v} chưa được có quyền quản lý ở GĐ1`).toBe(false)
    }
  })
})

describe('apDungLoaiTruCapBac — chỉ loại trừ TRONG cùng bộ phận', () => {
  it('kiêm nhiệm khác bộ phận thì giữ nguyên hết', () => {
    expect(apDungLoaiTruCapBac(['cs', 'sales'])).toEqual(['cs', 'sales'])
    expect(apDungLoaiTruCapBac(['cs_manager', 'sales_manager'])).toEqual(['cs_manager', 'sales_manager'])
    expect(apDungLoaiTruCapBac(['cs', 'sales_manager'])).toEqual(['cs', 'sales_manager'])
  })

  it('cùng bộ phận thì chỉ giữ cấp CAO NHẤT', () => {
    expect(apDungLoaiTruCapBac(['cs', 'cs_manager'])).toEqual(['cs_manager'])
    expect(apDungLoaiTruCapBac(['ky_thuat', 'ctv_lap_dat'])).toEqual(['ky_thuat'])
    expect(apDungLoaiTruCapBac(['kt_giam_doc', 'ky_thuat', 'ctv_lap_dat'])).toEqual(['kt_giam_doc'])
  })

  it('ca thật trên prod: [cs, sales_manager, cs_manager, admin] -> bỏ đúng cs', () => {
    expect(apDungLoaiTruCapBac(chuanHoaVaiTro(['cs', 'sales_manager', 'cs_manager', 'admin'])))
      .toEqual(['admin', 'cs_manager', 'sales_manager'])
  })

  it('vai trò không phân cấp (ceo/admin/marketing/kho/ke_toan/tai_chinh) không bao giờ bị loại', () => {
    expect(apDungLoaiTruCapBac(['ceo', 'admin', 'marketing', 'kho', 'ke_toan', 'tai_chinh']))
      .toEqual(['ceo', 'admin', 'marketing', 'kho', 'ke_toan', 'tai_chinh'])
  })

  it('kết quả luôn theo thứ tự khai báo VAI_TRO, không theo thứ tự người dùng tick', () => {
    expect(apDungLoaiTruCapBac(['sales', 'admin', 'cs'])).toEqual(['admin', 'cs', 'sales'])
  })

  it('mảng rỗng -> mảng rỗng', () => {
    expect(apDungLoaiTruCapBac([])).toEqual([])
  })
})

describe('apDungLoaiTruKhiTick — vai trò VỪA BẤM là vai trò thắng', () => {
  it('LỖI CEO BÁO: đang Trưởng CSKH, bấm Nhân viên CSKH -> HẠ CẤP được', () => {
    expect(apDungLoaiTruKhiTick(['cs_manager'], 'cs')).toEqual(['cs'])
  })

  it('chiều ngược lại: đang Nhân viên CSKH, bấm Trưởng CSKH -> lên cấp', () => {
    expect(apDungLoaiTruKhiTick(['cs'], 'cs_manager')).toEqual(['cs_manager'])
  })

  it('khác bộ phận thì cộng thêm, không đụng nhau', () => {
    expect(apDungLoaiTruKhiTick(['cs_manager'], 'sales_manager')).toEqual(['cs_manager', 'sales_manager'])
    expect(apDungLoaiTruKhiTick(['cs', 'sales'], 'kho')).toEqual(['cs', 'sales', 'kho'])
  })

  it('đổi cấp trong bộ phận này KHÔNG đụng bộ phận kia', () => {
    expect(apDungLoaiTruKhiTick(['cs', 'sales'], 'cs_manager')).toEqual(['cs_manager', 'sales'])
  })

  it('bộ phận Kỹ thuật 3 cấp: bấm cái nào ra cái đó', () => {
    expect(apDungLoaiTruKhiTick(['kt_giam_doc'], 'ctv_lap_dat')).toEqual(['ctv_lap_dat'])
    expect(apDungLoaiTruKhiTick(['ctv_lap_dat'], 'ky_thuat')).toEqual(['ky_thuat'])
  })

  it('bấm lại vai trò đã có thì giữ nguyên (không nhân đôi)', () => {
    expect(apDungLoaiTruKhiTick(['cs', 'sales'], 'cs')).toEqual(['cs', 'sales'])
  })

  it('người chưa có vai trò nào', () => {
    expect(apDungLoaiTruKhiTick([], 'ceo')).toEqual(['ceo'])
  })

  it('dữ liệu cũ vi phạm luật ở bộ phận KHÁC cũng được dọn luôn', () => {
    expect(apDungLoaiTruKhiTick(['cs', 'cs_manager'], 'sales')).toEqual(['cs_manager', 'sales'])
  })

  it('kết quả theo thứ tự khai báo VAI_TRO', () => {
    expect(apDungLoaiTruKhiTick(['sales', 'kho'], 'admin')).toEqual(['admin', 'sales', 'kho'])
  })
})
