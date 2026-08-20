/**
 * Hằng số phân trang + whitelist cột sắp xếp — dùng chung cho các hàm liệt kê
 * trong app/actions.ts.
 *
 * Tách riêng khỏi actions.ts (thay vì export thẳng như bản nháp ban đầu) vì
 * actions.ts có 'use server': Next 16 CHỈ cho phép export async function ở
 * file dạng này — export const giá trị thường (số, mảng…) làm build vỡ ngay
 * ("Only async functions are allowed to be exported in a 'use server' file").
 * Type (KetQuaTrang, TuyChonDanhSach) không bị luật này chặn vì bị xoá lúc
 * biên dịch, nên vẫn khai báo/export thẳng trong actions.ts như cũ.
 */

/** Số dòng mỗi trang — dùng chung cho mọi danh sách có phân trang. */
export const MOI_TRANG = 50

/**
 * Lịch thay lõi (/loi, coreForecast) — bản trước Task 3 dùng .limit(100), không phải 50.
 * Giữ riêng 100 cho hàm này để không "tụt" xuống còn 50 trước khi Task 4 dựng xong nút
 * chuyển trang (nếu dùng chung MOI_TRANG=50, 50 dòng đang xem được ở bản cũ sẽ tạm thời
 * không click tới được).
 */
export const MOI_TRANG_LOI = 100

/**
 * Trần cứng cho "chọn tất cả khớp bộ lọc".
 *
 * Bảng lớn nhất hiện nay mới 472 dòng nên trần này chưa bao giờ chạm tới. Nó ở
 * đây để một ngày dữ liệu phình lên thì giao diện KHÔNG lặng lẽ chọn 50.000 dòng
 * rồi đẩy hết vào một Server Action. Chạm trần thì phải nói ra, không cắt lén.
 */
export const TOI_DA_CHON = 2000

/** Cột được phép sắp xếp — ngoài danh sách này bị bỏ qua (chống injection). */
export const COT_MAY = ['install_date', 'serial', 'customer_name', 'product_name', 'warranty_full_end'] as const
export const COT_TICKET = ['created_at', 'ticket_code', 'state', 'customer_name'] as const
export const COT_LOI = ['han_som', 'serial', 'customer_name'] as const
export const COT_KHACH = ['full_name', 'province'] as const

/**
 * Cột có thể XUẤT của bảng khách — cho ô chọn trường export. `pii=true` (SĐT/địa chỉ)
 * thì bản có cột đó cần admin duyệt (CS gửi yêu cầu). Dùng chung server + client.
 */
export const XUAT_KHACH_COT: readonly { key: string; nhan: string; pii: boolean }[] = [
  { key: 'full_name', nhan: 'Tên', pii: false },
  { key: 'primary_phone', nhan: 'SĐT', pii: true },
  { key: 'address', nhan: 'Địa chỉ', pii: true },
  { key: 'province', nhan: 'Tỉnh/TP', pii: false },
  { key: 'customer_code', nhan: 'Mã KH', pii: false },
  { key: 'source', nhan: 'Nguồn', pii: false },
  { key: 'created_at', nhan: 'Ngày tạo', pii: false },
]
/** Trường bật sẵn khi mở ô chọn export. */
export const XUAT_KHACH_MAC_DINH = ['full_name', 'primary_phone', 'province']

/** Cột xuất của bảng TICKET (export chỉ admin nên không gate PII riêng). */
export const XUAT_TICKET_COT: readonly { key: string; nhan: string; pii?: boolean }[] = [
  { key: 'ticket_code', nhan: 'Mã' },
  { key: 'created_at', nhan: 'Ngày' },
  { key: 'state', nhan: 'Trạng thái' },
  { key: 'khan', nhan: 'Khẩn' },
  { key: 'ticket_type', nhan: 'Loại' },
  { key: 'customer_name', nhan: 'Khách' },
  { key: 'primary_phone', nhan: 'SĐT' },
  { key: 'serial', nhan: 'Serial' },
  { key: 'product_name', nhan: 'Máy' },
  { key: 'cs_ten', nhan: 'CS' },
  { key: 'ky_thuat_ten', nhan: 'Kỹ thuật' },
  { key: 'description', nhan: 'Mô tả' },
]
export const XUAT_TICKET_MAC_DINH = ['ticket_code', 'created_at', 'state', 'ticket_type', 'customer_name', 'serial', 'product_name']

