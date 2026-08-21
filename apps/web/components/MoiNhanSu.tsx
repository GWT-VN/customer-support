'use client'

import { useState, useTransition } from 'react'
import { moiNhanSu } from '@/lib/nen-tang/nhan-su'
import { MatKhauVuaCap } from './MatKhauVuaCap'
import { HO_SO_VAI_TRO, NHAN_BO_PHAN, NHAN_VAI_TRO, VAI_TRO, apDungLoaiTruCapBac, type VaiTro } from '@/lib/nen-tang/vai-tro'

/** Không mời thẳng vào quyền quản trị — xem kiemTraLoiMoi(). */
const VAI_TRO_MOI_DUOC = VAI_TRO.filter((v) => v !== 'admin')

export function MoiNhanSu() {
  const [email, setEmail] = useState('')
  const [chon, setChon] = useState<VaiTro[]>([])
  const [loi, setLoi] = useState<string | null>(null)
  const [xong, setXong] = useState<string | null>(null)
  const [ghiChu, setGhiChu] = useState<string | null>(null)
  const [capMk, setCapMk] = useState<{ email: string; matKhau: string } | null>(null)
  const [dangChay, batDau] = useTransition()

  function gui() {
    setLoi(null)
    setXong(null)
    setGhiChu(null)
    setCapMk(null)
    const e = email.trim().toLowerCase()
    batDau(async () => {
      const r = await moiNhanSu(email, chon)
      if (!r.ok) { setLoi(r.error); return }
      setXong(`Đã thêm ${e} vào danh sách.`)
      if (r.matKhau) setCapMk({ email: e, matKhau: r.matKhau })
      else if (r.ghiChu) setGhiChu(r.ghiChu)
      setEmail('')
      setChon([])
    })
  }

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <div>
        <p className="font-medium text-slate-900">Mời người ngoài @gwt.vn</p>
        <p className="text-sm text-slate-500">
          Dành cho cộng tác viên lắp đặt và người dùng email cá nhân. Hệ thống tạo luôn tài khoản
          kèm <b>mật khẩu ban đầu</b> hiện ngay dưới đây để bạn gửi cho họ; lần đăng nhập đầu họ
          bắt buộc tự đổi. Gõ sai email là mời nhầm người lạ — kiểm lại trước khi bấm.
        </p>
      </div>

      {loi && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{loi}</p>}
      {xong && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{xong}</p>}
      {ghiChu && <p className="text-sm text-slate-700 bg-slate-100 rounded-lg px-3 py-2">{ghiChu}</p>}
      {capMk && <MatKhauVuaCap email={capMk.email} matKhau={capMk.matKhau} />}

      <input
        type="email"
        value={email}
        disabled={dangChay}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="ctv.nam@gmail.com"
        className="w-full max-w-80 rounded-lg border px-3 py-2 text-slate-900"
      />

      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {VAI_TRO_MOI_DUOC.map((v) => (
          <label key={v} className="inline-flex items-center gap-1.5 text-sm text-slate-800 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={chon.includes(v)}
              disabled={dangChay}
              onChange={() =>
                setChon((truoc) =>
                  truoc.includes(v)
                    ? truoc.filter((x) => x !== v)
                    : apDungLoaiTruCapBac([...truoc, v])
                )
              }
              className="rounded border-slate-300"
            />
            {NHAN_VAI_TRO[v]}
            <span className="text-xs text-slate-400">({NHAN_BO_PHAN[HO_SO_VAI_TRO[v].boPhan]})</span>
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={gui}
        disabled={dangChay || !email.trim() || chon.length === 0}
        className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm disabled:opacity-40"
      >
        {dangChay ? 'Đang thêm…' : 'Mời vào hệ thống'}
      </button>
    </div>
  )
}
