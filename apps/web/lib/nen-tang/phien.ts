import { redirect } from 'next/navigation'
import { cache } from 'react'
import { authClient, dataClient } from './db'
import { chuanHoaEmail, xetLuatVao, type KetQuaVaoCua } from './vao-cua'
import { chuanHoaVaiTro, type VaiTro } from './vai-tro'

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

export type NhanVien = {
  id: string
  ten: string
  vai_tro: VaiTro[]
  email: string | null
  hoat_dong: boolean
}

/**
 * MỘT lượt đọc bảng staff cho mỗi request, dùng chung cho cả luật vào cửa lẫn
 * phân quyền.
 *
 * Trước đây kiemTraVaoCua() và layNhanVien() hỏi cùng bảng này hai lần riêng
 * biệt — mà database ở Singapore nên mỗi lượt tốn 50-80ms từ máy lập trình.
 * cache() gộp lại còn một lượt.
 */
const layDongStaff = cache(async (email: string): Promise<NhanVien | null> => {
  const { data, error } = await dataClient()
    .from('staff')
    .select('id, ten, vai_tro, email, hoat_dong')
    .eq('email', chuanHoaEmail(email))
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  // Coerce vai_tro về MẢNG: đọc được cả chuỗi cũ (trước migration 33) lẫn text[] mới.
  return { ...data, vai_tro: chuanHoaVaiTro((data as { vai_tro: string | string[] | null }).vai_tro) } as NhanVien
})

/** Đọc staff rồi xét luật KHU CS. Dùng chung cho requireStaff() và route callback. */
export async function kiemTraVaoCua(email: string): Promise<KetQuaVaoCua> {
  const e = chuanHoaEmail(email)
  const dong = await layDongStaff(e)
  return xetLuatVao('cs', e, dong ? { hoat_dong: dong.hoat_dong, vai_tro: dong.vai_tro } : null)
}

/**
 * Tạo hồ sơ CHỜ DUYỆT cho người @gwt.vn vào lần đầu. KHÔNG đụng dòng đã có.
 *
 * hoat_dong=false -> chưa vào được; admin bật ở /nhan-vien mới cấp quyền (C1).
 * vai_tro để DB tự điền mặc định '{}' (không role) — admin gán role lúc kích hoạt.
 * ten NOT NULL -> tạm lấy phần trước @, admin sửa lại sau.
 */
export async function ghiNhanNhanVienMoi(email: string) {
  const e = chuanHoaEmail(email)
  const { error } = await dataClient()
    .from('staff')
    .upsert(
      { email: e, ten: e.split('@')[0], hoat_dong: false },
      { onConflict: 'email', ignoreDuplicates: true }
    )
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
  if (!kq.duocVao) {
    // Người @gwt.vn lần đầu -> tạo hồ sơ CHỜ DUYỆT (inactive) để admin thấy + bật.
    if (kq.lyDo === 'cho_duyet') await ghiNhanNhanVienMoi(email)
    redirect(`/login?loi=${kq.lyDo}`)
  }

  return user
})

/** Xét luật vào NỀN TẢNG (rộng — mọi nhân sự hoạt động). Dùng cho khu /work. */
export async function kiemTraVaoNenTang(email: string): Promise<KetQuaVaoCua> {
  const e = chuanHoaEmail(email)
  const dong = await layDongStaff(e)
  return xetLuatVao('nen_tang', e, dong ? { hoat_dong: dong.hoat_dong, vai_tro: dong.vai_tro } : null)
}

/**
 * Chặn cổng NỀN TẢNG — cho MỌI nhân sự đang hoạt động (không cần vai trò CS).
 * Dùng cho khu /work và module không phải CS. Khu CS vẫn dùng requireStaff().
 */
export const requireNhanSu = cache(async () => {
  const user = await layNguoiDung()
  if (!user) redirect('/login')

  const email = chuanHoaEmail(user.email)
  const kq = await kiemTraVaoNenTang(email)
  if (!kq.duocVao) {
    if (kq.lyDo === 'cho_duyet') await ghiNhanNhanVienMoi(email)
    redirect(`/login?loi=${kq.lyDo}`)
  }
  return user
})

/**
 * Hồ sơ nhân viên của người đang đăng nhập.
 *
 * Dùng lại layDongStaff() nên KHÔNG tốn thêm lượt gọi database: requireStaff()
 * đã đọc đúng dòng đó rồi, cache() trả lại kết quả cũ.
 */
export const layNhanVien = cache(async (): Promise<NhanVien | null> => {
  const user = await requireStaff()
  return layDongStaff(chuanHoaEmail(user.email))
})
