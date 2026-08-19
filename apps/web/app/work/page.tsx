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
    <main data-khu="work" className="min-h-screen">
      <div className="max-w-5xl mx-auto px-5 py-5 sm:px-6 space-y-5">
        <header>
          <h1 style={{ fontSize: 20, fontWeight: 670, letterSpacing: "-.02em", margin: 0 }}>Việc của tôi</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
            Công việc bạn phụ trách hoặc cùng làm — xuyên mọi phòng ban.
          </p>
        </header>
        <ViecCuaToi rowsBanDau={rows} nenTang={nt} />
      </div>
    </main>
  )
}
