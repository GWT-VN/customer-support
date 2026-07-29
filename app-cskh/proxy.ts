import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Chặn MỌI trang trừ /login. Chưa đăng nhập -> đá về /login.
 *
 * Đây CHỈ là kiểm tra lạc quan để đá sớm, KHÔNG phải rào bảo mật. Rào thật là
 * requireStaff() — nó gọi getUser() xác minh token qua mạng trên MỌI đường đọc
 * dữ liệu, kèm luật vào cửa. Tài liệu Next 16 (guides/prefetching + file-conventions/proxy)
 * cũng nói rõ Proxy không nên dùng làm giải pháp phân quyền đầy đủ.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  // getSession() chứ KHÔNG getUser(): getUser() gọi mạng sang Supabase (Singapore) để
  // xác minh token ở MỌI request — đo được 96ms tới 1076ms mỗi lần chuyển trang, và
  // requireStaff() ngay sau đó đã làm đúng việc xác minh ấy rồi.
  //
  // getSession() đọc cookie, chỉ gọi mạng khi token hết hạn (để refresh) — nên vẫn
  // giữ được việc gia hạn phiên, không làm người dùng bị đăng xuất giữa chừng.
  const { data: { session } } = await supabase.auth.getSession()

  // /auth = vòng OAuth quay về, lúc đó CHƯA có session nên bắt buộc phải cho qua
  const DUONG_CONG_KHAI = ['/login', '/auth']
  const congKhai = DUONG_CONG_KHAI.some((p) => request.nextUrl.pathname.startsWith(p))

  if (!session && !congKhai) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
