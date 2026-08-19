import { describe, it, expect } from 'vitest'
import {
  docTenPlan, docTenTuThuMuc, xepGoiY, sdtChuan, tinCayThap, NGUONG_TIN_CAY_THAP, type KhachUngVien,
} from './khopPlanKhach'

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

  it('không nhầm số nhà (115A, 215A) với bộ máy WH15A/WH30A', () => {
    expect(docTenPlan('Anh Thế_115A_Hà Nội').boMay).toBeNull()
    expect(docTenPlan('Chị Hiền_215A_Nguyễn Huệ_Hà Nội').boMay).toBeNull()
  })

  it('tìm tên tỉnh với word boundary, không nhầm substring', () => {
    // "Hà Tĩnh" không nên match khi chỉ xuất hiện xuyên các từ (nha + tinh từ khác từ)
    expect(docTenPlan('Anh X_nha tinh te').tinh).toBeNull()
  })
})

describe('docTenTuThuMuc', () => {
  it('bỏ tiền tố số thứ tự Asana + ghi chú trong ngoặc, giữ lại tên', () => {
    expect(docTenTuThuMuc('23A Anh Minh (khách cũ)')).toBe('Anh Minh')
  })

  it('bỏ tiền tố + phần mô tả sau dấu gạch ngang', () => {
    expect(docTenTuThuMuc('05B Chị Hoa - lắp thêm 2 giàn')).toBe('Chị Hoa')
  })

  it('tiền tố chỉ có số, không chữ cái đi kèm', () => {
    expect(docTenTuThuMuc('7 Anh Sơn')).toBe('Anh Sơn')
  })

  it('tên thật 2 chữ với xưng hô ngắn ("Cô") vẫn giữ nguyên, không bị cắt thêm', () => {
    expect(docTenTuThuMuc('02A Cô Hà')).toBe('Cô Hà')
  })

  it('chuỗi rỗng hoặc null thì trả null, không đoán bừa', () => {
    expect(docTenTuThuMuc('')).toBeNull()
    expect(docTenTuThuMuc(null)).toBeNull()
    expect(docTenTuThuMuc(undefined)).toBeNull()
  })
})

const KHACH: KhachUngVien[] = [
  { id: 'k1', ten: 'Anh Long',  sdt: '0900000001', tinh: 'Hà Tĩnh', ngayLapSomNhat: '2025-08-28' },
  { id: 'k2', ten: 'Chị Bình', sdt: '0900000002', tinh: 'Hà Tĩnh', ngayLapSomNhat: '2024-01-05' },
  { id: 'k3', ten: 'Anh Cường', sdt: '0900000003', tinh: 'Hà Nội',  ngayLapSomNhat: '2025-08-25' },
]

describe('sdtChuan', () => {
  it('lấy 9 số cuối, bỏ ký tự thừa và mã vùng', () => {
    expect(sdtChuan('0900000001')).toBe('900000001')
    expect(sdtChuan('+84 900 000 001')).toBe('900000001')
    expect(sdtChuan('')).toBe('')
  })
})

