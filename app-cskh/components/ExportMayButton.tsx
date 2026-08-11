'use client'
import { NutXuat } from '@/components/NutXuat'
import { xuatMay } from '@/app/actions'
import { XUAT_MAY_COT, XUAT_MAY_MAC_DINH } from '@/lib/danhSach'

/** Xuất danh sách máy đã lắp đang lọc (admin). */
export function ExportMayButton({ q, sp, bh }: { q: string; sp?: string; bh?: string }) {
  return <NutXuat cot={XUAT_MAY_COT} macDinh={XUAT_MAY_MAC_DINH} tenFile="may"
    onXuat={(cot) => xuatMay(q, sp, bh, cot)} />
}
