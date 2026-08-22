'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apDungDoiLich, type DoiLichMuc } from '@/app/actions'
import { vnDate } from '@/components/Badge'

/**
 * Hỏi lại trước khi dời lịch các lượt bảo trì SAU.
 *
 * CEO chốt 21/08/2026: *"nên confirm lại có muốn đổi ngày bảo hành tiếp theo, CS confirm rồi
 * mới đổi"*. Lịch bảo trì là thứ khách đã được hẹn miệng — đổi sau lưng CS thì CS gọi khách
 * sai ngày, và không ai biết ngày đã bị đổi lúc nào.
 *
 * Hiện ĐỦ ngày cũ → ngày mới của từng lượt chứ không chỉ đếm "dời 2 lượt": CS phải nhìn được
 * mình đang đồng ý cái gì. Câu hỏi mà không kể nội dung thì chỉ dạy người ta bấm theo phản xạ.
 */
export function XacNhanDoiLich({
  visitId, ngay, deXuat, onXong,
}: {
  visitId: string
  /** Ngày làm THỰC TẾ — mốc để tính lại các lượt sau. */
  ngay: string
  deXuat: DoiLichMuc[]
  onXong: (ketQua: 'da_doi' | 'giu_nguyen') => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()

  if (!deXuat.length) return null

  async function doi() {
    setBusy(true); setErr(null)
    const r = await apDungDoiLich(visitId, ngay)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    onXong('da_doi')
    router.refresh()
  }

  return (
    <div className="mt-1 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs">
      <p className="font-medium text-amber-900">
        Dời {deXuat.length} lượt sau cho khớp ngày làm thực tế?
      </p>
      <ul className="mt-1 space-y-0.5 text-amber-900/90">
        {deXuat.map((m) => (
          <li key={m.id}>
            Lượt {m.lan_thu ?? '?'}:{' '}
            <span className="line-through opacity-60">{m.cu ? vnDate(m.cu) : 'chưa có ngày'}</span>
            {' → '}
            <strong>{vnDate(m.moi)}</strong>
          </li>
        ))}
      </ul>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <button onClick={doi} disabled={busy}
          className="rounded-lg bg-amber-600 px-2.5 py-1 font-medium text-white disabled:opacity-50">
          {busy ? 'Đang dời…' : 'Dời lịch'}
        </button>
        {/* Không đồng ý thì lượt VẪN xong — chỉ là lịch giữ nguyên. Nói rõ để CS khỏi tưởng
            bấm "Giữ nguyên" là huỷ luôn việc đánh dấu đã làm. */}
        <button onClick={() => onXong('giu_nguyen')} disabled={busy}
          className="text-slate-600 underline hover:text-slate-900">
          Giữ nguyên lịch
        </button>
        {err && <span className="text-red-600">{err}</span>}
      </div>
    </div>
  )
}
