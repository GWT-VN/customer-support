import { requireNhanSu } from '@/lib/supabase'
import { vieCcuaToi, nenTang } from './actions'
import { ViecCuaToi } from '@/components/work/ViecCuaToi'

export const metadata = { title: 'Việc của tôi · GWT Work' }

/**
 * Khu Work — "Việc của tôi": mọi nhân sự đang hoạt động đều vào được
 * (cổng nền tảng requireNhanSu, không cần vai trò CS). Xuyên mọi phòng ban.
 */
export default async function WorkPage() {
  await requireNhanSu()
  const [rows, nt] = await Promise.all([vieCcuaToi(), nenTang()])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <header>
          <h1 className="text-xl font-semibold text-slate-900">Việc của tôi</h1>
          <p className="text-sm text-slate-500">
            Công việc bạn phụ trách hoặc cùng làm — xuyên mọi phòng ban.
          </p>
        </header>
        <ViecCuaToi rowsBanDau={rows} nenTang={nt} />
      </div>
    </main>
  )
}
