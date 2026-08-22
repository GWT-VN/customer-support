'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { luuOChinhSach, luuHangLoat, type DongChinhSach, type DongLichSuGia } from './actions'
import { capGiaVaPct, type Bac } from '../_ctkm'

const vnd = new Intl.NumberFormat('vi-VN')
const BAC: { ma: Bac; nhan: string }[] = [
  { ma: 'NPP', nhan: 'Cấp 1 · NPP' },
  { ma: 'DAI_LY', nhan: 'Cấp 2 · Đại lý' },
  { ma: 'GIOI_THIEU', nhan: 'Cấp 3 · Giới thiệu' },
]

export function BangChinhSach({
  ds, lichSu, coQuyenSoan,
}: { ds: DongChinhSach[]; lichSu: DongLichSuGia[]; coQuyenSoan: boolean }) {
  const router = useRouter()
  const [dangChay, batDau] = useTransition()
  const [loi, setLoi] = useState<string | null>(null)
  /** Giá trị đang gõ, chưa lưu — khoá `${ma}|${bac}|${pct|gia}`. */
  const [nhap, setNhap] = useState<Record<string, string>>({})
  /** Mã đang tick để sửa hàng loạt. */
  const [tick, setTick] = useState<Set<string>>(new Set())
  const [bacHL, setBacHL] = useState<Bac>('DAI_LY')
  const [pctHL, setPctHL] = useState('')
  const [xemLichSu, setXemLichSu] = useState(false)

  function doiTick(ma: string) {
    setTick((t) => { const n = new Set(t); n.has(ma) ? n.delete(ma) : n.add(ma); return n })
  }
  const tickHet = ds.length > 0 && tick.size === ds.length

  function apHangLoat() {
    const v = pctHL.trim()
    const so = v === '' ? null : Number(v)
    if (v !== '' && !Number.isFinite(so)) { setLoi('Mức giảm không phải số.'); return }
    setLoi(null)
    batDau(async () => {
      const r = await luuHangLoat(bacHL, [...tick], 'PCT', so)
      if (!r.ok) setLoi(r.error)
      else { setTick(new Set()); setPctHL(''); setNhap({}); router.refresh() }
    })
  }

  const khoa = (ma: string, bac: Bac, o: 'pct' | 'gia') => `${ma}|${bac}|${o}`

  function o(dong: DongChinhSach, bac: Bac, kieu: 'pct' | 'gia'): string {
    const k = khoa(dong.ma, bac, kieu)
    if (k in nhap) return nhap[k]
    const c = dong.bac[bac]
    if (!c) return ''
    const v = kieu === 'pct' ? c.giam_pct : c.gia_ban
    return v == null ? '' : String(v)
  }

  function goVao(dong: DongChinhSach, bac: Bac, kieu: 'pct' | 'gia', v: string) {
    const so = v === '' ? null : Number(v)
    const cap = capGiaVaPct(dong.niem_yet, kieu === 'pct' ? 'PCT' : 'GIA', so)
    setNhap((n) => ({
      ...n,
      [khoa(dong.ma, bac, kieu)]: v,
      // Ô kia tự tính theo — CEO chốt: điền một ô, ô còn lại tự ra.
      [khoa(dong.ma, bac, kieu === 'pct' ? 'gia' : 'pct')]:
        v === '' ? '' : String(kieu === 'pct' ? (cap.gia ?? '') : (cap.pct ?? '')),
    }))
  }

  function luu(dong: DongChinhSach, bac: Bac, kieu: 'pct' | 'gia') {
    if (!coQuyenSoan) return
    const v = o(dong, bac, kieu)
    const so = v === '' ? null : Number(v)
    setLoi(null)
    batDau(async () => {
      const r = await luuOChinhSach(bac, dong.ma, kieu === 'pct' ? 'PCT' : 'GIA', so, dong.niem_yet)
      if (!r.ok) setLoi(r.error)
      else router.refresh()
    })
  }

  const inpO = 'w-[86px] rounded border border-slate-300 px-2 py-1 text-right text-sm tabular-nums disabled:bg-slate-50 disabled:text-slate-400'

  return (
    <div className="space-y-2">
      {loi && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{loi}</p>}

      {/* SỬA HÀNG LOẠT — CEO chốt 22/08: các mã thường giống nhau, phải đặt được một lượt. */}
      {coQuyenSoan && (
        <div className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 transition ${
          tick.size ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white'}`}>
          <span className="text-sm font-semibold text-slate-800">
            {tick.size ? `Đã chọn ${tick.size} mã` : 'Sửa hàng loạt'}
          </span>
          {tick.size === 0 ? (
            <span className="text-xs text-slate-500">Tick vào các mã bên dưới để đặt cùng một mức giảm.</span>
          ) : (
            <>
              <span className="text-sm text-slate-600">đặt</span>
              <select className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" value={bacHL}
                onChange={(e) => setBacHL(e.target.value as Bac)}>
                {BAC.map((b) => <option key={b.ma} value={b.ma}>{b.nhan}</option>)}
              </select>
              <span className="text-sm text-slate-600">giảm</span>
              <input type="number" className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-right text-sm tabular-nums"
                placeholder="%" value={pctHL} onChange={(e) => setPctHL(e.target.value)} />
              <button type="button" disabled={dangChay} onClick={apHangLoat}
                className="rounded-lg bg-[#0e8c9a] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#0a6771] disabled:opacity-50">
                {dangChay ? 'Đang áp…' : `Áp cho ${tick.size} mã`}
              </button>
              <button type="button" onClick={() => setTick(new Set())}
                className="text-xs text-slate-500 hover:text-slate-800 hover:underline">Bỏ chọn</button>
              <span className="w-full text-xs text-slate-500">
                Để trống ô % rồi bấm Áp = <b>bỏ chính sách</b> của {tick.size} mã này ở bậc trên. Bản cũ vẫn nằm trong lịch sử.
              </span>
            </>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                {coQuyenSoan && (
                  <th rowSpan={2} className="border-b border-slate-200 px-3 py-2 align-bottom">
                    <input type="checkbox" className="h-4 w-4 accent-[#0e8c9a]" checked={tickHet}
                      title={tickHet ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                      onChange={() => setTick(tickHet ? new Set() : new Set(ds.map((d) => d.ma)))} />
                  </th>
                )}
                <th rowSpan={2} className="border-b border-slate-200 px-3 py-2 align-bottom font-bold">Sản phẩm</th>
                <th rowSpan={2} className="border-b border-slate-200 px-3 py-2 text-right align-bottom font-bold">Niêm yết</th>
                {BAC.map((b) => (
                  <th key={b.ma} colSpan={2} className="border-b border-l border-slate-200 px-3 py-2 text-center font-bold">{b.nhan}</th>
                ))}
              </tr>
              <tr>
                {BAC.map((b) => (
                  <th key={b.ma} className="border-b border-l border-slate-200 px-2 py-1.5 text-center font-medium" colSpan={2}>
                    <span className="mr-6">% giảm</span><span>Giá bán</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ds.map((d) => (
                <tr key={d.ma} className={tick.has(d.ma) ? 'bg-teal-50/60' : 'hover:bg-slate-50'}>
                  {coQuyenSoan && (
                    <td className="px-3 py-2">
                      <input type="checkbox" className="h-4 w-4 accent-[#0e8c9a]"
                        checked={tick.has(d.ma)} onChange={() => doiTick(d.ma)} />
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{d.ten}</div>
                    <div className="font-mono text-[11px] text-slate-400">{d.ma}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-slate-700">
                    {vnd.format(d.niem_yet)} ₫
                  </td>
                  {BAC.map((b) => (
                    <td key={b.ma} className="border-l border-slate-100 px-2 py-2" colSpan={2}>
                      <div className="flex items-center justify-center gap-1.5">
                        <input
                          type="number" className={inpO} disabled={!coQuyenSoan || dangChay}
                          value={o(d, b.ma, 'pct')}
                          onChange={(e) => goVao(d, b.ma, 'pct', e.target.value)}
                          onBlur={() => luu(d, b.ma, 'pct')}
                          placeholder="%"
                        />
                        <input
                          type="number" className={inpO + ' w-[118px]'} disabled={!coQuyenSoan || dangChay}
                          value={o(d, b.ma, 'gia')}
                          onChange={(e) => goVao(d, b.ma, 'gia', e.target.value)}
                          onBlur={() => luu(d, b.ma, 'gia')}
                          placeholder="₫"
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        📌 <b>Điền một ô, ô kia tự tính.</b> Gõ % giảm → ra giá bán; gõ giá bán → ra % giảm.
        Rời khỏi ô là lưu. Xoá trắng ô = bỏ chính sách của mã đó ở bậc đó.
      </p>
      {/* LỊCH SỬ PHIÊN BẢN — CEO chốt 22/08: phải biết đã đổi những gì, khi nào. */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <button type="button" onClick={() => setXemLichSu((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50">
          <span>Lịch sử thay đổi <span className="ml-1 font-normal text-slate-400">({lichSu.length} bản ghi)</span></span>
          <span className="text-slate-400">{xemLichSu ? '▲' : '▼'}</span>
        </button>
        {xemLichSu && (
          <div className="overflow-x-auto border-t border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Sản phẩm</th>
                  <th className="px-3 py-2 font-medium">Bậc</th>
                  <th className="px-3 py-2 text-right font-medium">% giảm</th>
                  <th className="px-3 py-2 text-right font-medium">Giá bán</th>
                  <th className="px-3 py-2 font-medium">Áp từ</th>
                  <th className="px-3 py-2 font-medium">Đến</th>
                  <th className="px-3 py-2 font-medium">Ai đặt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lichSu.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Chưa có thay đổi nào được ghi lại.</td></tr>
                ) : lichSu.map((h, i) => {
                  const cu = h.trang_thai === 'thay_the'
                  return (
                    <tr key={i} className={cu ? 'text-slate-400' : 'hover:bg-slate-50'}>
                      <td className="px-3 py-2">
                        <div className={cu ? '' : 'text-slate-700'}>{h.ten}</div>
                        <div className="font-mono text-[11px] text-slate-400">{h.ma}</div>
                      </td>
                      <td className="px-3 py-2">{BAC.find((b) => b.ma === h.bac)?.nhan ?? h.bac}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{h.giam_pct == null ? '—' : `${h.giam_pct}%`}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{h.gia_ban == null ? '—' : `${vnd.format(h.gia_ban)} ₫`}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">{h.hieu_luc_tu}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                        {cu ? h.hieu_luc_den
                            : <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">đang áp</span>}
                      </td>
                      <td className="px-3 py-2 text-xs">{h.boi ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        📌 App lưu <b>cả hai</b> con số kèm ghi nhớ ô nào bạn gõ — để số hiển thị luôn đúng thứ đã duyệt,
        không lệch vài đồng vì tính lại từ phần trăm.
      </p>
    </div>
  )
}