/** Trường CẬP NHẬT HÀNG LOẠT (dùng chung client + server). enum -> dropdown; text/date -> nhập. */
export type CotSuaHL = {
  key: string; nhan: string; kieu: 'text' | 'enum' | 'date'; chonLua?: { gt: string; nhan: string }[]
}
export const SUA_HL_KHACH: readonly CotSuaHL[] = [
  { key: 'province', nhan: 'Tỉnh/TP', kieu: 'text' },
  { key: 'address', nhan: 'Địa chỉ', kieu: 'text' },
  { key: 'notes', nhan: 'Ghi chú', kieu: 'text' },
  { key: 'source', nhan: 'Nguồn', kieu: 'text' },
  { key: 'trang_thai', nhan: 'Trạng thái', kieu: 'enum', chonLua: [
    { gt: 'da_duyet', nhan: 'Đã duyệt' }, { gt: 'cho_duyet', nhan: 'Chờ duyệt' },
  ] },
]
/** Bảng nào cho sửa hàng loạt trường nào — server whitelist theo đây. */
export const SUA_HL_BANG: Record<string, readonly CotSuaHL[]> = {
  cs_customers: SUA_HL_KHACH,
}

/** Cột xuất — Máy đã lắp (export admin-only). */
export const XUAT_MAY_COT: readonly { key: string; nhan: string; pii?: boolean }[] = [
  { key: 'serial', nhan: 'Serial' },
  { key: 'product_name', nhan: 'Máy' },
  { key: 'internal_code', nhan: 'Mã nội bộ' },
  { key: 'customer_name', nhan: 'Khách' },
  { key: 'primary_phone', nhan: 'SĐT' },
  { key: 'install_date', nhan: 'Ngày bắt đầu BH' },
  { key: 'status', nhan: 'Trạng thái' },
  { key: 'warranty_full_end', nhan: 'Hết BH máy' },
  { key: 'warranty_core_end', nhan: 'Hết BH lõi' },
]
export const XUAT_MAY_MAC_DINH = ['serial', 'product_name', 'customer_name', 'primary_phone', 'install_date', 'warranty_full_end']

/** Cột xuất — Lịch bảo trì. */
export const XUAT_BAOTRI_COT: readonly { key: string; nhan: string; pii?: boolean }[] = [
  { key: 'customer_name', nhan: 'Khách' },
  { key: 'section', nhan: 'Công trình' },
  { key: 'bo_may', nhan: 'Bộ máy' },
  { key: 'loai_goi', nhan: 'Gói' },
  { key: 'lan_thu', nhan: 'Lần' },
  { key: 'tong_lan', nhan: 'Tổng lần' },
  { key: 'due_date', nhan: 'Đến hạn' },
  { key: 'completed_at', nhan: 'Đã xong' },
  { key: 'tinh_trang', nhan: 'Tình trạng' },
]
export const XUAT_BAOTRI_MAC_DINH = ['customer_name', 'bo_may', 'lan_thu', 'due_date', 'tinh_trang']

/** Cột xuất — Lịch thay lõi. */
export const XUAT_LOI_COT: readonly { key: string; nhan: string; pii?: boolean }[] = [
  { key: 'serial', nhan: 'Serial' },
  { key: 'product_name', nhan: 'Máy' },
  { key: 'customer_name', nhan: 'Khách' },
  { key: 'primary_phone', nhan: 'SĐT' },
  { key: 'filter_code', nhan: 'Mã lõi' },
  { key: 'filter_name', nhan: 'Lõi' },
  { key: 'chu_ky_raw', nhan: 'Chu kỳ' },
  { key: 'han_som', nhan: 'Đến hạn' },
  { key: 'tinh_trang', nhan: 'Tình trạng' },
  { key: 'lan_thay_gan_nhat', nhan: 'Thay gần nhất' },
]
export const XUAT_LOI_MAC_DINH = ['serial', 'customer_name', 'filter_code', 'han_som', 'tinh_trang']
export const COT_BAO_TRI = ['due_date', 'customer_name'] as const

/**
 * Nhãn cột + NGHĨA của từng chiều sắp xếp, để hiện thành câu tiếng Việt ở
 * ChipSapXep thay vì chỉ một mũi tên ▲/▼.
 *
 * Vì sao cần: mũi tên KHÔNG nói được điều người dùng cần biết. ▲ trên cột ngày
 * là "cũ nhất trước" hay "mới nhất trước"? Trên cột hạn là "sắp hết hạn trước"
 * hay "còn lâu nhất trước"? Phải đoán, và đoán sai thì đọc nhầm cả bảng.
 *
 * Khoá là TÊN CỘT THẬT trong DB (khớp COT_* ở trên) — thiếu cột nào thì
 * chipSapXep() rơi về câu chung chung "tăng dần/giảm dần", không vỡ.
 */
