import { authClient } from '@/lib/supabase'
import { dangXuat } from '@/app/auth/actions'

/**
 * Thanh trên cùng: email đang đăng nhập + nút Đăng xuất.
 * Chưa đăng nhập (vd trang /login) thì không hiện gì.
 */
export async function ThanhTaiKhoan() {
  const { data } = await (await authClient()).auth.getUser()
  if (!data.user) return null

  return (
    <div className="bg-white border-b">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-end gap-3 text-sm">
        <span className="text-slate-500">{data.user.email}</span>
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
  )
}
