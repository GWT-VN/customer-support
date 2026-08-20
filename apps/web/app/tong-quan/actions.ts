'use server'

import { listKhachChoDuyet, listToFix, maintenanceCounts, searchTickets } from '@/app/actions'
import { requireStaff } from '@/lib/supabase'

export type SoLieuTongQuan = {
  bhChoDuyet: number
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
  const [choDuyet, dem, ticket, canDon] = await Promise.all([
    listKhachChoDuyet(),
    maintenanceCounts(),
    searchTickets('', 'Open', undefined, undefined, { trang: 1 }),
    listToFix('', { trang: 1 }),
  ])
  return {
    bhChoDuyet: choDuyet.length,
    ticketMo: ticket.tong,
    baoTriCanLam: (dem['QUÁ HẠN'] ?? 0) + (dem['sắp đến hạn (≤30 ngày)'] ?? 0),
    canDon: canDon.tong,
  }
}
