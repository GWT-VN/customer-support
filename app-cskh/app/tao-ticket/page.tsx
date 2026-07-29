import { DieuHuong } from '@/components/DieuHuong'
import { ticketTypes } from '@/app/actions'
import { TaoTicketForm } from '@/components/TaoTicketForm'

export default async function TaoTicketPage() {
  const loaiList = await ticketTypes()
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">Tạo ticket</h1>
          <DieuHuong />
        </header>
        <TaoTicketForm loaiList={loaiList} />
      </div>
    </main>
  )
}
