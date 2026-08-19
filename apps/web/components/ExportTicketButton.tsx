'use client'

import { NutXuat } from '@/components/NutXuat'
import { xuatTicket } from '@/app/actions'
import { XUAT_TICKET_COT, XUAT_TICKET_MAC_DINH } from '@/lib/danhSach'

/** Xuất ticket đang lọc — dùng NutXuat chung (dropdown chọn trường). Chỉ admin (server chặn). */
export function ExportTicketButton(
  { q, state, khan, mine, ngtu, ngden }: { q: string; state?: string; khan?: boolean; mine?: boolean; ngtu?: string; ngden?: string }
) {
  return (
    <NutXuat
      cot={XUAT_TICKET_COT}
      macDinh={XUAT_TICKET_MAC_DINH}
      tenFile="ticket"
      onXuat={(cot) => xuatTicket(q, state, khan ?? false, mine ?? false, cot, ngtu, ngden)}
    />
  )
}
