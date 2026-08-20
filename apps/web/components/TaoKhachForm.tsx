'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { taoKhachChoDuyet, timKhachTheoSdt, type KhachKhopSdt } from '@/app/actions'
import { ChonTinh } from '@/components/ChonTinh'
import { canhBaoSdt, chuanHoaSdt } from '@/lib/sdt'

/**
 * Trang tạo khách đầy đủ.
 *
 * Bản trước chỉ có 4 ô trong một hộp thoại nhỏ (tên, SĐT, địa chỉ, tỉnh) — CEO
 * yêu cầu có chỗ nhập đủ, hoặc giữ đường tạo nhanh và thêm phần nâng cao. Ở đây
 * làm cả hai trong một trang: phần trên là 4 ô bắt buộc, phần nâng cao gập lại.
 *
 * SĐT tra TRƯỚC (lỗi #3): gõ xong là dò ngay, trùng thì mời dùng lại hồ sơ cũ
 * thay vì đẻ bản trùng — chống rác ngay tại cửa vào.
 */
export function TaoKhachForm() {
  const [f, setF] = useState({
    full_name: '', primary_phone: '', address: '', province: '',
    notes: '', ten_cty: '', mst: '', dia_chi_cty: '', sdt_cty: '', email_cty: '',
  })
  const [khop, setKhop] = useState<KhachKhopSdt | null>(null)
  const [dangTra, setDangTra] = useState(false)
  const [nangCao, setNangCao] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [trungId, setTrungId] = useState<string | null>(null)
  const router = useRouter()

  const sdtLuuDuoc = chuanHoaSdt(f.primary_phone).hopLe
  const dat = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v })

  async function traSdt() {
    setKhop(null); setTrungId(null)
    if (!sdtLuuDuoc) return
    setDangTra(true)
    try {
      const r = await timKhachTheoSdt(f.primary_phone)
      setKhop(r)
      // Khớp khách Sales -> điền sẵn cho khỏi gõ lại, CS sửa được.
      if (r.nguon === 'sales') {
        setF((cu) => ({
          ...cu,
          full_name: cu.full_name || r.full_name || '',
          address: cu.address || r.address || '',
          province: cu.province || r.province || '',
        }))
      }
    } finally {
      setDangTra(false)
    }
  }

  async function luu() {
    setBusy(true); setErr(null); setTrungId(null)
    try {
      const r = await taoKhachChoDuyet(f)
      if (!r.ok) {
        setErr(r.error)
        if (r.existingId) setTrungId(r.existingId)
        return
      }
      router.push(`/khach/${r.id}`)
    } catch (e) {
      setErr('Không rõ kết quả — mở danh sách khách kiểm tra trước khi bấm lại. ' +
        (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(false)
    }
  }

  const oChu = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900'

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-medium text-slate-900">Thông tin bắt buộc</h2>

        <label className="block">
          <span className="text-sm text-slate-700">SĐT <span className="text-red-600">*</span></span>
          <input value={f.primary_phone} onChange={(e) => dat('primary_phone', e.target.value)}
            onBlur={traSdt} inputMode="tel" placeholder="0xxxxxxxxx"
            className={`${oChu} font-mono`} />
          {dangTra && <span className="mt-1 block text-xs text-slate-400">Đang tra SĐT…</span>}
          {canhBaoSdt(f.primary_phone) && (
            <span className="mt-1 block text-xs text-amber-600">{canhBaoSdt(f.primary_phone)}</span>
          )}
          <span className="mt-1 block text-xs text-slate-400">
            Gõ SĐT trước — hệ thống tra xem đã có khách này chưa, khỏi tạo trùng.
          </span>
        </label>

        {khop?.nguon === 'cs' && khop.id && (
          <div className="space-y-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p>SĐT này đã là khách: <strong>{khop.full_name ?? '—'}</strong> — đừng tạo trùng.</p>
            <Link href={`/khach/${khop.id}`} prefetch={false}
              className="inline-block rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
              Mở hồ sơ đã có
            </Link>
          </div>
        )}
        {khop?.nguon === 'sales' && (
          <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
            Khớp khách bên Sales — đã điền sẵn tên/địa chỉ, sửa lại nếu cần. Lưu xong sẽ tự nối mã KH Sales.
          </p>
        )}

        <label className="block">
          <span className="text-sm text-slate-700">Tên khách <span className="text-red-600">*</span></span>
          <input value={f.full_name} onChange={(e) => dat('full_name', e.target.value)} className={oChu} />
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block sm:col-span-2">
            <span className="text-sm text-slate-700">Địa chỉ</span>
            <input value={f.address} onChange={(e) => dat('address', e.target.value)}
              placeholder="Số nhà, đường, phường/xã, quận/huyện" className={oChu} />
          </label>
          <label className="block">
            <span className="text-sm text-slate-700">Tỉnh / TP</span>
            <ChonTinh value={f.province} onChange={(v) => dat('province', v)} />
          </label>
        </div>
        <p className="text-xs text-slate-400">
          Tỉnh chọn ở ô riêng, đừng gõ vào ô địa chỉ — cả app dùng chung một danh mục tỉnh để còn lọc và gom theo vùng.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <button type="button" onClick={() => setNangCao(!nangCao)}
          className="flex w-full items-center justify-between px-5 py-3 text-left">
          <span className="font-medium text-slate-900">Thông tin nâng cao</span>
          <span className="text-sm text-slate-400">
            {nangCao ? '▲ thu lại' : '▼ ghi chú, thông tin công ty (xuất hoá đơn, hợp đồng)'}
          </span>
        </button>

        {nangCao && (
          <div className="space-y-3 border-t border-slate-200 px-5 py-4">
            <label className="block">
              <span className="text-sm text-slate-700">Ghi chú</span>
              <input value={f.notes} onChange={(e) => dat('notes', e.target.value)}
                placeholder="vd: khách không nhớ ngày lắp, chỉ liên hệ khi máy lỗi" className={oChu} />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-sm text-slate-700">Tên công ty</span>
                <input value={f.ten_cty} onChange={(e) => dat('ten_cty', e.target.value)}
                  placeholder="CÔNG TY TNHH…" className={oChu} />
              </label>
              <label className="block">
                <span className="text-sm text-slate-700">Mã số thuế</span>
                <input value={f.mst} onChange={(e) => dat('mst', e.target.value)}
                  placeholder="0123456789 hoặc 0123456789-001" className={`${oChu} font-mono`} />
              </label>
              <label className="block">
                <span className="text-sm text-slate-700">SĐT công ty</span>
                <input value={f.sdt_cty} onChange={(e) => dat('sdt_cty', e.target.value)}
                  className={`${oChu} font-mono`} />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm text-slate-700">Email công ty</span>
                <input type="email" value={f.email_cty} onChange={(e) => dat('email_cty', e.target.value)}
                  placeholder="nhận hoá đơn điện tử" className={oChu} />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm text-slate-700">Địa chỉ công ty (đăng ký thuế)</span>
                <input value={f.dia_chi_cty} onChange={(e) => dat('dia_chi_cty', e.target.value)}
                  placeholder="L.03-TMDV, tầng lửng, cao ốc H3, 384 Hoàng Diệu, Phường 9, Quận 4, TP. Hồ Chí Minh"
                  className={oChu} />
                {/* Khác hẳn địa chỉ nhà ở trên: địa chỉ thuế phải in NGUYÊN VĂN
                    trên hoá đơn, cắt tỉnh ra ô riêng là sai so với đăng ký kinh doanh. */}
                <span className="mt-1 block text-xs text-slate-400">
                  Ô này viết <strong>đầy đủ, liền một dòng, kèm cả tỉnh/thành</strong> — đúng như trên đăng ký kinh
                  doanh, vì nó được in nguyên văn lên hoá đơn. Ô Tỉnh/TP ở trên vẫn chọn riêng cho địa chỉ nhà.
                </span>
              </label>
            </div>
          </div>
        )}
      </section>

      {err && (
        <div className="space-y-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>{err}</p>
          {trungId && (
            <Link href={`/khach/${trungId}`} prefetch={false}
              className="inline-block rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
              Mở hồ sơ đã có
            </Link>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="button" onClick={luu} disabled={busy || !f.full_name.trim() || !sdtLuuDuoc || khop?.nguon === 'cs'}
          className="rounded-lg bg-[#b5642a] px-5 py-2.5 font-medium text-white hover:bg-[#8a4a1c] disabled:opacity-50">
          {busy ? 'Đang tạo…' : 'Tạo khách'}
        </button>
        <Link href="/khach-hang" prefetch={false} className="text-sm text-slate-500 underline">Huỷ</Link>
      </div>
    </div>
  )
}
