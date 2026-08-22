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

/**
 * Mặc định lịch bảo trì theo BỘ MÁY (combo), tính từ ngày kích hoạt:
 *  - WH15A / WH30A            -> 4 lần, mỗi 3 tháng.
 *  - WH15A ECO / WH30A ECO    -> 2 lần, mỗi 3 tháng.
 *  - Khác/không rõ            -> null (để CS tự nhập).
 */
export function macDinhTheoBoMay(boMay: string | null | undefined): { soLan: number; chuKy: number } | null {
  if (!boMay) return null
  const s = boMay.toUpperCase().replace(/\s+/g, '')
  const laCombo = s.includes('WH15A') || s.includes('WH30A')
  if (!laCombo) return null
  return s.includes('ECO') ? { soLan: 2, chuKy: 3 } : { soLan: 4, chuKy: 3 }
}

/**
 * Suy LOẠI MÁY (POU máy uống / POE lọc tổng) từ tên BỘ MÁY của lịch bảo trì.
 *
 * ⚠️ **HIỆN KHÔNG DÙNG — CEO chốt 21/08/2026 KHÔNG suy loại máy từ ô này.** Đừng bật lại mà
 * chưa hỏi. Lý do CEO đưa, đúng và quan trọng: tên bộ máy trong lịch bảo trì (WH15A/WH30A) chỉ
 * nói về **hệ lọc tổng** khách lắp — nó **không cho biết khách có thêm máy lọc nước UỐNG hay
 * không**. Suy ra POE rồi ẩn TDS/pH là **giấu mất chỉ tiêu kỹ thuật cần ghi** ở những khách có
 * cả hai loại máy.
 * ⇒ Chừng nào chưa map được lượt bảo trì tới đúng con máy thì form **hiện đủ 4 chỉ số**.
 *
 * Giữ hàm + test lại vì phép nhận dạng vẫn đúng và sẽ dùng được khi có map máy↔khách; xoá đi
 * thì phiên sau lại phải dò lại từ đầu.
 */
export function loaiMayTheoBoMay(boMay: string | null | undefined): 'POU' | 'POE' | null {
  if (!boMay) return null
  const s = boMay.toUpperCase().replace(/\s+/g, '')
  return s.includes('WH15A') || s.includes('WH30A') ? 'POE' : null
}

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

const iso = (dt: Date) => dt.toISOString().slice(0, 10)

/**
 * Dời tới ngày làm gần nhất nếu rơi vào ngày nghỉ của vùng.
 *
 * `giuThang` = mốc phải Ở LẠI ĐÚNG THÁNG của nó. Dùng cho các lượt SUY RA (lượt 2,
 * 3, 4…), không dùng cho ngày bắt đầu do người nhập chọn.
 *
 * Vì sao cần: cộng 3 tháng vào 30/11 ra 30/02 -> kẹp về 28/02 -> nếu 28/02 là Chủ
 * nhật, dời TỚI sẽ nhảy sang 01/03. Nhìn bảng thấy 30/11 · 01/03 · 31/05 · 30/08:
 * lượt 2 rơi sang THÁNG 3 nên trông như lệch chu kỳ. Khi giữ tháng thì lùi về ngày
 * làm cuối cùng của tháng 2 (26/02) -> các mốc thành T11 · T2 · T5 · T8, đều theo
 * tháng đúng như người dùng mong đợi.
 */
function dichQuaNgayNghi(y: number, m: number, d: number, vung: Vung, giuThang = false): string {
  const goc = new Date(Date.UTC(y, m, d))
  let toi = goc
  while (laNgayNghi(toi.getUTCDay(), vung)) toi = new Date(toi.getTime() + 86400000)
  if (!giuThang || toi.getUTCMonth() === goc.getUTCMonth()) return iso(toi)

  // Dời tới đã nhảy sang tháng khác -> lùi về ngày làm gần nhất TRONG tháng.
  let lui = goc
  while (laNgayNghi(lui.getUTCDay(), vung)) lui = new Date(lui.getTime() - 86400000)
  return iso(lui.getUTCMonth() === goc.getUTCMonth() ? lui : toi)
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
    // i === 0 là ngày người nhập chọn -> chỉ dời TỚI, không được lùi về quá khứ.
    out.push(dichQuaNgayNghi(ay, am, ad, vung, i > 0))
  }
  return out
}
