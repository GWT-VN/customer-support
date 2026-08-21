/**
 * Gom các cách viết khác nhau của CÙNG một tỉnh về một khoá, để ô lọc theo Tỉnh
 * không tách một tỉnh thành 2-3 mục, mỗi mục thiếu dữ liệu.
 *
 * ⚠️ CHỈ dùng lúc ĐỌC (dựng ô lọc, so khớp truy vấn). **KHÔNG sửa dữ liệu đang lưu** —
 * CEO chốt 21/08/2026: *"Ko đổi 34 tỉnh, cho phép điền cả tỉnh cũ vs mới"*, tức tên cũ
 * lẫn tên mới đều hợp lệ và không chuẩn hoá lúc ghi.
 *
 * Bảng bí danh dưới đây **chép từ dữ liệu THẬT đo ngày 21/08/2026**, không phải đoán.
 * Thêm bí danh mới thì đo lại rồi thêm, đừng bịa.
 */

/** Bỏ dấu + hạ chữ thường + bỏ tiền tố hành chính + gộp khoảng trắng/gạch nối. */
function chuanHoa(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/^(tp\.?|thanh pho|tinh)\s+/, '')
    .replace(/[\s\-.]+/g, ' ')
    .trim()
}

/**
 * Bí danh -> tên hiển thị chuẩn. Khoá đã qua `chuanHoa()`.
 * Số dòng đo được ghi kèm để biết cái nào đáng kể.
 */
const BI_DANH: Record<string, string> = {
  // Viết tắt / thêm tiền tố — 226 + 63 dòng
  'hcm': 'Hồ Chí Minh',
  'ho chi minh': 'Hồ Chí Minh',
  'sai gon': 'Hồ Chí Minh',
  // Gõ nhầm dấu — 2 + 2 + 1 + 1 dòng
  'hue': 'Huế',
  'da nang': 'Đà Nẵng',
  'dac lac': 'Đắk Lắk',
  'dak lak': 'Đắk Lắk',
  'dak nong': 'Đắk Nông',
  // Ghi tên THÀNH PHỐ thay vì tỉnh — 8 + 4 + 1 dòng
  'ha long': 'Quảng Ninh',
  'pleiku': 'Gia Lai',
  'da lat': 'Lâm Đồng',
}

/** Giá trị rác cần tách riêng để người xem biết là dữ liệu hỏng, không phải một tỉnh. */
export const TINH_LOI = '(lỗi dữ liệu)'
const LA_RAC = /^#(ref|n\/a|value|name)!?$/i

/**
 * Tên tỉnh hiển thị sau khi gom. Trả `null` nếu rỗng.
 * Giá trị rác (`#REF!`…) trả về `TINH_LOI` để hiện thành một mục riêng.
 */
export function gomTinh(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  if (LA_RAC.test(s)) return TINH_LOI
  const k = chuanHoa(s)
  if (BI_DANH[k]) return BI_DANH[k]
  // Không có bí danh -> giữ nguyên cách viết của dữ liệu, chỉ gộp các bản chỉ khác
  // dấu/hoa-thường lại với nhau (bản gặp đầu tiên thắng, xem gomDanhSachTinh).
  return s
}

/**
 * Dựng danh sách lựa chọn cho ô lọc Tỉnh từ các giá trị thô trong DB.
 * Gộp mọi biến thể về một mục, sắp theo tiếng Việt, đẩy mục lỗi xuống cuối.
 */
export function gomDanhSachTinh(raws: Array<string | null | undefined>): string[] {
  const theoKhoa = new Map<string, string>()
  for (const r of raws) {
    const ten = gomTinh(r)
    if (!ten) continue
    const k = ten === TINH_LOI ? TINH_LOI : chuanHoa(ten)
    if (!theoKhoa.has(k)) theoKhoa.set(k, ten)
  }
  const ds = [...theoKhoa.values()]
  const loi = ds.filter((t) => t === TINH_LOI)
  return [
    ...ds.filter((t) => t !== TINH_LOI).sort((a, b) => a.localeCompare(b, 'vi')),
    ...loi,
  ]
}

/**
 * Mọi cách viết thô ứng với một tên tỉnh đã gom — để dựng mệnh đề `.in(...)`.
 * Phải truyền vào đúng tập giá trị thô đang có trong DB.
 */
export function cacBienThe(tenDaGom: string, raws: Array<string | null | undefined>): string[] {
  const ra = new Set<string>()
  for (const r of raws) {
    const s = String(r ?? '').trim()
    if (s && gomTinh(s) === tenDaGom) ra.add(s)
  }
  return [...ra]
}
