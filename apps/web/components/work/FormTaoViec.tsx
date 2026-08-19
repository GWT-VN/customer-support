'use client'

/**
 * Ô thêm việc. Gõ tiêu đề rồi Enter là xong (đường nhanh — 90% trường hợp);
 * bấm "Thêm chi tiết" mới mở phần mô tả / hạn / team / gán người.
 * Cố ý KHÔNG bắt điền hết: việc ghi ra nhanh mới có người dùng.
 */
import { useState, useTransition } from 'react'
import { taoViec, type NenTang } from '@/app/work/actions'
import { NHAN_UU_TIEN, VAI_TRO, isoTuOInput } from '@/lib/work'

export function FormTaoViec({
  nenTang, teamMacDinh = null, onXong,
}: {
  nenTang: NenTang
  teamMacDinh?: number | null
  onXong: () => void
}) {
  const [title, setTitle] = useState('')
  const [moRong, setMoRong] = useState(false)
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState(3)
  const [due, setDue] = useState('')
  const [teamId, setTeamId] = useState<string>(teamMacDinh ? String(teamMacDinh) : '')
  const [nguoi, setNguoi] = useState<{ staff_id: string; role: string }[]>([])
  const [loi, setLoi] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const chuaChon = nenTang.nhan_su.filter((s) => !nguoi.some((n) => n.staff_id === s.id))

  function gui(e: React.FormEvent) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    start(async () => {
      try {
        await taoViec({
          title: t,
          description: description.trim() || null,
          priority,
          due: isoTuOInput(due),
          team_id: teamId ? Number(teamId) : null,
          assignees: nguoi,
        })
        setTitle(''); setDescription(''); setPriority(3); setDue('')
        setNguoi([]); setMoRong(false); setLoi(null)
        onXong()
      } catch (err) {
        setLoi(err instanceof Error ? err.message : 'Không tạo được việc')
      }
    })
  }

  return (
    <form onSubmit={gui} className="bg-white rounded-xl border p-3 space-y-3">
      <div className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Thêm việc mới…"
          className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-teal-500"
          aria-label="Tiêu đề việc"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
          className="px-2 py-2 rounded-lg border border-slate-200 text-sm text-slate-600"
          aria-label="Ưu tiên"
        >
          {[1, 2, 3, 4].map((p) => <option key={p} value={p}>{NHAN_UU_TIEN[p]}</option>)}
        </select>
        <button
          type="submit"
          disabled={pending || !title.trim()}
          className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50"
        >Thêm</button>
      </div>

      <button
        type="button"
        onClick={() => setMoRong((v) => !v)}
        className="text-xs text-teal-700 hover:underline"
      >
        {moRong ? '− Ẩn chi tiết' : '+ Thêm chi tiết (mô tả, hạn, team, giao cho ai)'}
      </button>

      {moRong && (
        <div className="space-y-3 pt-1 border-t border-slate-100">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Mô tả…"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-teal-500 resize-y"
            aria-label="Mô tả"
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs text-slate-500">
              Hạn
              <input
                type="datetime-local"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="mt-1 w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-800"
              />
            </label>
            <label className="text-xs text-slate-500">
              Team
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="mt-1 w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-800"
              >
                <option value="">— Không —</option>
                {nenTang.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1">
              Giao cho <span className="text-slate-400">(để trống = việc của chính bạn)</span>
            </p>
            <ul className="space-y-1">
              {nguoi.map((n) => {
                const s = nenTang.nhan_su.find((x) => x.id === n.staff_id)
                return (
                  <li key={n.staff_id} className="flex items-center gap-2">
                    <span className="text-sm text-slate-800 flex-1 truncate">{s?.ten ?? n.staff_id}</span>
                    <select
                      value={n.role}
                      onChange={(e) => setNguoi((ds) => ds.map((x) =>
                        x.staff_id === n.staff_id ? { ...x, role: e.target.value } : x))}
                      className="text-xs px-1.5 py-1 rounded-md border border-slate-200 text-slate-600"
                      aria-label={`Vai trò của ${s?.ten ?? ''}`}
                    >
                      {VAI_TRO.map((r) => <option key={r.v} value={r.v}>{r.nhan}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => setNguoi((ds) => ds.filter((x) => x.staff_id !== n.staff_id))}
                      className="text-slate-300 hover:text-red-500 text-lg leading-none"
                      aria-label={`Bỏ ${s?.ten ?? ''}`}
                    >×</button>
                  </li>
                )
              })}
            </ul>
            {chuaChon.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  if (!e.target.value) return
                  setNguoi((ds) => [...ds, { staff_id: e.target.value, role: ds.length === 0 ? 'owner' : 'doer' }])
                }}
                className="mt-1 w-full text-sm px-2 py-1.5 rounded-lg border border-slate-200 text-slate-700"
                aria-label="Thêm người làm"
              >
                <option value="">+ Thêm người…</option>
                {chuaChon.map((s) => <option key={s.id} value={s.id}>{s.ten}</option>)}
              </select>
            )}
          </div>
        </div>
      )}

      {loi && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{loi}</p>}
    </form>
  )
}