describe('xepGoiY', () => {
  it('SĐT trùng thì đứng đầu và luôn được gợi ý', () => {
    const r = xepGoiY({ source_customer_name: 'Chị Bình_Hà Tĩnh', source_phone: '0900000001', bo_may: null, source_folder: null }, KHACH)
    expect(r[0].id).toBe('k1')
    expect(r[0].lyDo).toContain('trùng SĐT')
  })

  it('không có SĐT thì khớp theo tỉnh + ngày lắp gần nhau (ca Anh Ng)', () => {
    const r = xepGoiY({ source_customer_name: 'Anh Ng_30A_Hà Tĩnh_Lắp 23/08/2025', source_phone: null, bo_may: 'WH30A', source_folder: null }, KHACH)
    expect(r[0].id).toBe('k1')
    expect(r[0].lyDo).toEqual(expect.arrayContaining(['cùng tỉnh Hà Tĩnh', 'ngày lắp lệch 5 ngày']))
  })

  it('cùng tỉnh nhưng ngày lắp lệch quá xa thì KHÔNG tính là khớp ngày', () => {
    const r = xepGoiY({ source_customer_name: 'X_Hà Tĩnh_Lắp 23/08/2025', source_phone: null, bo_may: null, source_folder: null }, KHACH)
    const k2 = r.find((x) => x.id === 'k2')
    expect(k2?.lyDo.some((l) => l.startsWith('ngày lắp'))).toBe(false)
  })

  it('không có manh mối nào thì trả mảng rỗng, không gợi ý bừa', () => {
    expect(xepGoiY({ source_customer_name: 'Anh Cường', source_phone: null, bo_may: null, source_folder: null }, KHACH)).toEqual([])
  })

  it('giới hạn số gợi ý trả về', () => {
    const r = xepGoiY({ source_customer_name: 'X_Hà Tĩnh', source_phone: null, bo_may: null, source_folder: null }, KHACH, 1)
    expect(r.length).toBe(1)
  })

  it('gợi ý chỉ khớp tỉnh (1 tín hiệu mềm duy nhất) có điểm dưới ngưỡng tin cậy', () => {
    // Không có ngày lắp trong tên plan -> chỉ còn tín hiệu "cùng tỉnh" (20 điểm).
    const r = xepGoiY({ source_customer_name: 'X_Hà Tĩnh', source_phone: null, bo_may: null, source_folder: null }, KHACH)
    const k2 = r.find((x) => x.id === 'k2')
    expect(k2?.diem).toBe(20)
    expect(k2 && tinCayThap(k2.diem)).toBe(true)
  })

  it('gợi ý trùng SĐT hoặc đủ 2 tín hiệu mềm không bị coi là yếu', () => {
    const r = xepGoiY({ source_customer_name: 'Chị Bình_Hà Tĩnh', source_phone: '0900000001', bo_may: null, source_folder: null }, KHACH)
    expect(r[0].diem).toBeGreaterThanOrEqual(100) // trùng SĐT (+ cộng thêm nếu khớp thêm tỉnh)
    expect(tinCayThap(r[0].diem)).toBe(false)
  })

  it('SĐT quá ngắn (< 9 số) không được tính là bằng chứng trùng khách, mặc dù dữ liệu giống hệt', () => {
    // Khách giả định có SĐT tạm "12345" (5 chữ số - không phải SĐT thực)
    const khachGiaDinh: KhachUngVien[] = [
      { id: 'k_temp', ten: 'Khách Tạm', sdt: '12345', tinh: null, ngayLapSomNhat: null },
    ]
    // Plan từ Asana cũng có SĐT tạm "12345"
    const r = xepGoiY({ source_customer_name: 'X', source_phone: '12345', bo_may: null, source_folder: null }, khachGiaDinh)
    // Kết quả: không có gợi ý nào (0 điểm vì SĐT không hợp lệ + không có tỉnh/ngày)
    expect(r).toEqual([])
  })

  it('khớp tên chính xác & duy nhất một khách -> đứng đầu, tin cậy cao', () => {
    const r = xepGoiY(
      { source_customer_name: null, source_phone: null, bo_may: null, source_folder: '10A Anh Long' },
      KHACH,
    )
    expect(r[0].id).toBe('k1')
    expect(r[0].diem).toBe(60)
    expect(r[0].lyDo).toContain('trùng tên "Anh Long"')
    expect(tinCayThap(r[0].diem)).toBe(false)
  })

  it('nhiều khách cùng tên với plan -> đều được đưa ra nhưng ở mức tin cậy yếu', () => {
    const khachTrungTen: KhachUngVien[] = [
      { id: 'k4', ten: 'Anh Kiên', sdt: null, tinh: null, ngayLapSomNhat: null },
      { id: 'k5', ten: 'Anh Kiên', sdt: null, tinh: null, ngayLapSomNhat: null },
      { id: 'k6', ten: 'Chị Đào', sdt: null, tinh: null, ngayLapSomNhat: null },
    ]
    const r = xepGoiY(
      { source_customer_name: null, source_phone: null, bo_may: null, source_folder: '12A Anh Kiên' },
      khachTrungTen,
      5,
    )
    const ids = r.map((x) => x.id)
    expect(ids).toEqual(expect.arrayContaining(['k4', 'k5']))
    expect(ids).not.toContain('k6')
    for (const g of r) {
      expect(g.diem).toBe(15)
      expect(tinCayThap(g.diem)).toBe(true)
    }
  })

  it('tên trích ra quá ngắn (chỉ còn tiếng xưng hô "Anh") thì KHÔNG gợi ý bừa', () => {
    const r = xepGoiY(
      { source_customer_name: null, source_phone: null, bo_may: null, source_folder: '01A Anh' },
      KHACH,
    )
    expect(r).toEqual([])
  })

  it('khớp SĐT vẫn đứng trên khớp tên (dù ứng viên khác nhau)', () => {
    // k1 khớp SĐT plan (100 điểm), k3 chỉ khớp tên chính xác qua source_folder (60 điểm).
    const r = xepGoiY(
      { source_customer_name: null, source_phone: '0900000001', bo_may: null, source_folder: '02A Anh Cường' },
      KHACH,
    )
    const k1 = r.find((x) => x.id === 'k1')
    const k3 = r.find((x) => x.id === 'k3')
    expect(k1?.diem).toBe(100)
    expect(k3?.diem).toBe(60)
    expect(r[0].id).toBe('k1')
    expect(k1!.diem).toBeGreaterThan(k3!.diem)
  })

  it('khớp tên một phần (tiền tố) yếu hơn khớp tên chính xác', () => {
    const r = xepGoiY(
      { source_customer_name: null, source_phone: null, bo_may: null, source_folder: '03A Anh Long Nguyễn' },
      KHACH,
    )
    const k1 = r.find((x) => x.id === 'k1')
    expect(k1?.diem).toBe(10)
    expect(k1?.lyDo).toContain('tên gần giống "Anh Long Nguyễn"')
    expect(tinCayThap(k1!.diem)).toBe(true)
  })

  it('tên mơ hồ (trùng nhiều khách) CỘNG DỒN với ngày lắp gần vẫn không được vượt ngưỡng tin cậy', () => {
    // k4/k5 cùng tên "Anh Kiên" (mơ hồ). k4 còn khớp ngày lắp gần (lệch 0 ngày, +40)
    // -> nếu cộng dồn thẳng 15+40=55 sẽ vượt ngưỡng 40 và hiện như "chắc chắn" dù
    // bằng chứng tên đang tự nói "không chắc". Phải bị chặn trần dưới ngưỡng.
    const khachTrungTen: KhachUngVien[] = [
      { id: 'k4', ten: 'Anh Kiên', sdt: null, tinh: null, ngayLapSomNhat: '2025-01-20' },
      { id: 'k5', ten: 'Anh Kiên', sdt: null, tinh: null, ngayLapSomNhat: null },
    ]
    const r = xepGoiY(
      {
        source_customer_name: 'X_Lắp 20/01/2025', source_phone: null, bo_may: null,
        source_folder: '12A Anh Kiên',
      },
      khachTrungTen,
    )
    const k4 = r.find((x) => x.id === 'k4')
    expect(k4).toBeTruthy()
    expect(k4!.lyDo.some((l) => l.startsWith('ngày lắp'))).toBe(true) // vẫn cộng ngày lắp vào lý do hiển thị
    expect(k4!.diem).toBeLessThan(NGUONG_TIN_CAY_THAP) // nhưng điểm KHÔNG được vượt ngưỡng
    expect(tinCayThap(k4!.diem)).toBe(true)
  })

  it('khớp tên một phần CỘNG DỒN với ngày lắp gần vẫn không được vượt ngưỡng tin cậy', () => {
    // "Anh Long Nguyễn" chỉ khớp một phần với "Anh Long" (+10). Nếu k1 còn khớp
    // ngày lắp gần (+40) thì tổng thẳng 50 sẽ vượt ngưỡng 40 — tên bị cắt bớt
    // trong thư mục không phải bằng chứng đủ mạnh để "chắc chắn" dù cộng ngày.
    const khachMotPhan: KhachUngVien[] = [
      { id: 'k1', ten: 'Anh Long', sdt: null, tinh: null, ngayLapSomNhat: '2025-01-20' },
    ]
    const r = xepGoiY(
      {
        source_customer_name: 'X_Lắp 20/01/2025', source_phone: null, bo_may: null,
        source_folder: '03A Anh Long Nguyễn',
      },
      khachMotPhan,
    )
    expect(r[0]?.diem).toBeLessThan(NGUONG_TIN_CAY_THAP)
    expect(tinCayThap(r[0]!.diem)).toBe(true)
  })

  it('tên thật 2 chữ có xưng hô "Cô" (chỉ 2 ký tự) vẫn được nhận, không bị loại oan', () => {
    const dsKhach: KhachUngVien[] = [
      { id: 'kh1', ten: 'Cô Hà', sdt: null, tinh: null, ngayLapSomNhat: null },
      { id: 'kh2', ten: 'Anh Long', sdt: null, tinh: null, ngayLapSomNhat: null },
    ]
    const r = xepGoiY(
      { source_customer_name: null, source_phone: null, bo_may: null, source_folder: '02A Cô Hà' },
      dsKhach,
    )
    expect(r[0]?.id).toBe('kh1')
    expect(r[0]?.diem).toBe(60)
    expect(tinCayThap(r[0]!.diem)).toBe(false)
  })

  it('xưng hô đứng một mình ("Chị", không kèm tên) vẫn bị loại, không gợi ý bừa', () => {
    const r = xepGoiY(
      { source_customer_name: null, source_phone: null, bo_may: null, source_folder: '04A Chị' },
      KHACH,
    )
    expect(r).toEqual([])
  })
})

describe('tinCayThap', () => {
  it('điểm 0 (không có gợi ý) không tính là "yếu" — nó là không có gợi ý gì cả', () => {
    expect(tinCayThap(0)).toBe(false)
  })

  it('1 tín hiệu mềm duy nhất (chỉ tỉnh 20, hoặc chỉ ngày lệch xa 25) là yếu', () => {
    expect(tinCayThap(20)).toBe(true)
    expect(tinCayThap(25)).toBe(true)
    expect(tinCayThap(NGUONG_TIN_CAY_THAP - 1)).toBe(true)
  })

  it('trùng SĐT, ngày lắp gần, hoặc đủ 2 tín hiệu mềm cộng dồn thì KHÔNG còn yếu', () => {
    expect(tinCayThap(NGUONG_TIN_CAY_THAP)).toBe(false) // ngày lắp lệch ≤7 ngày (40)
    expect(tinCayThap(45)).toBe(false) // tỉnh (20) + ngày lệch xa (25) cộng dồn
    expect(tinCayThap(100)).toBe(false) // trùng SĐT
  })
})
