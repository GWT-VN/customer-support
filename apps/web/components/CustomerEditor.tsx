'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addContact, deleteContact, updateCustomer, xoaKhach, type Contact, type Customer } from '@/app/actions'
import { ChonTinh } from '@/components/ChonTinh'
import { canhBaoSdt } from '@/lib/sdt'

const ROLES: Record<string, string> = {
  owner: 'Chủ nhà',
  family: 'Người nhà',
  helper: 'Giúp việc',
  manager: 'Quản lý',
  other: 'Khác',
}

export function CustomerEditor({ customer, contacts }: { customer: Customer; contacts: Contact[] }) {
  const router = useRouter()
  const [c, setC] = useState(customer)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!window.confirm('Bạn chắc chắn lưu thay đổi thông tin khách này?')) return
    setBusy(true); setErr(null); setMsg(null)
    const r = await updateCustomer(c.id, c)
    setBusy(false)
    if (!r.ok) setErr(r.error)
    else { setMsg(r.applied ? 'Đã lưu.' : 'Đã gửi chờ admin duyệt.'); router.refresh() }
  }

  async function xoa() {
    if (!window.confirm('Gửi yêu cầu XOÁ khách này? (admin duyệt mới ẩn)')) return
    setBusy(true); setErr(null); setMsg(null)
    const r = await xoaKhach(c.id)
    setBusy(false)
    if (!r.ok) setErr(r.error)
    else { setMsg(r.applied ? 'Đã xoá khách (ẩn).' : 'Đã gửi yêu cầu xoá, chờ admin duyệt.'); router.refresh() }
  }

  // form thêm SĐT phụ
  const [np, setNp] = useState({ phone: '', contact_name: '', role: 'helper', zalo_ok: true })
  async function add() {
    if (!np.phone.trim()) { setErr('Nhập SĐT đã.'); return }
    setBusy(true); setErr(null)
    const r = await addContact(c.id, { ...np, is_primary: false } as Omit<Contact, 'id'>)
    setBusy(false)
    if (!r.ok) setErr(r.error)
    else { setNp({ phone: '', contact_name: '', role: 'helper', zalo_ok: true }); router.refresh() }
  }

  return (
    <div className="space-y-4">
      {customer.needs_phone && (
        <p className="text-sm bg-amber-50 text-amber-900 rounded-lg px-3 py-2">
          ⚠️ Khách này cần bổ sung/sửa SĐT.
          {customer.notes && <span className="block mt-1 text-xs opacity-80">{customer.notes}</span>}
          <span className="block mt-1 text-xs">Nhập SĐT đúng dạng <code>0xxxxxxxxx</code> rồi Lưu — cờ sẽ tự gỡ.</span>
        </p>
      )}

      <section className="bg-white rounded-xl border p-5 space-y-3">
        <h2 className="font-medium text-slate-900">Thông tin khách</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-slate-700">Tên</span>
            <input value={c.full_name} onChange={(e) => setC({ ...c, full_name: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-slate-900" />
          </label>
          <label className="block">
            <span className="text-sm text-slate-700">SĐT chính (khoá)</span>
            <input value={c.primary_phone ?? ''} onChange={(e) => setC({ ...c, primary_phone: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-slate-900" placeholder="0xxxxxxxxx" />
            {/* Cảnh báo mềm — hồ sơ cũ dạng 84… vẫn lưu được, chỉ nhắc dạng chuẩn. */}
            {canhBaoSdt(c.primary_phone) && (
              <span className="block text-xs text-amber-600 mt-1">{canhBaoSdt(c.primary_phone)}</span>
            )}
          </label>
          <label className="block">
            <span className="text-sm text-slate-700">Tỉnh/TP</span>
            <ChonTinh value={c.province} onChange={(v) => setC({ ...c, province: v })} />
          </label>
          <label className="block">
            <span className="text-sm text-slate-700">Địa chỉ</span>
            <input value={c.address ?? ''} onChange={(e) => setC({ ...c, address: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-slate-900" />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={busy}
            className="rounded-lg bg-slate-900 text-white px-4 py-2 font-medium disabled:opacity-50">
            {busy ? 'Đang lưu…' : 'Lưu'}
          </button>
          {msg && <span className="text-sm text-emerald-700">{msg}</span>}
          <button onClick={xoa} disabled={busy}
            className="ml-auto rounded-lg border border-red-200 text-red-600 px-3 py-2 text-sm font-medium disabled:opacity-50 hover:bg-red-50">
            Xoá khách
          </button>
        </div>
        <p className="text-xs text-slate-400">Sửa/xoá cần admin duyệt (admin làm là áp ngay).</p>
      </section>

      <section className="bg-white rounded-xl border p-5 space-y-3">
        <h2 className="font-medium text-slate-900">SĐT phụ</h2>
        <p className="text-xs text-slate-500">Giúp việc, người nhà, quản lý toà nhà… — người thực sự nghe máy khi gọi bảo trì.</p>

        {contacts.length > 0 ? (
          <ul className="divide-y border rounded-lg">
            {contacts.map((ct) => (
              <li key={ct.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>
                  <span className="font-mono">{ct.phone}</span>
                  {ct.contact_name && <span className="text-slate-600"> · {ct.contact_name}</span>}
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                    {ROLES[ct.role ?? 'other'] ?? ct.role}
                  </span>
                  {!ct.zalo_ok && <span className="ml-1 text-xs text-slate-400">(không Zalo)</span>}
                </span>
                <button
                  onClick={async () => {
                    if (!window.confirm('Gửi yêu cầu xoá liên hệ này? (admin duyệt mới xoá)')) return
                    const r = await deleteContact(ct.id, c.id)
                    if (!r.ok) setErr(r.error)
                    else { setMsg(r.applied ? 'Đã xoá liên hệ.' : 'Đã gửi yêu cầu xoá, chờ duyệt.'); router.refresh() }
                  }}
                  className="text-xs text-red-600 hover:underline">Xoá</button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-400">Chưa có SĐT phụ.</p>}

        <div className="flex flex-wrap items-end gap-2 pt-2 border-t">
          <label className="block">
            <span className="text-xs text-slate-600">SĐT</span>
            <input value={np.phone} onChange={(e) => setNp({ ...np, phone: e.target.value })}
              className="mt-1 w-36 rounded-lg border px-2 py-1.5 font-mono text-sm" placeholder="0xxxxxxxxx" />
            {canhBaoSdt(np.phone) && (
              <span className="block text-xs text-amber-600 mt-1 max-w-56">{canhBaoSdt(np.phone)}</span>
            )}
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">Tên</span>
            <input value={np.contact_name} onChange={(e) => setNp({ ...np, contact_name: e.target.value })}
              className="mt-1 w-32 rounded-lg border px-2 py-1.5 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">Vai trò</span>
            <select value={np.role} onChange={(e) => setNp({ ...np, role: e.target.value })}
              className="mt-1 rounded-lg border px-2 py-1.5 text-sm bg-white">
              {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-sm pb-1.5">
            <input type="checkbox" checked={np.zalo_ok} onChange={(e) => setNp({ ...np, zalo_ok: e.target.checked })} />
            Zalo
          </label>
          <button onClick={add} disabled={busy}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50">
            Thêm
          </button>
        </div>
      </section>

      {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
    </div>
  )
}
