'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChonTinh } from '@/components/ChonTinh'
import { ChonKenh } from '@/components/ChonKenh'
import { nhanKetQuaTra, type KetQuaTraKhach } from '@/lib/tra-khach-chung'
import type { Kenh } from '@/app/actions'
import { taoKhach, suaKhach, traSdtSales } from './actions'
import type { CustomerInput } from './_types'

const inp =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100'
const lbl = 'block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1'

/**
 * MỘT form cho CẢ tạo lẫn sửa, và cho cả trang riêng lẫn hộp thoại.
 *
 * CEO bắt được bên CSKH chuyện màn tạo và màn sửa lệch bộ ô — gốc rễ là mỗi màn một form.
 * Ở đây cố ý chỉ có MỘT: thêm ô là hai màn cùng có, không thể lệch.
 *
 * Thứ tự ô cũng có chủ đích: **SĐT lên đầu tiên**, tra ngay khi rời ô. Gõ tên/địa chỉ xong
 * mới biết khách đã có thì công gõ đổ đi — nên hỏi cái nhận diện được người trước.
 *
 * `onXong` có = đang trong hộp thoại (đóng lại, tải lại danh sách);
 * không có = đang ở trang riêng (nhảy vào hồ sơ khách vừa tạo).
 */
export function CustomerForm({
  mode = 'create',
  customerCode,
  initial,
  kenh,
  onXong,
}: {
  mode?: 'create' | 'edit'
  customerCode?: string
  initial?: CustomerInput
  kenh: Kenh[]
  onXong?: () => void
}) {
  const router = useRouter()
  const isEdit = mode === 'edit'

  const [name, setName] = useState(initial?.name ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [province, setProvince] = useState(initial?.province ?? '')
  const [kenhId, setKenhId] = useState(initial?.channel_id ? String(initial.channel_id) : '')
  const [company, setCompany] = useState(initial?.company_invoice ?? '')
  const [taxCode, setTaxCode] = useState(initial?.tax_code ?? '')
  const [note, setNote] = useState(initial?.note ?? '')

  const [khop, setKhop] = useState<KetQuaTraKhach | null>(null)
  const [dangTra, setDangTra] = useState(false)
  // Chi tiết bung TẠI CHỖ. Mở sẵn khi sửa: người vào màn sửa là để xem/đổi thứ đã có.
  const [chiTiet, setChiTiet] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Tra khi rời ô SĐT — cả hai bảng, khớp bên nào cũng là khách CŨ. */
  async function traSdt() {
    setKhop(null)
    if (isEdit) return
    if (phone.replace(/\D/g, '').length < 9) return
    setDangTra(true)
    try {
      const r = await traSdtSales(phone)
      setKhop(r)
      // Khớp bên CSKH thì điền hộ cho khỏi gõ lại — nhưng CHỈ lấp ô đang trống,
      // người dùng đã gõ gì thì không được đè lên.
      if (r.cs) {
        setName((cu) => cu || r.cs?.full_name || '')
        setAddress((cu) => cu || r.cs?.address || '')
        setProvince((cu) => cu || r.cs?.province || '')
        setCompany((cu) => cu || r.cs?.ten_cty || '')
        setTaxCode((cu) => cu || r.cs?.mst || '')
        if (r.cs.channel_id) setKenhId((cu) => cu || String(r.cs?.channel_id))
      }
    } finally {
      setDangTra(false)
    }
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
      channel_id: kenhId ? Number(kenhId) : null,
    }
    const res = isEdit && customerCode ? await suaKhach(customerCode, input) : await taoKhach(input)
    if (!res.ok) {
      setError(res.error)
      setSubmitting(false)
      return
    }
    if (onXong) onXong()
    else {
      router.push(`/sales/khach/${encodeURIComponent(res.customer_code)}`)
      router.refresh()
    }
  }

  const cauNhac = khop ? nhanKetQuaTra(khop) : null

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {/* SĐT ĐẦU TIÊN — nhận diện người trước khi bắt gõ gì khác. */}
        <div>
          <label className={lbl}>SĐT</label>
          <input
            className={`${inp} font-mono`} value={phone} inputMode="tel" placeholder="09xxxxxxxx"
            onChange={(e) => { setPhone(e.target.value); setKhop(null) }}
            onBlur={traSdt}
          />
          {dangTra && <p className="mt-1 text-xs text-slate-400">Đang tra SĐT…</p>}
          {!isEdit && !dangTra && !khop && (
            <p className="mt-1 text-xs text-slate-400">Gõ SĐT trước — app tra xem đã có khách này chưa, khỏi tạo trùng.</p>
          )}
        </div>

        {/* Câu nhắc lấy từ hàm DÙNG CHUNG với CSKH: cùng tình huống, hai khu nói cùng một câu. */}
        {cauNhac && (
          <div className={`space-y-1.5 rounded-lg px-3 py-2 text-sm ${
            khop?.nhieuHoSo ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-800'}`}>
            <p>{cauNhac}</p>
            {khop?.sales?.customer_code && (
              <Link href={`/sales/khach/${encodeURIComponent(khop.sales.customer_code)}`}
                className="inline-block font-medium underline">
                Mở hồ sơ Sales: {khop.sales.name || khop.sales.customer_code}
              </Link>
            )}
            {khop?.cs && (
              <p className="text-xs">
                Bên CSKH: <b>{khop.cs.full_name}</b>
                {khop.cs.ma_kh && <span className="ml-1 font-mono text-[11px] opacity-70">{khop.cs.ma_kh}</span>}
                {' '}— thông tin đã điền sẵn xuống dưới, sửa được.
              </p>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={lbl}>Tên khách</label>
            <input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" />
          </div>
          <div>
            <label className={lbl}>Tỉnh / TP</label>
            <ChonTinh value={province} onChange={setProvince} />
          </div>
        </div>

        <div>
          <label className={lbl}>Địa chỉ</label>
          <input className={inp} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Số nhà, đường, phường/xã" />
        </div>
      </div>

      {/* BUNG TẠI CHỖ — không rời màn, không mất chữ đã gõ. */}
      {!chiTiet ? (
        <button type="button" onClick={() => setChiTiet(true)}
          className="text-sm font-medium text-teal-700 hover:underline">
          ＋ Thêm chi tiết (kênh, công ty xuất hoá đơn, ghi chú)
        </button>
      ) : (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Chi tiết</h3>
            {!isEdit && (
              <button type="button" onClick={() => setChiTiet(false)}
                className="text-xs text-slate-400 hover:text-slate-700">Thu gọn</button>
            )}
          </div>

          <div>
            <label className={lbl}>Kênh</label>
            <ChonKenh kenh={kenh} value={kenhId} onChange={setKenhId} />
            <p className="mt-1 text-xs text-slate-400">
              Khách lẻ hưởng khuyến mãi theo kênh này. Đại lý thì gán bậc ở <b>Đối tác đại lý</b>, không đặt ở đây.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={lbl}>Công ty xuất hoá đơn</label>
              <input className={inp} value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Mã số thuế</label>
              <input className={`${inp} font-mono`} value={taxCode} onChange={(e) => setTaxCode(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={lbl}>Ghi chú</label>
            <textarea className={`${inp} min-h-[72px]`} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Lưu ý khi chăm sóc khách này…" />
          </div>
        </div>
      )}

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={submitting}
          className="rounded-lg bg-[#0e8c9a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a6771] disabled:opacity-50">
          {submitting ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Tạo khách'}
        </button>
        {onXong && (
          <button type="button" onClick={onXong} className="text-sm text-slate-500 hover:text-slate-800">Huỷ</button>
        )}
      </div>
    </form>
  )
}
