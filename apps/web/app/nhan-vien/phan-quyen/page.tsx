import Link from 'next/link'
import { BangLechQuyen } from '@/components/BangLechQuyen'
import { MaTranQuyen } from '@/components/MaTranQuyen'
import { chanNeuKhongPhaiAdmin } from '@/lib/nen-tang/gac-cong'
import { docLech, docMaTran } from '@/lib/nen-tang/ma-tran'
import { QUYEN } from '@/lib/nen-tang/quyen'

export default async function PhanQuyenPage() {
  // Rào THẬT của trang này.
  await chanNeuKhongPhaiAdmin()
  const [maTran, lech] = await Promise.all([docMaTran(), docLech()])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-full mx-auto p-4 sm:p-6 space-y-4">
        <header className="space-y-1">
          <Link href="/nhan-vien" className="text-sm text-slate-500 hover:text-slate-800">
            ← Nhân viên
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">Phân quyền theo vai trò</h1>
        </header>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 space-y-1">
          <p className="font-medium">Ma trận đang CHẠY THỬ — tick ở đây chưa đổi quyền thật của ai.</p>
          <p>
            Luật quyết định hiện vẫn là luật cũ trong code. Bảng này được lưu lại và
            đối chiếu, để anh chỉnh cho đúng ý trước khi bật làm luật thật. Bật rồi thì mỗi ô
            bỏ tick là một người mất một việc — nên chỉnh xong hãy báo.
          </p>
        </div>

        <p className="text-sm text-slate-500">
          {QUYEN.length} việc trong app, gom từ 149 thao tác thật. Cột <b>Quản trị</b> khoá cứng
          toàn quyền — bỏ tick là khoá chết chính màn hình này. Kéo ngang để thấy hết vai trò;
          cột việc luôn dính bên trái. Di chuột vào tên cột để xem tên vai trò đầy đủ.
        </p>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">Lệch — ma trận nói khác luật đang chạy</h2>
          <BangLechQuyen ds={lech} />
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">Ma trận</h2>
          <MaTranQuyen maTran={maTran} />
        </section>
      </div>
    </main>
  )
}
