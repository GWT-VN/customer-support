import { DieuHuong } from '@/components/DieuHuong'
import { laAdmin } from '@/lib/supabase'
import { listKhachChoDuyet } from '@/app/actions'
import { DangKyBHForm } from '@/components/DangKyBHForm'
import { KhachChoDuyetList } from '@/components/KhachChoDuyetList'

export default async function DangKyBHPage() {
  const [admin, choDuyet] = await Promise.all([laAdmin(), listKhachChoDuyet()])
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">Đăng ký bảo hành</h1>
          <DieuHuong />
        </header>
        <p className="text-sm bg-sky-50 text-sky-900 rounded-lg px-3 py-2">
          Gắn máy (serial) cho khách và kích hoạt bảo hành. Thông tin máy tự lấy từ kho serial;
          khách mới (đại lý/Shopee đăng ký sau) tạo được ngay nhưng <strong>chờ admin duyệt</strong>.
        </p>
        <DangKyBHForm />

        {admin && (
          <section className="bg-white rounded-xl border p-5 max-w-2xl">
            <h2 className="font-medium text-slate-900 mb-3">Khách chờ duyệt ({choDuyet.length})</h2>
            <KhachChoDuyetList items={choDuyet} />
          </section>
        )}
      </div>
    </main>
  )
}