export const TEN_COT: Record<string, string> = {
  install_date: 'Ngày lắp',
  serial: 'Serial',
  customer_name: 'Tên khách',
  full_name: 'Tên khách',
  product_name: 'Tên máy',
  warranty_full_end: 'Hạn bảo hành',
  created_at: 'Ngày tạo',
  ticket_code: 'Mã ticket',
  state: 'Trạng thái',
  han_som: 'Hạn thay lõi',
  due_date: 'Hạn bảo trì',
  province: 'Tỉnh/TP',
}

/**
 * Rút tên sản phẩm dài về đúng MÃ MÁY cho ô chọn lọc:
 *   "Máy lọc nước GE GN610"                        -> "GN610"
 *   "Thiết bị làm mềm nước trung tâm GE GTEC-15A01-G" -> "GTEC-15A01-G"
 *   "Máy lọc nước GE CTS10 (màu trắng)"            -> "CTS10 (màu trắng)"
 *
 * ⚠️ KHÔNG dùng internal_code làm nhãn, dù nghe có vẻ đúng hơn. internal_code là
 * mã NHÀ MÁY, lệch hẳn với mã CS đang gọi hằng ngày (đối chiếu trên DB thật
 * 2026-07-29): GN610 = GPUN-4000XEN-G, DN810 = GTUN-8500XDS-G,
 * USH10 = GTUN-8600HP-G, B04 = GEUT-50B04-G. Hiện mã nhà máy trong ô lọc là
 * nhân viên không nhận ra máy của mình.
 *
 * Cách cắt: mọi tên đều có dạng "<loại sản phẩm> GE <mã>" — lấy phần sau " GE "
 * cuối cùng. Tên không theo khuôn thì giữ NGUYÊN VĂN, thà dài còn hơn cắt bậy.
 */
export function tenModel(tenDayDu: string | null, maNoiBo: string): string {
  if (!tenDayDu) return maNoiBo
  const i = tenDayDu.lastIndexOf(' GE ')
  if (i === -1) return tenDayDu
  const duoi = tenDayDu.slice(i + 4).trim()
  return duoi || tenDayDu
}

/**
 * Mã combo hệ thống lọc tổng (đợt đầu chỉ WH15A/WH30A). Một "bộ" = 1 dòng MẸ
 * internal_code = combo, các thiết bị là con (parent_serial trỏ về mẹ). BH kích
 * hoạt ở TỪNG con; mẹ chỉ là dòng nhóm → badge hiện "Bộ" thay vì "Chưa kích hoạt".
 */
/** Trạng thái sử dụng của 1 serial (vòng đời máy). */
export const NHAN_TRANG_THAI_SERIAL: Record<string, string> = {
  ton_kho: 'Tồn kho', da_lap: 'Đã lắp (khách)', trung_bay: 'Trưng bày',
  mkt: 'Marketing / Quay phim', kiem_dinh_nuoc: 'Kiểm định nước', lap_test: 'Lắp test thử',
  bao_tri: 'Thu hồi bảo trì', thanh_ly: 'Thanh lý',
}
/** Các trạng thái KHO có thể đặt tay cho máy chưa gắn khách (không gồm da_lap).
 *  DÙNG LÀM DỰ PHÒNG — nguồn chính giờ là bảng cấu hình serial_trang_thai (dsTrangThai). */
export const TRANG_THAI_KHO_DAT_TAY =
  ['ton_kho', 'trung_bay', 'mkt', 'kiem_dinh_nuoc', 'lap_test', 'bao_tri', 'thanh_ly'] as const

/** Token màu (cấu hình trong serial_trang_thai.mau) -> class badge. Liệt kê literal để
 *  Tailwind JIT quét được. Thêm token mới thì thêm cả ở đây. */
export const MAU_TRANG_THAI: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-600', emerald: 'bg-emerald-100 text-emerald-800',
  sky: 'bg-sky-100 text-sky-800', violet: 'bg-violet-100 text-violet-800',
  cyan: 'bg-cyan-100 text-cyan-800', indigo: 'bg-indigo-100 text-indigo-800',
  amber: 'bg-amber-100 text-amber-800', orange: 'bg-orange-100 text-orange-800',
  red: 'bg-red-100 text-red-700', teal: 'bg-teal-100 text-teal-800', rose: 'bg-rose-100 text-rose-700',
}
export const MAU_TOKENS = ['slate', 'emerald', 'sky', 'violet', 'cyan', 'indigo', 'amber', 'orange', 'red', 'teal', 'rose'] as const

