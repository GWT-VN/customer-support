'use client'
import { NutXuat } from '@/components/NutXuat'
import { xuatBaoTri } from '@/app/actions'
import { XUAT_BAOTRI_COT, XUAT_BAOTRI_MAC_DINH } from '@/lib/danhSach'

/** Xuất lịch bảo trì đang lọc (admin). */
export function ExportBaoTriButton({ tt, q, ngtu, ngden }: { tt?: string; q: string; ngtu?: string; ngden?: string }) {
  return <NutXuat cot={XUAT_BAOTRI_COT} macDinh={XUAT_BAOTRI_MAC_DINH} tenFile="bao_tri"
    onXuat={(cot) => xuatBaoTri(tt, q, cot, ngtu, ngden)} />
}
