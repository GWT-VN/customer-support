import { DoiMatKhau } from '@/components/DoiMatKhau'
import { dangXuat } from '@/app/auth/actions'
import { layNguoiDung } from '@/lib/nen-tang/phien'
import { conNoDoiMatKhau } from '@/lib/nen-tang/vao-cua'
import Link from 'next/link'

/**
 * Một trang, HAI ca:
 *
 *  1. Quên mật khẩu — mở từ link trong email. Link recovery của Supabase tạo phiên
 *     tạm ngay khi mở trang nên updateUser đổi được ngay.
 *  2. Đổi mật khẩu lần đầu — người vừa được admin cấp mật khẩu ban đầu. Họ bị
 *     proxy.ts và requireStaff() lùa về đây, không đi đâu khác được cho tới khi đổi.
 *
 * Phân biệt bằng cờ phai_doi_mat_khau trên tài khoản chứ không bằng query string:
 * query thì người dùng sửa được, cờ thì không.
 */
export default async function DatLaiMatKhauPage() {
  const user = await layNguoiDung()
  const batBuoc = conNoDoiMatKhau(user?.user_metadata)

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border p-6 space-y-3">
        <h1 className="text-lg font-semibold text-slate-900">
          {batBuoc ? 'Đặt mật khẩu của riêng bạn' : 'Đặt lại mật khẩu'}
        </h1>

        {batBuoc ? (
          <div className="text-sm text-slate-600 space-y-2">
            <p>
              Mật khẩu bạn vừa dùng là mật khẩu <b>quản trị cấp</b> — người cấp cũng biết nó.
              Đặt một mật khẩu mới ngay để chỉ mình bạn biết.
            </p>
            <p className="text-slate-500">Đổi xong mới vào được các màn khác. Tối thiểu 8 ký tự.</p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Nhập mật khẩu mới cho tài khoản của bạn.</p>
        )}

        <DoiMatKhau nhan={batBuoc ? 'Lưu và vào hệ thống' : 'Lưu mật khẩu mới'} batBuoc={batBuoc} />

        {/*
          Lối ra luôn phải là ĐĂNG XUẤT chứ không phải link tới /login, ở cả hai ca:
           · ca bắt buộc — proxy thấy còn phiên là đá thẳng vào trong rồi requireStaff
             đá ngược về đây, người dùng chỉ thấy trang nhấp nháy;
           · ca cookie còn mà phiên đã chết (đổi mật khẩu xong Supabase huỷ phiên cũ) —
             link thường không dọn được cookie hỏng, người dùng kẹt lại đây mãi.
          dangXuat() xoá cookie sb-* kể cả khi signOut lỗi, nên luôn thoát được.
        */}
        {batBuoc || !user ? (
          <form action={dangXuat}>
            <button type="submit" className="text-sm text-slate-500 underline">
              {batBuoc ? '← Không phải bạn? Đăng xuất' : '← Về trang đăng nhập'}
            </button>
          </form>
        ) : (
          <Link href="/login" className="block text-sm text-sky-700 underline">← Về trang đăng nhập</Link>
        )}
      </div>
    </main>
  )
}
