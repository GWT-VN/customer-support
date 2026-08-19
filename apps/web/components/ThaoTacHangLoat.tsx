'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDaChon } from '@/bang'
import { capNhatHangLoat, xoaHangLoat } from '@/app/actions'
import type { CotSuaHL } from '@/lib/danhSach'

/**
 * Thao tác HÀNG LOẠT — cắm vào <ThanhDaChon>. Cập nhật 1 trường (chọn trường + giá
 * trị) cho cấp QUẢN LÝ; nút XOÁ hàng loạt chỉ hiện khi choPhepXoa=true (CHỈ ADMIN —
 * xoá thông tin khách). Luôn hỏi xác nhận kèm SỐ DÒNG. Server vẫn chặn thật.
 */
export function ThaoTacHangLoat({ bang, truong, choPhepXoa = false }: { bang: string; truong: readonly CotSuaHL[]; choPhepXoa?: boolean }) {
  const { daChon, soDong, boChonHet } = useDaChon()
  const router = useRouter()
  const [mo, setMo] = useState(false)
  const [field, setField] = useState(truong[0]?.key ?? '')
  const [val, setVal] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const fdef = truong.find((f) => f.key === field)

  async function capNhat() {
    const nhanTruong = fdef?.nhan ?? field
    const nhanGT = fdef?.kieu === 'enum' ? (fdef.chonLua?.find((o) => o.gt === val)?.nhan ?? val) : (val || '(để trống)')
    if (!window.confirm(`Cập nhật "${nhanTruong}" = "${nhanGT}" cho ${soDong} dòng đã chọn?`)) return
    setBusy(true); setErr(null)
    const r = await capNhatHangLoat(bang, daChon, field, val)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    boChonHet(); setMo(false); setVal(''); router.refresh()
  }
  async function xoa() {
    if (!window.confirm(`XOÁ ${soDong} dòng đã chọn? (khách = ẩn mềm, giữ máy/ticket)`)) return
    setBusy(true); setErr(null)
    const r = await xoaHangLoat(bang, daChon)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    boChonHet(); router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {mo ? (
        <>
          <select value={field} onChange={(e) => { setField(e.target.value); setVal('') }}
            className="rounded-lg border px-2 py-1.5 text-sm bg-white text-slate-900">
            {truong.map((f) => <option key={f.key} value={f.key}>{f.nhan}</option>)}
          </select>
          {fdef?.kieu === 'enum' ? (
            <select value={val} onChange={(e) => setVal(e.target.value)}
              className="rounded-lg border px-2 py-1.5 text-sm bg-white text-slate-900">
              <option value="">— Chọn giá trị —</option>
              {fdef.chonLua?.map((o) => <option key={o.gt} value={o.gt}>{o.nhan}</option>)}
            </select>
          ) : fdef?.kieu === 'date' ? (
            <input type="date" value={val} onChange={(e) => setVal(e.target.value)}
              className="rounded-lg border px-2 py-1.5 text-sm text-slate-900" />
          ) : (
            <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Giá trị mới…"
              className="rounded-lg border px-2 py-1.5 text-sm text-slate-900" />
          )}
          <button onClick={capNhat} disabled={busy}
            className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50">
            Áp cho {soDong}
          </button>
          <button onClick={() => setMo(false)} className="text-sm text-slate-500 underline">Huỷ</button>
        </>
      ) : (
        <>
          <button onClick={() => setMo(true)} disabled={busy}
            className="rounded-lg border bg-white px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50">
            Cập nhật hàng loạt
          </button>
          {choPhepXoa && (
            <button onClick={xoa} disabled={busy}
              className="rounded-lg border border-red-200 text-red-600 px-3 py-1.5 text-sm hover:bg-red-50 disabled:opacity-50">
              Xoá hàng loạt
            </button>
          )}
        </>
      )}
      {err && <span className="text-sm text-red-600">{err}</span>}
    </div>
  )
}
