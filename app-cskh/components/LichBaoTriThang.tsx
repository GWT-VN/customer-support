import Link from 'next/link'
import type { LuotThang } from '@/app/actions'

const THU = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function thangKe(thang: string, buoc: number): string {
  const [y, m] = thang.split('-').map(Number)
  const idx = (y * 12 + (m - 1)) + buoc
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`
}
function tenThang(thang: string): string {
  const [y, m] = thang.split('-')
  return `Tháng ${Number(m)}/${y}`
}

/**
 * Calendar bảo trì theo THÁNG — nhìn tháng này có bao nhiêu lượt, rơi ngày nào.
 * Server component: lưới tĩnh + điều hướng tháng bằng Link (?thang=YYYY-MM).
 * Tuần bắt đầu Thứ 2. Chip: xanh=đã làm · đỏ=quá hạn · hổ phách=chưa làm.
 */
export function LichBaoTriThang({ thang, rows }: { thang: string; rows: LuotThang[] }) {
  const [y, m] = thang.split('-').map(Number)
  const soNgay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const thu1 = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7 // 0 = Thứ 2

  const theoNgay = new Map<number, LuotThang[]>()
  for (const r of rows) {
    if (!r.due_date) continue
    const d = Number(r.due_date.slice(8, 10))
    const a = theoNgay.get(d) ?? []
    a.push(r); theoNgay.set(d, a)
  }

  // các ô: đệm đầu tuần + từng ngày
  const o: (number | null)[] = []
  for (let i = 0; i < thu1; i++) o.push(null)
  for (let d = 1; d <= soNgay; d++) o.push(d)
  while (o.length % 7 !== 0) o.push(null)

  const chip = (r: LuotThang) => {
    const done = !!r.completed_at
    const qua = r.tinh_trang === 'QUÁ HẠN'
    const mau = done ? 'bg-emerald-100 text-emerald-800' : qua ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
    return (
      <div key={r.visit_id} className={`truncate rounded px-1 py-0.5 text-[10px] ${mau}`} title={`${r.customer_name ?? '—'} · lần ${r.lan_thu ?? '?'}${done ? ' · đã làm' : ''}`}>
        {r.customer_name ?? r.bo_may ?? '—'}{r.lan_thu ? ` (${r.lan_thu})` : ''}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/bao-tri?tt=lich&thang=${thangKe(thang, -1)}`} className="rounded-lg border px-2.5 py-1 text-sm hover:bg-slate-50">←</Link>
          <h2 className="font-medium text-slate-900 min-w-36 text-center">{tenThang(thang)}</h2>
          <Link href={`/bao-tri?tt=lich&thang=${thangKe(thang, 1)}`} className="rounded-lg border px-2.5 py-1 text-sm hover:bg-slate-50">→</Link>
        </div>
        <span className="text-sm text-slate-500">{rows.length} lượt trong tháng</span>
      </div>

      <div className="bg-white rounded-xl border overflow-x-auto">
        <div className="grid grid-cols-7 min-w-[42rem]">
          {THU.map((t) => (
            <div key={t} className={`px-2 py-2 text-xs font-medium text-center border-b ${t === 'CN' ? 'text-red-500' : t === 'T7' ? 'text-sky-600' : 'text-slate-500'}`}>{t}</div>
          ))}
          {o.map((d, i) => {
            const luot = d ? theoNgay.get(d) ?? [] : []
            return (
              <div key={i} className={`min-h-[5.5rem] border-b border-r p-1 align-top ${i % 7 === 6 ? 'bg-red-50/30' : ''}`}>
                {d && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">{d}</span>
                      {luot.length > 0 && <span className="text-[10px] bg-slate-900 text-white rounded-full px-1.5">{luot.length}</span>}
                    </div>
                    <div className="space-y-0.5 mt-0.5">
                      {luot.slice(0, 4).map(chip)}
                      {luot.length > 4 && <div className="text-[10px] text-slate-400">+{luot.length - 4} nữa</div>}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <p className="text-xs text-slate-500">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 align-middle" /> đã làm ·
        <span className="inline-block w-2 h-2 rounded-full bg-red-400 align-middle ml-2" /> quá hạn ·
        <span className="inline-block w-2 h-2 rounded-full bg-amber-400 align-middle ml-2" /> chưa làm
      </p>
    </div>
  )
}
