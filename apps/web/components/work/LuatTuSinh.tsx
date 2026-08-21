'use client'

/**
 * Một luật sinh việc — bật/tắt, chọn người nhận, và mở ra chỉnh tham số.
 *
 * Tách khỏi TuSinh.tsx vì mỗi luật giờ có state riêng (đang mở form? đang xem
 * trước?) — nhồi hết vào component cha thì phải quản một mớ Map theo key.
 *
 * "Xem trước" tồn tại vì chỉnh ngưỡng xong mà phải bấm Chạy mới biết hậu quả là
 * quá muộn: chạy rồi thì việc đã sinh ra thật, phải đi xoá.
 */
import { useState, useTransition } from 'react'
import { suaLuat, thuLuat, batTatLuat, doiNguoiNhan, type LuatTuSinh as Luat, type NenTang, type ThuLuat } from '@/app/work/actions'
import { NHAN_UU_TIEN, ngayThang } from '@/lib/work'
import { Chip, Nut, oNhap, MAU_UT_VAR } from './ui'

const MAU_NGUON: Record<string, string> = {
  CSKH: '#b5642a', Sales: '#2f7d8a', 'Kỹ thuật': '#5560c9', Marketing: '#b0518f',
}

/** Mỗi luật đọc sự kiện theo một trục thời gian khác nhau — nói rõ bằng tiếng Việt. */
const GIAI_THICH: Record<string, { nguong?: string; cuaSo?: string }> = {
  ticket_khong_nguoi: { nguong: 'Ticket phải mở quá bao nhiêu giờ mà chưa ai nhận' },
  bao_tri_toi_han: { cuaSo: 'Nhìn lượt bảo trì tới hạn trong khoảng ± bao nhiêu ngày' },
  bh_cho_kich_hoat: { cuaSo: 'Chỉ xét máy lắp trong bao nhiêu ngày gần đây (bỏ trống = mọi máy)' },
}

function gioChay(iso: string | null): string {
  if (!iso) return 'chưa chạy lần nào'
  const d = new Date(iso)
  const phut = Math.round((Date.now() - d.getTime()) / 60000)
  if (phut < 1) return 'vừa xong'
  if (phut < 60) return `${phut} phút trước`
  if (phut < 60 * 24) return `${Math.round(phut / 60)} giờ trước`
  return ngayThang(d)
}

