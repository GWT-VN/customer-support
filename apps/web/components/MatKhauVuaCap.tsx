'use client'

import { useState } from 'react'

/**
 * Ô hiện mật khẩu ban đầu vừa cấp — CEO chốt 21/08: hệ thống không tự gửi email,
 * admin đọc mật khẩu này rồi tự nhắn cho người kia.
 *
 * Vì sao không tự gửi: khâu gửi thư phụ thuộc SMTP của Supabase; chưa cấu hình
 * thì email im lặng không đi mà admin vẫn thấy "đã gửi" — đúng cái bẫy nút "gửi
 * lại mật khẩu" đã dính. Hiện thẳng ra màn hình thì không có gì để hỏng.
 *
 * Chỉ hiện MỘT LẦN: tải lại trang là mất, vì không chỗ nào lưu mật khẩu dạng đọc
 * được. Muốn xem lại thì cấp cái mới.
 */
export function MatKhauVuaCap({ email, matKhau }: { email: string; matKhau: string }) {
  const [daChep, setDaChep] = useState<'' | 'mk' | 'tin'>('')
  const [loi, setLoi] = useState<string | null>(null)

  const diaChi = typeof window === 'undefined' ? '' : window.location.origin
  const tinNhan = [
    'Chào bạn, đây là tài khoản vào phần mềm GWT:',
    `Địa chỉ: ${diaChi}`,
    `Email: ${email}`,
    `Mật khẩu: ${matKhau}`,
    'Lần đăng nhập đầu tiên hệ thống sẽ yêu cầu bạn tự đặt lại mật khẩu riêng.',
  ].join('\n')

  async function chep(gi: 'mk' | 'tin') {
    setLoi(null)
    try {
      await navigator.clipboard.writeText(gi === 'mk' ? matKhau : tinNhan)
      setDaChep(gi)
    } catch {
      // Trình duyệt chặn clipboard (thường vì trang không chạy https) — không im
      // lặng, vì admin sẽ tưởng đã chép được rồi dán ra một tin nhắn trống.
      setLoi('Trình duyệt không cho chép tự động — bôi đen rồi Ctrl/Cmd+C.')
    }
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
      <p className="text-sm text-amber-900">
        <b>Mật khẩu ban đầu của {email}</b> — chỉ hiện lần này, tải lại trang là mất.
        Gửi cho họ rồi thôi; lần đăng nhập đầu hệ thống bắt họ tự đổi.
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <code className="rounded bg-white border px-3 py-1.5 font-mono text-base tracking-wider text-slate-900 select-all">
          {matKhau}
        </code>
        <button
          type="button" onClick={() => chep('mk')}
          className="rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Chép mật khẩu
        </button>
        <button
          type="button" onClick={() => chep('tin')}
          className="rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Chép cả tin nhắn
        </button>
        {daChep && (
          <span className="text-sm text-emerald-700">
            {daChep === 'mk' ? 'Đã chép mật khẩu.' : 'Đã chép tin nhắn.'}
          </span>
        )}
      </div>

      {loi && <p className="text-sm text-red-600">{loi}</p>}

      <details className="text-sm text-amber-900">
        <summary className="cursor-pointer select-none">Xem tin nhắn sẽ gửi</summary>
        <pre className="mt-1 whitespace-pre-wrap rounded bg-white border p-2 text-xs text-slate-700">{tinNhan}</pre>
      </details>
    </div>
  )
}
