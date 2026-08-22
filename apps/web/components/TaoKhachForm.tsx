'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { taoKhachChoDuyet, traKhachChung, type Kenh } from '@/app/actions'
import { nhanKetQuaTra, type KetQuaTraKhach } from '@/lib/tra-khach-chung'
import { ChonTinh } from '@/components/ChonTinh'
import { ChonKenh } from '@/components/ChonKenh'
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
/**
 * Dùng ở HAI chỗ, cùng một bộ ô — trang `/khach/moi` và hộp thoại của nút "＋ Tạo khách".
 * Dùng chung là cố ý: CEO bắt được chuyện màn tạo và màn sửa lệch bộ ô, nên tuyệt đối không
 * đẻ bản thứ hai của form này.
 *
 * `onXong` có = đang mở trong hộp thoại (đóng lại rồi tải lại danh sách);
 * không có = đang ở trang riêng (nhảy thẳng vào hồ sơ khách vừa tạo).
 */
export function TaoKhachForm({ kenh, onXong }: { kenh: Kenh[]; onXong?: () => void }) {
  const [f, setF] = useState({
    full_name: '', primary_phone: '', address: '', province: '',
    notes: '', ten_cty: '', mst: '', dia_chi_cty: '', sdt_cty: '', email_cty: '',
    nguoi_dai_dien: '', chuc_vu_dai_dien: '',
  })
  const [kenhId, setKenhId] = useState('')
  const [sdtPhu, setSdtPhu] = useState<{ phone: string; contact_name: string; role: string; zalo_ok: boolean; ghi_chu: string }[]>([])
  const [dcPhu, setDcPhu] = useState<{ dia_chi: string; loai: string; tinh: string; ghi_chu: string }[]>([])
  const [khop, setKhop] = useState<KetQuaTraKhach | null>(null)
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
      const r = await traKhachChung(f.primary_phone)
      setKhop(r)
      // Khớp khách bên Sales -> điền sẵn cho khỏi gõ lại, CS vẫn sửa được.
      // Chỉ lấp ô ĐANG TRỐNG: người dùng đã gõ gì thì không được đè lên.
      if (r.sales && !r.cs) {
        setF((cu) => ({
          ...cu,
          full_name: cu.full_name || r.sales?.name || '',
          address: cu.address || r.sales?.address || '',
          province: cu.province || r.sales?.province || '',
        }))
      }
    } finally {
      setDangTra(false)
    }
  }

  async function luu() {
    setBusy(true); setErr(null); setTrungId(null)
    try {
      const r = await taoKhachChoDuyet({
        ...f,
        channel_id: kenhId ? Number(kenhId) : null,
        sdt_phu: sdtPhu.filter((x) => x.phone.trim()),
        dia_chi_phu: dcPhu.filter((x) => x.dia_chi.trim()),
      })
      if (!r.ok) {
        setErr(r.error)
        if (r.existingId) setTrungId(r.existingId)
        return
      }
      if (onXong) onXong()
      else router.push(`/khach/${r.id}`)
    } catch (e) {
      setErr('Không rõ kết quả — mở danh sách khách kiểm tra trước khi bấm lại. ' +
        (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(false)
    }
  }

  const coGoSdt = f.primary_phone.trim() !== ''

  const oChu = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900'

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-medium text-slate-900">Thông tin bắt buộc</h2>

        <label className="block">
          <span className="text-sm text-slate-700">SĐT</span>
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
          {/* CEO chốt 22/08: cho tạo khách KHÔNG có SĐT. Ca thật: khách gọi tới hỏi, CS cần mở
              hồ sơ ngay để ghi việc, chưa kịp xin số. Bắt buộc SĐT thì CS hoặc bỏ không tạo
              (mất dấu khách), hoặc GÕ SỐ BỪA cho qua — cái sau tệ hơn hẳn. */}
          {!coGoSdt && f.full_name.trim() !== '' && (
            <span className="mt-1 block rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">
              Chưa có SĐT — vẫn tạo được. Hồ sơ sẽ vào danh sách <strong>“Cần xin lại SĐT”</strong>
              {' '}ở bảng khách để CS gọi xin sau. Đừng gõ số bừa cho qua.
            </span>
          )}
        </label>

        {/* Câu nhắc lấy từ `nhanKetQuaTra()` — dùng CHUNG với Sales, để cùng một tình huống
            thì hai khu nói cùng một câu, nhân viên không phải đoán bên nào đúng. */}
        {khop && nhanKetQuaTra(khop) && (
          <div className={`space-y-1.5 rounded-lg px-3 py-2 text-sm ${
            khop.nhieuHoSo ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`}>
            <p>{nhanKetQuaTra(khop)}</p>
            {khop.cs && (
              <p className="text-xs">
                Hồ sơ CSKH: <strong>{khop.cs.full_name}</strong>
                {khop.cs.ma_kh ? ` · ${khop.cs.ma_kh}` : ''}
              </p>
            )}
            {khop.sales && !khop.cs && (
              <p className="text-xs">
                Bên Sales: <strong>{khop.sales.name ?? '—'}</strong> — đã điền sẵn tên/địa chỉ, sửa lại nếu cần.
              </p>
            )}
            {khop.cs && (
              <Link href={`/khach/${khop.cs.id}`} prefetch={false}
                className="inline-block rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
                Mở hồ sơ đã có
              </Link>
            )}
          </div>
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
            <ChonKenh kenh={kenh} value={kenhId} onChange={setKenhId} />

            <label className="block">
              <span className="text-sm text-slate-700">Ghi chú</span>
              <input value={f.notes} onChange={(e) => dat('notes', e.target.value)}
                placeholder="vd: khách không nhớ ngày lắp, chỉ liên hệ khi máy lỗi" className={oChu} />
            </label>

            {/* SĐT phụ — số công ty, số giúp việc, số người nhà. Nhập ngay lúc tạo
                cho khỏi phải mở lại hồ sơ. */}
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-700">SĐT phụ</span>
                <button type="button" onClick={() => setSdtPhu([...sdtPhu, { phone: '', contact_name: '', role: 'other', zalo_ok: true, ghi_chu: '' }])}
                  className="text-xs text-[#0a6771] underline">＋ thêm dòng</button>
              </div>
              {sdtPhu.length === 0 && <p className="mt-1 text-xs text-slate-400">Chưa có. Số công ty, giúp việc, người nhà…</p>}
              {sdtPhu.map((x, i) => (
                <div key={i} className="mt-2 flex flex-wrap items-center gap-2">
                  <input value={x.phone} placeholder="0xxxxxxxxx" inputMode="tel"
                    onChange={(e) => setSdtPhu(sdtPhu.map((y, j) => j === i ? { ...y, phone: e.target.value } : y))}
                    className="w-36 rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-sm" />
                  <input value={x.contact_name} placeholder="Tên người cầm máy"
                    onChange={(e) => setSdtPhu(sdtPhu.map((y, j) => j === i ? { ...y, contact_name: e.target.value } : y))}
                    className="w-44 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                  <select value={x.role}
                    onChange={(e) => setSdtPhu(sdtPhu.map((y, j) => j === i ? { ...y, role: e.target.value } : y))}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm">
                    <option value="owner">Chủ nhà</option>
                    <option value="family">Người nhà</option>
                    <option value="helper">Giúp việc</option>
                    <option value="manager">Quản lý</option>
                    <option value="other">Khác</option>
                  </select>
                  <label className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input type="checkbox" checked={x.zalo_ok}
                      onChange={(e) => setSdtPhu(sdtPhu.map((y, j) => j === i ? { ...y, zalo_ok: e.target.checked } : y))} />
                    Zalo
                  </label>
                  <input value={x.ghi_chu} placeholder="Ghi chú: giờ gọi được, số của ai…"
                    onChange={(e) => setSdtPhu(sdtPhu.map((y, j) => j === i ? { ...y, ghi_chu: e.target.value } : y))}
                    className="min-w-[180px] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                  <button type="button" onClick={() => setSdtPhu(sdtPhu.filter((_, j) => j !== i))}
                    className="text-xs text-slate-400 underline hover:text-red-600">xoá</button>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-700">Địa chỉ phụ</span>
                <button type="button" onClick={() => setDcPhu([...dcPhu, { dia_chi: '', loai: 'nha', tinh: '', ghi_chu: '' }])}
                  className="text-xs text-[#0a6771] underline">＋ thêm dòng</button>
              </div>
              {/* KHÔNG có loại "công ty" ở đây: địa chỉ công ty đã là ô riêng trong
                  khối Thông tin công ty (in nguyên văn lên hoá đơn). Để hai chỗ cùng
                  chứa được địa chỉ công ty là lúc xuất hoá đơn không biết lấy cái nào. */}
              {dcPhu.length === 0 && <p className="mt-1 text-xs text-slate-400">Chưa có. Nhà thứ hai, kho, nơi lắp đặt…</p>}
              {dcPhu.map((x, i) => (
                <div key={i} className="mt-2 flex flex-wrap items-end gap-2">
                  <input value={x.dia_chi} placeholder="Số nhà, đường, phường/xã, quận/huyện"
                    onChange={(e) => setDcPhu(dcPhu.map((y, j) => j === i ? { ...y, dia_chi: e.target.value } : y))}
                    className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                  <div className="w-44">
                    <ChonTinh value={x.tinh}
                      onChange={(v) => setDcPhu(dcPhu.map((y, j) => j === i ? { ...y, tinh: v } : y))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900" />
                  </div>
                  <select value={x.loai}
                    onChange={(e) => setDcPhu(dcPhu.map((y, j) => j === i ? { ...y, loai: e.target.value } : y))}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm">
                    <option value="nha">Nhà</option>
                    <option value="lap_dat">Lắp đặt</option>
                    <option value="other">Khác</option>
                  </select>
                  {/* Ô ghi chú — màn SỬA vốn có, màn TẠO thì thiếu. CEO bắt được 22/08:
                      hai màn phải y hệt nhau, không thì nhập ở màn này rồi sang màn kia
                      không thấy đâu. */}
                  <input value={x.ghi_chu} placeholder="Ghi chú: nhà bố mẹ, kho hàng…"
                    onChange={(e) => setDcPhu(dcPhu.map((y, j) => j === i ? { ...y, ghi_chu: e.target.value } : y))}
                    className="w-40 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                  <button type="button" onClick={() => setDcPhu(dcPhu.filter((_, j) => j !== i))}
                    className="pb-1.5 text-xs text-slate-400 underline hover:text-red-600">xoá</button>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-sm text-slate-700">Tên công ty</span>
                <input value={f.ten_cty} onChange={(e) => dat('ten_cty', e.target.value)}
                  placeholder="CÔNG TY TNHH…" className={oChu} />
              </label>
              <label className="block">
                <span className="text-sm text-slate-700">Người đại diện</span>
                <input value={f.nguoi_dai_dien} onChange={(e) => dat('nguoi_dai_dien', e.target.value)}
                  placeholder="Người ký hợp đồng" className={oChu} />
              </label>
              <label className="block">
                <span className="text-sm text-slate-700">Chức danh</span>
                <input value={f.chuc_vu_dai_dien} onChange={(e) => dat('chuc_vu_dai_dien', e.target.value)}
                  placeholder="Giám đốc / Tổng giám đốc…" className={oChu} />
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
        <button type="button" onClick={luu} disabled={busy || !f.full_name.trim() || (coGoSdt && !sdtLuuDuoc) || !!khop?.cs}
          className="rounded-lg bg-[#b5642a] px-5 py-2.5 font-medium text-white hover:bg-[#8a4a1c] disabled:opacity-50">
          {busy ? 'Đang tạo…' : 'Tạo khách'}
        </button>
        <Link href="/khach-hang" prefetch={false} className="text-sm text-slate-500 underline">Huỷ</Link>
      </div>
    </div>
  )
}
