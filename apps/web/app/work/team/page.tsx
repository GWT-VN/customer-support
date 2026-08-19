import { requireNhanSu } from '@/lib/supabase'
import { bangTeam, nenTang } from '../actions'
import { BangTeam } from '@/components/work/BangTeam'

export const metadata = { title: 'Bảng team · GWT Work' }

/**
 * Bảng team — mọi việc mình được xem (work.visible_task_ids quyết định), xem theo
 * Danh sách hoặc Bảng kanban, lọc theo team / người / từ khoá.
 */
export default async function BangTeamPage() {
  await requireNhanSu()
  const [rows, nt] = await Promise.all([bangTeam(), nenTang()])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
        <header>
          <h1 className="text-xl font-semibold text-slate-900">Bảng team</h1>
          <p className="text-sm text-slate-500">
            Việc của cả team — bạn chỉ thấy những việc mình có quyền xem.
          </p>
        </header>
        <BangTeam rowsBanDau={rows} nenTang={nt} />
      </div>
    </main>
  )
}
