'use client'

/**
 * Bảng team — mọi việc mình được xem, lọc theo team / người / trạng thái / từ khoá,
 * xem ở hai chế độ: Danh sách và Bảng (kanban theo trạng thái).
 *
 * Lọc chạy trên SERVER (RPC work_bang_team) chứ không lọc trong trình duyệt: quyền xem
 * do work.visible_task_ids() quyết định, client không được cầm việc mình không có quyền.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { bangTeam, doiTrangThai, type ViecTeamRow, type NenTang } from '@/app/work/actions'
import { TRANG_THAI, NHAN_TRANG_THAI, MAU_UU_TIEN, chuTat, nhanHan } from '@/lib/work'
import { DongViec } from './DongViec'
import { ChiTietViec } from './ChiTietViec'
import { FormTaoViec } from './FormTaoViec'

type Che = 'list' | 'board'

export function BangTeam({ rowsBanDau, nenTang }: { rowsBanDau: ViecTeamRow[]; nenTang: NenTang }) {
  const router = useRouter()
  const [rows, setRows] = useState(rowsBanDau)
  const [che, setChe] = useState<Che>('list')
  const [teamId, setTeamId] = useState<string>('')
  const [assignee, setAssignee] = useState<string>('')
  const [q, setQ] = useState('')
  const [mo, setMo] = useState<number | null>(null)
  const [loi, setLoi] = useState<string | null>(null)
  const [pending, start] = useTransition()

  /** Nạp lại theo bộ lọc hiện tại — gọi sau mỗi lần lọc hoặc ghi. */
  function nap(moi?: { team?: string; ai?: string; tu?: string }) {
    const t = moi?.team ?? teamId
    const a = moi?.ai ?? assignee
    const k = moi?.tu ?? q
    start(async () => {
      try {
        setRows(await bangTeam({
          team_id: t ? Number(t) : null,
          assignee: a || null,
          q: k.trim() || null,
        }))
        setLoi(null)
      } catch (e) {
        setLoi(e instanceof Error ? e.message : 'Không tải được danh sách')
      }
    })
  }

  function doi(id: number, status: string) {
    start(async () => {
      try {
        await doiTrangThai(id, status)
        setRows(await bangTeam({
          team_id: teamId ? Number(teamId) : null,
          assignee: assignee || null,
          q: q.trim() || null,
        }))
        setLoi(null)
      } catch (e) {
        setLoi(e instanceof Error ? e.message : 'Không đổi được trạng thái')
      }
    })
  }

  const oLoc = 'px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={teamId}
          onChange={(e) => { setTeamId(e.target.value); nap({ team: e.target.value }) }}
          className={oLoc}
          aria-label="Lọc theo team"
        >
          <option value="">Mọi team</option>
          {nenTang.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        <select
          value={assignee}
          onChange={(e) => { setAssignee(e.target.value); nap({ ai: e.target.value }) }}
          className={oLoc}
          aria-label="Lọc theo người"
        >
          <option value="">Mọi người</option>
          {nenTang.nhan_su.map((s) => <option key={s.id} value={s.id}>{s.ten}</option>)}
        </select>

        <form
          onSubmit={(e) => { e.preventDefault(); nap() }}
          className="flex gap-1"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm tiêu đề / mã việc…"
            className={oLoc}
            aria-label="Tìm việc"
          />
          <button type="submit" className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-sm">Tìm</button>
        </form>

        <span className="flex-1" />

        <div className="flex rounded-lg border border-slate-200 overflow-hidden" role="group" aria-label="Chế độ xem">
          {(['list', 'board'] as Che[]).map((c) => (
            <button
              key={c}
              onClick={() => setChe(c)}
              aria-pressed={che === c}
              className={`px-3 py-1.5 text-sm ${che === c ? 'bg-teal-600 text-white' : 'bg-white text-slate-600'}`}
            >{c === 'list' ? 'Danh sách' : 'Bảng'}</button>
          ))}
        </div>
      </div>

      <FormTaoViec
        nenTang={nenTang}
        teamMacDinh={teamId ? Number(teamId) : null}
        onXong={() => { nap(); router.refresh() }}
      />

      {loi && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{loi}</p>}

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border p-6 text-center text-sm text-slate-500">
          Không có việc nào khớp bộ lọc.
        </div>
      ) : che === 'list' ? (
        <ul className="bg-white rounded-xl border divide-y divide-slate-100">
          {rows.map((v) => (
            <DongViec key={v.id} v={v} pending={pending} onDoiTrangThai={doi} onMo={setMo} />
          ))}
        </ul>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {TRANG_THAI.map((cot) => {
            const cua = rows.filter((v) => v.status === cot.v)
            return (
              <section key={cot.v} className="bg-slate-100/70 rounded-xl p-2 min-h-24">
                <h3 className="text-xs font-semibold text-slate-600 px-1 pb-2">
                  {cot.nhan} <span className="text-slate-400 font-normal">· {cua.length}</span>
                </h3>
                <ul className="space-y-2">
                  {cua.map((v) => {
                    const han = nhanHan(v.due_at)
                    return (
                      <li key={v.id}>
                        <button
                          onClick={() => setMo(v.id)}
                          className="w-full text-left bg-white rounded-lg border p-2 hover:border-teal-400"
                        >
                          <span className="flex items-start gap-2">
                            <span className={`w-1 h-8 rounded-full flex-none ${MAU_UU_TIEN[v.priority] ?? 'bg-slate-300'}`} aria-hidden />
                            <span className="text-sm text-slate-800 line-clamp-2">{v.title}</span>
                          </span>
                          <span className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className="text-[10px] font-mono text-slate-400">{v.ref}</span>
                            {v.team_name && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-full border text-slate-600"
                                style={{ borderColor: (v.team_color ?? '#cbd5e1') + '66' }}
                              >{v.team_name}</span>
                            )}
                            {han && (
                              <span className={`text-[10px] font-medium ${han.startsWith('Quá hạn') ? 'text-red-600' : 'text-slate-500'}`}>
                                {han}
                              </span>
                            )}
                            <span className="flex-1" />
                            {v.assignees.slice(0, 2).map((a) => (
                              <span
                                key={a.staff_id}
                                title={a.ten}
                                className="w-5 h-5 rounded-full grid place-items-center text-[9px] font-semibold text-white bg-slate-500"
                              >{chuTat(a.ten)}</span>
                            ))}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                  {cua.length === 0 && (
                    <li className="text-[11px] text-slate-400 px-1">Không có việc {NHAN_TRANG_THAI[cot.v].toLowerCase()}.</li>
                  )}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      {pending && <p className="text-xs text-slate-400">Đang tải…</p>}

      {mo !== null && (
        <ChiTietViec
          taskId={mo}
          nenTang={nenTang}
          onDong={() => setMo(null)}
          onDoi={() => nap()}
        />
      )}
    </div>
  )
}
