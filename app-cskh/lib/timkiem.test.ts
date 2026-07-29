import { describe, expect, it } from 'vitest'
import { antoanChoOr, boDau, chuanHoaTuKhoa, mauDauTu, sapXepHopLe } from './timkiem'
import { COT_MAY, COT_TICKET, COT_LOI, COT_KHACH } from './danhSach'

describe('boDau', () => {
  it('bỏ dấu tiếng Việt và về chữ thường', () => {
    expect(boDau('Nguyễn Thị Hương')).toBe('nguyen thi huong')
    expect(boDau('Hưng Yên')).toBe('hung yen')
  })

  it('chữ đ phải thành d — NFD không tách được U+0111', () => {
    expect(boDau('Đoàn Văn Đức')).toBe('doan van duc')
    expect(boDau('đ')).toBe('d')
  })

  it('chuỗi đã không dấu thì giữ nguyên', () => {
    expect(boDau('nguyen van a')).toBe('nguyen van a')
  })

  it('chuỗi rỗng và khoảng trắng', () => {
    expect(boDau('')).toBe('')
    expect(boDau('  ')).toBe('  ')
  })
})

describe('chuanHoaTuKhoa', () => {
  it('bỏ dấu, cắt khoảng trắng thừa hai đầu', () => {
    expect(chuanHoaTuKhoa('  Hương  ')).toBe('huong')
  })

  it('gộp khoảng trắng giữa các từ', () => {
    expect(chuanHoaTuKhoa('Hưng    Yên')).toBe('hung yen')
  })
})

describe('sapXepHopLe — chốt chặn injection', () => {
  const CHO_PHEP = ['install_date', 'serial', 'customer_name'] as const
  const MAC_DINH = { cot: 'install_date', tang: false }
  const ROI_VE_MAC_DINH = { ...MAC_DINH, macDinh: true }

  it('cột hợp lệ thì dùng', () => {
    expect(sapXepHopLe('serial', 'asc', CHO_PHEP, MAC_DINH))
      .toEqual({ cot: 'serial', tang: true, macDinh: false })
  })

  it('cột LẠ bị bỏ qua, rơi về mặc định', () => {
    expect(sapXepHopLe('mat_khau', 'asc', CHO_PHEP, MAC_DINH)).toEqual(ROI_VE_MAC_DINH)
  })

  it('chuỗi tấn công cũng rơi về mặc định', () => {
    expect(sapXepHopLe('id; drop table cs_customers', 'asc', CHO_PHEP, MAC_DINH))
      .toEqual(ROI_VE_MAC_DINH)
  })

  it('thiếu tham số thì dùng mặc định', () => {
    expect(sapXepHopLe(undefined, undefined, CHO_PHEP, MAC_DINH)).toEqual(ROI_VE_MAC_DINH)
  })

  it('chiều chỉ nhận asc/desc, khác đi coi như desc', () => {
    expect(sapXepHopLe('serial', 'lung tung', CHO_PHEP, MAC_DINH))
      .toEqual({ cot: 'serial', tang: false, macDinh: false })
  })
})

describe('sapXepHopLe — cờ macDinh quyết định có hiện nút "bỏ sắp xếp" hay không', () => {
  const CHO_PHEP = ['install_date', 'serial'] as const
  const MAC_DINH = { cot: 'install_date', tang: false }

  it('bấm ĐÚNG về thứ tự gốc thì tính là mặc định, không cần nút bỏ', () => {
    // Bấm vòng quanh rồi quay lại install_date giảm dần = y hệt lúc chưa đụng gì.
    // Nếu chỉ xét "URL có ?cot= hay không" thì ca này ra macDinh=false, nút bỏ hiện
    // ra nhưng bấm vào không thấy gì đổi -> người dùng tưởng nút hỏng.
    expect(sapXepHopLe('install_date', 'desc', CHO_PHEP, MAC_DINH).macDinh).toBe(true)
  })

  it('đúng cột mặc định nhưng NGƯỢC chiều thì KHÔNG phải mặc định', () => {
    expect(sapXepHopLe('install_date', 'asc', CHO_PHEP, MAC_DINH).macDinh).toBe(false)
  })

  it('cột khác thì không phải mặc định', () => {
    expect(sapXepHopLe('serial', 'asc', CHO_PHEP, MAC_DINH).macDinh).toBe(false)
  })

  it('cột lạ bị loại -> về mặc định, KHÔNG hiện nút bỏ', () => {
    expect(sapXepHopLe('mat_khau', 'asc', CHO_PHEP, MAC_DINH).macDinh).toBe(true)
  })
})

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

