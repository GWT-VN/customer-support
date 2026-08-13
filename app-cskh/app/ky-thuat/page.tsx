import Link from 'next/link'
import { chanNeuKhongPhaiQuanLy } from '@/lib/supabase'
import { dsKyThuat } from '@/app/actions'
import { KyThuatBang } from '@/components/KyThuatBang'

export default async function KyThuatPage() {
  await chanNeuKhongPhaiQuanLy()
  const dsKt = await dsKyThuat()

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Gán lịch kỹ thuật</h1>
            <p className="text-sm text-slate-500">Gán việc cho kỹ thuật (nhân viên + cộng tác viên). 1 chuyến đi có thể gồm nhiều việc: lắp máy · bảo trì · ticket · thay lõi · khảo sát · thu tiền · khác.</p>
          </div>
          <Link href="/ky-thuat/lich" className="rounded-lg border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Xem lịch đã lên →</Link>
        </header>

        <KyThuatBang dsKt={dsKt} />
      </div>
    </main>
  )
}
