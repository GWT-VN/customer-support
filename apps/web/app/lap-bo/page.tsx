import { requireStaff } from '@/lib/nen-tang/phien'
import { LapBoForm } from '@/components/LapBoForm'
import { NutQuayLai } from '@/components/NutQuayLai'

export default async function LapBoPage() {
  await requireStaff()
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <NutQuayLai macDinh="/" />
        <header>
          <h1 className="text-xl font-semibold text-slate-900">Lắp bộ (combo)</h1>
          <p className="text-sm text-slate-500 mt-1">
            Chọn bộ WH15A/WH30A → gán serial từng thiết bị từ kho → hệ tự sinh mã bộ
            (vd <span className="font-mono">WH30A202608001</span>) và kích hoạt bảo hành từng thiết bị.
          </p>
        </header>
        <LapBoForm />
      </div>
    </main>
  )
}
