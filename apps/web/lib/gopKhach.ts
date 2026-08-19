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
