'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TINH_VN } from '@/lib/tinh'
import { taoKhach, suaKhach, kiemTraSdt } from './actions'
import type { CustomerInput } from './_types'

const inp =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100'
const lbl = 'block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1'

export function CustomerForm({
  mode = 'create',
  customerCode,
  initial,
}: {
  mode?: 'create' | 'edit'
  customerCode?: string
  initial?: CustomerInput
}) {
  const router = useRouter()
  const isEdit = mode === 'edit'

  const [name, setName] = useState(initial?.name ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [province, setProvince] = useState(initial?.province ?? '')
  const [company, setCompany] = useState(initial?.company_invoice ?? '')
  const [taxCode, setTaxCode] = useState(initial?.tax_code ?? '')
  const [note, setNote] = useState(initial?.note ?? '')

  const [dup, setDup] = useState<{ customer_code: string; name: string | null } | null>(null)
  const [, startCheck] = useTransition()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function onPhone(v: string) {
    setPhone(v)
    setDup(null)
    if (isEdit) return
    if (v.replace(/\D/g, '').length < 9) return
    startCheck(async () => {
      const hit = await kiemTraSdt(v)
      if (hit) setDup(hit)
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const input: CustomerInput = {
      name: name.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      province: province.trim() || null,
      company_invoice: company.trim() || null,
      tax_code: taxCode.trim() || null,
      note: note.trim() || null,
    }
    const res = isEdit && customerCode ? await suaKhach(customerCode, input) : await taoKhach(input)
    if (res.ok) {
      router.push(`/sales/khach/${encodeURIComponent(res.customer_code)}`)
      router.refresh()
    } else {
      setError(res.error)
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4">
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
        <div>
          <label className={lbl}>Tên khách</label>
          <input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" />
        </div>
        <div>
          <label className={lbl}>SĐT</label>
          <input className={inp} value={phone} onChange={(e) => onPhone(e.target.value)} placeholder="09xxxxxxxx" inputMode="tel" />
          {dup && (
            <p className="mt-1 text-xs text-amber-600">
              ⚠ SĐT này đã có khách{' '}
              <Link href={`/sales/khach/${encodeURIComponent(dup.customer_code)}`} className="font-medium underline">
                {dup.name || dup.customer_code}
              </Link>{' '}
              — cân nhắc dùng khách đó thay vì tạo trùng.
            </p>
          )}
        </div>
        <div><label className={lbl}>Tỉnh / TP</label>
          <select className={inp} value={province} onChange={(e) => setProvince(e.target.value)}>
            <option value="">— chọn —</option>
            {province && !TINH_VN.includes(province) && <option value={province}>{province} (cũ)</option>}
            {TINH_VN.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div><label className={lbl}>Địa chỉ</label><input className={inp} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
        <div><label className={lbl}>Công ty (xuất HĐ)</label><input className={inp} value={company} onChange={(e) => setCompany(e.target.value)} /></div>
        <div><label className={lbl}>Mã số thuế</label><input className={inp} value={taxCode} onChange={(e) => setTaxCode(e.target.value)} /></div>
        <div className="sm:col-span-2"><label className={lbl}>Ghi chú</label><textarea className={inp} rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <button type="submit" disabled={submitting} className="rounded-lg bg-[#0e8c9a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0a6771] disabled:opacity-60">
        {submitting ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Thêm khách'}
      </button>
    </form>
  )
}
