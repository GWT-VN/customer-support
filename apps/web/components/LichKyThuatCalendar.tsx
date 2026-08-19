import Link from 'next/link'
import type { LichKyThuatRow } from '@/app/actions'

const THU = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function thangKe(thang: string, buoc: number): string {
  const [y, m] = thang.split('-').map(Number)
  const idx = y * 12 + (m - 1) + buoc
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`
}
function tenThang(thang: string): string {
  const [y, m] = thang.split('-')
  return `Tháng ${Number(m)}/${y}`
}

/**
 * Calendar lịch KỸ THUẬT theo tháng — nhìn tháng này có bao nhiêu chuyến, ngày nào.
 * Server component. Tuần bắt đầu Thứ 2. Chip: xanh=xong · xám gạch=huỷ · sky=đã hẹn.
 */
export function LichKyThuatCalendar({ thang, rows, kt }: { thang: string; rows: LichKyThuatRow[]; kt?: string }) {
  const [y, m] = thang.split('-').map(Number)
  const soNgay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const thu1 = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7

  const theoNgay = new Map<number, LichKyThuatRow[]>()
  for (const r of rows) {
    const d = Number(r.ngay.slice(8, 10))
    const a = theoNgay.get(d) ?? []; a.push(r); theoNgay.set(d, a)
  }
  const o: (number | null)[] = []
  for (let i = 0; i < thu1; i++) o.push(null)
  for (let d = 1; d <= soNgay; d++) o.push(d)
  while (o.length % 7 !== 0) o.push(null)

  const qs = (t: string) => new URLSearchParams({ thang: t, ...(kt ? { kt } : {}) }).toString()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/ky-thuat/lich?view=calendar&${qs(thangKe(thang, -1))}`} className="rounded-lg border px-2.5 py-1 text-sm hover:bg-slate-50">←</Link>
          <h2 className="font-medium text-slate-900 min-w-36 text-center">{tenThang(thang)}</h2>
          <Link href={`/ky-thuat/lich?view=calendar&${qs(thangKe(thang, 1))}`} className="rounded-lg border px-2.5 py-1 text-sm hover:bg-slate-50">→</Link>
        </div>
        <span className="text-sm text-slate-500">{rows.length} chuyến trong tháng</span>
      </div>

      <div className="bg-white rounded-xl border overflow-x-auto">
        <div className="grid grid-cols-7 min-w-[42rem]">
          {THU.map((t) => (
            <div key={t} className={`px-2 py-2 text-xs font-medium text-center border-b ${t === 'CN' ? 'text-red-500' : t === 'T7' ? 'text-sky-600' : 'text-slate-500'}`}>{t}</div>
          ))}
          {o.map((d, i) => {
            const list = d ? theoNgay.get(d) ?? [] : []
            return (
              <div key={i} className={`min-h-[5.5rem] border-b border-r p-1 align-top ${i % 7 === 6 ? 'bg-red-50/30' : ''}`}>
                {d && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">{d}</span>
                      {list.length > 0 && <span className="text-[10px] bg-slate-900 text-white rounded-full px-1.5">{list.length}</span>}
                    </div>
                    <div className="space-y-0.5 mt-0.5">
                      {list.slice(0, 4).map((r) => (
                        <div key={r.id} className={`truncate rounded px-1 py-0.5 text-[10px] ${r.trang_thai === 'xong' ? 'bg-emerald-100 text-emerald-800' : r.trang_thai === 'huy' ? 'bg-slate-100 text-slate-400 line-through' : 'bg-sky-100 text-sky-800'}`}
                          title={`${r.ten_ky_thuat ?? ''} · ${r.ten_khach ?? r.dia_chi ?? ''}`}>
                          {r.ten_ky_thuat ?? 'KT'}{r.ten_khach ? ` · ${r.ten_khach}` : ''}
                        </div>
                      ))}
                      {list.length > 4 && <div className="text-[10px] text-slate-400">+{list.length - 4} nữa</div>}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
