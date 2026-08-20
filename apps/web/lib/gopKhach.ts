/**
 * Luật gộp khách — HÀM THUẦN, không đụng DB, để test được.
 *
 * Phép gộp thật nằm trong RPC `gop_khach` (migration 46). Ở đây chỉ lo hai việc
 * mà con người dễ làm sai: chọn nhầm chiều gộp (giữ bản nghèo, bỏ bản giàu) và
 * không hình dung được mình sắp làm gì trước khi bấm.
 */
export type KhachGon = {
  id: string; full_name: string; primary_phone: string | null; address: string | null
  so_may: number; so_ticket: number; so_plan: number
}

const tongDuLieu = (k: KhachGon) => k.so_may + k.so_ticket + k.so_plan

/** Chặn các ca gộp chắc chắn sai TRƯỚC khi vào hàng chờ duyệt. */
export function kiemTraGop(giu: KhachGon, gop: KhachGon): { ok: true } | { ok: false; lyDo: string } {
  if (giu.id === gop.id) return { ok: false, lyDo: 'Không thể gộp một khách với chính nó.' }
  if (tongDuLieu(gop) > tongDuLieu(giu)) {
    return {
      ok: false,
      lyDo: `Bản bị gộp (${gop.full_name}) đang có nhiều dữ liệu hơn bản giữ lại — đảo chiều gộp cho đúng.`,
    }
  }
  return { ok: true }
}

/** Câu mô tả cho người duyệt đọc: chuyển gì đi, lấp thêm gì. */
export function moTaGop(giu: KhachGon, gop: KhachGon): string {
  const chuyen: string[] = []
  if (gop.so_may) chuyen.push(`${gop.so_may} máy`)
  if (gop.so_ticket) chuyen.push(`${gop.so_ticket} ticket`)
  if (gop.so_plan) chuyen.push(`${gop.so_plan} lịch bảo trì`)

  const lapThem: string[] = []
  if (!giu.primary_phone && gop.primary_phone) lapThem.push('SĐT')
  if (!giu.address && gop.address) lapThem.push('địa chỉ')

  const ve = chuyen.length ? `chuyển ${chuyen.join(', ')}` : 'không có máy/ticket/lịch nào phải chuyển'
  const them = lapThem.length ? `, lấp thêm ${lapThem.join(' + ')}` : ''
  return `Gộp "${gop.full_name}" vào "${giu.full_name}": ${ve}${them}. Thông tin còn lại của bản bị gộp được ghi vào ghi chú.`
}

// ─────────────────────────────────────────────────────────────────────────────
// So sánh 2 hồ sơ trước khi gộp (màn /khach/gop)
//
// Vì sao cần: bản đầu chỉ hiện TÊN + SĐT. Rất nhiều khách không có SĐT nên CS
// không có gì để phân biệt "Anh Ánh" này với "Anh Ánh" kia — phải mở từng hồ sơ
// ra xem rồi nhớ trong đầu. Gộp nhầm thì một hồ sơ bị ẩn đi.
// ─────────────────────────────────────────────────────────────────────────────

/** Hồ sơ khách đủ trường để CS nhìn là biết có đúng người không. */
export type KhachDayDu = KhachGon & {
  province: string | null
  customer_code: string | null
  /** Khoá thật của kênh — cần để dựng payload gộp; `ten_kenh` chỉ để hiển thị. */
  channel_id: number | null
  ten_kenh: string | null
  source: string | null
  partner_ref: string | null
  notes: string | null
  ten_cty: string | null
  mst: string | null
  dia_chi_cty: string | null
  sdt_cty: string | null
  email_cty: string | null
  so_lien_he: number
  created_at: string | null
}

/**
 * Hồ sơ này ĐANG CÓ những gì — để chọn giữ bên nào.
 *
 * Cố ý KHÔNG gọi là "nguồn". CEO chỉ ra bản đầu đặt tên sai: nhãn "Bảo trì" nghe
 * như hồ sơ đến từ khu bảo trì, trong khi lịch bảo trì chưa map không phải hồ sơ
 * khách — nó chỉ là dòng `maintenance_plan` có tên + SĐT lấy từ Asana. Khách Sales
 * cũng không phải hồ sơ riêng: Sales có bảng `customers` riêng, nối vào đây bằng
 * `customer_code`. Nên đây là câu trả lời cho "hồ sơ này đang gánh gì", không phải
 * "đến từ đâu".
 *
 * Cũng KHÔNG đọc cột `source` — cột đó là chữ tự do người nhập gõ, không tin được.
 */
export function dangCo(k: KhachDayDu): string[] {
  const ra: string[] = []
  if (k.so_may > 0) ra.push('Máy (CS)')
  if (k.customer_code) ra.push('Đơn Sales')
  if (k.so_plan > 0) ra.push('Lịch bảo trì')
  if (k.so_ticket > 0) ra.push('Ticket')
  return ra.length ? ra : ['Chưa có dữ liệu']
}
