import Link from 'next/link'
import { DieuHuong } from '@/components/DieuHuong'
import { bhChoKichHoat, bhChoKichHoatDem } from '@/app/actions'
import { BHChoKichHoatList } from '@/components/BHChoKichHoatList'

const TAB = [
  { key: '', nhan: 'Tất cả' },
  { key: 'da_lap_chua_kich_hoat', nhan: 'Đã lắp — bấm là xong' },
  { key: 'don_sales_chua_gan_may', nhan: 'Đơn bán — cần điền serial' },
] as const

export default async function BHChoKichHoatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; nguon?: string }>
}) {
  const { q = '', nguon = '' } = await searchParams
  const [rows, dem] = await Promise.all([
    bhChoKichHoat(q, nguon || undefined),
    bhChoKichHoatDem(),
  ])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">Chờ kích hoạt BH</h1>
          <DieuHuong />
        </header>

        <p className="text-sm text-slate-500">
          Máy đã bán hoặc đã lắp mà bảo hành chưa kích hoạt. Kích hoạt xong dòng tự biến mất khỏi bảng.
        </p>

        <form className="flex gap-2">
          {nguon && <input type="hidden" name="nguon" value={nguon} />}
          <input name="q" defaultValue={q}
            placeholder="Gõ tên/SĐT khách, serial, mã máy, mã đơn…"
            className="flex-1 rounded-lg border px-4 py-2.5 text-slate-900 bg-white" />
          <button className="rounded-lg bg-slate-900 text-white px-5 font-medium">Tìm</button>
        </form>

        <div className="flex gap-2 flex-wrap">
          {TAB.map((t) => {
            const sl = t.key === 'da_lap_chua_kich_hoat' ? dem.da_lap
              : t.key === 'don_sales_chua_gan_may' ? dem.don_sales
              : dem.da_lap + dem.don_sales
            return (
              <Link key={t.key}
                href={`/bh-cho-kich-hoat?${new URLSearchParams({ ...(q && { q }), ...(t.key && { nguon: t.key }) })}`}
                className={`px-3 py-1.5 rounded-lg text-sm border ${
                  nguon === t.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'
                }`}>
                {t.nhan} ({sl})
              </Link>
            )
          })}
        </div>

        <p className="text-sm text-slate-500">
          {rows.length} dòng{rows.length === 500 && ' (giới hạn 500 — gõ cụ thể hơn)'}
        </p>

        <BHChoKichHoatList items={rows} />
      </div>
    </main>
  )
}
