'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { luuBangView, xoaBangView, type BangView } from '@/app/actions'
import { OChonTatCa, OChonDong, TieuDeCotSapXep } from '@/bang'

export type CotDef<T> = {
  key: string
  nhan: string
  batBuoc?: boolean
  sapXep?: string          // key trong whitelist sắp xếp (nếu cột này sắp được)
  phai?: boolean           // canh phải
  render: (r: T) => ReactNode
}

/**
 * Bảng tuỳ chỉnh cột dùng chung (Đợt C) — tách từ BangKhach để áp cho mọi bảng.
 * Chọn cột hiển thị + thứ tự (▲▼) + lưu/nạp view (cá nhân/chung) theo khoá `bang`.
 * Render ô do registry `cot` quyết định, nên ô tương tác (badge/nút) vẫn đặt được.
 * Bọc trong <KhungChon> ở trang để có chọn-nhiều-dòng.
 */
export function BangTuyChinh<T>({
  rows, keyOf, moTaOf, nhan, bang, cot, macDinh, sapMacDinh, views, admin, congCu,
}: {
  rows: T[]
  keyOf: (r: T) => string
  moTaOf: (r: T) => string
  nhan: string
  bang: string
  cot: CotDef<T>[]
  macDinh: string[]
  sapMacDinh?: string
  views: BangView[]
  admin: boolean
  /** Nút/điều khiển thêm (Xuất Excel, Lọc ngày…) gom chung 1 hàng với View + Cột. */
  congCu?: ReactNode
}) {
  const router = useRouter()
  const BAT_BUOC = cot.filter((c) => c.batBuoc).map((c) => c.key)
  const chuanHoa = (ds: string[]): string[] => {
    const hople = ds.filter((k) => cot.some((c) => c.key === k))
    for (const b of BAT_BUOC) if (!hople.includes(b)) hople.unshift(b)
    return hople.length ? hople : [...macDinh]
  }

  const [hien, setHien] = useState<string[]>(chuanHoa([...macDinh]))
  const [moCot, setMoCot] = useState(false)
  const [tenView, setTenView] = useState('')
  const [chung, setChung] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const cols = hien.map((k) => cot.find((c) => c.key === k)).filter((c): c is CotDef<T> => !!c)

  function toggle(key: string) {
    if (BAT_BUOC.includes(key)) return
    setHien((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]))
  }
  function doiCho(i: number, delta: number) {
    setHien((cur) => {
      const j = i + delta
      if (j < 0 || j >= cur.length) return cur
      const n = [...cur]
      ;[n[i], n[j]] = [n[j], n[i]]
      return n
    })
  }
  async function luu() {
    setBusy(true); setErr(null)
    const r = await luuBangView(bang, tenView, hien, chung)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    setTenView(''); setChung(false); router.refresh()
  }
  async function xoa(id: string) {
    if (!window.confirm('Xoá view này?')) return
    const r = await xoaBangView(id)
    if (!r.ok) setErr(r.error); else router.refresh()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <select defaultValue=""
          onChange={(e) => setHien(chuanHoa(views.find((v) => v.id === e.target.value)?.cot ?? macDinh))}
          className="rounded-lg border px-2 py-1.5 text-sm bg-white text-slate-700">
          <option value="">View: Mặc định</option>
          {views.map((v) => <option key={v.id} value={v.id}>{v.ten}{v.chu === 'chung' ? ' (chung)' : ''}</option>)}
        </select>
        <button onClick={() => setMoCot((v) => !v)}
          className="rounded-lg border bg-white px-3 py-1.5 text-sm text-slate-700">Cột ▾</button>
        {congCu}
      </div>

      {moCot && (
        <div className="mb-2 rounded-lg border bg-white p-3 space-y-2 max-w-md">
          <p className="text-xs font-medium text-slate-600">Cột hiển thị (▲▼ đổi thứ tự)</p>
          <ul className="space-y-1">
            {hien.map((k, i) => {
              const c = cot.find((x) => x.key === k)
              if (!c) return null
              return (
                <li key={k} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked disabled={c.batBuoc} onChange={() => toggle(k)} />
                  <span className="flex-1">{c.nhan}{c.batBuoc && <span className="text-[10px] text-slate-400"> (bắt buộc)</span>}</span>
                  <button onClick={() => doiCho(i, -1)} className="text-slate-400 hover:text-slate-700">▲</button>
                  <button onClick={() => doiCho(i, 1)} className="text-slate-400 hover:text-slate-700">▼</button>
                </li>
              )
            })}
          </ul>
          {cot.some((c) => !hien.includes(c.key)) && (
            <div className="pt-1 border-t">
              <p className="text-xs text-slate-500 mb-1">Cột ẩn — bấm để thêm:</p>
              <div className="flex flex-wrap gap-1.5">
                {cot.filter((c) => !hien.includes(c.key)).map((c) => (
                  <button key={c.key} onClick={() => toggle(c.key)}
                    className="rounded border px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50">+ {c.nhan}</button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
            <input value={tenView} onChange={(e) => setTenView(e.target.value)} placeholder="Tên view…"
              className="rounded border px-2 py-1 text-sm w-32 text-slate-900" />
            {admin && <label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={chung} onChange={(e) => setChung(e.target.checked)} /> Chung (mọi người)</label>}
            <button onClick={luu} disabled={busy || !tenView.trim()}
              className="rounded-lg bg-slate-900 text-white px-3 py-1 text-sm disabled:opacity-50">Lưu view</button>
            {err && <span className="text-xs text-red-600">{err}</span>}
          </div>
          {views.length > 0 && (
            <div className="pt-1 text-xs text-slate-500 border-t">
              View đã lưu:{' '}
              {views.map((v) => (
                <span key={v.id} className="mr-2 whitespace-nowrap">{v.ten}{v.chu === 'chung' && ' (chung)'}
                  <button onClick={() => xoa(v.id)} className="text-red-500 ml-0.5" title="Xoá view">✕</button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <OChonTatCa nhan={nhan} />
              {cols.map((c) => c.sapXep
                ? <TieuDeCotSapXep key={c.key} cot={c.sapXep} nhan={c.nhan} chieuMacDinh="asc" dangMacDinh={c.sapXep === sapMacDinh} />
                : <th key={c.key} className={`px-4 py-3 font-medium ${c.phai ? 'text-right' : 'text-left'}`}>{c.nhan}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={keyOf(r)} className="hover:bg-slate-50 align-top">
                <OChonDong khoa={keyOf(r)} moTa={moTaOf(r)} />
                {cols.map((c) => <td key={c.key} className={`px-4 py-3 text-slate-700 ${c.phai ? 'text-right' : ''}`}>{c.render(r)}</td>)}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={cols.length + 1} className="px-4 py-10 text-center text-slate-400">Không có dòng nào.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
