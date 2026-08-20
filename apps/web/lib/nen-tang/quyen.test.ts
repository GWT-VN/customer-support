import { describe, expect, it } from 'vitest'
import { VAI_TRO } from './vai-tro'
import { HO_SO_QUYEN, MAC_DINH, QUYEN, laMaQuyenHopLe } from './quyen'

describe('kho quyền', () => {
  it('có đủ 45 quyền, không trùng mã', () => {
    expect(QUYEN.length).toBe(45)
    expect(new Set(QUYEN).size).toBe(45)
  })

  it('mã quyền theo khuôn khu.đối_tượng.hành_động', () => {
    for (const q of QUYEN) {
      expect(q, `${q} phải có ít nhất 2 dấu chấm phân cấp`).toMatch(/^[a-z_]+\.[a-z_]+(\.[a-z_]+)?$/)
    }
  })

  it('mọi quyền đều có hồ sơ (nhóm + nhãn tiếng Việt)', () => {
    for (const q of QUYEN) {
      expect(HO_SO_QUYEN[q], `${q} thiếu hồ sơ`).toBeTruthy()
      expect(HO_SO_QUYEN[q].nhan.length, `${q} thiếu nhãn`).toBeGreaterThan(3)
    }
  })

  it('laMaQuyenHopLe chặn mã lạ — gõ sai tên quyền là hở quyền mà không ai biết', () => {
    expect(laMaQuyenHopLe('cs.khach.xem')).toBe(true)
    expect(laMaQuyenHopLe('cs.khach.xoa_het')).toBe(false)
    expect(laMaQuyenHopLe('')).toBe(false)
  })
})

describe('giá trị khởi tạo — sinh từ hành vi HÔM NAY', () => {
  it('mọi vai trò đều có mục trong MAC_DINH, và chỉ chứa mã hợp lệ', () => {
    for (const v of VAI_TRO) {
      expect(MAC_DINH[v], `${v} thiếu mục`).toBeDefined()
      for (const q of MAC_DINH[v]) expect(laMaQuyenHopLe(q), `${v} có mã lạ ${q}`).toBe(true)
    }
  })

  it('admin có TOÀN BỘ 42 quyền', () => {
    expect([...MAC_DINH.admin].sort()).toEqual([...QUYEN].sort())
  })

  it('Trưởng CSKH có quyền duyệt, nhân viên CSKH thì không', () => {
    expect(MAC_DINH.cs_manager).toContain('cs.serial.duyet')
    expect(MAC_DINH.cs).not.toContain('cs.serial.duyet')
    expect(MAC_DINH.cs_manager).toContain('cs.khach.duyet_cho')
    expect(MAC_DINH.cs).not.toContain('cs.khach.duyet_cho')
  })

  it('quyền chỉ-admin không rơi xuống Trưởng CSKH', () => {
    for (const q of ['he_thong.nhan_su.sua', 'he_thong.phan_quyen', 'cs.yeu_cau.duyet', 'cs.khach.xoa_hang_loat'] as const) {
      expect(MAC_DINH.cs_manager, `${q} không được rơi xuống cs_manager`).not.toContain(q)
      expect(MAC_DINH.admin).toContain(q)
    }
  })

  it('CEO CHỈ có quyền xem, không có quyền ghi nào', () => {
    expect(MAC_DINH.ceo.length).toBeGreaterThan(0)
    for (const q of MAC_DINH.ceo) {
      expect(HO_SO_QUYEN[q].chiXem, `CEO không được có quyền ghi: ${q}`).toBe(true)
    }
    expect(MAC_DINH.ceo).toContain('cs.khach.xem')
    expect(MAC_DINH.ceo).toContain('sales.don.xem')
    expect(MAC_DINH.ceo).not.toContain('cs.khach.sua')
  })

  it('vai trò mới chưa có nghiệp vụ riêng: chỉ được mức "mọi nhân sự"', () => {
    for (const v of ['marketing', 'kho', 'ke_toan', 'tai_chinh', 'ctv_lap_dat'] as const) {
      expect(MAC_DINH[v]).toContain('work.viec.xem_tao')
      expect(MAC_DINH[v], `${v} chưa được đụng dữ liệu khách`).not.toContain('cs.khach.xem')
      expect(MAC_DINH[v]).not.toContain('cs.khach.sua')
    }
  })

  it('Sales thuần vào được đơn Sales, KHÔNG vào được dữ liệu khách CS', () => {
    expect(MAC_DINH.sales).toContain('sales.don.xem')
    expect(MAC_DINH.sales).toContain('sales.don.ghi')
    expect(MAC_DINH.sales).not.toContain('cs.khach.xem')
  })

  it('BA ô CEO chủ động đổi 20/08', () => {
    // 1. ghi chi phí ticket hạ xuống nhân viên CSKH
    expect(MAC_DINH.cs).toContain('cs.ticket.chi_phi')
    // 2. tạo plan bảo trì hạ xuống nhân viên CSKH (kết quả vào hàng chờ duyệt)
    expect(MAC_DINH.cs).toContain('cs.bao_tri.tao_plan')
    // 3. duyệt plan bảo trì là quyền MỚI của Trưởng CSKH
    expect(MAC_DINH.cs_manager).toContain('cs.bao_tri.duyet_plan')
    expect(MAC_DINH.cs).not.toContain('cs.bao_tri.duyet_plan')
  })
})
