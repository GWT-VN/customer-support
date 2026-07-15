import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * Hai client TÁCH BIỆT — đừng trộn lẫn:
 *
 *  1. authClient()  — anon key + session cookie. CHỈ để biết "ai đang đăng nhập".
 *                     Không đọc được bảng CSKH (RLS 0 policy chặn anon/authenticated).
 *
 *  2. dataClient()  — service_role, BỎ QUA RLS. Chỉ gọi SAU KHI đã xác thực nhân viên.
 *                     Key này KHÔNG BAO GIỜ được xuống trình duyệt.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function authClient() {
  const store = await cookies()
  return createServerClient(URL, ANON, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options))
        } catch {
          // gọi từ Server Component -> bỏ qua, middleware đã refresh session
        }
      },
    },
  })
}

/** service_role — chỉ dùng trong Server Action / Route Handler, sau requireStaff(). */
export function dataClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error(
      'Thiếu SUPABASE_SERVICE_ROLE_KEY. Điền vào .env.local (xem .env.example). ' +
        'KHÔNG commit file .env.local.'
    )
  }
  return createClient(URL, key, { auth: { persistSession: false } })
}

/** Chặn cổng: chưa đăng nhập -> throw. Mọi truy vấn dữ liệu phải gọi hàm này trước. */
export async function requireStaff() {
  const { data, error } = await (await authClient()).auth.getUser()
  if (error || !data.user) throw new Error('UNAUTHENTICATED')
  return data.user
}
