import { NextResponse, type NextRequest } from 'next/server'
import { authClient } from '@/lib/nen-tang/db'
import { ghiNhanNhanVienMoi, kiemTraVaoCua } from '@/lib/nen-tang/phien'
import { chuanHoaEmail } from '@/lib/nen-tang/vao-cua'

/**
 * Google (và magic link / đặt lại mật khẩu) gọi ngược về đây sau khi xác thực.
 *
 * LƯU Ý: lúc này session CHƯA tồn tại -> proxy.ts phải bỏ qua /auth, không thì
 * vòng đăng nhập không bao giờ khép được (đá về /login trước khi kịp đổi code).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')

  // Người dùng bấm Huỷ ở màn Google, hoặc Google trả lỗi cấu hình
  if (searchParams.get('error') || !code) {
    return NextResponse.redirect(`${origin}/login?loi=google`)
  }

  const supabase = await authClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) return NextResponse.redirect(`${origin}/login?loi=google`)

  const email = chuanHoaEmail(data.user.email)
  const kq = await kiemTraVaoCua(email)

  if (!kq.duocVao) {
    // Người @gwt.vn lần đầu -> tạo hồ sơ CHỜ DUYỆT (inactive) để admin thấy + bật.
    if (kq.lyDo === 'cho_duyet') await ghiNhanNhanVienMoi(email)
    // Dọn session ngay: xác thực được nhưng không có quyền vào.
    // KHÔNG kèm email vào URL — dữ liệu cá nhân không đưa lên query string.
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?loi=${kq.lyDo}`)
  }

  return NextResponse.redirect(`${origin}/`)
}
