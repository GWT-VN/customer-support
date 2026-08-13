'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useState } from 'react'

function taoClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

/**
 * Tự đổi mật khẩu cho người ĐANG đăng nhập (kể cả kỹ thuật vừa được cấp mật khẩu tạm).
 * Gọi thẳng supabase.auth.updateUser ở trình duyệt — không cần service_role.
 * Dùng được cả ở trang tài khoản lẫn ở trang đặt lại mật khẩu (sau link email).
 */
export function DoiMatKhau({ nhan = 'Đổi mật khẩu', onXong }: { nhan?: string; onXong?: () => void }) {
  const [mk, setMk] = useState('')
  const [mk2, setMk2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function luu(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (mk.length < 6) { setErr('Mật khẩu tối thiểu 6 ký tự.'); return }
    if (mk !== mk2) { setErr('Hai lần nhập chưa khớp.'); return }
    setBusy(true)
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
