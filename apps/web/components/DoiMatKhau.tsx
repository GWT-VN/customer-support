'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useState } from 'react'
import { doiMatKhauBatBuoc } from '@/app/auth/actions'

function taoClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

/**
 * Tự đổi mật khẩu cho người ĐANG đăng nhập (kể cả kỹ thuật vừa được cấp mật khẩu tạm).
 *
 * HAI đường, cố ý khác nhau:
 *
 *  - mặc định (link "quên mật khẩu") — gọi thẳng supabase.auth.updateUser ở trình
 *    duyệt. Bắt buộc phải vậy: link recovery chỉ tạo phiên tạm phía client, server
 *    không nhìn thấy nên không đổi hộ được.
 *  - batBuoc (mật khẩu admin cấp, đăng nhập lần đầu) — gọi Server Action để đặt mật
 *    khẩu VÀ hạ cờ phai_doi_mat_khau trong một lượt. Xong thì làm mới phiên, nếu
 *    không cookie còn cờ cũ và proxy lại đá về đúng màn này.
 */
export function DoiMatKhau({
  nhan = 'Đổi mật khẩu',
  onXong,
  batBuoc = false,
}: { nhan?: string; onXong?: () => void; batBuoc?: boolean }) {
  const [mk, setMk] = useState('')
  const [mk2, setMk2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const toiThieu = batBuoc ? 8 : 6

  async function luu(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (mk.length < toiThieu) { setErr(`Mật khẩu tối thiểu ${toiThieu} ký tự.`); return }
    if (mk !== mk2) { setErr('Hai lần nhập chưa khớp.'); return }
    setBusy(true)

    if (batBuoc) {
      const r = await doiMatKhauBatBuoc(mk)
      if (!r.ok) { setBusy(false); setErr(r.error); return }
      // Đổi mật khẩu xong, Supabase HUỶ phiên đang chạy (đo được khi thử tay:
      // trang sau đó không còn nhận ra người dùng). Nên không cố giữ phiên nữa —
      // đăng xuất hẳn cho sạch rồi mời đăng nhập lại bằng mật khẩu mới. Cách này
      // còn có cái lợi: người dùng gõ lại mật khẩu vừa đặt, nhớ được ngay.
      setOk(true); setMk(''); setMk2('')
      await taoClient().auth.signOut()
      window.location.assign('/login?doi_mk=ok')
      return
    }

    const { error } = await taoClient().auth.updateUser({ password: mk })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setOk(true); setMk(''); setMk2(''); onXong?.()
  }

  return (
    <form onSubmit={luu} className="space-y-2 max-w-sm">
      <input type="password" value={mk} onChange={(e) => setMk(e.target.value)} placeholder="Mật khẩu mới"
        autoComplete="new-password" className="w-full rounded-lg border px-3 py-2 text-sm" />
      <input type="password" value={mk2} onChange={(e) => setMk2(e.target.value)} placeholder="Nhập lại mật khẩu mới"
        autoComplete="new-password" className="w-full rounded-lg border px-3 py-2 text-sm" />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm disabled:opacity-50">{busy ? 'Đang lưu…' : nhan}</button>
        {ok && <span className="text-sm text-emerald-700">Đã đổi mật khẩu.</span>}
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </form>
  )
}
