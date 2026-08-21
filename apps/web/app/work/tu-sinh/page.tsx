import Link from 'next/link'
import { requireNhanSu } from '@/lib/nen-tang/phien'
import { manTuSinh, nenTang } from '../actions'
import { TuSinh } from '@/components/work/TuSinh'

export const metadata = { title: 'Việc tự sinh · GWT Work' }

/**
 * Sự kiện trong CSKH / Sales tự đẻ ra việc — không ai phải nhớ.
 * Bộ quét chạy dưới DB bằng pg_cron; màn này chỉ để xem và chỉnh luật.
 */
export default async function TuSinhPage() {
  await requireNhanSu()
  const [duLieu, nt] = await Promise.all([manTuSinh(), nenTang()])

  return (
    <main data-khu="work" className="min-h-screen">
      <div className="max-w-5xl mx-auto px-5 py-5 sm:px-6 space-y-5 khung-trang">
        <header>
          <nav className="flex gap-3 mb-2" style={{ fontSize: 12.5 }} aria-label="Khu Việc">
            <Link href="/work" style={{ color: 'var(--accent-ink)' }}>Việc của tôi</Link>
            <Link href="/work/team" style={{ color: 'var(--accent-ink)' }}>Bảng team</Link>
            <span style={{ color: 'var(--faint)' }}>Việc tự sinh</span>
          </nav>
          <h1 style={{ fontSize: 20, fontWeight: 670, letterSpacing: '-.02em', margin: 0 }}>Việc tự sinh từ ERP</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
            Sự kiện trong CSKH / Sales tự đẻ ra việc — không ai phải nhớ.
          </p>
        </header>
        <TuSinh duLieu={duLieu} nenTang={nt} />
      </div>
    </main>
  )
}
