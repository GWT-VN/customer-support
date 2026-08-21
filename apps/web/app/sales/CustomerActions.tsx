'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { xoaKhach } from './actions'

export function CustomerActions({ customerCode }: { customerCode: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  function onDelete() {
    if (!confirm(`Xoá khách ${customerCode}? Không hoàn tác được.`)) return
    setErr(null)
    start(async () => {
      const res = await xoaKhach(customerCode)
      if (res.ok) {
        router.push('/sales/khach')
        router.refresh()
      } else setErr(res.error)
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Link href={`/sales/khach/${encodeURIComponent(customerCode)}/sua`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Sửa</Link>
        <button onClick={onDelete} disabled={pending} className="rounded-lg border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-60">
          {pending ? 'Đang xoá…' : 'Xoá'}
        </button>
      </div>
      {err && <span className="max-w-xs text-right text-xs text-rose-600">{err}</span>}
    </div>
  )
}
