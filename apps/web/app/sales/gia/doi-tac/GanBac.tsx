'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { OChonGoiY, type MucChon } from '@/bang'
import { ganBac, goBac, timKhachChoBac, type DoiTac } from '../actions'
import type { Bac } from '../../_ctkm'

const NHAN_BAC: Record<Bac, string> = {
  NPP: 'Cấp 1 · NPP',
  DAI_LY: 'Cấp 2 · Đại lý',
  GIOI_THIEU: 'Cấp 3 · Giới thiệu',
}

export function GanBac({ ds, coQuyenSoan }: { ds: DoiTac[]; coQuyenSoan: boolean }) {
  const router = useRouter()
  const [dangChay, batDau] = useTransition()
  const [loi, setLoi] = useState<string | null>(null)
  const [goiY, setGoiY] = useState<MucChon[]>([])
  const [chon, setChon] = useState<string | null>(null)
  const [bac, setBac] = useState<Bac>('DAI_LY')
  const [ghiChu, setGhiChu] = useState('')

  function tim(q: string) {
    // Gõ để tìm — luật số 2: 421 khách, không thể dropdown.
    batDau(async () => setGoiY(await timKhachChoBac(q)))
  }

  function chay(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setLoi(null)
    batDau(async () => {
      const r = await fn()
      if (!r.ok) setLoi(r.error ?? 'Không thực hiện được.')
      else { setChon(null); setGhiChu(''); router.refresh() }
    })
  }

  return (
    <div className="space-y-4">
      {loi && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{loi}</p>}

      {coQuyenSoan && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Gán bậc cho đối tác</h2>
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_2fr_auto] sm:items-end">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Khách hàng</label>
              <OChonGoiYTim giaTri={chon} onChon={setChon} goiY={goiY} onTim={tim} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Bậc</label>
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={bac} onChange={(e) => setBac(e.target.value as Bac)}>
                {(Object.keys(NHAN_BAC) as Bac[]).map((b) => <option key={b} value={b}>{NHAN_BAC[b]}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ghi chú</label>
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="tuỳ chọn" />
            </div>
            <button
              type="button" disabled={dangChay || !chon}
              className="rounded-lg bg-[#0e8c9a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a6771] disabled:opacity-50"
              onClick={() => chon && chay(() => ganBac(chon, bac, ghiChu || null))}
            >Gán bậc</button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Không gán = <b>khách lẻ</b>. Không cần thêm khách lẻ vào đây.
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5 font-medium">Đối tác</th>
                <th className="px-3 py-2.5 font-medium">Mã khách</th>
                <th className="px-3 py-2.5 font-medium">Bậc</th>
                <th className="px-3 py-2.5 font-medium">Hiệu lực từ</th>
                <th className="px-3 py-2.5 font-medium">Ghi chú</th>
                {coQuyenSoan && <th className="px-3 py-2.5 text-center font-medium">Gỡ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ds.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-400">Chưa gán bậc cho đối tác nào — mọi khách đang là khách lẻ.</td></tr>
              ) : ds.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800">{d.ten ?? '(chưa có tên)'}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-500">{d.customer_code}</td>
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
                        title="Gỡ bậc — khách quay về khách lẻ. Lịch sử bậc cũ vẫn giữ."
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
    </div>
  )
}

/** OChonGoiY nhưng nguồn gợi ý lấy từ server theo từ khoá — 421 khách, không nạp hết. */
function OChonGoiYTim({
  giaTri, onChon, goiY, onTim,
}: { giaTri: string | null; onChon: (v: string) => void; goiY: MucChon[]; onTim: (q: string) => void }) {
  const [q, setQ] = useState('')
  return (
    <div>
      <input
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        placeholder="Gõ tên / SĐT / mã khách…"
        value={giaTri && !q ? giaTri : q}
        onChange={(e) => { setQ(e.target.value); onTim(e.target.value) }}
      />
      {q.length >= 2 && goiY.length > 0 && (
        <div className="mt-1 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {goiY.map((g) => (
            <button key={g.gt} type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={() => { onChon(g.gt); setQ('') }}>
              <span className="font-medium text-slate-800">{g.nhan}</span>
              <span className="ml-2 font-mono text-xs text-slate-400">{g.gt}</span>
              {g.phu && <span className="ml-2 text-xs text-slate-400">{g.phu}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
