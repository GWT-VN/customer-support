'use server'

import { listKhachChoDuyet, listToFix, maintenanceCounts, searchTickets } from '@/app/actions'
import { requireStaff } from '@/lib/nen-tang/phien'
import { coQuyenHienNut } from '@/lib/nen-tang/kiem-quyen'
export type SoLieuTongQuan = {
  /** null = người này không có quyền duyệt khách chờ, nên KHÔNG hiện ô đó. */
  bhChoDuyet: number | null
  ticketMo: number
  baoTriCanLam: number
  canDon: number
}

/**
 * Bốn con số của màn Tổng quan. Gọi lại các hàm đếm sẵn có thay vì viết truy vấn
 * mới — số ở đây phải KHỚP số người dùng thấy khi bấm vào từng trang, lệch số là
 * mất tin ngay.
 *
 * "Bảo trì cần làm" = quá hạn + sắp đến hạn, đúng hai tab đầu của /bao-tri.
 */
export async function soLieuTongQuan(): Promise<SoLieuTongQuan> {
  await requireStaff()
  // Hỏi quyền TRƯỚC rồi mới đọc: listKhachChoDuyet() tự gác bằng cs.khach.duyet_cho
  // và ĐÁ VỀ TRANG CHỦ nếu thiếu. Gọi vô điều kiện là nhân viên thường mở Tổng quan
  // liền bị văng — đã xảy ra THẬT trên production với tài khoản NV CSKH ngay hôm
  // bật ma trận (mục Lệch ghi đúng 2 lần, khớp 2 chỗ gọi trong một lượt vẽ trang).
  const duocDuyet = await coQuyenHienNut('cs.khach.duyet_cho', 'QUANLY')
  const [choDuyet, dem, ticket, canDon] = await Promise.all([
    duocDuyet ? listKhachChoDuyet() : Promise.resolve(null),
    maintenanceCounts(),
    searchTickets('', 'Open', undefined, undefined, { trang: 1 }),
    listToFix('', { trang: 1 }),
  ])
  return {
    bhChoDuyet: choDuyet?.length ?? null,
    ticketMo: ticket.tong,
    baoTriCanLam: (dem['QUÁ HẠN'] ?? 0) + (dem['sắp đến hạn (≤30 ngày)'] ?? 0),
    canDon: canDon.tong,
  }
}
