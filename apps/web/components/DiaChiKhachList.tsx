'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  themDiaChiKhach, xoaDiaChiKhach, suaDiaChiKhachAction, type DiaChiKhach,
} from '@/app/actions'
import { ChonTinh } from '@/components/ChonTinh'
import { NHAN_LOAI_DIA_CHI } from '@/lib/danhSach'

/**
 * Địa chỉ THÊM của khách — nhà / nơi lắp đặt / khác.
 *
 * `cs_customers.address` chỉ chứa được một địa chỉ, mà khách thật hay có hai: khách vừa có địa
 * chỉ nhà vừa có địa chỉ nơi lắp máy.
 *
 * CEO chốt 22/08/2026, ba điểm:
 *  · **Sửa được** — trước đây chỉ thêm/xoá; gõ sai một chữ là phải xoá rồi nhập lại từ đầu.
 *  · **Hiện ĐỦ nội dung địa chỉ ngay trên dòng** — trước đây nhìn vào không đọc được địa chỉ là
 *    gì, mà bấm vào cũng không ra; lưu vào như thế thì vô nghĩa.
 *  · **Bỏ loại "Công ty"** — địa chỉ công ty đã có ô riêng ở khối *Thông tin công ty* phía trên
 *    (in lên hoá đơn). Hai chỗ cùng nhập một dữ kiện là hai nguồn sự thật, sớm muộn lệch nhau.
 *    Hồ sơ CŨ đang mang loại `cty` vẫn hiện và vẫn sửa được, không nuốt mất.
 *  · **Ô Tỉnh/TP riêng** — giống hệt màn tạo khách. Thiếu ô này thì hai màn nhập khác nhau, và
 *    lọc/gom theo tỉnh sẽ sót đúng phần địa chỉ phụ.
 */

/** Loại cho ô CHỌN. `cty` cố ý không có, nhưng dữ liệu cũ mang nó thì vẫn giữ được. */
const LOAI_CHON: { gt: string; nhan: string }[] = [
  { gt: 'nha', nhan: 'Nhà' },
  { gt: 'lap_dat', nhan: 'Lắp đặt' },
  { gt: 'khac', nhan: 'Khác' },
]

