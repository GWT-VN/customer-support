import Link from 'next/link'
import type { LuotThang } from '@/app/actions'
import { ngayDayDu, oCuaThang, thangHienTai, thangKe } from '@/lib/lichThang'

const THU = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function tenThang(thang: string): string {
  const [y, m] = thang.split('-')
  return `Tháng ${Number(m)}/${y}`
}

function vnNgay(ngay: string): string {
  return `${ngay.slice(8, 10)}/${ngay.slice(5, 7)}/${ngay.slice(0, 4)}`
}

/**
 * Calendar bảo trì theo THÁNG — nhìn tháng này có bao nhiêu lượt, rơi ngày nào.
 * Server component: lưới tĩnh + điều hướng bằng Link (`?thang=YYYY-MM&ngay=YYYY-MM-DD`).
 * Tuần bắt đầu Thứ 2. Chip: xanh=đã làm · đỏ=quá hạn · hổ phách=chưa làm.
 *
 * CEO báo hai lỗi ở bản trước: ô ngày không bấm được (nhìn thấy số mà không xem
 * được chi tiết) và không có đường về tháng hiện tại. Nay mỗi ô ngày là một Link
 * mở danh sách chuyến của đúng ngày đó ngay bên dưới, và có nút "Tháng này".
 */
export function LichBaoTriThang({
  thang,
  rows,
  ngay,
}: {
  thang: string
  rows: LuotThang[]
  ngay?: string
}) {
  const theoNgay = new Map<number, LuotThang[]>()
  for (const r of rows) {
    if (!r.due_date) continue
    const d = Number(r.due_date.slice(8, 10))
    const a = theoNgay.get(d) ?? []
    a.push(r); theoNgay.set(d, a)
  }

  const o = oCuaThang(thang)
  const luotCuaNgay = ngay ? rows.filter((r) => r.due_date === ngay) : []

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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Link href={`/bao-tri?tt=lich&thang=${thangKe(thang, -1)}`} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm hover:bg-slate-50">←</Link>
          <h2 className="font-medium text-slate-900 min-w-36 text-center">{tenThang(thang)}</h2>
          <Link href={`/bao-tri?tt=lich&thang=${thangKe(thang, 1)}`} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm hover:bg-slate-50">→</Link>
          <Link
            href={`/bao-tri?tt=lich&thang=${thangHienTai()}`}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm hover:bg-slate-50"
          >
            Tháng này
          </Link>
        </div>
        <span className="text-sm text-slate-500">{rows.length} lượt trong tháng</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="grid grid-cols-7 min-w-[42rem]">
          {THU.map((t) => (
            <div key={t} className={`px-2 py-2 text-xs font-medium text-center border-b ${t === 'CN' ? 'text-red-500' : t === 'T7' ? 'text-sky-600' : 'text-slate-500'}`}>{t}</div>
          ))}
          {o.map((d, i) => {
            if (!d) return <div key={i} className={`min-h-[5.5rem] border-b border-r p-1 ${i % 7 === 6 ? 'bg-red-50/30' : ''}`} />
            const luot = theoNgay.get(d) ?? []
            const nd = ngayDayDu(thang, d)
            const dangChon = ngay === nd
            return (
              <Link
                key={i}
                href={`/bao-tri?tt=lich&thang=${thang}&ngay=${nd}`}
                scroll={false}
                className={
                  `block min-h-[5.5rem] border-b border-r p-1 align-top hover:bg-[#e2f2f3] ` +
                  (dangChon ? 'bg-[#e2f2f3] ring-2 ring-inset ring-[#0e8c9a] ' : i % 7 === 6 ? 'bg-red-50/30 ' : '')
                }
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{d}</span>
                  {luot.length > 0 && <span className="text-[10px] bg-slate-900 text-white rounded-full px-1.5">{luot.length}</span>}
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {luot.slice(0, 4).map(chip)}
                  {luot.length > 4 && <div className="text-[10px] text-slate-400">+{luot.length - 4} nữa</div>}
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 align-middle" /> đã làm ·
        <span className="inline-block w-2 h-2 rounded-full bg-red-400 align-middle ml-2" /> quá hạn ·
        <span className="inline-block w-2 h-2 rounded-full bg-amber-400 align-middle ml-2" /> chưa làm ·
        <span className="ml-2">bấm một ngày để xem chi tiết</span>
      </p>

      {ngay && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <h3 className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-900">
            Ngày {vnNgay(ngay)} · {luotCuaNgay.length} lượt
          </h3>
          {luotCuaNgay.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Không có lượt bảo trì nào ngày này.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {luotCuaNgay.map((r) => (
                <li key={r.visit_id} className="px-4 py-3 text-sm text-slate-700">
                  <span className="font-medium">{r.customer_name ?? r.bo_may ?? '—'}</span>
                  {r.lan_thu ? <span className="text-slate-400"> · lần {r.lan_thu}</span> : null}
                  {r.bo_may && r.customer_name ? <span className="text-slate-400"> · {r.bo_may}</span> : null}
                  {r.completed_at
                    ? <span className="ml-2 text-xs text-emerald-700">✓ đã làm</span>
                    : r.tinh_trang === 'QUÁ HẠN'
                      ? <span className="ml-2 text-xs text-red-700">quá hạn</span>
                      : <span className="ml-2 text-xs text-amber-600">chưa làm</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
