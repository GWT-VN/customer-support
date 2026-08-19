import Link from 'next/link'
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
    <main data-khu="work" className="min-h-screen">
      <div className="max-w-[1180px] mx-auto px-5 py-5 sm:px-6 space-y-5">
        <header>
          <nav className="flex gap-3 mb-2" style={{ fontSize: 12.5 }} aria-label="Khu Việc">
            <Link href="/work" style={{ color: "var(--accent-ink)" }}>Việc của tôi</Link>
            <span style={{ color: "var(--faint)" }}>Bảng team</span>
            <Link href="/work/tu-sinh" style={{ color: "var(--accent-ink)" }}>Việc tự sinh</Link>
          </nav>
          <h1 style={{ fontSize: 20, fontWeight: 670, letterSpacing: "-.02em", margin: 0 }}>Bảng team</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
            Việc của cả team — bạn chỉ thấy những việc mình có quyền xem.
          </p>
        </header>
        <BangTeam rowsBanDau={rows} nenTang={nt} />
      </div>
    </main>
  )
}
