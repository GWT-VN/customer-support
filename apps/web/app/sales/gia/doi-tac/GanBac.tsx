'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { MucChon } from '@/bang'
import { ganBac, goBac, timKhachChoBac, type DoiTac, type LichSuBac } from '../actions'
import type { Bac } from '../../_ctkm'

const NHAN_BAC: Record<Bac, string> = {
  NPP: 'Cấp 1 · NPP',
  DAI_LY: 'Cấp 2 · Đại lý',
  GIOI_THIEU: 'Cấp 3 · Giới thiệu',
}

function homNay(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function GanBac({
  ds, lichSu, coQuyenSoan,
}: { ds: DoiTac[]; lichSu: LichSuBac[]; coQuyenSoan: boolean }) {
  const router = useRouter()
  const [dangChay, batDau] = useTransition()
  const [loi, setLoi] = useState<string | null>(null)
  const [goiY, setGoiY] = useState<MucChon[]>([])
  // Giữ CẢ mã và tên: CEO chốt 22/08 — chọn xong phải thấy TÊN khách, không ai nhớ mã.
  const [chon, setChon] = useState<{ ma: string; ten: string } | null>(null)
  const [bac, setBac] = useState<Bac>('DAI_LY')
  const [tuNgay, setTuNgay] = useState(homNay())
  const [ghiChu, setGhiChu] = useState('')
  const [xemLichSu, setXemLichSu] = useState(false)

  function chay(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setLoi(null)
    batDau(async () => {
      const r = await fn()
      if (!r.ok) setLoi(r.error ?? 'Không thực hiện được.')
      else { setChon(null); setGhiChu(''); setTuNgay(homNay()); router.refresh() }
    })
  }

  return (
    <div className="space-y-4">
      {loi && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{loi}</p>}

      {coQuyenSoan && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Gán bậc cho đối tác</h2>
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto_2fr_auto] sm:items-end">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Khách hàng</label>
              <TimKhach
                chon={chon}
                onChon={(m) => setChon(m)}
                goiY={goiY}
                onTim={(q) => batDau(async () => setGoiY(await timKhachChoBac(q)))}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Bậc</label>
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={bac} onChange={(e) => setBac(e.target.value as Bac)}>
                {(Object.keys(NHAN_BAC) as Bac[]).map((b) => <option key={b} value={b}>{NHAN_BAC[b]}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Hiệu lực từ</label>
              <input type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
                value={tuNgay} onChange={(e) => setTuNgay(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ghi chú</label>
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="tuỳ chọn" />
            </div>
            <button
              type="button" disabled={dangChay || !chon}
              className="rounded-lg bg-[#0e8c9a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a6771] disabled:opacity-50"
              onClick={() => chon && chay(() => ganBac(chon.ma, bac, ghiChu || null, tuNgay))}
            >Gán bậc</button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Ngày hiệu lực mặc định là <b>hôm nay</b>, sửa được nếu đối tác đã lên bậc từ trước.
            Không gán = <b>khách lẻ</b>.
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5 font-medium">Đối tác</th>
                <th className="px-3 py-2.5 font-medium">Bậc</th>
                <th className="px-3 py-2.5 font-medium">Hiệu lực từ</th>
                <th className="px-3 py-2.5 font-medium">Ghi chú</th>
                {coQuyenSoan && <th className="px-3 py-2.5 text-center font-medium">Gỡ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ds.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-400">Chưa gán bậc cho đối tác nào — mọi khách đang là khách lẻ.</td></tr>
              ) : ds.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{d.ten ?? '(chưa có tên)'}</div>
                    <div className="font-mono text-[11px] text-slate-400">{d.customer_code}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{NHAN_BAC[d.bac]}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">{d.hieu_luc_tu}</td>
                  <td className="px-3 py-2 text-slate-600">{d.ghi_chu ?? '—'}</td>
                  {coQuyenSoan && (
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button" disabled={dangChay}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-rose-300 hover:text-rose-700 disabled:opacity-50"
                        title="Gỡ bậc — khách quay về khách lẻ. Lịch sử vẫn giữ ở mục dưới."
                        onClick={() => chay(() => goBac(d.customer_code))}
                      >Gỡ</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* LỊCH SỬ — CEO chốt 22/08: gỡ rồi vẫn phải tra được từng là cấp nào, ngày nào. */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <button type="button" onClick={() => setXemLichSu((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50">
          <span>Lịch sử bậc đã kết thúc <span className="ml-1 font-normal text-slate-400">({lichSu.length})</span></span>
          <span className="text-slate-400">{xemLichSu ? '▲' : '▼'}</span>
        </button>
        {xemLichSu && (
          <div className="overflow-x-auto border-t border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Đối tác</th>
                  <th className="px-3 py-2.5 font-medium">Từng là bậc</th>
                  <th className="px-3 py-2.5 font-medium">Từ ngày</th>
                  <th className="px-3 py-2.5 font-medium">Đến ngày</th>
                  <th className="px-3 py-2.5 font-medium">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lichSu.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">Chưa có bậc nào bị gỡ hay đổi.</td></tr>
                ) : lichSu.map((h, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <div className="text-slate-700">{h.ten ?? '(chưa có tên)'}</div>
                      <div className="font-mono text-[11px] text-slate-400">{h.customer_code}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{NHAN_BAC[h.bac]}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">{h.hieu_luc_tu}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">{h.hieu_luc_den}</td>
                    <td className="px-3 py-2 text-slate-500">{h.ghi_chu ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/** Gõ để tìm khách — nguồn gợi ý lấy từ server (421 khách, không nạp hết). */
function TimKhach({
  chon, onChon, goiY, onTim,
}: {
  chon: { ma: string; ten: string } | null
  onChon: (m: { ma: string; ten: string } | null) => void
  goiY: MucChon[]
  onTim: (q: string) => void
}) {
  const [q, setQ] = useState('')

  // Đã chọn: hiện THẺ TÊN thay cho ô gõ — không bắt CEO đọc mã khách.
  if (chon) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-slate-800">{chon.ten}</div>
          <div className="font-mono text-[11px] text-slate-400">{chon.ma}</div>
        </div>
        <button type="button" onClick={() => { onChon(null); setQ('') }}
          className="shrink-0 rounded px-1.5 text-slate-400 hover:text-rose-600" title="Chọn khách khác">✕</button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        placeholder="Gõ tên / SĐT / mã khách…"
        value={q}
        onChange={(e) => { setQ(e.target.value); onTim(e.target.value) }}
      />
      {q.length >= 2 && goiY.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {goiY.map((g) => (
            <button key={g.gt} type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={() => { onChon({ ma: g.gt, ten: g.nhan }); setQ('') }}>
              <span className="font-medium text-slate-800">{g.nhan}</span>
              {g.phu && <span className="ml-2 text-xs text-slate-400">{g.phu}</span>}
              <span className="ml-2 font-mono text-[11px] text-slate-300">{g.gt}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
