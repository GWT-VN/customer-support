'use client'
import { NutXuat } from '@/components/NutXuat'
import { xuatLoi } from '@/app/actions'
import { XUAT_LOI_COT, XUAT_LOI_MAC_DINH } from '@/lib/danhSach'

/** Xuất lịch thay lõi đang lọc (admin). */
export function ExportLoiButton({ tt, q, ngtu, ngden }: { tt?: string; q: string; ngtu?: string; ngden?: string }) {
  return <NutXuat cot={XUAT_LOI_COT} macDinh={XUAT_LOI_MAC_DINH} tenFile="lich_loi"
    onXuat={(cot) => xuatLoi(tt, q, cot, ngtu, ngden)} />
}
