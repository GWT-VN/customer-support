import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { chuanHoaEmail, xetLuatVaoCua, xetLuatVaoNenTang, VAI_TRO_VAO_APP, type KetQuaVaoCua } from './auth'
import { chuanHoaVaiTro, coQuyenQuanLy, laChiKyThuat, laQuyenAdmin, type VaiTro } from './quyen'

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

/** Đọc staff rồi xét luật. Dùng chung cho requireStaff() và route callback. */
export async function kiemTraVaoCua(email: string): Promise<KetQuaVaoCua> {
  const e = chuanHoaEmail(email)
  const dong = await layDongStaff(e)
  return xetLuatVaoCua(e, dong ? { hoat_dong: dong.hoat_dong, vai_tro: dong.vai_tro } : null)
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
  return xetLuatVaoNenTang(e, dong ? { hoat_dong: dong.hoat_dong, vai_tro: dong.vai_tro } : null)
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

/** Người đang đăng nhập có vào được KHU CS không (admin|cs|cs_manager|ky_thuat). */
export async function coTheVaoCS(): Promise<boolean> {
  const nv = await layNhanVien()
  if (!nv) return false
  return nv.vai_tro.some((r) => (VAI_TRO_VAO_APP as readonly string[]).includes(r))
}

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

/** Dùng cho cả chặn ở server LẪN ẩn nút trên giao diện. */
export async function laAdmin(): Promise<boolean> {
  return laQuyenAdmin((await layNhanVien())?.vai_tro)
}

/**
 * Cấp QUẢN LÝ CS = admin HOẶC cs_manager. Được duyệt + nghiệp vụ CS nâng cao.
 * Xem lib/quyen.ts:coQuyenQuanLy để biết ranh giới (XOÁ khách/nhân sự/catalog vẫn CHỈ admin).
 */
export async function laQuanLy(): Promise<boolean> {
  return coQuyenQuanLy((await layNhanVien())?.vai_tro)
}

/**
 * CHỈ là kỹ thuật (không kiêm CS/admin) — dùng để ép giao diện rút gọn: chỉ thấy
 * lịch chuyến của mình, ẩn mọi menu CS. Người kiêm cả CS lẫn kỹ thuật vẫn dùng
 * app đầy đủ như CS.
 */
export async function laChiKyThuatVien(): Promise<boolean> {
  return laChiKyThuat((await layNhanVien())?.vai_tro)
}

/**
 * Chặn TRANG chỉ dành cho admin.
 *
 * Ẩn nút trên giao diện KHÔNG phải phân quyền — ai biết đường dẫn vẫn mở được.
 * Rào thật nằm ở đây và ở từng Server Action nhạy cảm.
 */
export async function chanNeuKhongPhaiAdmin() {
  if (!(await laAdmin())) redirect('/?loi=khong_du_quyen')
}

/** Chặn TRANG dành cho cấp quản lý (admin hoặc cs_manager). */
export async function chanNeuKhongPhaiQuanLy() {
  if (!(await laQuanLy())) redirect('/?loi=khong_du_quyen')
}
