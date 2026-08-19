'use client'

/**
 * Bảng team — mọi việc mình được xem, lọc theo team / người / trạng thái / từ khoá,
 * xem ở hai chế độ: Danh sách và Bảng (kanban theo trạng thái). Bám mockup GWT Work.
 *
 * Lọc chạy trên SERVER (RPC work_bang_team) chứ không lọc trong trình duyệt: quyền xem
 * do work.visible_task_ids() quyết định, client không được cầm việc mình không có quyền.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { bangTeam, doiTrangThai, type ViecTeamRow, type NenTang } from '@/app/work/actions'
import { TRANG_THAI, NHAN_TRANG_THAI, nhanHan } from '@/lib/work'
import { DongViec } from './DongViec'
import { ChiTietViec } from './ChiTietViec'
import { FormTaoViec } from './FormTaoViec'
import { ThanhHangLoat } from './ThanhHangLoat'
import { Chip, ChongAvatar, Nut, oNhap, MAU_UT_VAR, MAU_TRANG_THAI } from './ui'

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
  const [chon, setChon] = useState<Set<number>>(new Set())
  const [thongBao, setThongBao] = useState<string | null>(null)

  function doiChon(id: number, c: boolean) {
    setChon((cu) => {
      const moi = new Set(cu)
      if (c) moi.add(id); else moi.delete(id)
      return moi
    })
  }

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={teamId}
          onChange={(e) => { setTeamId(e.target.value); nap({ team: e.target.value }) }}
          style={{ ...oNhap, fontWeight: 600, color: 'var(--ink-2)' }}
          aria-label="Lọc theo team"
        >
          <option value="">Mọi team</option>
          {nenTang.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        <select
          value={assignee}
          onChange={(e) => { setAssignee(e.target.value); nap({ ai: e.target.value }) }}
          style={{ ...oNhap, fontWeight: 600, color: 'var(--ink-2)' }}
          aria-label="Lọc theo người"
        >
          <option value="">Mọi người</option>
          {nenTang.nhan_su.map((s) => <option key={s.id} value={s.id}>{s.ten}</option>)}
        </select>

        <form onSubmit={(e) => { e.preventDefault(); nap() }} className="flex gap-1.5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm tiêu đề, mã việc…"
            style={{ ...oNhap, minWidth: 200 }}
            aria-label="Tìm việc"
          />
          <Nut type="submit">Tìm</Nut>
        </form>

        <span className="flex-1" />

        <div
          className="flex overflow-hidden"
          style={{ border: '1px solid var(--border-strong)', borderRadius: 9 }}
          role="group"
          aria-label="Chế độ xem"
        >
          {(['list', 'board'] as Che[]).map((c) => (
            <button
              key={c}
              onClick={() => setChe(c)}
              aria-pressed={che === c}
              style={{
                padding: '7px 13px', fontSize: 13, fontWeight: 600,
                background: che === c ? 'var(--accent)' : 'var(--surface)',
                color: che === c ? '#fff' : 'var(--ink-2)',
              }}
            >{c === 'list' ? 'Danh sách' : 'Bảng'}</button>
          ))}
        </div>
      </div>

      <FormTaoViec
        nenTang={nenTang}
        teamMacDinh={teamId ? Number(teamId) : null}
        onXong={() => { nap(); router.refresh() }}
      />

      {loi && (
        <p
          className="px-3 py-2 rounded-lg"
          style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-wash)', border: '1px solid var(--red)' }}
        >{loi}</p>
      )}
      {thongBao && (
        <p
          className="px-3 py-2 rounded-lg"
          style={{ fontSize: 13, color: 'var(--green)', background: 'var(--green-wash)', border: '1px solid var(--green)' }}
        >{thongBao}</p>
      )}

      {rows.length === 0 ? (
        <div
          className="p-8 text-center"
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 11, boxShadow: 'var(--shadow)', color: 'var(--muted)', fontSize: 13.5,
          }}
        >
          Không có việc nào khớp bộ lọc.
        </div>
      ) : che === 'list' ? (
        <>
        <label className="flex items-center gap-2 px-1" style={{ fontSize: 12, color: 'var(--muted)' }}>
          <input
            type="checkbox"
            checked={rows.length > 0 && rows.every((v) => chon.has(v.id))}
            onChange={(e) => setChon(e.target.checked ? new Set(rows.map((v) => v.id)) : new Set())}
            style={{ width: 14, height: 14, accentColor: 'var(--accent)' }}
          />
          Chọn tất cả {rows.length} việc đang hiện
        </label>
        <ul
          className="overflow-hidden list-none p-0 m-0"
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 11, boxShadow: 'var(--shadow)',
          }}
        >
          {rows.map((v, i) => (
            <DongViec
              key={v.id} v={v} pending={pending}
              onDoiTrangThai={doi} onMo={setMo} cuoi={i === rows.length - 1}
              dangChon={chon.has(v.id)} onChon={doiChon}
            />
          ))}
        </ul>
        </>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5 items-start">
          {TRANG_THAI.map((cot) => {
            const cua = rows.filter((v) => v.status === cot.v)
            return (
              <section
                key={cot.v}
                className="flex flex-col gap-2.5 p-2.5"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11 }}
              >
                <h3 className="flex items-center gap-2 m-0.5" style={{ fontSize: 12.5, fontWeight: 650 }}>
                  <span
                    className="flex-none"
                    style={{ width: 8, height: 8, borderRadius: 3, background: MAU_TRANG_THAI[cot.v] }}
                  />
                  {cot.nhan}
                  <span className="mono ml-auto" style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>
                    {cua.length}
                  </span>
                </h3>

                {cua.map((v) => {
                  const han = nhanHan(v.due_at)
                  return (
                    <button
                      key={v.id}
                      onClick={() => setMo(v.id)}
                      className="w-full text-left flex flex-col gap-2.5"
                      style={{
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderLeft: `3px solid ${MAU_UT_VAR[v.priority] ?? 'var(--border-strong)'}`,
                        borderRadius: 9, padding: '11px 12px', boxShadow: 'var(--shadow)',
                      }}
                    >
                      <span style={{ fontWeight: 560, fontSize: 13.5, letterSpacing: '-.006em', lineHeight: 1.35 }}>
                        {v.title}
                      </span>
                      {(v.team_name || han) && (
                        <span className="flex items-center gap-2 flex-wrap">
                          {v.team_name && <Chip chamMau={v.team_color ?? 'var(--faint)'}>{v.team_name}</Chip>}
                          {han && (
                            <span
                              className="so"
                              style={{
                                fontSize: 11.5, fontWeight: 600,
                                color: han.startsWith('Quá hạn') ? 'var(--red)'
                                  : han === 'Hôm nay' ? 'var(--amber)' : 'var(--muted)',
                              }}
                            >{han}</span>
                          )}
                        </span>
                      )}
                      <span className="flex items-center justify-between gap-2">
                        <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--faint)' }}>
                          {v.ref} · P{v.priority}
                        </span>
                        <ChongAvatar nguoi={v.assignees.map((a) => ({ ten: a.ten, role: a.role }))} toiDa={2} co={22} />
                      </span>
                    </button>
                  )
                })}

                {cua.length === 0 && (
                  <p className="px-1" style={{ fontSize: 11.5, color: 'var(--faint)' }}>
                    Không có việc {NHAN_TRANG_THAI[cot.v].toLowerCase()}.
                  </p>
                )}
              </section>
            )
          })}
        </div>
      )}

      {pending && <p style={{ fontSize: 12, color: 'var(--faint)' }}>Đang tải…</p>}

      {chon.size > 0 && (
        <ThanhHangLoat
          ids={[...chon]}
          nenTang={nenTang}
          onBoChon={() => setChon(new Set())}
          onXong={(tb) => { setThongBao(tb); setChon(new Set()); nap(); router.refresh() }}
        />
      )}
      {chon.size > 0 && <div style={{ height: 72 }} aria-hidden />}

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
