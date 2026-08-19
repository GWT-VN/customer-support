'use client'

/**
 * Thanh thao tác hàng loạt — hiện lên khi chọn ≥1 việc, dính đáy màn hình.
 *
 * Dính đáy chứ không nằm trên đầu danh sách: chọn tới việc thứ 30 thì thanh ở
 * đầu trang đã trôi mất, phải cuộn ngược lên mới bấm được.
 *
 * Mỗi nút gọi đúng MỘT lượt RPC cho cả mớ, không lặp n lần — nửa chừng rớt mạng
 * thì dữ liệu dở dang.
 */
import { useState, useTransition } from 'react'
import { hangLoat, type NenTang } from '@/app/work/actions'
import { TRANG_THAI, VAI_TRO, NHAN_UU_TIEN, isoTuOInput } from '@/lib/work'
import { Nut, oNhap } from './ui'

export function ThanhHangLoat({
  ids, nenTang, onXong, onBoChon,
}: {
  ids: number[]
  nenTang: NenTang
  onXong: (thongBao: string) => void
  onBoChon: () => void
}) {
  const [pending, start] = useTransition()
  const [vai, setVai] = useState('doer')
  const [moThem, setMoThem] = useState(false)

  function chay(input: Parameters<typeof hangLoat>[1], mo_ta: string) {
    start(async () => {
      try {
        const kq = await hangLoat(ids, input)
        onXong(
          `${mo_ta}: ${kq.da_sua} việc` +
          (kq.bo_qua > 0 ? ` · bỏ qua ${kq.bo_qua} việc bạn không có quyền sửa` : '')
        )
      } catch (e) {
        onXong(e instanceof Error ? `Lỗi: ${e.message}` : 'Thao tác không thành công')
      }
    })
  }

  const o: React.CSSProperties = { ...oNhap, fontSize: 12.5, padding: '6px 9px' }

  return (
    <div
      className="fixed left-0 right-0 bottom-0 z-40 px-4 py-3"
      style={{ background: 'var(--surface)', borderTop: '1px solid var(--border-strong)', boxShadow: '0 -8px 24px -12px rgba(14,28,31,.25)' }}
      role="region"
      aria-label="Thao tác hàng loạt"
    >
      <div className="max-w-5xl mx-auto flex items-center gap-2 flex-wrap">
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          Đã chọn <span className="so">{ids.length}</span> việc
        </span>
        <button onClick={onBoChon} className="underline" style={{ fontSize: 12, color: 'var(--muted)' }}>
          Bỏ chọn
        </button>

        <span className="w-px h-6 mx-1" style={{ background: 'var(--border)' }} aria-hidden />

        <select
          defaultValue="" disabled={pending} style={o} aria-label="Chuyển trạng thái"
          onChange={(e) => { if (e.target.value) { chay({ status: e.target.value }, 'Đã chuyển trạng thái'); e.target.value = '' } }}
        >
          <option value="">Chuyển trạng thái…</option>
          {TRANG_THAI.map((s) => <option key={s.v} value={s.v}>{s.nhan}</option>)}
          <option value="cancelled">Huỷ việc</option>
        </select>

        <span className="flex items-center gap-1">
          <select
            defaultValue="" disabled={pending} style={o} aria-label="Giao cho"
            onChange={(e) => { if (e.target.value) { chay({ gan_ai: e.target.value, gan_vai: vai }, 'Đã giao việc'); e.target.value = '' } }}
          >
            <option value="">Giao cho…</option>
            {nenTang.nhan_su.map((s) => <option key={s.id} value={s.id}>{s.ten}</option>)}
          </select>
          <select
            value={vai} onChange={(e) => setVai(e.target.value)} disabled={pending}
            style={{ ...o, padding: '6px 7px' }} aria-label="Vai trò khi giao"
          >
            {VAI_TRO.map((r) => <option key={r.v} value={r.v}>{r.nhan}</option>)}
          </select>
        </span>

        <select
          defaultValue="" disabled={pending} style={o} aria-label="Đổi ưu tiên"
          onChange={(e) => { if (e.target.value) { chay({ priority: Number(e.target.value) }, 'Đã đổi ưu tiên'); e.target.value = '' } }}
        >
          <option value="">Ưu tiên…</option>
          {[1, 2, 3, 4].map((p) => <option key={p} value={p}>{NHAN_UU_TIEN[p]}</option>)}
        </select>

        <button
          onClick={() => setMoThem((v) => !v)}
          style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-ink)' }}
        >{moThem ? '− Bớt' : '+ Hạn, team, bỏ người'}</button>

        <span className="flex-1" />
        {pending && <span style={{ fontSize: 12, color: 'var(--faint)' }}>Đang áp…</span>}
      </div>

      {moThem && (
        <div className="max-w-5xl mx-auto flex items-center gap-2 flex-wrap mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <label style={{ fontSize: 12, color: 'var(--muted)' }}>
            Hạn{' '}
            <input
              type="datetime-local" disabled={pending} style={o} aria-label="Đặt hạn hàng loạt"
              onChange={(e) => { const v = isoTuOInput(e.target.value); if (v) chay({ due: v }, 'Đã đặt hạn') }}
            />
          </label>
          <Nut disabled={pending} onClick={() => chay({ xoa_due: true }, 'Đã bỏ hạn')} style={{ fontSize: 12, padding: '6px 10px' }}>
            Bỏ hạn
          </Nut>

          <select
            defaultValue="" disabled={pending} style={o} aria-label="Chuyển team"
            onChange={(e) => { if (e.target.value) { chay({ team_id: Number(e.target.value) }, 'Đã chuyển team'); e.target.value = '' } }}
          >
            <option value="">Chuyển team…</option>
            {nenTang.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          <select
            defaultValue="" disabled={pending} style={o} aria-label="Bỏ người khỏi việc"
            onChange={(e) => { if (e.target.value) { chay({ bo_ai: e.target.value }, 'Đã bỏ người'); e.target.value = '' } }}
          >
            <option value="">Bỏ người khỏi việc…</option>
            {nenTang.nhan_su.map((s) => <option key={s.id} value={s.id}>{s.ten}</option>)}
          </select>

          <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>
            Việc nào bỏ xong mà hết người thì được giữ lại — việc không thể mồ côi.
          </span>
        </div>
      )}
    </div>
  )
}
