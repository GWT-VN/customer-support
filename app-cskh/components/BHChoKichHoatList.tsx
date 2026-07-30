'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { kichHoatNhanh, type BHChoKichHoat } from '@/app/actions'
import { SerialPicker } from '@/components/SerialPicker'
import { vnDate } from '@/components/Badge'

const HOM_NAY = () => new Date().toISOString().slice(0, 10)

/** Khoá của 1 dòng — view không có id, dòng đơn sales phân biệt bằng mã đơn + mã máy. */
function khoa(r: BHChoKichHoat) {
  return `${r.nguon}|${r.serial ?? ''}|${r.ma_don ?? ''}|${r.ma_noi_bo ?? ''}|${r.customer_id ?? ''}`
}

/**
 * Hàng chờ kích hoạt bảo hành.
 *
 * Hai kiểu dòng:
 *  · đã lắp  -> đủ serial + khách, bấm một nút là xong.
 *  · đơn bán -> đã biết khách từ đơn, CSKH chỉ điền serial rồi bấm.
 *
 * Dòng nào chưa nối được sang khách CSKH thì không kích hoạt tại chỗ được
 * (thiếu customer_id) — đẩy sang /dang-ky-bh để chọn/tạo khách.
 */
export function BHChoKichHoatList({ items }: { items: BHChoKichHoat[] }) {
  const [serial, setSerial] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [loi, setLoi] = useState<Record<string, string>>({})
  const router = useRouter()

  async function chay(r: BHChoKichHoat) {
    const k = khoa(r)
    const sn = (r.serial ?? serial[k] ?? '').trim()
    if (!sn || !r.customer_id) return
    setBusy(k); setLoi((c) => ({ ...c, [k]: '' }))
    const kq = await kichHoatNhanh({
      serial: sn,
      customer_id: r.customer_id,
      // Dòng đã lắp giữ nguyên ngày lắp; dòng đơn bán lấy ngày đặt hàng làm mốc BH.
      install_date: (r.ngay_lap || r.ngay_dat_hang || HOM_NAY()).slice(0, 10),
      install_address: r.dia_chi ?? undefined,
    })
    setBusy(null)
    if (!kq.ok) setLoi((c) => ({ ...c, [k]: kq.error }))
    else router.refresh()   // kích hoạt xong -> view bỏ dòng này ra
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border px-4 py-10 text-center text-slate-400">
        Không còn máy nào chờ kích hoạt bảo hành.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Khách</th>
            <th className="text-left px-4 py-3 font-medium">Máy</th>
            <th className="text-left px-4 py-3 font-medium">Đơn / ngày lắp</th>
            <th className="text-left px-4 py-3 font-medium">Serial</th>
            <th className="text-left px-4 py-3 font-medium w-px whitespace-nowrap">Kích hoạt</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((r) => {
            const k = khoa(r)
            const daCoSerial = Boolean(r.serial)
            const sn = r.serial ?? serial[k] ?? ''
            const chayDuoc = Boolean(r.customer_id) && sn.trim().length > 0
            return (
              <tr key={k} className="hover:bg-slate-50 align-top">
                <td className="px-4 py-2.5 text-slate-700">
                  {r.customer_id ? (
                    <Link href={`/khach/${r.customer_id}`} className="hover:underline">
                      {r.ten_khach ?? '—'}
                    </Link>
                  ) : (
                    <span>{r.ten_khach ?? '—'}</span>
                  )}
                  {r.sdt_khach && <div className="font-mono text-[10px] text-slate-400">{r.sdt_khach}</div>}
                  {!r.customer_id && (
                    <div className="text-[10px] text-amber-700">chưa có hồ sơ khách CSKH</div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-700">
                  {r.ten_noi_bo ?? '—'}
                  <div className="font-mono text-[10px] text-slate-400">{r.ma_noi_bo ?? '—'}</div>
                </td>
                <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                  {daCoSerial ? (
                    <>lắp {vnDate(r.ngay_lap)}</>
                  ) : (
                    <>
                      {r.ma_don ?? '—'}
                      <div className="text-[10px] text-slate-400">{vnDate(r.ngay_dat_hang)}</div>
                    </>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {daCoSerial ? (
                    <span className="font-mono text-xs text-slate-900">{r.serial}</span>
                  ) : (
                    <div className="flex min-w-56">
                      <SerialPicker
                        value={serial[k] ?? ''}
                        onChange={(v) => setSerial((c) => ({ ...c, [k]: v }))}
                        placeholder="Gõ serial máy…"
                      />
                    </div>
                  )}
                  {loi[k] && <p className="text-xs text-red-600 mt-1">{loi[k]}</p>}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {r.customer_id ? (
                    <button
                      onClick={() => chay(r)}
                      disabled={!chayDuoc || busy === k}
                      className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-40">
                      {busy === k ? 'Đang kích hoạt…' : 'Kích hoạt BH'}
                    </button>
                  ) : (
                    <Link href="/dang-ky-bh"
                      className="rounded-lg border px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                      Chọn khách…
                    </Link>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
