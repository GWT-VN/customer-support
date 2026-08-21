'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { authClient, dataClient } from '@/lib/nen-tang/db'
import {
  ghiNhanNhanVienMoi, kiemTraVaoCua, kiemTraVaoNenTang, layNguoiDung,
} from '@/lib/nen-tang/phien'
import { chuanHoaEmail, conNoDoiMatKhau } from '@/lib/nen-tang/vao-cua'

/**
 * Thoát khỏi app: xoá session Supabase rồi về trang đăng nhập.
 *
 * Phải chịu được ca cookie CÒN mà phiên đã CHẾT (Supabase huỷ phiên khi đổi mật
 * khẩu). Lúc đó signOut() ném lỗi, và nếu để lỗi bay lên thì cookie không bao giờ
 * bị xoá — người dùng kẹt vĩnh viễn ở màn đổi mật khẩu, không nút nào ra được.
 * Đã dính thật khi thử tay 21/08.
 */
export async function dangXuat() {
  try {
    await (await authClient()).auth.signOut()
  } catch {
    // nuốt có chủ đích — dọn tay ở dưới
  }
  // Dọn tay cho chắc: mọi cookie sb-* đều là của Supabase Auth.
  const store = await cookies()
  for (const c of store.getAll()) if (c.name.startsWith('sb-')) store.delete(c.name)
  redirect('/login')
}

/**
 * Gọi ngay sau khi đăng nhập MẬT KHẨU thành công.
 *
 * Đường Google được xét trong route /auth/callback; đường mật khẩu chạy ở
 * client nên cần bản tương đương chạy server, nếu không rào chỉ áp một nửa.
 */
export async function xacNhanQuyenVaoCua(): Promise<
  | { ok: true; phaiDoiMatKhau: boolean; vaoDuocCS: boolean }
  | { ok: false; lyDo: 'bi_khoa' | 'ngoai_danh_sach' | 'cho_duyet' | 'ngoai_cs' }
> {
  const supabase = await authClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return { ok: false, lyDo: 'ngoai_danh_sach' }

  const email = chuanHoaEmail(data.user.email)

  // Cổng ĐĂNG NHẬP xét luật NỀN TẢNG, không xét luật khu CS.
  //
  // Trước đây xét luật CS nên CTV lắp đặt, Sales thuần, Kho, Kế toán… đăng nhập
  // là bị đá ra ngay với lý do 'ngoai_cs', dù khu Việc và khu Sales vốn mở cho
  // mọi nhân sự (requireNhanSu). Nghĩa là lời mời cấp tài khoản cho CTV không
  // dùng được — đúng thứ CEO vừa yêu cầu. Vào cửa và được-làm-gì là hai chuyện
  // khác nhau: vào rồi thì từng khu tự gác tiếp.
  const kq = await kiemTraVaoNenTang(email)

  if (!kq.duocVao) {
    // Người @gwt.vn lần đầu -> tạo hồ sơ CHỜ DUYỆT (inactive) để admin thấy + bật.
    if (kq.lyDo === 'cho_duyet') await ghiNhanNhanVienMoi(email)
    await supabase.auth.signOut()
    return { ok: false, lyDo: kq.lyDo }
  }
  return {
    ok: true,
    phaiDoiMatKhau: conNoDoiMatKhau(data.user.user_metadata),
    vaoDuocCS: (await kiemTraVaoCua(email)).duocVao,
  }
}

/**
 * Đổi mật khẩu cho ca BẮT BUỘC — mật khẩu admin cấp, đăng nhập lần đầu.
 *
 * Làm ở server bằng service_role thay vì để trình duyệt tự gọi updateUser vì hai
 * việc phải đi CÙNG NHAU: đặt mật khẩu mới và hạ cờ phai_doi_mat_khau. Tách ra
 * thì đổi được mật khẩu mà cờ vẫn treo (kẹt vòng lặp), hoặc tệ hơn: hạ cờ mà mật
 * khẩu vẫn là cái admin biết.
 *
 * Ca "quên mật khẩu" KHÔNG đi đường này — link recovery chỉ tạo phiên tạm ở
 * trình duyệt, server không thấy, nên nó vẫn dùng supabase.auth.updateUser.
 */
export async function doiMatKhauBatBuoc(matKhau: string) {
  const user = await layNguoiDung()
  if (!user) return { ok: false as const, error: 'Phiên đăng nhập đã hết hạn. Đăng nhập lại.' }
  if (matKhau.length < 8) return { ok: false as const, error: 'Mật khẩu tối thiểu 8 ký tự.' }

  const { error } = await dataClient().auth.admin.updateUserById(user.id, {
    password: matKhau,
    user_metadata: { ...user.user_metadata, phai_doi_mat_khau: false },
  })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}
