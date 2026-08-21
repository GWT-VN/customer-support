import { chanNeuThieuQuyen } from '@/lib/nen-tang/kiem-quyen'
import { baoTriDaMap, baoTriSapHet, boiCanhKhach } from '@/app/actions'
import { BaoTriQuanLy } from '@/components/BaoTriQuanLy'

export default async function LenLichBaoTriPage({
  searchParams,
}: {
  searchParams: Promise<{ kh?: string }>
}) {
  await chanNeuThieuQuyen('cs.bao_tri.tao_plan', 'QUANLY')
  const { kh } = await searchParams
  const [daMap, sapHet] = await Promise.all([baoTriDaMap(), baoTriSapHet()])
  const moTaoKhach = kh ? { id: kh, ctx: await boiCanhKhach(kh) } : undefined
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">Bảo trì · Lên lịch &amp; tạo gói</h1>
        <p className="text-sm text-slate-500">Lên lịch tự động (né cuối tuần theo vùng) · tạo gói mới cho khách · nhắc chào gói sắp hết.</p>
        <BaoTriQuanLy chuaMap={[]} daMap={daMap} sapHet={sapHet} phan="lenlich" moTaoKhach={moTaoKhach} />
      </div>
    </main>
  )
}
