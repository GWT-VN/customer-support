import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { DUONG_DOI_MAT_KHAU, HEADER_DUONG_DAN, conNoDoiMatKhau } from '@/lib/nen-tang/vao-cua'

/**
 * Chặn MỌI trang trừ /login. Chưa đăng nhập -> đá về /login.
 *
 * Đây CHỈ là kiểm tra lạc quan để đá sớm, KHÔNG phải rào bảo mật. Rào thật là
 * requireStaff() — nó gọi getUser() xác minh token qua mạng trên MỌI đường đọc
 * dữ liệu, kèm luật vào cửa. Tài liệu Next 16 (guides/prefetching + file-conventions/proxy)
 * cũng nói rõ Proxy không nên dùng làm giải pháp phân quyền đầy đủ.
 */
export async function proxy(request: NextRequest) {
  // Server Component KHÔNG có cách nào hỏi "đường dẫn hiện tại là gì" — Next 16
  // cố tình không cho, vì layout được cache theo segment. Nhưng luật "chưa đổi
  // mật khẩu thì không đi đâu khác" BẮT BUỘC phải biết đường dẫn, nếu không nó
  // đá cả chính màn đổi mật khẩu về chính nó -> vòng lặp chuyển hướng vô tận
  // (Chrome báo ERR_TOO_MANY_REDIRECTS, đã dính thật khi thử tay).
  //
  // Proxy thì biết. Nhét vào header của REQUEST để phía trong đọc lại.
  const header = new Headers(request.headers)
  header.set(HEADER_DUONG_DAN, request.nextUrl.pathname)
  const tuoiMoi = { request: { headers: header } }

  let response = NextResponse.next(tuoiMoi)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next(tuoiMoi)
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

  /**
   * Chuyển hướng mà KHÔNG vứt cookie vừa được gia hạn.
   *
   * getSession() tự gia hạn token khi hết hạn và ghi cookie mới vào `response`.
   * Trước đây hai nhánh chuyển hướng tạo NextResponse.redirect MỚI TINH, không
   * mang cookie đó theo — token vừa gia hạn bị vứt ngay, lần sau lại phải gia
   * hạn tiếp, và nếu refresh token đã dùng một lần thì phiên chết hẳn.
   */
  const di = (duong: URL) => {
    const ra = NextResponse.redirect(duong)
    for (const c of response.cookies.getAll()) ra.cookies.set(c)
    return ra
  }

  // /auth = vòng OAuth quay về, lúc đó CHƯA có session nên bắt buộc phải cho qua
  const DUONG_CONG_KHAI = ['/login', '/auth']
  const congKhai = DUONG_CONG_KHAI.some((p) => request.nextUrl.pathname.startsWith(p))

  // Đã đăng nhập mà còn đứng ở /login -> đá thẳng vào trong.
  // Không có dòng này thì layout gốc (bọc cả /login) thấy user truthy sẽ dựng
  // Sidebar BÊN CẠNH form đăng nhập: người dùng thấy "vừa có menu vừa có ô đăng
  // nhập", và cú router.push('/') sau khi đăng nhập đôi khi không nhảy kịp nên
  // kẹt lại ngay đây. Chỉ khớp ĐÚNG '/login' để không đụng vòng OAuth ở /auth.
  //
  // HAI điều kiện thêm vào, mỗi cái vá một lỗi đã đo được:
  //
  //  · chỉ GET — Server Action là POST về chính `/login`. Đá cả POST thì client
  //    nhận HTML thay vì kết quả action, action ném lỗi, nút "Đăng nhập" kẹt
  //    vĩnh viễn ở "Đang vào…" dù phiên ĐÃ tạo (lỗi 26, tái hiện 2/2 lần).
  //
  //  · không có `?loi=` — cookie hỏng vẫn "trông như" có phiên với getSession(),
  //    nên trang bên trong đá ra /login rồi proxy đá ngược vào: 40 lượt 307 rồi
  //    Chrome bỏ cuộc với ERR_TOO_MANY_REDIRECTS, không có đường tự thoát (lỗi
  //    25, CEO dính thật). Mang theo `?loi=` là dấu hiệu "vừa bị đá ra" — để yên
  //    cho trang đăng nhập dọn cookie ma.
  if (
    session
    && request.nextUrl.pathname === '/login'
    && request.method === 'GET'
    && !request.nextUrl.searchParams.has('loi')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return di(url)
  }

  if (!session && !congKhai) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return di(url)
  }

  // Mật khẩu admin cấp chưa được đổi -> nhốt ở đúng màn đổi mật khẩu.
  //
  // Đọc từ session cookie nên KHÔNG tốn lượt gọi mạng nào. Đây chỉ là rào lạc
  // quan để đá sớm; rào thật nằm ở requireStaff()/requireNhanSu(), vì cookie có
  // thể còn metadata cũ vài phút sau khi người ta vừa đổi xong.
  if (
    session
    && conNoDoiMatKhau(session.user?.user_metadata)
    && !request.nextUrl.pathname.startsWith(DUONG_DOI_MAT_KHAU)
    && request.nextUrl.pathname !== '/login'
  ) {
    const url = request.nextUrl.clone()
    url.pathname = DUONG_DOI_MAT_KHAU
    url.search = ''
    return di(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
