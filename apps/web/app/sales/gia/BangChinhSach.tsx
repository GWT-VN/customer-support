'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { luuOChinhSach, type DongChinhSach } from './actions'
import { capGiaVaPct, type Bac } from '../_ctkm'

const vnd = new Intl.NumberFormat('vi-VN')
const BAC: { ma: Bac; nhan: string }[] = [
  { ma: 'NPP', nhan: 'Cấp 1 · NPP' },
  { ma: 'DAI_LY', nhan: 'Cấp 2 · Đại lý' },
  { ma: 'GIOI_THIEU', nhan: 'Cấp 3 · Giới thiệu' },
]

export function BangChinhSach({ ds, coQuyenSoan }: { ds: DongChinhSach[]; coQuyenSoan: boolean }) {
  const router = useRouter()
  const [dangChay, batDau] = useTransition()
  const [loi, setLoi] = useState<string | null>(null)
  /** Giá trị đang gõ, chưa lưu — khoá `${ma}|${bac}|${pct|gia}`. */
  const [nhap, setNhap] = useState<Record<string, string>>({})

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
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
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
                <tr key={d.ma} className="hover:bg-slate-50">
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
      <p className="text-xs text-slate-500">
        📌 App lưu <b>cả hai</b> con số kèm ghi nhớ ô nào bạn gõ — để số hiển thị luôn đúng thứ đã duyệt,
        không lệch vài đồng vì tính lại từ phần trăm.
      </p>
    </div>
  )
}
