'use client'

/**
 * Một dòng việc — dùng chung cho "Việc của tôi" và "Bảng team".
 * Bám mockup: thanh ưu tiên 3px dọc mép trái, ô tick bo 6px, tiêu đề 1 dòng,
 * hàng meta là chip, bên phải là hạn + chồng avatar.
 *
 * Ô tick và ô trạng thái ghi thẳng; phần thân bấm vào là mở panel chi tiết.
 */
import type { NguoiLam } from '@/app/work/actions'
import { TRANG_THAI, NHAN_VAI_TRO, nhanHan } from '@/lib/work'
import { Chip, ChongAvatar, MAU_UT_VAR, MAU_TRANG_THAI } from './ui'

export type ViecHienThi = {
  id: number
  ref: string
  title: string
  status: string
  priority: number
  due_at: string | null
  team_name: string | null
  team_color: string | null
  sub_n: number
  assignees: NguoiLam[]
  my_role?: string | null
}

export function DongViec({
  v, pending, onDoiTrangThai, onMo, cuoi = false, dangChon, onChon,
}: {
  v: ViecHienThi
  pending: boolean
  onDoiTrangThai: (id: number, status: string) => void
  onMo: (id: number) => void
  cuoi?: boolean
  /** Có ô chọn hay không — truyền onChon thì ô hiện ra. */
  dangChon?: boolean
  onChon?: (id: number, chon: boolean) => void
}) {
  const han = nhanHan(v.due_at)
  const quaHan = han.startsWith('Quá hạn')
  const homNay = han === 'Hôm nay'
  const xong = v.status === 'done'

  return (
    <li
      className="flex items-stretch gap-3 relative"
      style={{
        borderBottom: cuoi ? 'none' : '1px solid var(--border)',
        background: dangChon ? 'var(--accent-wash)' : undefined,
      }}
    >
      {/* thanh ưu tiên chạy hết chiều cao dòng — đọc lướt là thấy việc gấp */}
      <span
        className="w-[3px] flex-none"
        style={{ background: MAU_UT_VAR[v.priority] ?? 'var(--border-strong)', borderRadius: '0 3px 3px 0' }}
        aria-hidden
      />

      <span className="flex items-center gap-3 flex-1 min-w-0 py-3 pr-4">
        {onChon && (
          <input
            type="checkbox"
            checked={!!dangChon}
            onChange={(e) => onChon(v.id, e.target.checked)}
            aria-label={`Chọn việc ${v.title}`}
            className="flex-none"
            style={{ width: 15, height: 15, accentColor: 'var(--accent)' }}
          />
        )}
        <button
          onClick={() => onDoiTrangThai(v.id, xong ? 'todo' : 'done')}
          disabled={pending}
          aria-label={xong ? `Bỏ đánh dấu xong: ${v.title}` : `Đánh dấu xong: ${v.title}`}
          className="grid place-items-center flex-none transition-colors"
          style={{
            width: 19, height: 19, borderRadius: 6,
            border: `1.7px solid ${xong ? 'var(--green)' : 'var(--border-strong)'}`,
            background: xong ? 'var(--green)' : 'transparent',
            color: xong ? '#fff' : 'transparent',
            fontSize: 11, lineHeight: 1,
          }}
        >✓</button>

        <button onClick={() => onMo(v.id)} className="min-w-0 flex-1 text-left flex flex-col gap-[5px]">
          <span
            className="truncate"
            style={{
              fontWeight: 560, fontSize: 14, letterSpacing: '-.006em',
              color: xong ? 'var(--muted)' : 'var(--ink)',
              textDecoration: xong ? 'line-through' : undefined,
            }}
          >{v.title}</span>
          <span className="flex items-center gap-[7px] flex-wrap">
            <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--faint)' }}>{v.ref}</span>
            {v.team_name && <Chip chamMau={v.team_color ?? 'var(--faint)'}>{v.team_name}</Chip>}
            {v.my_role && (
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)' }}>
                {NHAN_VAI_TRO[v.my_role] ?? v.my_role}
              </span>
            )}
            {v.sub_n > 0 && (
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)' }}>{v.sub_n} việc con</span>
            )}
          </span>
        </button>

        <span className="flex items-center gap-3.5 flex-none pl-1.5">
          {han && (
            <span
              className="so whitespace-nowrap"
              style={{
                fontSize: 12, fontWeight: 600,
                color: quaHan ? 'var(--red)' : homNay ? 'var(--amber)' : 'var(--muted)',
              }}
            >{han}</span>
          )}
          <ChongAvatar
            nguoi={v.assignees.map((a) => ({
              ten: a.ten, role: a.role, chuThich: `${a.ten} · ${NHAN_VAI_TRO[a.role] ?? a.role}`,
            }))}
          />
          <select
            value={v.status}
            onChange={(e) => onDoiTrangThai(v.id, e.target.value)}
            disabled={pending}
            aria-label={`Trạng thái của ${v.title}`}
            className="flex-none"
            style={{
              fontSize: 11.5, fontWeight: 600, padding: '4px 8px', borderRadius: 7,
              border: '1px solid var(--border)', background: 'var(--surface-2)',
              color: MAU_TRANG_THAI[v.status] ?? 'var(--ink-2)', outline: 'none',
            }}
          >
            {TRANG_THAI.map((s) => <option key={s.v} value={s.v}>{s.nhan}</option>)}
          </select>
        </span>
      </span>
    </li>
  )
}
