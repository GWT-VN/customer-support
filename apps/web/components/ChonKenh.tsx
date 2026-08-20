'use client'

import { useMemo } from 'react'
import type { Kenh } from '@/app/actions'

/**
 * Chọn kênh/đối tác bằng HAI ô phụ thuộc nhau, thay cho một danh sách phẳng 26 mục.
 *
 * CEO 20/08/2026: "tách 2 ô được ko, nếu key cấp 2 thì tự điền cấp 1 tương ứng,
 * nếu key cấp 1 thì chỉ cho chọn cấp 2 tương ứng".
 *
 * Cố ý KHÔNG cho gõ tự do: `dim_channel` là danh mục của Sales, cả hai module đọc
 * chung. Cho gõ tay là mỗi người đẻ một cách viết ("Đại lý CWS" / "CWS" / "cws"),
 * hỏng luôn việc gom doanh số theo kênh. Ô `<select>` gõ chữ vẫn nhảy tới đúng
 * mục, nên vẫn nhanh như gõ.
 */
export function ChonKenh({
  kenh, value, onChange,
}: {
  kenh: Kenh[]
  /** id trong dim_channel, rỗng = không qua kênh nào */
  value: string
  onChange: (id: string) => void
}) {
  const dangChon = useMemo(() => kenh.find((k) => String(k.id) === value) ?? null, [kenh, value])

  const capMot = useMemo(
    () => [...new Set(kenh.map((k) => k.channel_l1).filter(Boolean))].sort(),
    [kenh],
  )
  const capHai = useMemo(
    () => (dangChon ? kenh.filter((k) => k.channel_l1 === dangChon.channel_l1) : []),
    [kenh, dangChon],
  )

  /** Đổi cấp 1: nhảy sang mục ĐẦU TIÊN của cấp 1 đó, để không bao giờ có trạng thái nửa vời. */
  function datCapMot(l1: string) {
    if (!l1) { onChange(''); return }
    const dau = kenh.find((k) => k.channel_l1 === l1)
    onChange(dau ? String(dau.id) : '')
  }

  const oChu = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900'

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="text-sm text-slate-700">Kênh — cấp 1</span>
        <select value={dangChon?.channel_l1 ?? ''} onChange={(e) => datCapMot(e.target.value)} className={oChu}>
          <option value="">— Không qua kênh nào —</option>
          {capMot.map((l1) => <option key={l1} value={l1}>{l1}</option>)}
        </select>
      </label>

      <label className="block">
        <span className="text-sm text-slate-700">Kênh — cấp 2</span>
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={!dangChon} className={oChu}>
          {!dangChon && <option value="">— Chọn cấp 1 trước —</option>}
          {capHai.map((k) => (
            <option key={k.id} value={k.id}>{k.channel_l2 || '(không chia cấp 2)'}</option>
          ))}
        </select>
        {dangChon && (
          <span className="mt-1 block text-xs text-slate-400">
            Đang chọn: {[dangChon.channel_l1, dangChon.channel_l2].filter(Boolean).join(' · ')}
          </span>
        )}
      </label>
    </div>
  )
}
