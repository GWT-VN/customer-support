import Link from 'next/link'
import { chanNeuKhongPhaiQuanLy } from '@/lib/supabase'
import { dsKyThuat, dsLichKyThuat } from '@/app/actions'
import { KyThuatBang } from '@/components/KyThuatBang'
import { LichKyThuatList } from '@/components/LichKyThuatList'

const iso = (d: Date) => d.toISOString().slice(0, 10)

export default async function KyThuatPage({
  searchParams,
}: {
  searchParams: Promise<{ tu?: string; den?: string; kt?: string }>
}) {
  await chanNeuKhongPhaiQuanLy()
  const { tu: tuRaw, den: denRaw, kt } = await searchParams
  const now = new Date()
  const tu = /^\d{4}-\d{2}-\d{2}$/.test(tuRaw ?? '') ? tuRaw! : iso(new Date(now.getTime() - 7 * 86400000))
  const den = /^\d{4}-\d{2}-\d{2}$/.test(denRaw ?? '') ? denRaw! : iso(new Date(now.getTime() + 45 * 86400000))

  const [dsKt, lich] = await Promise.all([dsKyThuat(), dsLichKyThuat(tu, den, kt || undefined)])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        <header>
          <h1 className="text-xl font-semibold text-slate-900">Lịch kỹ thuật</h1>
          <p className="text-sm text-slate-500">Gán việc cho kỹ thuật (nhân viên + cộng tác viên). 1 chuyến đi có thể gồm nhiều việc: lắp máy · bảo trì · ticket · thay lõi · khảo sát · khác.</p>
        </header>

        <KyThuatBang dsKt={dsKt} />

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-medium text-slate-900">Lịch chuyến đi ({lich.length})</h2>
            <form className="flex items-end gap-2 text-xs text-slate-600">
              <label>Từ<br /><input type="date" name="tu" defaultValue={tu} className="mt-0.5 rounded border px-2 py-1 text-sm" /></label>
              <label>Đến<br /><input type="date" name="den" defaultValue={den} className="mt-0.5 rounded border px-2 py-1 text-sm" /></label>
              {kt && <input type="hidden" name="kt" value={kt} />}
              <button className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm">Lọc</button>
            </form>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            <Link href={`/ky-thuat?${new URLSearchParams({ tu, den })}`} className={`px-2.5 py-1 rounded-lg text-xs border ${!kt ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'}`}>Tất cả KT</Link>
            {dsKt.filter((k) => k.hoat_dong).map((k) => (
              <Link key={k.id} href={`/ky-thuat?${new URLSearchParams({ tu, den, kt: k.id })}`}
                className={`px-2.5 py-1 rounded-lg text-xs border ${kt === k.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'}`}>
                {k.ten}
              </Link>
            ))}
          </div>

          <LichKyThuatList rows={lich} />
        </section>
      </div>
    </main>
  )
}
