import { chanNeuThieuQuyen } from '@/lib/nen-tang/kiem-quyen'
import { catalogSyncLast } from '@/app/actions'
import { NutDongBoCatalog } from '@/components/NutDongBoCatalog'

export default async function DongBoCatalogPage() {
  await chanNeuThieuQuyen('he_thong.catalog', 'ADMIN')
  const logs = await catalogSyncLast()

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">Đồng bộ catalog</h1>
        </header>

        <p className="text-sm bg-sky-50 text-sky-900 rounded-lg px-3 py-2">
          6 bảng gương catalog (mã nội bộ, lõi lọc, chính sách bảo hành…) được kéo từ
          <strong> GWT-Masterdata</strong>. Chạy tự động hàng ngày; bấm nút để cập nhật ngay khi Masterdata vừa đổi.
        </p>

        <div className="bg-white rounded-xl border p-5">
          <NutDongBoCatalog logs={logs} />
        </div>
      </div>
    </main>
  )
}
