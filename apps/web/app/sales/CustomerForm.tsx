'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChonTinh } from '@/components/ChonTinh'
import { ChonKenh } from '@/components/ChonKenh'
import { nhanKetQuaTra, type KetQuaTraKhach } from '@/lib/tra-khach-chung'
import type { Kenh } from '@/app/actions'
import { OChonGoiY } from '@/bang'
import { taoKhach, suaKhach, traSdtSales, type NhanVienChon } from './actions'
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
  nhanVien,
  khoaSheet = false,
  onXong,
}: {
  mode?: 'create' | 'edit'
  customerCode?: string
  initial?: CustomerInput
  kenh: Kenh[]
  nhanVien: NhanVienChon[]
  /** Khách từ Google Sheet: mấy ô Sheet dựng lại từ đơn thì khoá, sửa cũng bị đè. */
  khoaSheet?: boolean
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
  const [email, setEmail] = useState(initial?.email ?? '')
  const [ngaySinh, setNgaySinh] = useState(initial?.ngay_sinh ?? '')
  const [diaChiCty, setDiaChiCty] = useState(initial?.dia_chi_cty ?? '')
  const [sdtCty, setSdtCty] = useState(initial?.sdt_cty ?? '')
  const [emailCty, setEmailCty] = useState(initial?.email_cty ?? '')
  const [salesOwner, setSalesOwner] = useState(initial?.sales_owner ?? '')
  const [daiDien, setDaiDien] = useState(initial?.nguoi_dai_dien ?? '')
  const [chucVu, setChucVu] = useState(initial?.chuc_vu_dai_dien ?? '')

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
      email: email.trim() || null,
      ngay_sinh: ngaySinh.trim() || null,
      dia_chi_cty: diaChiCty.trim() || null,
      sdt_cty: sdtCty.trim() || null,
      email_cty: emailCty.trim() || null,
      nguoi_dai_dien: daiDien.trim() || null,
      chuc_vu_dai_dien: chucVu.trim() || null,
      sales_owner: salesOwner.trim() || null,
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
      {khoaSheet && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <b>Khách từ Google Sheet.</b> Tên · SĐT · địa chỉ · tỉnh · công ty xuất hoá đơn · MST ·
          ghi chú do Sheet <b>dựng lại từ đơn</b> mỗi lần đồng bộ, nên app khoá lại — sửa ở đây
          cũng bị đè. Muốn đổi thì sửa trong <b>dòng đơn</b> trên Sheet rồi dựng lại DM_KHACH.
          Các ô còn lại bên dưới là <b>của app</b>, sửa được ngay và không bị đè.
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {/* SĐT ĐẦU TIÊN — nhận diện người trước khi bắt gõ gì khác. */}
        <div>
          <label className={lbl}>SĐT</label>
          <input
            className={`${inp} font-mono disabled:bg-slate-100 disabled:text-slate-500`} value={phone}
            inputMode="tel" placeholder="09xxxxxxxx" disabled={khoaSheet}
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
            <input className={inp + ' disabled:bg-slate-100 disabled:text-slate-500'} value={name} disabled={khoaSheet} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" />
          </div>
          <div>
            <label className={lbl}>Tỉnh / TP</label>
            {khoaSheet
              ? <input className={inp + ' disabled:bg-slate-100 disabled:text-slate-500'} value={province} disabled />
              : <ChonTinh value={province} onChange={setProvince} />}
          </div>
        </div>

        <div>
          <label className={lbl}>Địa chỉ</label>
          <input className={inp + ' disabled:bg-slate-100 disabled:text-slate-500'} value={address} disabled={khoaSheet} onChange={(e) => setAddress(e.target.value)} placeholder="Số nhà, đường, phường/xã" />
        </div>
      </div>

      {/* BUNG TẠI CHỖ — không rời màn, không mất chữ đã gõ. */}
      {!chiTiet ? (
        <button type="button" onClick={() => setChiTiet(true)}
          className="text-sm font-medium text-teal-700 hover:underline">
          ＋ Thêm chi tiết (kênh, email, công ty, sales phụ trách, ghi chú)
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
              <label className={lbl}>Email</label>
              <input className={inp} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Ngày sinh</label>
              <input className={inp + ' tabular-nums'} type="date" value={ngaySinh} onChange={(e) => setNgaySinh(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={lbl}>Sales phụ trách</label>
            <OChonGoiY
              giaTri={salesOwner || null}
              onChon={(v) => setSalesOwner(v ?? '')}
              tuyChon={nhanVien.map((n) => ({ gt: n.email, nhan: n.ten, phu: n.vai_tro.join(', ') }))}
              choTrong="— chưa giao —"
              choPhepXoa
            />
          </div>

          <div className="border-t border-slate-100 pt-3">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Thông tin công ty</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={lbl}>Công ty xuất hoá đơn</label>
                <input className={inp + ' disabled:bg-slate-100 disabled:text-slate-500'} value={company} disabled={khoaSheet} onChange={(e) => setCompany(e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Mã số thuế</label>
                <input className={`${inp} font-mono disabled:bg-slate-100 disabled:text-slate-500`} value={taxCode} disabled={khoaSheet} onChange={(e) => setTaxCode(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Địa chỉ công ty</label>
                <input className={inp} value={diaChiCty} onChange={(e) => setDiaChiCty(e.target.value)} />
              </div>
              <div>
                <label className={lbl}>SĐT công ty</label>
                <input className={`${inp} font-mono`} value={sdtCty} onChange={(e) => setSdtCty(e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Email công ty</label>
                <input className={inp} type="email" value={emailCty} onChange={(e) => setEmailCty(e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Người đại diện</label>
                <input className={inp} value={daiDien} onChange={(e) => setDaiDien(e.target.value)} placeholder="Người ký hợp đồng / hoá đơn" />
              </div>
              <div>
                <label className={lbl}>Chức danh</label>
                <input className={inp} value={chucVu} onChange={(e) => setChucVu(e.target.value)} placeholder="Giám đốc, Kế toán trưởng…" />
              </div>
            </div>
          </div>

          <div>
            <label className={lbl}>Ghi chú</label>
            <textarea className={`${inp} min-h-[72px] disabled:bg-slate-100 disabled:text-slate-500`} value={note} disabled={khoaSheet}
              onChange={(e) => setNote(e.target.value)} placeholder="Lưu ý khi chăm sóc khách này…" />
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
