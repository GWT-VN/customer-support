'use client'

/**
 * Panel chi tiết 1 việc (trượt từ phải). Dùng chung cho "Việc của tôi" và "Bảng team".
 * Tự nạp dữ liệu khi mở để danh sách ngoài không phải mang theo comment/nhật ký.
 */
import { useEffect, useState, useTransition } from 'react'
import {
  chiTietViec, suaViec, ganNguoi, boNguoi, themBinhLuan, doiTrangThai,
  type ChiTietViec as Ct, type NenTang,
} from '@/app/work/actions'
import {
  TRANG_THAI, VAI_TRO, NHAN_UU_TIEN, MAU_UU_TIEN,
  chuTat, nhanHan, inputTuIso, isoTuOInput, moTaNhatKy,
} from '@/lib/work'

const NHAN_PHAM_VI: Record<string, string> = {
  private: 'chỉ mình tôi', team: 'cả team', company: 'toàn công ty',
}

function Avatar({ ten }: { ten: string }) {
  return (
    <span
      title={ten}
      className="w-6 h-6 rounded-full grid place-items-center text-[10px] font-semibold text-white flex-none bg-slate-500"
    >
      {chuTat(ten)}
    </span>
  )
}

export function ChiTietViec({
  taskId, nenTang, onDong, onDoi,
}: {
  taskId: number
  nenTang: NenTang
  onDong: () => void
  onDoi: () => void
}) {
  const [ct, setCt] = useState<Ct | null>(null)
  const [loi, setLoi] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [binhLuan, setBinhLuan] = useState('')
  const [themAi, setThemAi] = useState('')
  const [themVai, setThemVai] = useState('doer')

  useEffect(() => {
    let huy = false
    chiTietViec(taskId)
      .then((d) => { if (!huy) { setCt(d); setLoi(null) } })
      .catch((e: unknown) => { if (!huy) setLoi(e instanceof Error ? e.message : 'Không mở được việc này') })
    return () => { huy = true }
  }, [taskId])

  /** Bọc mọi thao tác ghi: hiện lỗi ngay tại panel, nạp lại, báo cho danh sách ngoài. */
  function chay(fn: () => Promise<void>) {
    start(async () => {
      try {
        await fn()
        setCt(await chiTietViec(taskId))
        setLoi(null)
        onDoi()
      } catch (e) {
        setLoi(e instanceof Error ? e.message : 'Thao tác không thành công')
      }
    })
  }

  const t = ct?.task
  const daGan = new Set((ct?.assignees ?? []).map((a) => a.staff_id))
  const conLai = nenTang.nhan_su.filter((s) => !daGan.has(s.id))

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Chi tiết việc">
      <button className="flex-1 bg-slate-900/30" onClick={onDong} aria-label="Đóng" />
      <aside className="w-full sm:max-w-lg bg-white h-full overflow-y-auto shadow-xl">
        <header className="sticky top-0 bg-white border-b px-4 py-3 flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400">{t?.ref ?? '…'}</span>
          <span className="flex-1" />
          <button onClick={onDong} className="text-slate-400 hover:text-slate-700 text-xl leading-none" aria-label="Đóng">×</button>
        </header>

        {loi && (
          <p className="mx-4 mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{loi}</p>
        )}

        {!t || !ct ? (
          <p className="p-4 text-sm text-slate-500">Đang mở…</p>
        ) : (
          <div className="p-4 space-y-5">
            <div>
              <input
                defaultValue={t.title}
                disabled={!ct.co_the_sua || pending}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v && v !== t.title) chay(() => suaViec(t.id, { title: v }))
                }}
                className="w-full text-lg font-semibold text-slate-900 outline-none border-b border-transparent focus:border-teal-500 disabled:bg-transparent"
                aria-label="Tiêu đề"
              />
              <p className="text-xs text-slate-400 mt-1">
                {t.creator_ten ? `${t.creator_ten} tạo` : 'Tạo'} · {t.origin === 'manual' ? 'thủ công' : t.origin}
                {t.due_at && ` · ${nhanHan(t.due_at)}`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-500">
                Trạng thái
                <select
                  value={t.status}
                  disabled={pending}
                  onChange={(e) => chay(() => doiTrangThai(t.id, e.target.value))}
                  className="mt-1 w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-800"
                >
                  {TRANG_THAI.map((s) => <option key={s.v} value={s.v}>{s.nhan}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-500">
                Ưu tiên
                <select
                  value={t.priority}
                  disabled={!ct.co_the_sua || pending}
                  onChange={(e) => chay(() => suaViec(t.id, { priority: Number(e.target.value) }))}
                  className="mt-1 w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-800"
                >
                  {[1, 2, 3, 4].map((p) => <option key={p} value={p}>{NHAN_UU_TIEN[p]}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-500">
                Hạn
                <input
                  type="datetime-local"
                  defaultValue={inputTuIso(t.due_at)}
                  disabled={!ct.co_the_sua || pending}
                  onChange={(e) => chay(() => suaViec(t.id,
                    e.target.value ? { due: isoTuOInput(e.target.value) } : { xoa_due: true }))}
                  className="mt-1 w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-800"
                />
              </label>
              <label className="text-xs text-slate-500">
                Team
                <select
                  value={t.team_id ?? ''}
                  disabled={!ct.co_the_sua || pending}
                  onChange={(e) => chay(() => suaViec(t.id,
                    e.target.value ? { team_id: Number(e.target.value) } : { xoa_team: true }))}
                  className="mt-1 w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-800"
                >
                  <option value="">— Không —</option>
                  {nenTang.teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
                </select>
              </label>
            </div>

            <label className="block text-xs text-slate-500">
              Mô tả
              <textarea
                defaultValue={t.description ?? ''}
                disabled={!ct.co_the_sua || pending}
                rows={3}
                onBlur={(e) => {
                  if (e.target.value !== (t.description ?? '')) chay(() => suaViec(t.id, { description: e.target.value }))
                }}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 resize-y"
              />
            </label>

            {/* Người làm */}
            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Người làm</h3>
              <ul className="mt-2 space-y-1">
                {ct.assignees.map((a) => (
                  <li key={a.staff_id} className="flex items-center gap-2">
                    <Avatar ten={a.ten} />
                    <span className="text-sm text-slate-800 flex-1 truncate">{a.ten}</span>
                    <select
                      value={a.role}
                      disabled={!ct.co_the_sua || pending}
                      onChange={(e) => chay(() => ganNguoi(t.id, a.staff_id, e.target.value))}
                      className="text-xs px-1.5 py-1 rounded-md border border-slate-200 text-slate-600"
                      aria-label={`Vai trò của ${a.ten}`}
                    >
                      {VAI_TRO.map((r) => <option key={r.v} value={r.v}>{r.nhan}</option>)}
                    </select>
                    {ct.co_the_sua && ct.assignees.length > 1 && (
                      <button
                        onClick={() => chay(() => boNguoi(t.id, a.staff_id))}
                        disabled={pending}
                        className="text-slate-300 hover:text-red-500 text-lg leading-none"
                        aria-label={`Bỏ ${a.ten}`}
                      >×</button>
                    )}
                  </li>
                ))}
              </ul>
              {ct.co_the_sua && conLai.length > 0 && (
                <div className="flex gap-2 mt-2">
                  <select
                    value={themAi}
                    onChange={(e) => setThemAi(e.target.value)}
                    className="flex-1 text-sm px-2 py-1.5 rounded-lg border border-slate-200 text-slate-700"
                    aria-label="Thêm người"
                  >
                    <option value="">+ Thêm người…</option>
                    {conLai.map((s) => <option key={s.id} value={s.id}>{s.ten}</option>)}
                  </select>
                  <select
                    value={themVai}
                    onChange={(e) => setThemVai(e.target.value)}
                    className="text-sm px-2 py-1.5 rounded-lg border border-slate-200 text-slate-700"
                    aria-label="Vai trò người thêm"
                  >
                    {VAI_TRO.map((r) => <option key={r.v} value={r.v}>{r.nhan}</option>)}
                  </select>
                  <button
                    disabled={!themAi || pending}
                    onClick={() => { const ai = themAi; setThemAi(''); chay(() => ganNguoi(t.id, ai, themVai)) }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-sm disabled:opacity-40"
                  >Gán</button>
                </div>
              )}
            </section>

            {ct.subtasks.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Việc con</h3>
                <ul className="mt-2 space-y-1">
                  {ct.subtasks.map((s) => (
                    <li key={s.id} className="text-sm text-slate-700 flex gap-2">
                      <span className="font-mono text-[11px] text-slate-400">{s.ref}</span>
                      <span className="flex-1 truncate">{s.title}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Bình luận */}
            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Bình luận</h3>
              <ul className="mt-2 space-y-2">
                {ct.comments.map((c) => (
                  <li key={c.id} className="flex gap-2">
                    <Avatar ten={c.ten ?? '?'} />
                    <div className="min-w-0">
                      <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{c.body}</p>
                      <p className="text-[11px] text-slate-400">{c.ten}</p>
                    </div>
                  </li>
                ))}
                {ct.comments.length === 0 && <li className="text-sm text-slate-400">Chưa có bình luận.</li>}
              </ul>
              <form
                className="flex gap-2 mt-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const b = binhLuan.trim()
                  if (!b) return
                  setBinhLuan('')
                  chay(() => themBinhLuan(t.id, b))
                }}
              >
                <input
                  value={binhLuan}
                  onChange={(e) => setBinhLuan(e.target.value)}
                  placeholder="Viết bình luận…"
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-teal-500"
                />
                <button
                  type="submit"
                  disabled={pending || !binhLuan.trim()}
                  className="px-3 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium disabled:opacity-40"
                >Gửi</button>
              </form>
            </section>

            {/* Nhật ký */}
            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nhật ký</h3>
              <ul className="mt-2 space-y-1">
                {ct.activity.map((a) => (
                  <li key={a.id} className="text-[12px] text-slate-500">
                    <span className="text-slate-700">{a.ten ?? 'Ai đó'}</span> {moTaNhatKy(a.verb, a.payload)}
                  </li>
                ))}
              </ul>
            </section>

            <div className={`h-1 rounded-full ${MAU_UU_TIEN[t.priority] ?? 'bg-slate-200'}`} aria-hidden />
            <p className="text-[11px] text-slate-400">
              {ct.co_the_sua ? 'Bạn sửa được việc này.' : 'Chỉ xem — bạn không phải người tạo hay người làm.'}
              {' '}Ai xem được: {NHAN_PHAM_VI[t.visibility] ?? t.visibility}.
            </p>
          </div>
        )}
      </aside>
    </div>
  )
}
