'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { banHanh, ketThucSom, nhanBan } from './actions'

/** Tháng kế tiếp so với hôm nay, dạng YYYY-MM. Tính theo giờ máy, không dùng UTC. */
function thangSau(): string {
  const d = new Date()
  const t = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`
}

export function CtkmActions({
  id,
  ten,
  trangThai,
  quyen,
}: {
  id: string
  ten: string
  trangThai: string
  quyen: { soan: boolean; duyet: boolean }
}) {
  const router = useRouter()
  const [dangChay, batDau] = useTransition()
  const [loi, setLoi] = useState<string | null>(null)

  function chay(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setLoi(null)
    batDau(async () => {
      const r = await fn()
      if (!r.ok) setLoi(r.error ?? 'Không thực hiện được.')
      else router.refresh()
    })
  }

  const nut = 'rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-300 disabled:opacity-50'

  return (
    <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-2.5">
      {loi && <p className="mb-2 rounded bg-rose-50 px-2 py-1 text-xs text-rose-700">{loi}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {quyen.soan && (
          <Link href={`/sales/ctkm/${id}`} className={nut}>
            {trangThai === 'nhap' ? 'Sửa' : 'Xem chi tiết'}
          </Link>
        )}

        {quyen.soan && (
          <button
            type="button"
            disabled={dangChay}
            className={nut}
            onClick={() => chay(() => nhanBan(id, thangSau()))}
            title={`Chép "${ten}" thành bản nháp cho tháng sau`}
          >
            ⧉ Nhân bản sang tháng sau
          </button>
        )}

        <span className="flex-1" />

        {trangThai === 'nhap' &&
          (quyen.duyet ? (
            <button
              type="button"
              disabled={dangChay}
              className="rounded-md bg-[#0e8c9a] px-3 py-1 text-xs font-semibold text-white hover:bg-[#0a6771] disabled:opacity-50"
              onClick={() => chay(() => banHanh(id))}
            >
              ✓ Ban hành
            </button>
          ) : (
            // Không có quyền duyệt thì nói rõ VÌ SAO không thấy nút, thay vì để trống.
            <span className="text-xs text-slate-500" title="Chỉ người có quyền duyệt mới ban hành được">
              Chờ duyệt
            </span>
          ))}

        {trangThai === 'ban_hanh' && quyen.duyet && (
          <button
            type="button"
            disabled={dangChay}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-rose-300 hover:text-rose-700 disabled:opacity-50"
            onClick={() => chay(() => ketThucSom(id))}
            title="Dừng từ hôm nay. Không xoá — đơn cũ vẫn tra lại được."
          >
            Kết thúc sớm
          </button>
        )}
      </div>
    </div>
  )
}
