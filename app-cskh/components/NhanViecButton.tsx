'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { nhanTicket } from '@/app/actions'

/** Nút "Nhận việc" — gán ticket đang trống cho chính mình. Hiện khi ticket chưa có người phụ trách. */
export function NhanViecButton({ code }: { code: string }) {
  const router = useRouter()
  const [dangChay, batDau] = useTransition()
  const [loi, setLoi] = useState<string | null>(null)

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={dangChay}
        onClick={() =>
          batDau(async () => {
            setLoi(null)
            const r = await nhanTicket(code)
            if (r.ok) router.refresh()
            else setLoi(r.error)
          })
        }
        className="rounded-lg bg-emerald-600 text-white px-3 py-1 text-sm font-medium disabled:opacity-50 hover:bg-emerald-700"
      >
        {dangChay ? '…' : 'Nhận việc'}
      </button>
      {loi && <span className="text-sm text-red-600">{loi}</span>}
    </span>
  )
}
