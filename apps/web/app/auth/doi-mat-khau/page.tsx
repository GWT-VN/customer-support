import { DoiMatKhau } from '@/components/DoiMatKhau'
import Link from 'next/link'

/**
 * Đặt lại mật khẩu sau khi bấm link trong email "quên mật khẩu".
 * Link recovery của Supabase tạo phiên tạm ngay khi mở trang -> updateUser đổi được ngay.
 */
export default function DatLaiMatKhauPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border p-6 space-y-3">
        <h1 className="text-lg font-semibold text-slate-900">Đặt lại mật khẩu</h1>
        <p className="text-sm text-slate-500">Nhập mật khẩu mới cho tài khoản của bạn.</p>
        <DoiMatKhau nhan="Lưu mật khẩu mới" />
        <Link href="/login" className="block text-sm text-sky-700 underline">← Về trang đăng nhập</Link>
      </div>
    </main>
  )
}
