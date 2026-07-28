'use server'

import { authClient, ghiNhanNhanVienMoi, kiemTraVaoCua } from '@/lib/supabase'
import { chuanHoaEmail } from '@/lib/auth'

/**
 * Gọi ngay sau khi đăng nhập MẬT KHẨU thành công.
 *
 * Đường Google được xét trong route /auth/callback; đường mật khẩu chạy ở
 * client nên cần bản tương đương chạy server, nếu không rào chỉ áp một nửa.
 */
export async function xacNhanQuyenVaoCua(): Promise<
  { ok: true } | { ok: false; lyDo: 'bi_khoa' | 'ngoai_danh_sach' }
> {
  const supabase = await authClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return { ok: false, lyDo: 'ngoai_danh_sach' }

  const email = chuanHoaEmail(data.user.email)
  const kq = await kiemTraVaoCua(email)

  if (!kq.duocVao) {
    await supabase.auth.signOut()
    return { ok: false, lyDo: kq.lyDo }
  }
  if (kq.nguon === 'domain') await ghiNhanNhanVienMoi(email)
  return { ok: true }
}
