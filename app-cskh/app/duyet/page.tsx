import { chanNeuKhongPhaiAdmin } from '@/lib/supabase'
import { listKhachChoDuyet, listYeuCauThayDoi } from '@/app/actions'
import { KhachChoDuyetList } from '@/components/KhachChoDuyetList'
import { DuyetList } from '@/components/DuyetList'

export default async function DuyetPage() {
  await chanNeuKhongPhaiAdmin()
  const [khachCho, yeuCau] = await Promise.all([listKhachChoDuyet(), listYeuCauThayDoi()])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">Chờ duyệt</h1>
        </header>

        <section className="space-y-2">
          <h2 className="font-medium text-slate-900">Khách mới ({khachCho.length})</h2>
          <p className="text-xs text-slate-400">Khách do CS tạo, chờ duyệt để chính thức.</p>
          <KhachChoDuyetList items={khachCho} />
        </section>

        <section className="space-y-2">
          <h2 className="font-medium text-slate-900">Yêu cầu sửa/xoá ({yeuCau.length})</h2>
          <p className="text-xs text-slate-400">CS đề xuất sửa/xoá khách · SĐT phụ · lịch thay lõi. Duyệt là áp thật.</p>
          <DuyetList items={yeuCau} />
        </section>
      </div>
    </main>
  )
}
