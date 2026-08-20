'use client'

/**
 * Panel chi tiết 1 việc (trượt từ phải). Dùng chung cho "Việc của tôi" và "Bảng team".
 * Tự nạp dữ liệu khi mở để danh sách ngoài không phải mang theo comment/nhật ký.
 */
import { useEffect, useState, useTransition } from 'react'
import {
  chiTietViec, suaViec, ganNguoi, boNguoi, themBinhLuan, doiTrangThai,
  type ChiTietViec as Ct, type NenTang, type KQ,
} from '@/app/work/actions'
import {
  TRANG_THAI, VAI_TRO, NHAN_VAI_TRO, NHAN_UU_TIEN,
  nhanHan, inputTuIso, isoTuOInput, moTaNhatKy, mocThoiGian,
} from '@/lib/work'
import { Avatar, Chip, Nut, oNhap, MAU_UT_VAR, MAU_TRANG_THAI } from './ui'

const NHAN_PHAM_VI: Record<string, string> = {
  private: 'chỉ mình tôi', team: 'cả team', company: 'toàn công ty',
}

/** Nhãn nhỏ in hoa mở đầu mỗi mục (theo mockup). */
function Nhan({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="uppercase m-0"
      style={{ fontSize: 10.5, fontWeight: 650, letterSpacing: '.08em', color: 'var(--faint)' }}
    >{children}</h3>
  )
}

