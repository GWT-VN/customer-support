import { chanNeuThieuQuyen } from '@/lib/nen-tang/kiem-quyen'
import { baoTriChuaMap } from '@/app/actions'
import { BaoTriQuanLy } from '@/components/BaoTriQuanLy'

export default async function MapKhachBaoTriPage() {
  await chanNeuThieuQuyen('cs.bao_tri.tao_plan', 'QUANLY')
  const chuaMap = await baoTriChuaMap()
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">Bảo trì · Map khách</h1>
        <p className="text-sm text-slate-500">Gán lịch bảo trì (từ Asana) vào hồ sơ khách kích hoạt máy.</p>
        <BaoTriQuanLy chuaMap={chuaMap} daMap={[]} sapHet={[]} phan="map" />
      </div>
    </main>
  )
}