describe('antoanChoOr — chốt chặn phá cú pháp .or() của PostgREST', () => {
  it('bỏ ký tự phá cú pháp .or() của PostgREST', () => {
    expect(antoanChoOr('a,b(c)%d')).toBe('a b c d')
  })

  it('gộp khoảng trắng phát sinh sau khi bỏ ký tự, cắt hai đầu', () => {
    expect(antoanChoOr('  a,,b((c))  ')).toBe('a b c')
  })

  it('chuỗi không có ký tự nguy hiểm thì giữ nguyên', () => {
    expect(antoanChoOr('huong')).toBe('huong')
  })

  it('chuỗi rỗng vẫn trả về rỗng', () => {
    expect(antoanChoOr('')).toBe('')
  })
})

describe('mauDauTu — khớp theo đầu từ, hết nhiễu Phương/Thương', () => {
  // Postgres không có trong test nên mô phỏng: \m (mốc đầu từ của Postgres) tương
  // đương \b đứng trước ký tự chữ trong JS. Đủ để chốt Ý ĐỊNH của mẫu regex;
  // hành vi thật trên PostgREST đã đo riêng trên DB (41 dòng -> 20 dòng).
  const khop = (kw: string, ten: string) =>
    new RegExp(mauDauTu(kw).replace(/^\\m/, '\\b'), 'i').test(ten)

  it('sinh đúng mẫu có mốc đầu từ', () => {
    expect(mauDauTu('huong')).toBe('\\mhuong')
  })

  it('ăn tên có ĐÚNG chữ Hương', () => {
    expect(khop('huong', 'nguyen thi huong')).toBe(true)
    expect(khop('huong', 'huong giang')).toBe(true)
    expect(khop('huong', 'vu huong tra my')).toBe(true)
  })

  it('KHÔNG ăn Phương / Phượng / Thương / Thường — 21 dòng sai của cách cũ', () => {
    expect(khop('huong', 'chi minh phuong')).toBe(false)
    expect(khop('huong', 'chi phuong anh')).toBe(false)
    expect(khop('huong', 'chi thuong')).toBe(false)
    expect(khop('huong', 'nguyen hai thuong')).toBe(false)
    expect(khop('huong', 'cong ty co phan dau tu thuong mai va san xuat xanh xanh')).toBe(false)
  })

  it('vẫn gõ được một phần tên — mốc chỉ ràng buộc chỗ bắt đầu', () => {
    expect(khop('le thi', 'chi le thi thu huong - ocean park')).toBe(true)
    expect(khop('huon', 'nguyen thi huong')).toBe(true)     // gõ dở tới đâu lọc tới đó
  })

  it('thoát ký tự regex — gõ "[" phải ra mẫu HỢP LỆ, không làm PostgREST trả 400', () => {
    expect(mauDauTu('a[b')).toBe('\\ma\\[b')
    for (const xau of ['[', 'a(b', 'a+b', 'a|b', 'a.b', 'a\\b', '?', '{2,']) {
      expect(() => new RegExp(mauDauTu(xau).replace(/^\\m/, '\\b'))).not.toThrow()
    }
  })

  it('dấu chấm là chữ THẬT chứ không phải ký tự đại diện', () => {
    expect(khop('a.b', 'axb')).toBe(false)
    expect(khop('a.b', 'a.b')).toBe(true)
  })
})
