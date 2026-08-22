'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ganKenh, type Kenh } from '@/app/actions'
import { ChonKenh } from '@/components/ChonKenh'

/**
 * Gắn khách vào 1 kênh/đối tác (đại lý/KTS/KOL…). Danh mục `dim_channel` do Sales quản,
 * CSKH chỉ chọn.
 *
 * Ô chọn dùng CHUNG `ChonKenh` — cùng một component với màn tạo khách và màn tạo đơn của Sales.
 * CEO chốt 22/08/2026: *"thống nhất app global, các chỗ cho chọn kênh đều chia 2 cấp giống nhau
 * hết, sửa 1 chỗ apply all các chỗ khác logic như nhau"*.
 */
export function GanKenh({
  customerId, channelId, kenh,
}: { customerId: string; channelId: number | null; kenh: Kenh[] }) {
  const router = useRouter()
  const [val, setVal] = useState(channelId != null ? String(channelId) : '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)


  async function doi(v: string) {
    setVal(v); setBusy(true); setMsg(null)
    const r = await ganKenh(customerId, v ? Number(v) : null)
    setBusy(false)
    if (!r.ok) setMsg(r.error)
    else { setMsg('Đã lưu.'); router.refresh() }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Dùng CHUNG `ChonKenh` với màn tạo khách và màn tạo đơn. CEO chốt 22/08: "thống nhất app
          global, các chỗ cho chọn kênh đều chia 2 cấp giống nhau hết, sửa 1 chỗ apply all".
          Trước đây chỗ này là một `<select>` phẳng 26 mục — vừa lệch với màn khác, vừa vi phạm
          luật ">10 mục phải gõ để tìm". */}
      <div className="min-w-[320px] flex-1">
        <ChonKenh kenh={kenh} value={val} onChange={doi} />
      </div>
      {busy && <span className="text-xs text-slate-400">Đang lưu…</span>}
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </div>
  )
}
