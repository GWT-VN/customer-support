import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { authClient, dataClient } from './db'
import {
  DUONG_DOI_MAT_KHAU, HEADER_DUONG_DAN, chuanHoaEmail, conNoDoiMatKhau, xetLuatVao,
  type KetQuaVaoCua,
} from './vao-cua'
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
 * Rào THẬT của luật "đổi mật khẩu lần đầu".
 *
 * proxy.ts cũng chặn, nhưng nó đọc cookie nên chỉ là rào lạc quan — ai gọi thẳng
 * Server Action thì không đi qua proxy. Đặt ở đây thì MỌI đường chạm dữ liệu đều
 * bị chặn, giống hệt cách requireStaff() rào luật vào cửa.
 *
 * Đứng SAU luật vào cửa có chủ đích: người vừa bị khoá phải thấy lý do "bị khoá"
 * ở trang đăng nhập, chứ không phải bị lùa sang màn đổi mật khẩu rồi bí.
 */
async function chanNeuConNoDoiMatKhau(user: { user_metadata?: Record<string, unknown> }) {
  if (!conNoDoiMatKhau(user.user_metadata)) return
  // Đang Ở màn đổi mật khẩu thì thôi — layout gốc bọc cả trang đó, đá tiếp là
  // trang tự đá về chính nó mãi mãi. Đường dẫn do proxy.ts đưa xuống bằng header.
  const duongDan = (await headers()).get(HEADER_DUONG_DAN) ?? ''
  if (duongDan.startsWith(DUONG_DOI_MAT_KHAU)) return
  redirect(DUONG_DOI_MAT_KHAU)
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
  // Kèm ?loi=het_han có chủ đích: proxy thấy tham số này thì thôi không đá ngược
  // vào trong, còn trang đăng nhập thì dọn cookie ma. Không có nó thì cookie hỏng
  // (còn hình dạng nhưng token chết) làm hai bên đá qua đá lại tới khi trình duyệt
  // bỏ cuộc — CEO đã dính, đo được 40 lượt 307.
  if (!user) redirect('/login?loi=het_han')

  const email = chuanHoaEmail(user.email)
  const kq = await kiemTraVaoCua(email)
  if (!kq.duocVao) {
    // Người @gwt.vn lần đầu -> tạo hồ sơ CHỜ DUYỆT (inactive) để admin thấy + bật.
    if (kq.lyDo === 'cho_duyet') await ghiNhanNhanVienMoi(email)

    // Nhân sự HỢP LỆ nhưng không thuộc CSKH (CTV lắp đặt, Sales thuần, Kho…):
    // đá về khu Việc chứ KHÔNG về /login. Đá về /login là vòng lặp: trang đăng
    // nhập thấy mã lỗi này liền signOut, họ đăng nhập lại rồi bị đá tiếp, không
    // bao giờ vào được khu nào cả.
    if (kq.lyDo === 'ngoai_cs' && (await kiemTraVaoNenTang(email)).duocVao) {
      await chanNeuConNoDoiMatKhau(user)
      redirect('/work?loi=ngoai_cs')
    }
    redirect(`/login?loi=${kq.lyDo}`)
  }
  await chanNeuConNoDoiMatKhau(user)

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
  // Kèm ?loi=het_han có chủ đích: proxy thấy tham số này thì thôi không đá ngược
  // vào trong, còn trang đăng nhập thì dọn cookie ma. Không có nó thì cookie hỏng
  // (còn hình dạng nhưng token chết) làm hai bên đá qua đá lại tới khi trình duyệt
  // bỏ cuộc — CEO đã dính, đo được 40 lượt 307.
  if (!user) redirect('/login?loi=het_han')

  const email = chuanHoaEmail(user.email)
  const kq = await kiemTraVaoNenTang(email)
  if (!kq.duocVao) {
    if (kq.lyDo === 'cho_duyet') await ghiNhanNhanVienMoi(email)
    redirect(`/login?loi=${kq.lyDo}`)
  }
  await chanNeuConNoDoiMatKhau(user)
  return user
})

/**
 * Hồ sơ nhân viên của người đang đăng nhập, hoặc null.
 *
 * KHÔNG gác cổng — cố ý. Trước đây hàm này gọi requireStaff() (cổng khu CS), nên
 * mọi thứ đọc nó cũng bị gác theo, kể cả THANH MENU vốn hiện ở cả khu Việc và
 * khu Sales. Hậu quả: người ngoài CSKH (CTV lắp đặt, Sales thuần, Kho…) mở /work
 * là menu tự đá họ ra, đá tới đâu menu lại đá tiếp — vòng lặp chuyển hướng, đo
 * được 13 lượt 307 liên tiếp khi thử tay 21/08.
 *
 * Vẫn an toàn vì: layNguoiDung() xác minh token QUA MẠNG (không chỉ đọc cookie),
 * người bị khoá trả về null, và người gọi nào cần chặn thì tự gọi requireStaff()
 * / requireNhanSu() / chanNeuThieuQuyen() — mọi trang hiện đã làm đúng thế.
 * Null ở đây luôn dẫn tới "không có quyền gì", tức là hỏng theo hướng CẤM.
 */
export const layNhanVien = cache(async (): Promise<NhanVien | null> => {
  const user = await layNguoiDung()
  if (!user) return null
  const dong = await layDongStaff(chuanHoaEmail(user.email))
  // Người bị khoá coi như không có hồ sơ: khoá phải cắt quyền NGAY, không đợi
  // tới lượt gác cổng kế tiếp.
  return dong && dong.hoat_dong ? dong : null
})
