'use client'

/**
 * "Việc tự sinh từ ERP" — bật/tắt luật, chọn người nhận, chạy tay, xem việc vừa sinh.
 *
 * Bộ quét chạy dưới DB (pg_cron, mỗi 15 phút) chứ không phải ở app: nó phải chạy
 * kể cả khi không ai mở trình duyệt. Nút "Chạy ngay" chỉ để xem kết quả liền.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { chayTuSinh, hangLoat, type ManTuSinh, type NenTang } from '@/app/work/actions'
import { nhanHan, ngayThang } from '@/lib/work'
import { DongViec } from './DongViec'
import { ChiTietViec } from './ChiTietViec'
import { ThanhHangLoat } from './ThanhHangLoat'
import { LuatTuSinh } from './LuatTuSinh'
import { Nut } from './ui'

export function TuSinh({ duLieu, nenTang, duocSuaLuat }: { duLieu: ManTuSinh; nenTang: NenTang; duocSuaLuat: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [loi, setLoi] = useState<string | null>(null)
  const [ketQua, setKetQua] = useState<string | null>(null)
  const [mo, setMo] = useState<number | null>(null)
  const [chon, setChon] = useState<Set<number>>(new Set())

  function doiChon(id: number, c: boolean) {
    setChon((cu) => {
      const moi = new Set(cu)
      if (c) moi.add(id); else moi.delete(id)
      return moi
    })
  }

  function chay(fn: () => Promise<{ ok: boolean; loi?: string }>) {
    start(async () => {
      const kq = await fn()
      if (!kq.ok) { setLoi(kq.loi ?? 'Thao tác không thành công'); return }
      setLoi(null)
      router.refresh()
    })
  }

  function bamChayNgay() {
    start(async () => {
      const kq = await chayTuSinh()
      if (!kq.ok) { setKetQua(null); setLoi(kq.loi); return }
      const tong = kq.duLieu.reduce((n, x) => n + x.da_tao, 0)
      setKetQua(tong === 0
        ? 'Quét xong — không có việc nào mới.'
        : `Quét xong — sinh ${tong} việc mới: ` +
          kq.duLieu.filter((x) => x.da_tao > 0).map((x) => `${x.luat} (${x.da_tao})`).join(', '))
      setLoi(null)
      router.refresh()
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
          {duocSuaLuat && (
            <Nut chinh onClick={bamChayNgay} disabled={pending}>
              {pending ? 'Đang quét…' : 'Chạy ngay'}
            </Nut>
          )}
        </div>

        <ul className="list-none p-0 m-0 overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11, boxShadow: 'var(--shadow)' }}>
          {duLieu.luat.map((l, i) => (
            <LuatTuSinh
              key={l.key} l={l} nenTang={nenTang}
              duocSuaLuat={duocSuaLuat}
              cuoi={i === duLieu.luat.length - 1}
              onXong={() => router.refresh()}
              onLoi={setLoi}
            />
          ))}
        </ul>

        {!duocSuaLuat && (
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
          {duLieu.tong_auto > duLieu.gan_day.length && (
            <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>
              · bạn xem được {duLieu.gan_day.length}/{duLieu.tong_auto} việc, phần còn lại thuộc team khác
            </span>
          )}
        </div>

        {duLieu.gan_day.length > 0 && (
          <label className="flex items-center gap-2 px-1 mb-2" style={{ fontSize: 12, color: 'var(--muted)' }}>
            <input
              type="checkbox"
              checked={duLieu.gan_day.every((v) => chon.has(v.id))}
              onChange={(e) => setChon(e.target.checked ? new Set(duLieu.gan_day.map((v) => v.id)) : new Set())}
              style={{ width: 14, height: 14, accentColor: 'var(--accent)' }}
            />
            Chọn tất cả {duLieu.gan_day.length} việc — rồi phân người / đổi trạng thái hàng loạt
          </label>
        )}

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
                    onDoiTrangThai={(id, st) => chay(() => hangLoat([id], { status: st }))}
                    onMo={setMo}
                    cuoi={i === duLieu.gan_day.length - 1}
                    dangChon={chon.has(v.id)} onChon={doiChon}
                  />
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {chon.size > 0 && (
        <ThanhHangLoat
          ids={[...chon]}
          nenTang={nenTang}
          onBoChon={() => setChon(new Set())}
          onXong={(tb) => { setKetQua(tb); setChon(new Set()); router.refresh() }}
        />
      )}
      {chon.size > 0 && <div style={{ height: 72 }} aria-hidden />}

      {mo !== null && (
        <ChiTietViec taskId={mo} nenTang={nenTang} onDong={() => setMo(null)} onDoi={() => router.refresh()} />
      )}
    </div>
  )
}
