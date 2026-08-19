'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { taoViec, doiTrangThai, type ViecRow } from '@/app/work/actions'

const MAU_UT: Record<number, string> = { 1: 'bg-red-500', 2: 'bg-amber-500', 3: 'bg-indigo-500', 4: 'bg-slate-300' }
const NHAN_UT: Record<number, string> = { 1: 'P1 · Khẩn', 2: 'P2', 3: 'P3', 4: 'P4' }
const TRANG_THAI = [
  { v: 'todo', nhan: 'Cần làm' },
  { v: 'doing', nhan: 'Đang làm' },
  { v: 'blocked', nhan: 'Bị chặn' },
  { v: 'review', nhan: 'Chờ duyệt' },
  { v: 'done', nhan: 'Xong' },
] as const

function hanText(iso: string | null): { text: string; cls: string } {
  if (!iso) return { text: '', cls: 'text-slate-400' }
  const d = new Date(iso)
  const homNay = new Date()
  const moc = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const soNgay = Math.round((moc(d) - moc(homNay)) / 86_400_000)
  const nhan = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
  if (soNgay < 0) return { text: `Quá hạn ${nhan}`, cls: 'text-red-600' }
  if (soNgay === 0) return { text: 'Hôm nay', cls: 'text-amber-600' }
  if (soNgay === 1) return { text: 'Ngày mai', cls: 'text-slate-600' }
  return { text: nhan, cls: 'text-slate-500' }
}

const NHAN_VAI: Record<string, string> = { owner: 'Phụ trách', doer: 'Cùng làm', reviewer: 'Nghiệm thu', watcher: 'Theo dõi' }

export function ViecCuaToi({ rowsBanDau }: { rowsBanDau: ViecRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState(3)

  function them(e: React.FormEvent) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    start(async () => {
      await taoViec({ title: t, priority })
      setTitle('')
      setPriority(3)
      router.refresh()
    })
  }

  function doi(id: number, status: string) {
    start(async () => {
      await doiTrangThai(id, status)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={them} className="flex gap-2 bg-white rounded-xl border p-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Thêm việc mới…"
          className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-teal-500"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
          className="px-2 py-2 rounded-lg border border-slate-200 text-sm text-slate-600"
          aria-label="Ưu tiên"
        >
          {[1, 2, 3, 4].map((p) => (
            <option key={p} value={p}>{NHAN_UT[p]}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending || !title.trim()}
          className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50"
        >
          Thêm
        </button>
      </form>

      {rowsBanDau.length === 0 ? (
        <div className="bg-white rounded-xl border p-6 text-center text-sm text-slate-500">
          Chưa có việc nào. Thêm việc đầu tiên ở trên.
        </div>
      ) : (
        <ul className="bg-white rounded-xl border divide-y divide-slate-100">
          {rowsBanDau.map((v) => {
            const han = hanText(v.due_at)
            const xong = v.status === 'done'
            return (
              <li key={v.id} className="flex items-center gap-3 p-3">
                <button
                  onClick={() => doi(v.id, xong ? 'todo' : 'done')}
                  disabled={pending}
                  aria-label={xong ? 'Bỏ đánh dấu xong' : 'Đánh dấu xong'}
                  className={`w-5 h-5 rounded-md border flex-none grid place-items-center text-white text-xs ${
                    xong ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 hover:border-emerald-500'
                  }`}
                >
                  {xong ? '✓' : ''}
                </button>
                <span className={`w-1.5 h-9 rounded-full flex-none ${MAU_UT[v.priority] ?? 'bg-slate-300'}`} />
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium truncate ${xong ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                    {v.title}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[11px] font-mono text-slate-400">{v.ref}</span>
                    {v.team_name && (
                      <span
                        className="text-[11px] px-1.5 py-0.5 rounded-full border text-slate-600"
                        style={{ borderColor: (v.team_color ?? '#cbd5e1') + '66' }}
                      >
                        {v.team_name}
                      </span>
                    )}
                    {v.my_role && <span className="text-[11px] text-slate-400">{NHAN_VAI[v.my_role] ?? v.my_role}</span>}
                    {v.sub_n > 0 && <span className="text-[11px] text-slate-400">{v.sub_n} việc con</span>}
                    {han.text && <span className={`text-[11px] font-medium ${han.cls}`}>{han.text}</span>}
                  </div>
                </div>
                <select
                  value={v.status}
                  onChange={(e) => doi(v.id, e.target.value)}
                  disabled={pending}
                  aria-label="Trạng thái"
                  className="text-xs px-2 py-1 rounded-md border border-slate-200 text-slate-600 bg-white"
                >
                  {TRANG_THAI.map((s) => (
                    <option key={s.v} value={s.v}>{s.nhan}</option>
                  ))}
                </select>
              </li>
            )
          })}
        </ul>
      )}

      {pending && <p className="text-xs text-slate-400">Đang lưu…</p>}
    </div>
  )
}
