'use client'

/**
 * Một dòng việc trong danh sách — dùng chung cho "Việc của tôi" và "Bảng team".
 * Ô tick và ô trạng thái ghi thẳng; phần còn lại bấm vào là mở panel chi tiết.
 */
import type { NguoiLam } from '@/app/work/actions'
import { TRANG_THAI, NHAN_VAI_TRO, MAU_UU_TIEN, chuTat, nhanHan } from '@/lib/work'

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
  v, pending, onDoiTrangThai, onMo,
}: {
  v: ViecHienThi
  pending: boolean
  onDoiTrangThai: (id: number, status: string) => void
  onMo: (id: number) => void
}) {
  const han = nhanHan(v.due_at)
  const quaHan = han.startsWith('Quá hạn')
  const xong = v.status === 'done'

  return (
    <li className="flex items-center gap-3 p-3 hover:bg-slate-50">
      <button
        onClick={() => onDoiTrangThai(v.id, xong ? 'todo' : 'done')}
        disabled={pending}
        aria-label={xong ? `Bỏ đánh dấu xong: ${v.title}` : `Đánh dấu xong: ${v.title}`}
        className={`w-5 h-5 rounded-md border flex-none grid place-items-center text-white text-xs ${
          xong ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 hover:border-emerald-500'
        }`}
      >
        {xong ? '✓' : ''}
      </button>

      <span className={`w-1.5 h-9 rounded-full flex-none ${MAU_UU_TIEN[v.priority] ?? 'bg-slate-300'}`} aria-hidden />

      <button onClick={() => onMo(v.id)} className="min-w-0 flex-1 text-left">
        <span className={`block text-sm font-medium truncate ${xong ? 'line-through text-slate-400' : 'text-slate-800'}`}>
          {v.title}
        </span>
        <span className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[11px] font-mono text-slate-400">{v.ref}</span>
          {v.team_name && (
            <span
              className="text-[11px] px-1.5 py-0.5 rounded-full border text-slate-600"
              style={{ borderColor: (v.team_color ?? '#cbd5e1') + '66' }}
            >{v.team_name}</span>
          )}
          {v.my_role && <span className="text-[11px] text-slate-400">{NHAN_VAI_TRO[v.my_role] ?? v.my_role}</span>}
          {v.sub_n > 0 && <span className="text-[11px] text-slate-400">{v.sub_n} việc con</span>}
          {han && (
            <span className={`text-[11px] font-medium ${quaHan ? 'text-red-600' : han === 'Hôm nay' ? 'text-amber-600' : 'text-slate-500'}`}>
              {han}
            </span>
          )}
        </span>
      </button>

      <span className="flex -space-x-1.5 flex-none" aria-label="Người làm">
        {v.assignees.slice(0, 3).map((a) => (
          <span
            key={a.staff_id}
            title={`${a.ten} · ${NHAN_VAI_TRO[a.role] ?? a.role}`}
            className="w-6 h-6 rounded-full grid place-items-center text-[10px] font-semibold text-white bg-slate-500 ring-2 ring-white"
          >{chuTat(a.ten)}</span>
        ))}
        {v.assignees.length > 3 && (
          <span className="w-6 h-6 rounded-full grid place-items-center text-[10px] font-semibold text-slate-600 bg-slate-200 ring-2 ring-white">
            +{v.assignees.length - 3}
          </span>
        )}
      </span>

      <select
        value={v.status}
        onChange={(e) => onDoiTrangThai(v.id, e.target.value)}
        disabled={pending}
        aria-label={`Trạng thái của ${v.title}`}
        className="text-xs px-2 py-1 rounded-md border border-slate-200 text-slate-600 bg-white flex-none"
      >
        {TRANG_THAI.map((s) => <option key={s.v} value={s.v}>{s.nhan}</option>)}
      </select>
    </li>
  )
}