/** Loại việc của lịch kỹ thuật (1 chuyến có thể nhiều việc). "khac" bắt buộc ghi cụ thể. */
export const LOAI_VIEC_KT: { v: string; nhan: string }[] = [
  { v: 'lap_may', nhan: 'Lắp máy' }, { v: 'bao_tri', nhan: 'Bảo trì' },
  { v: 'ticket', nhan: 'Xử lý ticket' }, { v: 'thay_loi', nhan: 'Thay lõi' },
  { v: 'khao_sat', nhan: 'Khảo sát' }, { v: 'thu_tien', nhan: 'Cần thu tiền' },
  { v: 'khac', nhan: 'Khác' },
]
export const NHAN_LOAI_VIEC: Record<string, string> = Object.fromEntries(LOAI_VIEC_KT.map((x) => [x.v, x.nhan]))

export const MA_COMBO = ['WH15A', 'WH30A', 'WH15AECO', 'WH30AECO'] as const
export type MaCombo = (typeof MA_COMBO)[number]
export function laMaBo(internalCode: string | null | undefined): boolean {
  return !!internalCode && (MA_COMBO as readonly string[]).includes(internalCode)
}

/**
 * Lọc theo ngày dùng CHUNG cho các bảng có trường ngày (install_date, due_date,
 * han_som, created_at…). Hai tham số URL `ngtu`/`ngden` suy ra 4 chế độ, KHÔNG cần
 * param mode: đúng ngày (tu==den) · khoảng (tu..den) · trước (chỉ den) · sau (chỉ tu).
 * Chỉ nhận YYYY-MM-DD; giá trị lạ bị bỏ (tránh .gte() sai).
 */
export function docLocNgay(sp: { ngtu?: string; ngden?: string }): { tu: string | null; den: string | null } {
  const ok = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null)
  return { tu: ok(sp.ngtu), den: ok(sp.ngden) }
}

/** Chuẩn hoá 1 ô ngày nhập kho về ISO YYYY-MM-DD. Nhận YYYY-MM-DD, DD/MM/YYYY,
 *  DD-MM-YYYY (kể cả năm 2 số). Không hợp lệ -> null (giữ serial, chỉ bỏ ngày). */
export function chuanNgayNhap(s: string | null | undefined): string | null {
  const t = (s ?? '').trim()
  if (!t) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (!m) return null
  const [, d, mo, yRaw] = m
  const y = yRaw.length === 2 ? '20' + yRaw : yRaw
  const dd = d.padStart(2, '0'), mm = mo.padStart(2, '0')
  if (+mm < 1 || +mm > 12 || +dd < 1 || +dd > 31) return null
  return `${y}-${mm}-${dd}`
}

export type DongNhapSerial = { serial: string; po: string | null; ngay: string | null }

/**
 * Phân tích bảng serial dán từ Excel: mỗi dòng `Serial [TAB/phẩy PO [TAB/phẩy Ngày]]`.
 * Cột 1 = serial (bắt buộc), cột 2 = PO, cột 3 = ngày nhập (chuẩn hoá ISO). Bỏ dòng
 * trống + dòng tiêu đề (ô đầu chứa "serial"). Thuần — test được, không đụng DB/React.
 */
export function phanTichBangSerial(text: string): DongNhapSerial[] {
  const ra: DongNhapSerial[] = []
  for (const raw of (text ?? '').split(/\r?\n/)) {
    if (!raw.trim()) continue
    const cells = raw.split(/\t|,|;/).map((c) => c.trim())
    const serial = cells[0]
    if (!serial) continue
    if (/serial/i.test(serial) && ra.length === 0) continue   // bỏ dòng tiêu đề
    ra.push({ serial, po: cells[1] || null, ngay: chuanNgayNhap(cells[2]) })
  }
  return ra
}

/** Mô tả điều kiện lọc ngày để hiện chip (vd "Ngày = 01/08/2026", "Từ …", "Đến …"). */
export function moTaLocNgay(tu: string | null, den: string | null, nhan = 'Ngày'): string | null {
  const vn = (d: string) => d.split('-').reverse().join('/')
  if (tu && den) return tu === den ? `${nhan} = ${vn(tu)}` : `${nhan}: ${vn(tu)} → ${vn(den)}`
  if (tu) return `${nhan}: từ ${vn(tu)}`
  if (den) return `${nhan}: đến ${vn(den)}`
  return null
}

