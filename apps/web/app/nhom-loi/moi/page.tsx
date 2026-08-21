import { chanNeuThieuQuyen } from '@/lib/nen-tang/kiem-quyen'
import { NutQuayLai } from '@/components/NutQuayLai'
import { NhomLoiForm } from '@/components/NhomLoiForm'

export default async function TaoNhomLoiPage({
  searchParams,
}: {
  searchParams: Promise<{ goi_y?: string; ten?: string; tickets?: string }>
}) {
  await chanNeuThieuQuyen('cs.nhom_loi.cau_hinh', 'QUANLY')
  const { goi_y, ten, tickets } = await searchParams
  const dsTicket = tickets ? tickets.split(',').filter(Boolean) : []

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <NutQuayLai macDinh="/nhom-loi" />
        <h1 className="text-xl font-semibold text-slate-900">Tạo nhóm lỗi</h1>
        <NhomLoiForm goiYMau={goi_y} goiYTen={ten} goiYTickets={dsTicket} />
      </div>
    </main>
  )
}
