import Link from 'next/link'
import { chanNeuKhongPhaiQuanLy } from '@/lib/supabase'
import { dsKyThuat, dsLichKyThuat } from '@/app/actions'
import { LichKyThuatList } from '@/components/LichKyThuatList'
import { LichKyThuatCalendar } from '@/components/LichKyThuatCalendar'

const iso = (d: Date) => d.toISOString().slice(0, 10)

export default async function XemLichKyThuatPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; tu?: string; den?: string; kt?: string; thang?: string }>
}) {
  await chanNeuKhongPhaiQuanLy()
  const { view = 'list', tu: tuRaw, den: denRaw, kt, thang: thangRaw } = await searchParams
  const laCalendar = view === 'calendar'
  const now = new Date()
  const thang = /^\d{4}-\d{2}$/.test(thangRaw ?? '') ? thangRaw! : now.toISOString().slice(0, 7)
  const tu = /^\d{4}-\d{2}-\d{2}$/.test(tuRaw ?? '') ? tuRaw! : iso(new Date(now.getTime() - 7 * 86400000))
  const den = /^\d{4}-\d{2}-\d{2}$/.test(denRaw ?? '') ? denRaw! : iso(new Date(now.getTime() + 45 * 86400000))

  const dsKt = await dsKyThuat(true)
  const rows = laCalendar
    ? await dsLichKyThuat(`${thang}-01`, `${thang}-31`, kt || undefined)
    : await dsLichKyThuat(tu, den, kt || undefined)

  const giuKt = (extra: Record<string, string>) => new URLSearchParams({ ...(kt ? { kt } : {}), ...extra }).toString()

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Lịch kỹ thuật đã lên</h1>
            <p className="text-sm text-slate-500">Xem các chuyến đã gán cho kỹ thuật. Gán chuyến mới ở <Link href="/ky-thuat" className="underline">Gán lịch kỹ thuật</Link>.</p>
          </div>
          <div className="flex gap-1.5">
            <Link href={`/ky-thuat/lich?${giuKt({ view: 'list' })}`} className={`px-3 py-1.5 rounded-lg text-sm border ${!laCalendar ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'}`}>Danh sách</Link>
            <Link href={`/ky-thuat/lich?${giuKt({ view: 'calendar', thang })}`} className={`px-3 py-1.5 rounded-lg text-sm border ${laCalendar ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'}`}>📅 Calendar</Link>
          </div>
        </header>

        <div className="flex gap-1.5 flex-wrap">
          <Link href={`/ky-thuat/lich?${new URLSearchParams({ view, ...(laCalendar ? { thang } : { tu, den }) })}`}
            className={`px-2.5 py-1 rounded-lg text-xs border ${!kt ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'}`}>Tất cả KT</Link>
          {dsKt.map((k) => (
            <Link key={k.id} href={`/ky-thuat/lich?${new URLSearchParams({ view, kt: k.id, ...(laCalendar ? { thang } : { tu, den }) })}`}
              className={`px-2.5 py-1 rounded-lg text-xs border ${kt === k.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'}`}>{k.ten}</Link>
          ))}
        </div>

        {laCalendar ? (
          <LichKyThuatCalendar thang={thang} rows={rows} kt={kt || undefined} />
        ) : (
          <>
            <form className="flex items-end gap-2 text-xs text-slate-600">
              <label>Từ<br /><input type="date" name="tu" defaultValue={tu} className="mt-0.5 rounded border px-2 py-1 text-sm" /></label>
              <label>Đến<br /><input type="date" name="den" defaultValue={den} className="mt-0.5 rounded border px-2 py-1 text-sm" /></label>
              <input type="hidden" name="view" value="list" />
              {kt && <input type="hidden" name="kt" value={kt} />}
              <button className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm">Lọc</button>
            </form>
            <LichKyThuatList rows={rows} />
          </>
        )}
      </div>
    </main>
  )
}
