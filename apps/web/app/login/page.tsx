'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { xacNhanQuyenVaoCua } from '../auth/actions'

const THONG_BAO_LOI: Record<string, string> = {
  bi_khoa: 'Tài khoản của bạn đã bị khoá quyền vào hệ thống CSKH. Liên hệ quản trị.',
  cho_duyet: 'Tài khoản @gwt.vn của bạn đã được tạo và đang CHỜ quản trị duyệt. Liên hệ admin để được kích hoạt.',
  ngoai_danh_sach: 'Tài khoản này chưa được cấp quyền vào hệ thống CSKH. Liên hệ quản trị.',
  ngoai_cs: 'Tài khoản này không có vai trò CSKH (chỉ Sales, hoặc chưa được gán vai trò CS). Liên hệ quản trị.',
  google: 'Đăng nhập Google không thành công. Thử lại hoặc dùng email + mật khẩu.',
  het_han: 'Phiên đăng nhập đã hết hạn hoặc không còn hợp lệ. Đăng nhập lại.',
}

function taoClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function FormDangNhap() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [thongBao, setThongBao] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const searchParams = useSearchParams()

  const maLoi = searchParams.get('loi') ?? ''
  const loiTuUrl = THONG_BAO_LOI[maLoi] ?? null
  // Vừa đổi mật khẩu ban đầu xong -> phiên cũ bị huỷ, phải đăng nhập lại. Không
  // nói ra thì người dùng tưởng đổi hỏng và gõ lại mật khẩu cũ.
  const vuaDoiMatKhau = searchParams.get('doi_mk') === 'ok'

  // Bị luật vào cửa từ chối thì session cũ phải dọn. Không dọn thì người dùng
  // vẫn "đang đăng nhập", mỗi lần mở app lại bị đá về đây mà không hiểu vì sao.
  useEffect(() => {
    // 'het_han' PHẢI nằm trong danh sách này: đó chính là ca cookie ma. Không dọn
    // thì proxy vẫn tưởng còn phiên và app khoá chết bằng vòng lặp chuyển hướng.
    if (
      maLoi === 'bi_khoa' || maLoi === 'ngoai_danh_sach' || maLoi === 'cho_duyet'
      || maLoi === 'ngoai_cs' || maLoi === 'het_han'
    ) {
      taoClient().auth.signOut()
    }
  }, [maLoi])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    // try/catch quanh TOÀN BỘ thân hàm: chỉ cần một lời gọi ném lỗi là setBusy(false)
    // không bao giờ chạy và nút đứng vĩnh viễn ở "Đang vào…" — người dùng tưởng hỏng
    // rồi bấm lại, dù phiên đã tạo xong. Đúng bài học của nút Gộp treo hôm 20/08.
    try {
      await vaoApp()
    } catch {
      setErr('Không kết nối được máy chủ. Thử lại.')
      setBusy(false)
    }
  }

  async function vaoApp() {
    const { error } = await taoClient().auth.signInWithPassword({ email, password })
    if (error) {
      setErr('Email hoặc mật khẩu không đúng.')
      setBusy(false)
      return
    }

    // Xác thực xong chưa đủ — còn phải qua luật vào cửa, giống hệt đường Google
    const quyen = await xacNhanQuyenVaoCua()
    if (!quyen.ok) {
      setErr(THONG_BAO_LOI[quyen.lyDo])
      setBusy(false)
      return
    }

    // Hard navigation CỐ Ý (không router.push): sau server action, điều hướng
    // bằng App Router hay kẹt — layout gốc bọc /login không re-render nên nút cứ
    // "Đang vào…" dù server đã trả trang chủ 200. Tải lại nguyên trang thì server
    // dựng '/' với đúng session, proxy cho qua, hết đường treo.
    //
    // Mật khẩu do quản trị cấp thì đi thẳng màn đổi mật khẩu. Proxy cũng chặn,
    // nhưng gửi thẳng tới đúng chỗ thì người dùng không thấy một cú nhảy thừa.
    window.location.assign(
      quyen.phaiDoiMatKhau ? '/auth/doi-mat-khau' : quyen.vaoDuocCS ? '/' : '/work'
    )
  }

  async function quenMatKhau() {
    setErr(null); setThongBao(null)
    if (!email) { setErr('Nhập email rồi bấm "Quên mật khẩu?".'); return }
    setBusy(true)
    const { error } = await taoClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/doi-mat-khau`,
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setThongBao('Đã gửi email đặt lại mật khẩu (nếu email có tài khoản). Kiểm tra hộp thư + spam.')
  }

  async function dangNhapGoogle() {
    setBusy(true)
    setErr(null)
    const { error } = await taoClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Buộc Google hỏi chọn tài khoản mỗi lần. Không có dòng này thì sau khi
        // Đăng xuất, bấm Google là vào thẳng bằng tài khoản cũ (phiên Google của
        // trình duyệt vẫn còn) — máy dùng chung sẽ vào nhầm người.
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) {
      setErr(THONG_BAO_LOI.google)
      setBusy(false)
    }
    // Thành công thì trình duyệt tự chuyển sang Google, không cần làm gì thêm
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-xl shadow-sm border p-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">GWT · CSKH</h1>
          <p className="text-sm text-slate-500 mt-1">Đăng nhập bằng tài khoản nhân viên</p>
        </div>

        <label className="block">
          <span className="text-sm text-slate-700">Email</span>
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-slate-900"
            autoComplete="username"
          />
        </label>

        <label className="block">
          <span className="text-sm text-slate-700">Mật khẩu</span>
          <input
            type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-slate-900"
            autoComplete="current-password"
          />
        </label>

        <div className="text-right -mt-1">
          <button type="button" onClick={quenMatKhau} disabled={busy} className="text-xs text-sky-700 underline disabled:opacity-50">Quên mật khẩu?</button>
        </div>

        {(thongBao ?? (vuaDoiMatKhau ? 'Đã đổi mật khẩu. Đăng nhập lại bằng mật khẩu MỚI của bạn.' : null)) && (
          <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
            {thongBao ?? 'Đã đổi mật khẩu. Đăng nhập lại bằng mật khẩu MỚI của bạn.'}
          </p>
        )}
        {(err ?? loiTuUrl) && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err ?? loiTuUrl}</p>
        )}

        <button
          type="submit" disabled={busy}
          className="w-full rounded-lg bg-slate-900 text-white py-2 font-medium disabled:opacity-50"
        >
          {busy ? 'Đang vào…' : 'Đăng nhập'}
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs text-slate-400">hoặc</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <button
          type="button" onClick={dangNhapGoogle} disabled={busy}
          className="w-full rounded-lg border py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Đăng nhập bằng Google
        </button>

        <p className="text-xs text-slate-400">
          Chưa có tài khoản? Liên hệ quản trị — tài khoản do quản trị tạo trên Supabase.
        </p>
      </form>
    </main>
  )
}

export default function Login() {
  // useSearchParams buộc phải nằm trong Suspense, không thì next build lỗi
  return (
    <Suspense>
      <FormDangNhap />
    </Suspense>
  )
}
