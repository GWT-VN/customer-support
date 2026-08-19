'use client'

import { NutXuat } from '@/components/NutXuat'
import { xuatKhach, taiExportDaDuyet, type YeuCauExport } from '@/app/actions'
import { XUAT_KHACH_COT, XUAT_KHACH_MAC_DINH } from '@/lib/danhSach'

/** Xuất danh sách khách — dùng NutXuat chung (dropdown chọn trường + gate PII). */
export function ExportKhachButton({ q, daDuyet }: { q: string; daDuyet: YeuCauExport[] }) {
  return (
    <NutXuat
      cot={XUAT_KHACH_COT}
      macDinh={XUAT_KHACH_MAC_DINH}
      tenFile="khach"
      onXuat={(cot) => xuatKhach(q, cot)}
      daDuyet={daDuyet.map((y) => ({ id: y.id, nhan: y.tieu_chi?.q ? `(lọc “${String(y.tieu_chi.q)}”)` : '' }))}
      onTai={taiExportDaDuyet}
    />
  )
}
