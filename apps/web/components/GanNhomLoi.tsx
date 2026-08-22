'use client'

import { OChonGoiY } from '@/bang/OChonGoiY'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ganTicketVaoNhom, boGanNhom, type NhomChon } from '@/app/actions'

type DaGan = { group_code: string; nhom_ten: string; nguon: string }

/**
 * Gán TAY 1 ticket vào nhóm lỗi (dùng khi lỗi mới, mẫu tự động chưa bắt được).
 * Chỉ admin thấy. Gán tay hiện nguồn "người"; có thể bỏ gán. Nhóm do mẫu tự bắt
 * (nguồn "rule") không bỏ ở đây — sửa mẫu ở trang nhóm.
 */
export function GanNhomLoi({ code, daGan, nhomList }: { code: string; daGan: DaGan[]; nhomList: NhomChon[] }) {
  const router = useRouter()
  const [group, setGroup] = useState('')
  const [lyDo, setLyDo] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const daCo = new Set(daGan.map((d) => d.group_code))
  const conLai = nhomList.filter((n) => !daCo.has(n.code))
  const ganTay = daGan.filter((d) => d.nguon === 'người')

  async function gan() {
    if (!group) return
    setBusy(true); setErr(null)
    const r = await ganTicketVaoNhom(code, group, lyDo || undefined)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    setGroup(''); setLyDo(''); router.refresh()
  }
  async function bo(gc: string) {
    setBusy(true); setErr(null)
    const r = await boGanNhom(code, gc)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    router.refresh()
  }

  return (
    <div className="space-y-2">
      {ganTay.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ganTay.map((d) => (
            <span key={d.group_code} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border bg-violet-50 text-violet-800 text-xs">
              {d.nhom_ten} <span className="text-violet-400">(gán tay)</span>
              <button disabled={busy} onClick={() => bo(d.group_code)} className="text-violet-500 hover:text-red-600" title="Bỏ gán">✕</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {/* Gõ-để-tìm thay cho `<select>` trần: 13 nhóm lỗi, quá ngưỡng 10 mục theo luật CEO
            chốt 22/08 (`docs/CHUAN-FILTER.md` Luật 2). Dùng chung `OChonGoiY` với các khu khác,
            không viết bản riêng. */}
        <div className="min-w-[260px]">
          <OChonGoiY
            giaTri={group || null}
            onChon={setGroup}
            tuyChon={conLai.map((n) => ({ gt: n.code, nhan: n.ten, phu: n.code }))}
            choTrong="Gõ mã hoặc tên nhóm lỗi…"
          />
        </div>
        <input value={lyDo} onChange={(e) => setLyDo(e.target.value)} placeholder="Lý do (tuỳ chọn)"
          className="rounded-lg border px-3 py-1.5 text-sm text-slate-900" />
        <button disabled={busy || !group} onClick={gan} className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm disabled:opacity-50">Gắn</button>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <p className="text-[11px] text-slate-400">
        Gắn tay dùng cho lỗi mới chưa có mẫu. Nếu lặp nhiều, nên tạo nhóm để hệ tự gom.
      </p>
    </div>
  )
}
