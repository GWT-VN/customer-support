'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { duyetYeuCau, tuChoiYeuCau, type YeuCauThayDoi } from '@/app/actions'

const NHAN_BANG: Record<string, string> = {
  cs_customers: 'Khách',
  customer_contacts: 'SĐT phụ',
  filter_replacement: 'Lịch thay lõi',
}
const NHAN_COT: Record<string, string> = {
  full_name: 'Tên', primary_phone: 'SĐT', address: 'Địa chỉ', province: 'Tỉnh/TP', notes: 'Ghi chú',
  filter_code: 'Mã lõi', replaced_at: 'Ngày thay', note: 'Ghi chú',
  phone: 'SĐT', contact_name: 'Tên', role: 'Vai trò', zalo_ok: 'Zalo',
}

function tomTat(y: YeuCauThayDoi): string {
  if (y.loai === 'xoa') return 'Xoá'
  const p = y.payload ?? {}
  return Object.entries(p)
    .filter(([k]) => k !== 'needs_phone' && k !== 'notes')
    .map(([k, v]) => `${NHAN_COT[k] ?? k}: ${v ?? '—'}`).join(' · ')
}

/** Hàng chờ duyệt yêu cầu SỬA/XOÁ (admin). Duyệt -> áp thật; Từ chối -> bỏ. */
export function DuyetList({ items }: { items: YeuCauThayDoi[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function lam(id: string, duyet: boolean) {
    setBusy(id); setErr(null)
    const r = duyet ? await duyetYeuCau(id) : await tuChoiYeuCau(id)
    setBusy(null)
    if (!r.ok) setErr(r.error)
    else router.refresh()
  }

  if (!items.length) return <p className="text-sm text-slate-400">Không có yêu cầu sửa/xoá nào chờ duyệt.</p>
  return (
    <div className="space-y-2">
      {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
      <ul className="divide-y border rounded-lg">
        {items.map((y) => (
          <li key={y.id} className="px-3 py-2.5 flex items-start justify-between gap-3">
            <div className="min-w-0 text-sm">
              <div className="text-slate-900">
                <span className={
                  'text-[10px] font-medium px-1.5 py-0.5 rounded mr-1.5 ' +
                  (y.loai === 'xoa' ? 'bg-red-100 text-red-700' : 'bg-sky-100 text-sky-700')
                }>{y.loai === 'xoa' ? 'XOÁ' : 'SỬA'}</span>
                {NHAN_BANG[y.doi_tuong] ?? y.doi_tuong}
              </div>
              <div className="text-slate-600 mt-0.5 break-words">{tomTat(y)}</div>
              {y.ly_do && <div className="text-xs text-slate-400 mt-0.5">{y.ly_do}</div>}
              <div className="text-[11px] text-slate-400 mt-0.5">
                {y.nguoi_gui ?? '—'} · {new Date(y.created_at).toLocaleString('vi-VN', { hour12: false })}
              </div>
            </div>
            <div className="flex gap-2 flex-none">
              <button onClick={() => lam(y.id, true)} disabled={busy === y.id}
                className="rounded-lg bg-emerald-600 text-white px-3 py-1 text-xs font-medium disabled:opacity-50">
                {busy === y.id ? '…' : 'Duyệt'}
              </button>
              <button onClick={() => lam(y.id, false)} disabled={busy === y.id}
                className="rounded-lg border px-3 py-1 text-xs text-slate-600 disabled:opacity-50">
                Từ chối
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