export const NGHIA_SAP_XEP: Record<string, { asc: string; desc: string }> = {
  // Ngày tháng — nói rõ đầu nào lên trước, đây là chỗ mũi tên gây hiểu lầm nhất
  install_date: { asc: 'lắp lâu nhất trước', desc: 'lắp gần đây nhất trước' },
  created_at: { asc: 'cũ nhất trước', desc: 'mới nhất trước' },
  // Hạn — "tăng dần" nghĩa là gấp nhất lên đầu, phải nói bằng lời
  han_som: { asc: 'quá hạn lâu nhất trước', desc: 'còn nhiều thời gian nhất trước' },
  due_date: { asc: 'đến hạn sớm nhất trước', desc: 'đến hạn muộn nhất trước' },
  warranty_full_end: { asc: 'hết bảo hành sớm nhất trước', desc: 'hết bảo hành muộn nhất trước' },
  // Chữ
  customer_name: { asc: 'A → Z', desc: 'Z → A' },
  full_name: { asc: 'A → Z', desc: 'Z → A' },
  product_name: { asc: 'A → Z', desc: 'Z → A' },
  province: { asc: 'A → Z', desc: 'Z → A' },
  serial: { asc: 'A → Z', desc: 'Z → A' },
  ticket_code: { asc: 'mã cũ nhất trước', desc: 'mã mới nhất trước' },
  // state lưu chữ tiếng Anh (Cancel/Done/Open) nên thứ tự chữ cái ra kết quả
  // trông vô nghĩa trên màn hình — bắt buộc phải viết ra đủ 3 nhãn tiếng Việt.
  state: { asc: 'Đã huỷ → Đã xong → Đang mở', desc: 'Đang mở → Đã xong → Đã huỷ' },
}

/**
 * 4 trạng thái bảo hành cho bộ lọc ở trang "/". PHẢI khớp Y HỆT logic phân
 * loại ở components/Badge.tsx (WarrantyBadge) — cố tình KHÔNG có nhánh
 * "không rõ hạn" (co_chinh_sach_bh=false) trong 4 lựa chọn này, đúng theo
 * yêu cầu chỉ lọc 4 trạng thái. Lệch khỏi WarrantyBadge thì lọc "còn hạn"
 * lại ra dòng badge đỏ, mất lòng tin ngay.
 */
export const TINH_TRANG_BH = ['chua_kich_hoat', 'con_han_may', 'het_may_con_loi', 'het_ca_hai'] as const
export type TinhTrangBH = (typeof TINH_TRANG_BH)[number]

export const NHAN_TINH_TRANG_BH: Record<TinhTrangBH, string> = {
  chua_kich_hoat: 'Chưa kích hoạt',
  con_han_may: 'Còn hạn máy',
  het_may_con_loi: 'Hết hạn máy, còn lõi',
  het_ca_hai: 'Hết cả hai',
}

/**
 * Ngày lắp đáng tin tới đâu (migration 47).
 *
 * Nhiều khách chỉ liên hệ khi máy hỏng, hỏi ngày lắp thì người nhớ người không.
 * Trước đây ngày đoán và ngày thật nằm lẫn nhau trong cùng một cột `install_date`,
 * nhìn vào không phân biệt được — mà hạn bảo hành lại suy ra từ đúng cột đó, nên CS
 * đọc hạn rồi báo chắc nịch cho khách trong khi mốc gốc chỉ là phỏng đoán.
 *
 * Cố ý KHÔNG cho `install_date` null: bảo hành, lịch bảo trì, lịch thay lõi đều tính
 * từ nó. Vẫn điền ngày đoán tốt nhất, chỉ đánh dấu rõ là đoán.
 */
export const DO_CHAC_NGAY_LAP = ['chinh_xac', 'uoc_luong', 'khong_ro'] as const
export type DoChacNgayLap = (typeof DO_CHAC_NGAY_LAP)[number]

export const NHAN_DO_CHAC: Record<DoChacNgayLap, string> = {
  chinh_xac: 'Khách nhớ chính xác',
  uoc_luong: 'Khách áng chừng',
  khong_ro: 'Khách không nhớ',
}

/**
 * Giá trị lạ (client cũ, gõ tay, dữ liệu bẩn) rơi về 'chinh_xac' thay vì ném lỗi —
 * ràng buộc CHECK ở DB chỉ nhận 3 giá trị, để lọt là cả lần kích hoạt BH đổ.
 */
export function doChacHopLe(v: string | null | undefined): DoChacNgayLap {
  return (DO_CHAC_NGAY_LAP as readonly string[]).includes(v ?? '')
    ? (v as DoChacNgayLap)
    : 'chinh_xac'
}