/** Pill vai trò trong danh sách người làm. */
function PillVai({ role }: { role: string }) {
  const mau: Record<string, [string, string]> = {
    owner: ['var(--accent-wash)', 'var(--accent-ink)'],
    doer: ['var(--surface-3)', 'var(--ink-2)'],
    reviewer: ['var(--amber-wash)', 'var(--amber)'],
    watcher: ['var(--surface-3)', 'var(--muted)'],
  }
  const [bg, fg] = mau[role] ?? ['var(--surface-3)', 'var(--muted)']
  return (
    <span
      className="uppercase"
      style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.03em', padding: '3px 8px', borderRadius: 6, background: bg, color: fg }}
    >{NHAN_VAI_TRO[role] ?? role}</span>
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
    chiTietViec(taskId).then((kq) => {
      if (huy) return
      if (kq.ok) { setCt(kq.duLieu); setLoi(null) } else setLoi(kq.loi)
    })
    return () => { huy = true }
  }, [taskId])

  /** Bọc mọi thao tác ghi: hiện lỗi ngay tại panel, nạp lại, báo cho danh sách ngoài. */
  function chay(fn: () => Promise<KQ<unknown>>) {
    start(async () => {
      const kq = await fn()
      if (!kq.ok) { setLoi(kq.loi); return }
      const lai = await chiTietViec(taskId)
      if (lai.ok) { setCt(lai.duLieu); setLoi(null) } else setLoi(lai.loi)
      onDoi()
    })
  }

  const t = ct?.task
  const daGan = new Set((ct?.assignees ?? []).map((a) => a.staff_id))
  const conLai = nenTang.nhan_su.filter((s) => !daGan.has(s.id))

  return (
    <div data-khu="work" className="fixed inset-0 z-50 flex pointer-events-none" role="dialog" aria-label="Chi tiết việc">
      {/*
        KHÔNG phủ lớp tối lên danh sách: người dùng cần vẫn nhìn thấy bảng việc
        bên trái trong lúc đọc chi tiết bên phải. Vùng trái chỉ bắt click để
        đóng, hoàn toàn trong suốt.
      */}
      <button
        className="flex-1 pointer-events-auto"
        style={{ background: 'transparent' }}
        onClick={onDong}
        aria-label="Đóng bảng chi tiết"
      />
      <aside
        className="w-full h-full overflow-y-auto pointer-events-auto"
        style={{
          maxWidth: 520, background: 'var(--surface)',
          borderLeft: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-lg)',
        }}
      >
        <header
          className="sticky top-0 flex items-center gap-2.5 px-[18px] py-3.5"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        >
          <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--faint)' }}>{t?.ref ?? '…'}</span>
          {t && (
            <span
              className="inline-flex items-center gap-1.5"
              style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: 'var(--accent-wash)', color: 'var(--accent-ink)' }}
            >
              <span className="rounded-full" style={{ width: 7, height: 7, background: MAU_TRANG_THAI[t.status] }} />
              {TRANG_THAI.find((x) => x.v === t.status)?.nhan ?? t.status}
            </span>
          )}
          <span className="flex-1" />
          {t && (
            <button
              onClick={() => chay(() => doiTrangThai(t.id, t.status === 'done' ? 'todo' : 'done'))}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg"
              style={{
                fontSize: 12.5, fontWeight: 600, padding: '5px 11px',
                border: `1px solid ${t.status === 'done' ? 'var(--green)' : 'var(--border-strong)'}`,
                background: t.status === 'done' ? 'var(--green-wash)' : 'var(--surface)',
                color: t.status === 'done' ? 'var(--green)' : 'var(--ink-2)',
              }}
            >✓ {t.status === 'done' ? 'Đã xong — bỏ đánh dấu' : 'Đánh dấu xong'}</button>
          )}
          <button
            onClick={onDong}
            className="text-xl leading-none"
            style={{ color: 'var(--muted)' }}
            aria-label="Đóng"
          >×</button>
        </header>

        {loi && (
          <p
            className="mx-[18px] mt-3 px-3 py-2 rounded-lg"
            style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-wash)', border: '1px solid var(--red)' }}
          >{loi}</p>
        )}

        {!t || !ct ? (
          <p className="p-[18px]" style={{ fontSize: 13, color: 'var(--muted)' }}>Đang mở…</p>
        ) : (
          <div className="px-5 pt-[18px] pb-10 flex flex-col gap-[18px]">
            <div>
              <input
                defaultValue={t.title}
                disabled={!ct.co_the_sua || pending}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v && v !== t.title) chay(() => suaViec(t.id, { title: v }))
                }}
                className="w-full outline-none bg-transparent"
                style={{
                  fontSize: 19, fontWeight: 670, letterSpacing: '-.02em', lineHeight: 1.3,
                  color: 'var(--ink)', borderBottom: '1px solid transparent',
                }}
                aria-label="Tiêu đề"
              />
              <p className="mt-1.5" style={{ fontSize: 11.5, color: 'var(--faint)' }}>
                {t.creator_ten ? `${t.creator_ten} tạo` : 'Tạo'} {mocThoiGian(t.created_at)} · {t.origin === 'manual' ? 'thủ công' : 'tự sinh'}
                {t.due_at && ` · ${nhanHan(t.due_at)}`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 550 }}>
                Trạng thái
                <select
                  value={t.status}
                  disabled={pending}
                  onChange={(e) => chay(() => doiTrangThai(t.id, e.target.value))}
                  className="mt-1 w-full"
                  style={oNhap}
                >
                  {TRANG_THAI.map((s) => <option key={s.v} value={s.v}>{s.nhan}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 550 }}>
                Ưu tiên
                <select
                  value={t.priority}
                  disabled={!ct.co_the_sua || pending}
                  onChange={(e) => chay(() => suaViec(t.id, { priority: Number(e.target.value) }))}
                  className="mt-1 w-full"
                  style={oNhap}
                >
                  {[1, 2, 3, 4].map((p) => <option key={p} value={p}>{NHAN_UU_TIEN[p]}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 550 }}>
                Hạn
                <input
                  type="datetime-local"
                  defaultValue={inputTuIso(t.due_at)}
                  disabled={!ct.co_the_sua || pending}
                  onChange={(e) => chay(() => suaViec(t.id,
                    e.target.value ? { due: isoTuOInput(e.target.value) } : { xoa_due: true }))}
                  className="mt-1 w-full"
                  style={oNhap}
                />
              </label>
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 550 }}>
                Team
                <select
                  value={t.team_id ?? ''}
                  disabled={!ct.co_the_sua || pending}
                  onChange={(e) => chay(() => suaViec(t.id,
                    e.target.value ? { team_id: Number(e.target.value) } : { xoa_team: true }))}
                  className="mt-1 w-full"
                  style={oNhap}
                >
                  <option value="">— Không —</option>
                  {nenTang.teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
                </select>
              </label>
            </div>

            <label className="block" style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 550 }}>
              Mô tả
              <textarea
                defaultValue={t.description ?? ''}
                disabled={!ct.co_the_sua || pending}
                rows={3}
                onBlur={(e) => {
                  if (e.target.value !== (t.description ?? '')) chay(() => suaViec(t.id, { description: e.target.value }))
                }}
                className="mt-1 w-full resize-y"
                style={oNhap}
              />
            </label>

            {/* Người làm */}
            <section className="flex flex-col gap-2.5">
              <Nhan>Người làm</Nhan>
              <ul className="space-y-1.5 list-none p-0 m-0">
                {ct.assignees.map((a) => (
                  <li
                    key={a.staff_id}
                    className="flex items-center gap-2.5 px-2.5 py-2"
                    style={{ border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface-2)' }}
                  >
                    <Avatar ten={a.ten} co={26} vien={a.role === 'owner'} />
                    <span className="flex-1 truncate" style={{ fontSize: 13, fontWeight: 600 }}>{a.ten}</span>
                    {!ct.co_the_sua && <PillVai role={a.role} />}
                    {ct.co_the_sua && (
                      <select
                        value={a.role}
                        disabled={pending}
                        onChange={(e) => chay(() => ganNguoi(t.id, a.staff_id, e.target.value))}
                        style={{ ...oNhap, fontSize: 11.5, padding: '3px 7px' }}
                        aria-label={`Vai trò của ${a.ten}`}
                      >
                        {VAI_TRO.map((r) => <option key={r.v} value={r.v}>{r.nhan}</option>)}
                      </select>
                    )}
                    {ct.co_the_sua && ct.assignees.length > 1 && (
                      <button
                        onClick={() => chay(() => boNguoi(t.id, a.staff_id))}
                        disabled={pending}
                        className="text-lg leading-none"
                        style={{ color: 'var(--faint)' }}
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
                    className="flex-1"
                    style={oNhap}
                    aria-label="Thêm người"
                  >
                    <option value="">+ Thêm người…</option>
                    {conLai.map((s) => <option key={s.id} value={s.id}>{s.ten}</option>)}
                  </select>
                  <select
                    value={themVai}
                    onChange={(e) => setThemVai(e.target.value)}
                    style={oNhap}
                    aria-label="Vai trò người thêm"
                  >
                    {VAI_TRO.map((r) => <option key={r.v} value={r.v}>{r.nhan}</option>)}
                  </select>
                  <Nut
                    chinh
                    disabled={!themAi || pending}
                    onClick={() => { const ai = themAi; setThemAi(''); chay(() => ganNguoi(t.id, ai, themVai)) }}
                  >Gán</Nut>
                </div>
              )}
            </section>

            {ct.subtasks.length > 0 && (
              <section className="flex flex-col gap-2.5">
                <Nhan>Việc con</Nhan>
                <ul className="space-y-1 list-none p-0 m-0">
                  {ct.subtasks.map((s) => (
                    <li key={s.id} className="flex gap-2 items-center" style={{ fontSize: 13 }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--faint)' }}>{s.ref}</span>
                      <span className="flex-1 truncate">{s.title}</span>
                      <Chip chamMau={MAU_TRANG_THAI[s.status]}>
                        {TRANG_THAI.find((x) => x.v === s.status)?.nhan ?? s.status}
                      </Chip>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Bình luận */}
            <section className="flex flex-col gap-2.5">
              <Nhan>Bình luận</Nhan>
              <ul className="space-y-2.5 list-none p-0 m-0">
                {ct.comments.map((c) => (
                  <li key={c.id} className="flex gap-2.5">
                    <Avatar ten={c.ten ?? '?'} co={26} />
                    <div className="min-w-0 flex-1">
                      <p style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>
                        {c.ten}
                        <span className="mono" style={{ fontWeight: 400, color: 'var(--faint)', marginLeft: 6 }}>
                          {mocThoiGian(c.created_at)}
                        </span>
                      </p>
                      <p
                        className="whitespace-pre-wrap break-words mt-0.5 px-2.5 py-2"
                        style={{ fontSize: 13, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9 }}
                      >{c.body}</p>
                    </div>
                  </li>
                ))}
                {ct.comments.length === 0 && (
                  <li style={{ fontSize: 13, color: 'var(--faint)' }}>Chưa có bình luận.</li>
                )}
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
                  className="flex-1"
                  style={oNhap}
                />
                <Nut chinh type="submit" disabled={pending || !binhLuan.trim()}>Gửi</Nut>
              </form>
            </section>

            {/* Nhật ký */}
            <section className="flex flex-col gap-2.5">
              <Nhan>Nhật ký</Nhan>
              <ul className="list-none p-0 m-0 flex flex-col">
                {ct.activity.map((a, i) => (
                  <li key={a.id} className="flex gap-2.5">
                    <span className="flex flex-col items-center flex-none">
                      <span
                        className="grid place-items-center rounded-full"
                        style={{
                          width: 24, height: 24, fontSize: 10, fontWeight: 700,
                          background: i === 0 ? 'var(--accent)' : 'var(--surface-3)',
                          color: i === 0 ? '#fff' : 'var(--muted)',
                          border: `1px solid ${i === 0 ? 'var(--accent)' : 'var(--border)'}`,
                        }}
                      >•</span>
                      {i < ct.activity.length - 1 && (
                        <span className="w-0.5 flex-1 my-0.5" style={{ background: 'var(--border)' }} />
                      )}
                    </span>
                    <span className="pt-0.5 pb-3" style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                      <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{a.ten ?? 'Ai đó'}</b>{' '}
                      {moTaNhatKy(a.verb, a.payload)}
                      <span className="mono block" style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>
                        {mocThoiGian(a.created_at)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <div
              className="h-1 rounded-full"
              style={{ background: MAU_UT_VAR[t.priority] ?? 'var(--border-strong)' }}
              aria-hidden
            />
            <p style={{ fontSize: 11.5, color: 'var(--faint)' }}>
              {ct.co_the_sua ? 'Bạn sửa được việc này.' : 'Chỉ xem — bạn không phải người tạo hay người làm.'}
              {' '}Ai xem được: {NHAN_PHAM_VI[t.visibility] ?? t.visibility}.
            </p>
          </div>
        )}
      </aside>
    </div>
  )
}
