import { layNguoiDung } from '@/lib/nen-tang/phien'
import { dangXuat } from '@/app/auth/actions'

/**
 * Thanh trên cùng: email đang đăng nhập + nút Đăng xuất. CHỈ vậy.
 * Menu thuộc dòng tiêu đề của từng trang (xem DieuHuong).
 * Chưa đăng nhập (vd trang /login) thì không hiện gì.
 *
 * ⛔ ĐỪNG thêm ô tìm kiếm vào đây. Đã thử và user bác ngay: mỗi trang vốn đã có
 * một ô tìm to, thêm ô nhỏ ở đây thành HAI ô trên cùng màn hình làm hai việc
 * khác nhau — người dùng không biết gõ vào đâu. Một trang, một ô tìm.
 *
 * Dùng layNguoiDung() (có cache) chứ KHÔNG tự gọi getUser() — nếu không thì
 * mỗi trang tốn thêm một lượt gọi mạng tới Supabase chỉ để hiện cái email.
 */
export async function ThanhTaiKhoan() {
  const user = await layNguoiDung()
  if (!user) return null

  return (
    <div className="bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-end gap-4 text-sm">
        <div className="flex items-center gap-3 shrink-0">
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
