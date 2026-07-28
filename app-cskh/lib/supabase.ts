import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { chuanHoaEmail, xetLuatVaoCua, type KetQuaVaoCua } from './auth'

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
          // gọi từ Server Component -> bỏ qua, proxy đã refresh session
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

/**
 * "Ai đang đăng nhập?" — getUser() gọi MẠNG tới Supabase, và database đang ở
 * Singapore trong khi hàm chạy ở region của Vercel, nên mỗi lượt rất đắt.
 *
 * cache() của React gộp mọi lần gọi trong CÙNG một request thành một lượt duy
 * nhất. Trước đây một trang gọi tới 3 lần (thanh tài khoản, requireStaff, và
 * mỗi Server Action). proxy.ts chạy runtime riêng nên không gộp được vào đây.
 */
export const layNguoiDung = cache(async () => {
  const { data, error } = await (await authClient()).auth.getUser()
  return error ? null : data.user
})

/** Đọc staff rồi xét luật. Dùng chung cho requireStaff() và route callback. */
export async function kiemTraVaoCua(email: string): Promise<KetQuaVaoCua> {
  const e = chuanHoaEmail(email)
  const { data, error } = await dataClient()
    .from('staff')
    .select('hoat_dong')
    .eq('email', e)
    .maybeSingle()
  if (error) throw error
  return xetLuatVaoCua(e, data ?? null)
}

/** Ghi nhận người vào lần đầu theo luật domain. KHÔNG đụng dòng đã có. */
export async function ghiNhanNhanVienMoi(email: string) {
  const e = chuanHoaEmail(email)
  const { error } = await dataClient()
    .from('staff')
    // ten NOT NULL -> tạm lấy phần trước @, admin sửa lại ở màn quản lý nhân viên.
    // vai_tro để DB tự điền mặc định 'cs' — người mới không tự thành admin.
    .upsert({ email: e, ten: e.split('@')[0] }, { onConflict: 'email', ignoreDuplicates: true })
  if (error) throw error
}

/**
 * Chặn cổng: chưa đăng nhập HOẶC không có quyền -> đá về /login kèm lý do.
 * Mọi truy vấn dữ liệu phải gọi hàm này trước.
 *
 * Vì sao redirect() chứ không throw: ca "đang dùng thì bị thu quyền" xảy ra
 * giữa lúc render trang. Ném lỗi thì trên production Next giấu sạch thông tin,
 * người dùng chỉ thấy trang trắng "Application error" và không hiểu vì sao.
 *
 * LƯU Ý: redirect() hoạt động bằng cách ném lỗi NEXT_REDIRECT — người gọi
 * TUYỆT ĐỐI không được bọc requireStaff() trong try/catch, sẽ nuốt mất redirect.
 */
export const requireStaff = cache(async () => {
  const user = await layNguoiDung()
  if (!user) redirect('/login')

  const email = chuanHoaEmail(user.email)
  const kq = await kiemTraVaoCua(email)
  if (!kq.duocVao) redirect(`/login?loi=${kq.lyDo}`)
  if (kq.nguon === 'domain') await ghiNhanNhanVienMoi(email)

  return user
})