export function LuatTuSinh({
  l, nenTang, duocSuaLuat, cuoi, onXong, onLoi,
}: {
  l: Luat
  nenTang: NenTang
  duocSuaLuat: boolean
  cuoi: boolean
  onXong: () => void
  onLoi: (s: string) => void
}) {
  const [pending, start] = useTransition()
  const [moSua, setMoSua] = useState(false)
  const [thu, setThu] = useState<ThuLuat | null>(null)

  // Bản nháp — chỉ ghi khi bấm Lưu, để chỉnh nhầm còn bấm Huỷ được.
  const [nhap, setNhap] = useState({
    priority: l.priority,
    han_ngay: l.han_ngay,
    max_moi_lan: l.max_moi_lan,
    nguong_gio: l.nguong_gio,
    cua_so_ngay: l.cua_so_ngay,
    team_key: l.team_key ?? '',
  })

  const gt = GIAI_THICH[l.key] ?? {}

  function chay(fn: () => Promise<{ ok: boolean; loi?: string }>, sauKhiXong?: () => void) {
    start(async () => {
      const kq = await fn()
      if (!kq.ok) { onLoi(kq.loi ?? 'Thao tác không thành công'); return }
      sauKhiXong?.()
      onXong()
    })
  }

  function xemTruoc() {
    start(async () => {
      const kq = await thuLuat(l.key)
      if (!kq.ok) { onLoi(kq.loi); return }
      setThu(kq.duLieu)
    })
  }

  const o: React.CSSProperties = { ...oNhap, fontSize: 12.5, padding: '5px 8px' }
  const oSo: React.CSSProperties = { ...o, width: 72 }

  return (
    <li
      className="p-3.5"
      style={{ borderBottom: cuoi ? 'none' : '1px solid var(--border)' }}
    >
      <div className="flex items-start gap-3">
        <span
          className="w-[3px] self-stretch rounded-full flex-none"
          style={{ background: l.active ? (MAU_UT_VAR[l.priority] ?? 'var(--border-strong)') : 'var(--border)' }}
          aria-hidden
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontSize: 13.5, fontWeight: 600, color: l.active ? 'var(--ink)' : 'var(--muted)' }}>
              {l.name}
            </span>
            <Chip chamMau={MAU_NGUON[l.nguon] ?? 'var(--faint)'}>{l.nguon}</Chip>
            <Chip>{NHAN_UU_TIEN[l.priority] ?? `P${l.priority}`}</Chip>
            <Chip>hạn +{l.han_ngay} ngày</Chip>
            {l.nguong_gio != null && <Chip>sau {l.nguong_gio} giờ</Chip>}
            {l.cua_so_ngay != null && <Chip>±{l.cua_so_ngay} ngày</Chip>}
            <Chip>tối đa {l.max_moi_lan}/lượt</Chip>
          </div>

          {l.mo_ta && <p className="mt-1 m-0" style={{ fontSize: 12.5, color: 'var(--muted)' }}>{l.mo_ta}</p>}

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>
              Giao cho{' '}
              <select
                value={l.nguoi_nhan ?? ''}
                disabled={!duocSuaLuat || pending}
                onChange={(e) => chay(() => doiNguoiNhan(l.key, e.target.value || null))}
                style={o}
                aria-label={`Người nhận việc của luật ${l.name}`}
              >
                <option value="">Quản lý CSKH (mặc định)</option>
                {nenTang.nhan_su.map((s) => <option key={s.id} value={s.id}>{s.ten}</option>)}
              </select>
            </label>
            <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>
              · quét {gioChay(l.last_run_at)}{l.last_created > 0 && `, sinh ${l.last_created} việc`}
            </span>
            {duocSuaLuat && (
              <>
                <button
                  onClick={() => setMoSua((v) => !v)}
                  style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-ink)' }}
                >{moSua ? '− Đóng' : '⚙ Chỉnh luật'}</button>
                <button
                  onClick={xemTruoc}
                  disabled={pending}
                  style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-ink)' }}
                >👁 Xem trước</button>
              </>
            )}
          </div>
        </div>

        <button
          onClick={() => chay(() => batTatLuat(l.key, !l.active))}
          disabled={!duocSuaLuat || pending}
          aria-pressed={l.active}
          className="flex-none"
          style={{
            fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 20,
            border: `1px solid ${l.active ? 'var(--green)' : 'var(--border-strong)'}`,
            background: l.active ? 'var(--green-wash)' : 'var(--surface-2)',
            color: l.active ? 'var(--green)' : 'var(--muted)',
            opacity: duocSuaLuat ? 1 : .6,
          }}
        >{l.active ? 'Bật' : 'Tắt'}</button>
      </div>

      {/* ── Chỉnh tham số ── */}
      {moSua && (
        <div
          className="mt-3 p-3 rounded-xl"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          <div className="flex flex-wrap gap-x-4 gap-y-3">
            <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>
              <span className="block mb-1">Ưu tiên việc sinh ra</span>
              <select value={nhap.priority} style={o}
                onChange={(e) => setNhap({ ...nhap, priority: Number(e.target.value) })}>
                {[1, 2, 3, 4].map((p) => <option key={p} value={p}>{NHAN_UU_TIEN[p]}</option>)}
              </select>
            </label>

            <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>
              <span className="block mb-1">Hạn = hôm nay + ? ngày</span>
              <input type="number" min={0} max={365} value={nhap.han_ngay} style={oSo}
                onChange={(e) => setNhap({ ...nhap, han_ngay: Number(e.target.value) })} />
            </label>

            {gt.nguong && (
              <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                <span className="block mb-1">Ngưỡng (giờ)</span>
                <input type="number" min={0} max={720} value={nhap.nguong_gio ?? ''} style={oSo}
                  onChange={(e) => setNhap({ ...nhap, nguong_gio: e.target.value === '' ? null : Number(e.target.value) })} />
              </label>
            )}

            {gt.cuaSo && (
              <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                <span className="block mb-1">Cửa sổ (ngày)</span>
                <input type="number" min={1} max={365} value={nhap.cua_so_ngay ?? ''} style={oSo}
                  placeholder="—"
                  onChange={(e) => setNhap({ ...nhap, cua_so_ngay: e.target.value === '' ? null : Number(e.target.value) })} />
              </label>
            )}

            <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>
              <span className="block mb-1">Việc thuộc team</span>
              <select value={nhap.team_key} style={o}
                onChange={(e) => setNhap({ ...nhap, team_key: e.target.value })}>
                {nenTang.teams.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
              </select>
            </label>

            <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>
              <span className="block mb-1">Tối đa mỗi lượt</span>
              <input type="number" min={1} max={200} value={nhap.max_moi_lan} style={oSo}
                onChange={(e) => setNhap({ ...nhap, max_moi_lan: Number(e.target.value) })} />
            </label>
          </div>

          <p className="mt-2 mb-0" style={{ fontSize: 11.5, color: 'var(--faint)' }}>
            {gt.nguong && <>· {gt.nguong}. </>}
            {gt.cuaSo && <>· {gt.cuaSo}. </>}
            · &ldquo;Tối đa mỗi lượt&rdquo; chặn việc đổ hàng chục việc lên đầu một người khi chạy lần đầu;
            phần còn lại lượt sau lấy tiếp.
          </p>

          <div className="flex gap-2 mt-3">
            <Nut chinh disabled={pending}
              onClick={() => chay(() => suaLuat(l.key, nhap), () => { setMoSua(false); setThu(null) })}>
              Lưu luật
            </Nut>
            <Nut disabled={pending} onClick={() => {
              setNhap({
                priority: l.priority, han_ngay: l.han_ngay, max_moi_lan: l.max_moi_lan,
                nguong_gio: l.nguong_gio, cua_so_ngay: l.cua_so_ngay, team_key: l.team_key ?? '',
              })
              setMoSua(false)
            }}>Huỷ</Nut>
          </div>
        </div>
      )}

      {/* ── Xem trước ── */}
      {thu && (
        <div
          className="mt-3 p-3 rounded-xl"
          style={{ background: 'var(--accent-wash)', border: '1px solid #bfe2e5' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <b style={{ fontSize: 12.5, color: 'var(--accent-ink)' }}>
              Chạy bây giờ sẽ sinh {thu.se_sinh.length} việc
            </b>
            <span className="flex-1" />
            <button onClick={() => setThu(null)} style={{ fontSize: 12, color: 'var(--accent-ink)' }}>Đóng</button>
          </div>
          {thu.se_sinh.length === 0 ? (
            <p className="m-0" style={{ fontSize: 12.5, color: 'var(--accent-ink)' }}>
              Không có sự kiện nào khớp — mọi thứ đã sinh việc rồi, hoặc tham số đang quá chặt.
            </p>
          ) : (
            <ul className="list-none p-0 m-0 space-y-1">
              {thu.se_sinh.map((x) => (
                <li key={x.khoa} className="flex gap-2" style={{ fontSize: 12.5 }}>
                  <span className="mono" style={{ color: 'var(--accent-ink)', minWidth: 120 }}>{x.khoa}</span>
                  <span className="flex-1 truncate">{x.mo_ta}</span>
                  <span className="mono" style={{ color: 'var(--muted)' }}>{x.moc}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 mb-0" style={{ fontSize: 11.5, color: 'var(--accent-ink)', opacity: .8 }}>
            Đây chỉ là xem trước — chưa việc nào được tạo.
          </p>
        </div>
      )}
    </li>
  )
}
