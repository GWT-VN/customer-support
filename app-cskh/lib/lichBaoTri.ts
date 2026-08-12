/**
 * Lên lịch bảo trì — thuần, không phụ thuộc DB (test được).
 *
 * Quy tắc (theo luồng nghiệp vụ):
 *  - Bắt đầu từ NGÀY BẮT ĐẦU (mặc định = ngày lắp, sửa được vì khách 1-2 tháng sau mới ở).
 *  - Mỗi lần cách nhau `chuKyThang` tháng (mặc định 3; 1/2/3/4/6; hoặc null = chỉ 1 lần).
 *  - `tongLan` lượt.
 *  - TRÁNH CUỐI TUẦN theo vùng, rơi vào ngày nghỉ thì DỜI TỚI ngày làm kế tiếp:
 *      · 'bac' (Hà Nội + miền Bắc + Đà Nẵng): nghỉ Thứ 7 + Chủ nhật.
 *      · 'nam' (HCM + Đông Nam Bộ + ĐBSCL): nghỉ Chủ nhật.
 *
 * Ngày thao tác bằng UTC (Date.UTC/getUTCDay) để KHÔNG lệch múi giờ — đầu vào/ra đều
 * là chuỗi 'YYYY-MM-DD'.
 */

export type Vung = 'bac' | 'nam'

/** Bỏ dấu + thường hoá để so tên tỉnh. */
function boDau(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim()
}

/** Tỉnh/TP thuộc vùng 'nam' (chỉ nghỉ CN). Còn lại (gồm miền Bắc + Đà Nẵng) là 'bac'. */
const TINH_NAM = new Set([
  'ho chi minh', 'tp ho chi minh', 'tphcm', 'hcm', 'sai gon',
  'binh duong', 'dong nai', 'long an', 'tay ninh', 'ba ria vung tau', 'vung tau', 'binh phuoc',
  'tien giang', 'ben tre', 'vinh long', 'tra vinh', 'can tho', 'hau giang', 'soc trang',
  'bac lieu', 'ca mau', 'an giang', 'kien giang', 'dong thap',
].map(boDau))

/** Suy vùng từ tỉnh của khách. Mặc định 'bac' (nghiêm hơn) khi trống/không rõ; cho ghi đè tay. */
export function vungTheoTinh(province: string | null | undefined): Vung {
  if (!province) return 'bac'
  const p = boDau(province)
  for (const nam of TINH_NAM) if (p.includes(nam)) return 'nam'
  return 'bac'
}

/** Cộng `n` tháng vào ngày, giữ ngày trong tháng (kẹp về cuối tháng nếu tràn). */
function themThang(y: number, m: number, d: number, n: number): [number, number, number] {
  const tong = m + n
  const ny = y + Math.floor(tong / 12)
  const nm = ((tong % 12) + 12) % 12
  const cuoiThang = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  return [ny, nm, Math.min(d, cuoiThang)]
}

function laNgayNghi(day: number, vung: Vung): boolean {
  // getUTCDay: 0=CN, 6=T7
  if (day === 0) return true
  if (vung === 'bac' && day === 6) return true
  return false
}

/** Dời tới ngày làm kế tiếp nếu rơi vào ngày nghỉ của vùng. */
function dichQuaNgayNghi(y: number, m: number, d: number, vung: Vung): string {
  let dt = new Date(Date.UTC(y, m, d))
  while (laNgayNghi(dt.getUTCDay(), vung)) {
    dt = new Date(dt.getTime() + 86400000)
  }
  return dt.toISOString().slice(0, 10)
}

/**
 * Sinh danh sách ngày bảo trì. `chuKyThang` null/0 -> chỉ 1 lượt (ngày bắt đầu).
 * Trả mảng 'YYYY-MM-DD' đã dời khỏi ngày nghỉ.
 */
export function sinhLichBaoTri(
  ngayBatDau: string, chuKyThang: number | null, tongLan: number, vung: Vung
): string[] {
  const m0 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ngayBatDau)
  if (!m0) return []
  const y = +m0[1], mo = +m0[2] - 1, d = +m0[3]
  const soLan = Math.max(1, Math.floor(tongLan) || 1)
  const buoc = chuKyThang && chuKyThang > 0 ? chuKyThang : 0
  const out: string[] = []
  for (let i = 0; i < soLan; i++) {
    if (buoc === 0 && i > 0) break  // "chỉ 1 lần"
    const [ay, am, ad] = themThang(y, mo, d, i * buoc)
    out.push(dichQuaNgayNghi(ay, am, ad, vung))
  }
  return out
}
