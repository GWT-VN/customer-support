'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setErr('Email hoặc mật khẩu không đúng.')
      setBusy(false)
      return
    }
    router.push('/')
    router.refresh()
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

        {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}

        <button
          type="submit" disabled={busy}
          className="w-full rounded-lg bg-slate-900 text-white py-2 font-medium disabled:opacity-50"
        >
          {busy ? 'Đang vào…' : 'Đăng nhập'}
        </button>

        <p className="text-xs text-slate-400">
          Chưa có tài khoản? Liên hệ quản trị — tài khoản do quản trị tạo trên Supabase.
        </p>
      </form>
    </main>
  )
}
