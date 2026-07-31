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
