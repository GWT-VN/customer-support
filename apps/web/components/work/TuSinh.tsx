'use client'

/**
 * "Việc tự sinh từ ERP" — bật/tắt luật, chọn người nhận, chạy tay, xem việc vừa sinh.
 *
 * Bộ quét chạy dưới DB (pg_cron, mỗi 15 phút) chứ không phải ở app: nó phải chạy
 * kể cả khi không ai mở trình duyệt. Nút "Chạy ngay" chỉ để xem kết quả liền.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  chayTuSinh, batTatLuat, doiNguoiNhan, type ManTuSinh, type NenTang,
} from '@/app/work/actions'
import { NHAN_UU_TIEN, nhanHan, ngayThang } from '@/lib/work'
import { DongViec } from './DongViec'
import { ChiTietViec } from './ChiTietViec'
import { Chip, Nut, oNhap, MAU_UT_VAR } from './ui'

/** Nguồn sự kiện → màu chip, khớp màu module ở nav. */
const MAU_NGUON: Record<string, string> = {
  CSKH: '#b5642a', Sales: '#2f7d8a', 'Kỹ thuật': '#5560c9', Marketing: '#b0518f',
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

export function TuSinh({ duLieu, nenTang }: { duLieu: ManTuSinh; nenTang: NenTang }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [loi, setLoi] = useState<string | null>(null)
  const [ketQua, setKetQua] = useState<string | null>(null)
  const [mo, setMo] = useState<number | null>(null)

  function chay(fn: () => Promise<void>) {
    start(async () => {
      try {
        await fn()
        setLoi(null)
        router.refresh()
      } catch (e) {
        setLoi(e instanceof Error ? e.message : 'Thao tác không thành công')
      }
    })
  }

  function bamChayNgay() {
    start(async () => {
      try {
        const kq = await chayTuSinh()
        const tong = kq.reduce((n, x) => n + x.da_tao, 0)
        setKetQua(tong === 0
          ? 'Quét xong — không có việc nào mới.'
          : `Quét xong — sinh ${tong} việc mới: ` +
            kq.filter((x) => x.da_tao > 0).map((x) => `${x.luat} (${x.da_tao})`).join(', '))
        setLoi(null)
        router.refresh()
      } catch (e) {
        setKetQua(null)
        setLoi(e instanceof Error ? e.message : 'Không chạy được bộ quét')
      }
    })
  }

  const soBat = duLieu.luat.filter((l) => l.active).length

  return (
    <div className="space-y-5">
      <div
        className="flex gap-2.5 px-3.5 py-3 rounded-xl"
        style={{ background: 'var(--accent-wash)', border: '1px solid #bfe2e5', color: 'var(--accent-ink)', fontSize: 12.5 }}
      >
        <span aria-hidden>ⓘ</span>
        <span>
          Bộ quét chạy dưới DB <b>mỗi 15 phút</b> (pg_cron), không phụ thuộc ai mở app.
          Mỗi việc mang khoá của sự kiện gốc nên chạy lại bao nhiêu lần cũng không đẻ trùng.
          Mỗi lượt lấy tối đa <b>15 việc/luật</b> để lần đầu không đổ hàng chục việc lên đầu một người.
        </span>
      </div>

      {loi && (
        <p className="px-3 py-2 rounded-lg"
           style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-wash)', border: '1px solid var(--red)' }}>{loi}</p>
      )}
      {ketQua && (
        <p className="px-3 py-2 rounded-lg"
           style={{ fontSize: 13, color: 'var(--green)', background: 'var(--green-wash)', border: '1px solid var(--green)' }}>{ketQua}</p>
      )}

      {/* ── Luật ── */}
      <section>
        <div className="flex items-center gap-2.5 mb-2.5">
          <h2 className="m-0" style={{ fontSize: 14.5, fontWeight: 650 }}>Luật sinh việc</h2>
          <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', background: 'var(--surface-3)', padding: '2px 8px', borderRadius: 20 }}>
            {soBat}/{duLieu.luat.length} bật
          </span>
          <span className="flex-1" />
          {duLieu.la_quan_ly && (
            <Nut chinh onClick={bamChayNgay} disabled={pending}>
              {pending ? 'Đang quét…' : 'Chạy ngay'}
            </Nut>
          )}
        </div>

        <ul className="list-none p-0 m-0 overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11, boxShadow: 'var(--shadow)' }}>
          {duLieu.luat.map((l, i) => (
            <li key={l.key} className="flex items-start gap-3 p-3.5"
                style={{ borderBottom: i === duLieu.luat.length - 1 ? 'none' : '1px solid var(--border)' }}>
              <span className="w-[3px] self-stretch rounded-full flex-none"
                    style={{ background: l.active ? (MAU_UT_VAR[l.priority] ?? 'var(--border-strong)') : 'var(--border)' }} aria-hidden />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: l.active ? 'var(--ink)' : 'var(--muted)' }}>{l.name}</span>
                  <Chip chamMau={MAU_NGUON[l.nguon] ?? 'var(--faint)'}>{l.nguon}</Chip>
                  <Chip>{NHAN_UU_TIEN[l.priority] ?? `P${l.priority}`}</Chip>
                  <Chip>hạn +{l.han_ngay} ngày</Chip>
                </div>
                {l.mo_ta && <p className="mt-1 m-0" style={{ fontSize: 12.5, color: 'var(--muted)' }}>{l.mo_ta}</p>}

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <label style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                    Giao cho{' '}
                    <select
                      value={l.nguoi_nhan ?? ''}
                      disabled={!duLieu.la_quan_ly || pending}
                      onChange={(e) => chay(() => doiNguoiNhan(l.key, e.target.value || null))}
                      style={{ ...oNhap, fontSize: 12, padding: '3px 8px' }}
                      aria-label={`Người nhận việc của luật ${l.name}`}
                    >
                      <option value="">Quản lý CSKH (mặc định)</option>
                      {duLieu.nhan_su.map((s) => <option key={s.id} value={s.id}>{s.ten}</option>)}
                    </select>
                  </label>
                  <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>
                    · quét {gioChay(l.last_run_at)}
                    {l.last_created > 0 && `, sinh ${l.last_created} việc`}
                  </span>
                </div>
              </div>

              <button
                onClick={() => chay(() => batTatLuat(l.key, !l.active))}
                disabled={!duLieu.la_quan_ly || pending}
                aria-pressed={l.active}
                className="flex-none"
                style={{
                  fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 20,
                  border: `1px solid ${l.active ? 'var(--green)' : 'var(--border-strong)'}`,
                  background: l.active ? 'var(--green-wash)' : 'var(--surface-2)',
                  color: l.active ? 'var(--green)' : 'var(--muted)',
                  opacity: duLieu.la_quan_ly ? 1 : .6,
                }}
              >{l.active ? 'Bật' : 'Tắt'}</button>
            </li>
          ))}
        </ul>

        {!duLieu.la_quan_ly && (
          <p className="mt-2" style={{ fontSize: 11.5, color: 'var(--faint)' }}>
            Chỉ cấp quản lý mới bật/tắt luật, đổi người nhận hoặc chạy tay.
          </p>
        )}
      </section>

      {/* ── Việc vừa sinh ── */}
      <section>
        <div className="flex items-center gap-2.5 mb-2.5">
          <h2 className="m-0" style={{ fontSize: 14.5, fontWeight: 650 }}>Việc vừa tự sinh</h2>
          <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', background: 'var(--surface-3)', padding: '2px 8px', borderRadius: 20 }}>
            {duLieu.gan_day.length}
          </span>
        </div>

        {duLieu.gan_day.length === 0 ? (
          <div className="p-8 text-center"
               style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11, boxShadow: 'var(--shadow)', color: 'var(--muted)', fontSize: 13.5 }}>
            Chưa có việc nào được sinh tự động.
          </div>
        ) : (
          <ul className="list-none p-0 m-0 overflow-hidden"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11, boxShadow: 'var(--shadow)' }}>
            {duLieu.gan_day.map((v, i) => (
              <li key={v.id}>
                <div className="flex items-center gap-2 px-4 pt-2.5" style={{ fontSize: 11, color: 'var(--faint)' }}>
                  <span className="mono">{v.origin_ref}</span>
                  <span>· {nhanHan(v.created_at) || ngayThang(v.created_at)}</span>
                </div>
                <ul className="list-none p-0 m-0">
                  <DongViec
                    v={v}
                    pending={pending}
                    onDoiTrangThai={() => { /* đổi trạng thái làm ở màn Việc của tôi */ }}
                    onMo={setMo}
                    cuoi={i === duLieu.gan_day.length - 1}
                  />
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {mo !== null && (
        <ChiTietViec taskId={mo} nenTang={nenTang} onDong={() => setMo(null)} onDoi={() => router.refresh()} />
      )}
    </div>
  )
}
