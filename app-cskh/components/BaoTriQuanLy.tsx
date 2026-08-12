'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ganKhachBaoTri, lenLichBaoTri, type PlanChuaMap, type PlanDaMap } from '@/app/actions'
import { KhachPicker } from '@/components/KhachPicker'
import { vnDate } from '@/components/Badge'

const CHU_KY = [
  { v: '1', nhan: '1 tháng' }, { v: '2', nhan: '2 tháng' }, { v: '3', nhan: '3 tháng (mặc định)' },
  { v: '4', nhan: '4 tháng' }, { v: '6', nhan: '6 tháng' }, { v: '0', nhan: 'Chỉ 1 lần' },
]

/**
 * Quản lý lịch bảo trì (Đợt 1): map plan chưa gắn khách + lên lịch tự động.
 *  · Map: khớp SĐT gợi ý sẵn, hoặc chọn tay.
 *  · Lên lịch: chọn ngày bắt đầu (mặc định ngày lắp) + chu kỳ + số lần + vùng
 *    (né T7/CN theo miền); hệ tự sinh các mốc.
 */
export function BaoTriQuanLy({ chuaMap, daMap }: { chuaMap: PlanChuaMap[]; daMap: PlanDaMap[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [chonTay, setChonTay] = useState<string | null>(null)     // plan id đang chọn khách tay
  const [moLich, setMoLich] = useState<string | null>(null)       // plan id đang mở form lịch
  // form lịch
  const [ngay, setNgay] = useState('')
  const [chuKy, setChuKy] = useState('3')
  const [tongLan, setTongLan] = useState('')
  const [vung, setVung] = useState('')

  async function gan(planId: string, customerId: string) {
    setBusy(planId); setErr(null); setMsg(null)
    const r = await ganKhachBaoTri(planId, customerId)
    setBusy(null)
    if (!r.ok) { setErr(r.error); return }
    setChonTay(null); setMsg('Đã map khách.'); router.refresh()
  }
  async function lenLich(planId: string, macDinhLan: number | null) {
    setBusy(planId); setErr(null); setMsg(null)
    const r = await lenLichBaoTri(planId, {
      ngayBatDau: ngay || undefined,
      chuKyThang: chuKy === '0' ? null : Number(chuKy),
      tongLan: Number(tongLan) || macDinhLan || 1,
      vung: vung === 'bac' || vung === 'nam' ? vung : undefined,
    })
    setBusy(null)
    if (!r.ok) { setErr(r.error); return }
    setMoLich(null); setMsg(`Đã lên ${r.so_lan} lượt bảo trì.`); router.refresh()
  }

  return (
    <div className="space-y-5">
      {(msg || err) && <p className={`text-sm ${err ? 'text-red-600' : 'text-emerald-700'}`}>{err ?? msg}</p>}

      {/* ── Cần map khách ── */}
      <section className="bg-white rounded-xl border p-4 space-y-3">
        <div>
          <h2 className="font-medium text-slate-900">🔗 Cần map khách ({chuaMap.length})</h2>
          <p className="text-xs text-slate-500">Lịch bảo trì (từ Asana) chưa gắn được vào hồ sơ khách. Map để bảo trì đi cùng khách kích hoạt máy.</p>
        </div>
        {chuaMap.length === 0 ? (
          <p className="text-sm text-emerald-700">Tất cả plan đã map khách ✓</p>
        ) : (
          <ul className="divide-y border rounded-lg">
            {chuaMap.map((p) => (
              <li key={p.id} className="px-3 py-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <span className="text-sm text-slate-900">{p.source_customer_name ?? '(không tên)'}</span>
                    <span className="text-xs text-slate-400 font-mono"> · {p.source_phone ?? '—'}</span>
                    <div className="text-xs text-slate-500">{p.bo_may ?? '—'} · {p.tong_lan ?? '?'} lần · {p.loai_goi}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.goi_y_id && (
                      <button disabled={busy === p.id} onClick={() => gan(p.id, p.goi_y_id!)}
                        className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm disabled:opacity-50">
                        Gán: {p.goi_y_ten} ({p.goi_y_sdt})
                      </button>
                    )}
                    <button onClick={() => setChonTay(chonTay === p.id ? null : p.id)}
                      className="rounded-lg border px-3 py-1.5 text-sm text-slate-700">Chọn khách khác</button>
                  </div>
                </div>
                {chonTay === p.id && (
                  <div className="pt-1"><KhachPicker onPick={(id) => gan(p.id, id)} /></div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Lên lịch ── */}
      <section className="bg-white rounded-xl border p-4 space-y-3">
        <div>
          <h2 className="font-medium text-slate-900">📅 Lên lịch bảo trì ({daMap.length} plan đã map)</h2>
          <p className="text-xs text-slate-500">Chọn ngày bắt đầu (mặc định = ngày lắp) + chu kỳ + số lần → hệ tự sinh mốc, né T7/CN theo miền. Cần khách đã có máy kích hoạt BH.</p>
        </div>
        {daMap.length === 0 ? (
          <p className="text-sm text-slate-400">Chưa có plan nào đã map.</p>
        ) : (
          <ul className="divide-y border rounded-lg">
            {daMap.map((p) => (
              <li key={p.id} className="px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <Link href={`/khach/${p.customer_id}`} prefetch={false} className="text-sm text-slate-900 underline">{p.ten_khach ?? '(khách)'}</Link>
                    <div className="text-xs text-slate-500">
                      {p.bo_may ?? '—'} · đã xong {p.so_xong}/{p.tong_lan ?? '?'} · đã lên {p.so_visit} lượt
                      {p.ngay_bat_dau && <> · bắt đầu {vnDate(p.ngay_bat_dau)}</>}
                      {p.chu_ky_thang && <> · mỗi {p.chu_ky_thang} tháng</>}
                    </div>
                  </div>
                  <button onClick={() => { setMoLich(moLich === p.id ? null : p.id); setNgay(p.ngay_bat_dau ?? ''); setChuKy(String(p.chu_ky_thang ?? 3)); setTongLan(String(p.tong_lan ?? '')); setVung(p.vung ?? ''); setErr(null) }}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800">
                    {p.so_visit > 0 ? 'Sinh lại lịch' : 'Lên lịch'}
                  </button>
                </div>
                {moLich === p.id && (
                  <div className="rounded-lg bg-slate-50 border p-2.5 flex flex-wrap items-end gap-2">
                    <label className="text-xs text-slate-600">Ngày bắt đầu<br />
                      <input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} className="mt-0.5 rounded border px-2 py-1 text-sm" />
                    </label>
                    <label className="text-xs text-slate-600">Chu kỳ<br />
                      <select value={chuKy} onChange={(e) => setChuKy(e.target.value)} className="mt-0.5 rounded border px-2 py-1 text-sm bg-white">
                        {CHU_KY.map((c) => <option key={c.v} value={c.v}>{c.nhan}</option>)}
                      </select>
                    </label>
                    <label className="text-xs text-slate-600">Số lần<br />
                      <input value={tongLan} onChange={(e) => setTongLan(e.target.value)} inputMode="numeric" placeholder={String(p.tong_lan ?? '')} className="mt-0.5 w-20 rounded border px-2 py-1 text-sm" />
                    </label>
                    <label className="text-xs text-slate-600">Vùng (né cuối tuần)<br />
                      <select value={vung} onChange={(e) => setVung(e.target.value)} className="mt-0.5 rounded border px-2 py-1 text-sm bg-white">
                        <option value="">Tự theo tỉnh{p.province ? ` (${p.province})` : ''}</option>
                        <option value="bac">Bắc + Đà Nẵng (nghỉ T7+CN)</option>
                        <option value="nam">HCM + Nam Bộ (nghỉ CN)</option>
                      </select>
                    </label>
                    <button disabled={busy === p.id} onClick={() => lenLich(p.id, p.tong_lan)}
                      className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm disabled:opacity-50">
                      {busy === p.id ? 'Đang sinh…' : 'Sinh lịch'}
                    </button>
                    {p.so_xong > 0 && <span className="text-[11px] text-amber-600 w-full">Giữ {p.so_xong} lượt đã làm, chỉ thay các lượt chưa làm.</span>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
