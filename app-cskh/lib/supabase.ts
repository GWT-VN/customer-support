import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
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

/** Người đăng nhập hợp lệ nhưng KHÔNG có quyền vào hệ thống CSKH. */
export class LoiKhongCoQuyen extends Error {
  constructor(public lyDo: 'bi_khoa' | 'ngoai_danh_sach') {
    super('FORBIDDEN')
    this.name = 'LoiKhongCoQuyen'
  }
}

/** Đọc cs_staff rồi xét luật. Dùng chung cho requireStaff() và route callback. */
export async function kiemTraVaoCua(email: string): Promise<KetQuaVaoCua> {
  const e = chuanHoaEmail(email)
  const { data, error } = await dataClient()
    .from('cs_staff')
    .select('hoat_dong')
    .eq('email', e)
    .maybeSingle()
  if (error) throw error
  return xetLuatVaoCua(e, data ?? null)
}

/** Ghi nhận người vào lần đầu theo luật domain. KHÔNG đụng dòng đã có. */
export async function ghiNhanNhanVienMoi(email: string) {
  const { error } = await dataClient()
    .from('cs_staff')
    .upsert({ email: chuanHoaEmail(email) }, { onConflict: 'email', ignoreDuplicates: true })
  if (error) throw error
}

/**
 * Chặn cổng: chưa đăng nhập HOẶC không có quyền -> throw.
 * Mọi truy vấn dữ liệu phải gọi hàm này trước.
 */
export async function requireStaff() {
  const { data, error } = await (await authClient()).auth.getUser()
  if (error || !data.user) throw new Error('UNAUTHENTICATED')

  const email = chuanHoaEmail(data.user.email)
  const kq = await kiemTraVaoCua(email)
  if (!kq.duocVao) throw new LoiKhongCoQuyen(kq.lyDo)
  if (kq.nguon === 'domain') await ghiNhanNhanVienMoi(email)

  return data.user
}
