'use server'

import { redirect } from 'next/navigation'
import { authClient, ghiNhanNhanVienMoi, kiemTraVaoCua } from '@/lib/supabase'
import { chuanHoaEmail } from '@/lib/auth'

/** Thoát khỏi app: xoá session Supabase rồi về trang đăng nhập. */
export async function dangXuat() {
  await (await authClient()).auth.signOut()
  redirect('/login')
}

/**
 * Gọi ngay sau khi đăng nhập MẬT KHẨU thành công.
 *
 * Đường Google được xét trong route /auth/callback; đường mật khẩu chạy ở
 * client nên cần bản tương đương chạy server, nếu không rào chỉ áp một nửa.
 */
export async function xacNhanQuyenVaoCua(): Promise<
  { ok: true } | { ok: false; lyDo: 'bi_khoa' | 'ngoai_danh_sach' | 'cho_duyet' }
> {
  const supabase = await authClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return { ok: false, lyDo: 'ngoai_danh_sach' }

  const email = chuanHoaEmail(data.user.email)
  const kq = await kiemTraVaoCua(email)

  if (!kq.duocVao) {
    // Người @gwt.vn lần đầu -> tạo hồ sơ CHỜ DUYỆT (inactive) để admin thấy + bật.
    if (kq.lyDo === 'cho_duyet') await ghiNhanNhanVienMoi(email)
    await supabase.auth.signOut()
    return { ok: false, lyDo: kq.lyDo }
  }
  return { ok: true }
}
