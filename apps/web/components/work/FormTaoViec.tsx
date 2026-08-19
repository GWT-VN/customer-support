'use client'

/**
 * Ô thêm việc. Gõ tiêu đề rồi Enter là xong (đường nhanh — 90% trường hợp);
 * bấm "Thêm chi tiết" mới mở phần mô tả / hạn / team / gán người.
 * Cố ý KHÔNG bắt điền hết: việc ghi ra nhanh mới có người dùng.
 */
import { useState, useTransition } from 'react'
import { taoViec, type NenTang } from '@/app/work/actions'
import { NHAN_UU_TIEN, VAI_TRO, isoTuOInput } from '@/lib/work'
import { Nut, oNhap, MAU_UT_VAR } from './ui'

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
    <form
      onSubmit={gui}
      className="p-3 space-y-3"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11, boxShadow: 'var(--shadow)' }}
    >
      <div className="flex gap-2">
        <span
          className="w-[3px] flex-none rounded-full self-stretch"
          style={{ background: MAU_UT_VAR[priority] ?? 'var(--border-strong)' }}
          aria-hidden
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Thêm việc mới…"
          className="flex-1"
          style={oNhap}
          aria-label="Tiêu đề việc"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
          style={{ ...oNhap, color: 'var(--ink-2)', fontWeight: 600 }}
          aria-label="Ưu tiên"
        >
          {[1, 2, 3, 4].map((p) => <option key={p} value={p}>{NHAN_UU_TIEN[p]}</option>)}
        </select>
        <Nut chinh type="submit" disabled={pending || !title.trim()}>Thêm</Nut>
      </div>

      <button
        type="button"
        onClick={() => setMoRong((v) => !v)}
        className="hover:underline"
        style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-ink)' }}
      >
        {moRong ? '− Ẩn chi tiết' : '+ Thêm chi tiết (mô tả, hạn, team, giao cho ai)'}
      </button>

      {moRong && (
        <div className="space-y-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Mô tả…"
            className="w-full resize-y"
            style={oNhap}
            aria-label="Mô tả"
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 550 }}>
              Hạn
              <input
                type="datetime-local"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="mt-1 w-full"
                style={oNhap}
              />
            </label>
            <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 550 }}>
              Team
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="mt-1 w-full"
                style={oNhap}
              >
                <option value="">— Không —</option>
                {nenTang.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          </div>

          <div>
            <p className="mb-1" style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 550 }}>
              Giao cho <span style={{ color: 'var(--faint)', fontWeight: 400 }}>(để trống = việc của chính bạn)</span>
            </p>
            <ul className="space-y-1">
              {nguoi.map((n) => {
                const s = nenTang.nhan_su.find((x) => x.id === n.staff_id)
                return (
                  <li key={n.staff_id} className="flex items-center gap-2">
                    <span className="flex-1 truncate" style={{ fontSize: 13, color: 'var(--ink)' }}>{s?.ten ?? n.staff_id}</span>
                    <select
                      value={n.role}
                      onChange={(e) => setNguoi((ds) => ds.map((x) =>
                        x.staff_id === n.staff_id ? { ...x, role: e.target.value } : x))}
                      style={{ ...oNhap, fontSize: 11.5, padding: '3px 7px', background: 'var(--surface-2)', color: 'var(--ink-2)' }}
                      aria-label={`Vai trò của ${s?.ten ?? ''}`}
                    >
                      {VAI_TRO.map((r) => <option key={r.v} value={r.v}>{r.nhan}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => setNguoi((ds) => ds.filter((x) => x.staff_id !== n.staff_id))}
                      className="text-lg leading-none hover:opacity-100"
                      style={{ color: 'var(--faint)', opacity: .7 }}
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
                className="mt-1 w-full"
                style={oNhap}
                aria-label="Thêm người làm"
              >
                <option value="">+ Thêm người…</option>
                {chuaChon.map((s) => <option key={s.id} value={s.id}>{s.ten}</option>)}
              </select>
            )}
          </div>
        </div>
      )}

      {loi && (
        <p
          className="px-3 py-2 rounded-lg"
          style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-wash)', border: '1px solid var(--red)' }}
        >{loi}</p>
      )}
    </form>
  )
}