export function DiaChiKhachList({
  customerId, items,
}: { customerId: string; items: DiaChiKhach[] }) {
  const [dc, setDc] = useState('')
  const [loai, setLoai] = useState('nha')
  const [tinh, setTinh] = useState('')
  const [ghiChu, setGhiChu] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  /** id dòng đang mở để sửa tại chỗ; null = không sửa dòng nào. */
  const [suaId, setSuaId] = useState<string | null>(null)
  const [sua, setSua] = useState({ dia_chi: '', loai: 'nha', tinh: '', ghi_chu: '' })
  const router = useRouter()

  async function them() {
    if (!dc.trim()) { setErr('Nhập địa chỉ đã.'); return }
    setBusy(true); setErr(null)
    const r = await themDiaChiKhach(customerId, dc, loai, ghiChu, tinh)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    setDc(''); setGhiChu(''); setTinh(''); router.refresh()
  }

  function moSua(d: DiaChiKhach) {
    setErr(null)
    setSuaId(d.id)
    setSua({ dia_chi: d.dia_chi, loai: d.loai, tinh: d.tinh ?? '', ghi_chu: d.ghi_chu ?? '' })
  }

  async function luuSua() {
    if (!suaId) return
    setBusy(true); setErr(null)
    const r = await suaDiaChiKhachAction(suaId, customerId, sua)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    setSuaId(null); router.refresh()
  }

  async function xoa(id: string, nhan: string) {
    if (!window.confirm(`Xoá địa chỉ "${nhan}"?`)) return
    setBusy(true); setErr(null)
    const r = await xoaDiaChiKhach(id, customerId)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    router.refresh()
  }

  const oNho = 'mt-1 w-full rounded-lg border px-2 py-1.5 text-sm text-slate-900'

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="font-medium text-slate-900">Địa chỉ khác ({items.length})</h2>
        <p className="text-xs text-slate-400">
          Địa chỉ chính ở khối trên · địa chỉ công ty ở khối <em>Thông tin công ty</em>.
          Đây là các địa chỉ thêm: nhà, nơi lắp đặt.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-400">Chưa có địa chỉ nào khác.</p>
      ) : (
        <ul className="divide-y rounded-lg border text-sm">
          {items.map((d) => (
            <li key={d.id} className="px-3 py-2">
              {suaId === d.id ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="block min-w-[220px] flex-1">
                      <span className="text-xs text-slate-600">Địa chỉ</span>
                      <input value={sua.dia_chi} onChange={(e) => setSua({ ...sua, dia_chi: e.target.value })}
                        className={oNho} />
                    </label>
                    <label className="block w-44">
                      <span className="text-xs text-slate-600">Tỉnh / TP</span>
                      <ChonTinh value={sua.tinh} onChange={(v) => setSua({ ...sua, tinh: v })} />
                    </label>
                    <label className="block">
                      <span className="text-xs text-slate-600">Loại</span>
                      <select value={sua.loai} onChange={(e) => setSua({ ...sua, loai: e.target.value })}
                        className={`${oNho} bg-white`}>
                        {LOAI_CHON.map((l) => <option key={l.gt} value={l.gt}>{l.nhan}</option>)}
                        {/* Dữ liệu cũ mang loại ngoài danh sách (vd `cty`) vẫn giữ được, không nuốt mất. */}
                        {!LOAI_CHON.some((l) => l.gt === sua.loai) && (
                          <option value={sua.loai}>{NHAN_LOAI_DIA_CHI[sua.loai] ?? sua.loai} (giữ nguyên)</option>
                        )}
                      </select>
                    </label>
                    <label className="block w-40">
                      <span className="text-xs text-slate-600">Ghi chú</span>
                      <input value={sua.ghi_chu} onChange={(e) => setSua({ ...sua, ghi_chu: e.target.value })}
                        className={oNho} />
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={luuSua} disabled={busy}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                      {busy ? 'Đang lưu…' : 'Lưu'}
                    </button>
                    <button onClick={() => setSuaId(null)} disabled={busy}
                      className="text-xs text-slate-500 underline">huỷ</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {NHAN_LOAI_DIA_CHI[d.loai] ?? d.loai}
                    </span>
                    <span className="ml-2 text-slate-800">{d.dia_chi}</span>
                    {d.tinh && <span className="text-slate-500"> · {d.tinh}</span>}
                    {d.ghi_chu && <span className="block text-xs text-slate-400">{d.ghi_chu}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <button onClick={() => moSua(d)} disabled={busy}
                      className="text-xs text-sky-700 underline disabled:opacity-50">sửa</button>
                    <button onClick={() => xoa(d.id, d.dia_chi)} disabled={busy}
                      className="text-xs text-slate-400 underline hover:text-red-600 disabled:opacity-50">xoá</button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2 border-t pt-3">
        <label className="block min-w-[220px] flex-1">
          <span className="text-xs text-slate-600">Địa chỉ</span>
          <input value={dc} onChange={(e) => setDc(e.target.value)}
            placeholder="Số nhà, đường, phường/xã, quận/huyện" className={oNho} />
        </label>
        <label className="block w-44">
          <span className="text-xs text-slate-600">Tỉnh / TP</span>
          <ChonTinh value={tinh} onChange={setTinh} />
        </label>
        <label className="block">
          <span className="text-xs text-slate-600">Loại</span>
          <select value={loai} onChange={(e) => setLoai(e.target.value)} className={`${oNho} bg-white`}>
            {LOAI_CHON.map((l) => <option key={l.gt} value={l.gt}>{l.nhan}</option>)}
          </select>
        </label>
        <label className="block w-40">
          <span className="text-xs text-slate-600">Ghi chú</span>
          <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} className={oNho} />
        </label>
        <button onClick={them} disabled={busy}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50">
          Thêm địa chỉ
        </button>
      </div>
      <p className="text-xs text-slate-400">
        Tỉnh chọn ở ô riêng, đừng gõ vào ô địa chỉ — giống màn tạo khách, để còn lọc và gom theo vùng.
      </p>

      {err && <p className="text-sm text-red-600">{err}</p>}
    </section>
  )
}
