'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  taoKyThuat, suaKyThuat, xoaKyThuat, capTaiKhoanKyThuat, thuTaiKhoanKyThuat,
  type KyThuat, type TrangThaiTaiKhoanKT,
} from '@/app/actions'

/**
 * Quản lý danh sách kỹ thuật (nhân viên + CTV): thêm/sửa/khoá/xoá.
 * Cột "Đăng nhập" chỉ ADMIN thấy: cấp/thu quyền đăng nhập cho KT (email ngoài).
 * Cấp quyền tạo mật khẩu tạm — hiện 1 lần để admin chuyển cho kỹ thuật.
 */
export function RosterKyThuat({
  dsKt, trangThai, laAdmin,
}: {
  dsKt: KyThuat[]; trangThai: Record<string, TrangThaiTaiKhoanKT>; laAdmin: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [suaId, setSuaId] = useState<string | null>(null)
  const [matKhau, setMatKhau] = useState<{ id: string; mk: string } | null>(null)

  // form thêm mới
  const [ten, setTen] = useState('')
  const [sdt, setSdt] = useState('')
  const [vung, setVung] = useState('')
  const [email, setEmail] = useState('')
  const [ctv, setCtv] = useState(false)

  // buffer sửa
  const [eTen, setETen] = useState(''); const [eSdt, setESdt] = useState('')
  const [eVung, setEVung] = useState(''); const [eEmail, setEEmail] = useState('')
  const [eCtv, setECtv] = useState(false); const [eHd, setEHd] = useState(true)

  async function them() {
    if (!ten.trim()) { setErr('Nhập tên kỹ thuật.'); return }
    setBusy('them'); setErr(null)
    const r = await taoKyThuat({ ten, sdt: sdt || undefined, vung: vung || undefined, email: email || undefined, la_ctv: ctv })
    setBusy(null)
    if (!r.ok) { setErr(r.error); return }
    setTen(''); setSdt(''); setVung(''); setEmail(''); setCtv(false); router.refresh()
  }
  function moSua(k: KyThuat) {
    setSuaId(k.id); setErr(null)
    setETen(k.ten); setESdt(k.sdt ?? ''); setEVung(k.vung ?? ''); setEEmail(k.email ?? ''); setECtv(k.la_ctv); setEHd(k.hoat_dong)
  }
  async function luuSua(id: string) {
    if (!eTen.trim()) { setErr('Nhập tên kỹ thuật.'); return }
    setBusy(id); setErr(null)
    const r = await suaKyThuat(id, { ten: eTen, sdt: eSdt || undefined, vung: eVung || undefined, email: eEmail || undefined, la_ctv: eCtv, hoat_dong: eHd })
    setBusy(null)
    if (!r.ok) { setErr(r.error); return }
    setSuaId(null); router.refresh()
  }
  async function xoa(id: string) {
    if (!window.confirm('Xoá kỹ thuật này? (không xoá được nếu đã có chuyến gán)')) return
    setBusy(id); setErr(null)
    const r = await xoaKyThuat(id); setBusy(null)
    if (!r.ok) { setErr(r.error); return }
    router.refresh()
  }
  async function cap(id: string) {
    setBusy(id); setErr(null); setMatKhau(null)
    const r = await capTaiKhoanKyThuat(id); setBusy(null)
    if (!r.ok) { setErr(r.error); return }
    if (r.mat_khau_tam) setMatKhau({ id, mk: r.mat_khau_tam })
    router.refresh()
  }
  async function thu(id: string) {
    if (!window.confirm('Thu quyền đăng nhập của kỹ thuật này?')) return
    setBusy(id); setErr(null)
    const r = await thuTaiKhoanKyThuat(id); setBusy(null)
    if (!r.ok) { setErr(r.error); return }
    router.refresh()
  }

  const oInput = 'rounded-lg border px-2.5 py-1.5 text-sm'

  return (
    <div className="space-y-3">
      {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}

      {/* Thêm mới */}
      <div className="bg-white rounded-xl border p-4 space-y-2">
        <p className="text-sm font-medium text-slate-800">Thêm kỹ thuật</p>
        <div className="flex flex-wrap gap-2">
          <input value={ten} onChange={(e) => setTen(e.target.value)} placeholder="Tên" className={oInput} />
          <input value={sdt} onChange={(e) => setSdt(e.target.value)} placeholder="SĐT" className={oInput} />
          <input value={vung} onChange={(e) => setVung(e.target.value)} placeholder="Vùng (vd: bắc/nam)" className={oInput} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (để cấp đăng nhập)" className={`${oInput} min-w-56`} />
          <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" checked={ctv} onChange={(e) => setCtv(e.target.checked)} /> CTV</label>
          <button onClick={them} disabled={busy === 'them'} className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm disabled:opacity-50">{busy === 'them' ? '…' : 'Thêm'}</button>
        </div>
      </div>

      {/* Danh sách */}
      <ul className="space-y-2">
        {dsKt.map((k) => {
          const tt = k.email ? trangThai[k.email.trim().toLowerCase()] : undefined
          const dangSua = suaId === k.id
          return (
            <li key={k.id} className={`bg-white rounded-xl border p-3 ${k.hoat_dong ? '' : 'opacity-60'}`}>
              {dangSua ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input value={eTen} onChange={(e) => setETen(e.target.value)} placeholder="Tên" className={oInput} />
                  <input value={eSdt} onChange={(e) => setESdt(e.target.value)} placeholder="SĐT" className={oInput} />
                  <input value={eVung} onChange={(e) => setEVung(e.target.value)} placeholder="Vùng" className={oInput} />
                  <input value={eEmail} onChange={(e) => setEEmail(e.target.value)} placeholder="Email" className={`${oInput} min-w-56`} />
                  <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" checked={eCtv} onChange={(e) => setECtv(e.target.checked)} /> CTV</label>
                  <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" checked={eHd} onChange={(e) => setEHd(e.target.checked)} /> Hoạt động</label>
                  <button onClick={() => luuSua(k.id)} disabled={busy === k.id} className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm disabled:opacity-50">Lưu</button>
                  <button onClick={() => setSuaId(null)} className="text-sm text-slate-500 underline">Huỷ</button>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-slate-900">{k.ten}</span>
                    {k.la_ctv && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">CTV</span>}
                    {!k.hoat_dong && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">đã khoá</span>}
                    <div className="text-xs text-slate-500 mt-0.5">
                      {[k.sdt, k.vung, k.email].filter(Boolean).join(' · ') || '—'}
                    </div>
                    {laAdmin && (
                      <div className="mt-1 text-xs">
                        {tt?.hoat_dong
                          ? <span className="text-emerald-700">● Có tài khoản đăng nhập</span>
                          : k.email
                            ? <span className="text-slate-400">○ Chưa cấp đăng nhập</span>
                            : <span className="text-slate-400">Thêm email để cấp đăng nhập</span>}
                        {matKhau?.id === k.id && (
                          <span className="ml-2 text-amber-700">Mật khẩu tạm: <code className="font-mono bg-amber-50 px-1 rounded select-all">{matKhau.mk}</code> (đưa cho kỹ thuật, chỉ hiện 1 lần)</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-none">
                    {laAdmin && k.email && !tt?.hoat_dong && <button onClick={() => cap(k.id)} disabled={busy === k.id} className="text-xs text-sky-700 underline">cấp đăng nhập</button>}
                    {laAdmin && tt?.hoat_dong && <button onClick={() => thu(k.id)} disabled={busy === k.id} className="text-xs text-amber-700 underline">thu quyền</button>}
                    <button onClick={() => moSua(k)} className="text-xs text-slate-600 underline">sửa</button>
                    <button onClick={() => xoa(k.id)} disabled={busy === k.id} className="text-xs text-red-600 underline">xoá</button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
        {dsKt.length === 0 && <li className="text-sm text-slate-400">Chưa có kỹ thuật nào.</li>}
      </ul>
    </div>
  )
}
