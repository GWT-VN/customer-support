import { layNguoiDung } from '@/lib/supabase'
import { dangXuat } from '@/app/auth/actions'
import { DieuHuong } from './DieuHuong'

/**
 * Thanh trên cùng: menu chính + email đang đăng nhập + nút Đăng xuất.
 * Chưa đăng nhập (vd trang /login) thì không hiện gì.
 *
 * Dùng layNguoiDung() (có cache) chứ KHÔNG tự gọi getUser() — nếu không thì
 * mỗi trang tốn thêm một lượt gọi mạng tới Supabase chỉ để hiện cái email.
 */
export async function ThanhTaiKhoan() {
  const user = await layNguoiDung()
  if (!user) return null

  return (
    <div className="bg-white border-b sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-end gap-4 text-sm">
        <DieuHuong />
        <div className="flex items-center gap-3 shrink-0 border-l pl-4">
          <span className="hidden sm:inline text-slate-500">{user.email}</span>
          <form action={dangXuat}>
            <button
              type="submit"
              className="rounded-lg border px-3 py-1 text-slate-700 hover:bg-slate-50"
            >
              Đăng xuất
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
