'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { deXuatGopKhach, khachDayDu } from '@/app/actions'
import { TimKhachChiTiet } from '@/components/TimKhachChiTiet'
import { dangCo, type KhachDayDu } from '@/lib/gopKhach'
import {
  TRUONG_GOP, giaTriTruong, macDinhLuaChon, dungPChon, truongKhongCoChoChua,
  type ChonBen, type LoaiDiaChi, type LuaChon,
} from '@/lib/gopKhachChon'

/**
 * Màn gộp 2 hồ sơ khách trùng — CS chọn TỪNG TRƯỜNG, không để máy quyết ngầm.
 *
 * Vì sao không phải "bản giữ luôn thắng": đo trên production, 12/14 nhóm khách
 * trùng tên có CẢ HAI đều có SĐT và 12/14 có hai địa chỉ khác nhau. Hai SĐT của
 * một người không phải xung đột — đó là số chính + số công ty/giúp việc; hai địa
 * chỉ là nhà + công ty. Nên mặc định ở đây GIỮ CẢ HAI, CS chỉ chọn cái nào làm
 * chính; cái còn lại xuống SĐT phụ / địa chỉ phụ chứ không rơi mất.
 */

const MAU_NHAN: Record<string, string> = {
  'Máy (CS)': 'bg-[#fbeadd] text-[#8a4a1c]',
  'Đơn Sales': 'bg-[#dcf0f3] text-[#0b7d8c]',
  'Lịch bảo trì': 'bg-emerald-100 text-emerald-800',
  Ticket: 'bg-amber-100 text-amber-800',
  'Chưa có dữ liệu': 'bg-slate-100 text-slate-500',
}

const LOAI_DIA_CHI: { v: LoaiDiaChi | 'bo'; nhan: string }[] = [
  { v: 'nha', nhan: 'Địa chỉ nhà' },
  { v: 'cty', nhan: 'Địa chỉ công ty' },
  { v: 'lap_dat', nhan: 'Địa chỉ lắp đặt' },
  { v: 'khac', nhan: 'Chưa rõ loại' },
  { v: 'bo', nhan: '✕ Không giữ' },
]

function CotHoSo({ k, vai }: { k: KhachDayDu; vai: 'giu' | 'gop' }) {
  const giu = vai === 'giu'
  return (
    <div className={`rounded-xl border p-3 ${giu ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[11px] font-bold uppercase tracking-wide ${giu ? 'text-emerald-700' : 'text-slate-500'}`}>
          {giu ? '✓ Giữ lại' : 'Sẽ bị ẩn'}
        </span>
        <Link href={`/khach/${k.id}`} prefetch={false} target="_blank" className="text-xs text-[#0a6771] underline">
          Mở hồ sơ ↗
        </Link>
      </div>
      <p className="mt-1 font-semibold text-slate-900">{k.full_name}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {dangCo(k).map((n) => (
          <span key={n} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${MAU_NHAN[n] ?? 'bg-slate-100 text-slate-600'}`}>
            {n}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-600">
        {k.so_may} máy · {k.so_ticket} ticket · {k.so_plan} lịch bảo trì · {k.so_lien_he} liên hệ
      </p>
    </div>
  )
}

/** Nút chọn một bên cho một trường. Chỉ hiện khi hai bên khác nhau. */
function NutChon({ dangChon, ben, onChon, giaTri }: {
  dangChon: ChonBen; ben: ChonBen; onChon: () => void; giaTri: string
}) {
  const on = dangChon === ben
  return (
    <button
      type="button"
      onClick={onChon}
      className={
        'w-full rounded-lg border px-2.5 py-1.5 text-left text-sm ' +
        (on ? 'border-emerald-500 bg-emerald-50 font-medium text-slate-900' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300')
      }
    >
      <span className={'mr-1.5 ' + (on ? 'text-emerald-600' : 'text-slate-300')}>{on ? '●' : '○'}</span>
      {giaTri || '—'}
    </button>
  )
}

export function GopKhachManHinh({
  giuBanDau, gopBanDau,
}: { giuBanDau: KhachDayDu | null; gopBanDau: KhachDayDu | null }) {
  const [giu, setGiu] = useState<KhachDayDu | null>(giuBanDau)
  const [gop, setGop] = useState<KhachDayDu | null>(gopBanDau)
  const [lc, setLc] = useState<LuaChon | null>(
    giuBanDau && gopBanDau ? macDinhLuaChon(giuBanDau, gopBanDau) : null,
  )
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const router = useRouter()
  // Gộp ẩn cả một hồ sơ khách — tuyệt đối không được chạy 2 lần. Dùng ref chứ không
  // dựa vào `busy`: state cập nhật bất đồng bộ, click thứ hai lọt trước re-render.
  const dangGop = useRef(false)

  function datLai(g: KhachDayDu | null, p: KhachDayDu | null) {
    setGiu(g); setGop(p)
    setLc(g && p ? macDinhLuaChon(g, p) : null)
  }

  async function chon(id: string, ben: 'giu' | 'gop') {
    setErr(null); setMsg(null)
    const k = await khachDayDu(id)
    if (!k) { setErr('Không đọc được hồ sơ khách này.'); return }
    if (ben === 'giu') datLai(k, gop); else datLai(giu, k)
  }

  function doiChieu() {
    setErr(null); setMsg(null)
    datLai(gop, giu)
  }

  function datTruong(khoa: string, ben: ChonBen) {
    setLc((cu) => (cu ? { ...cu, truong: { ...cu.truong, [khoa]: ben } } : cu))
  }

  async function chotGop() {
    if (!giu || !gop || !lc || dangGop.current) return
    const p = dungPChon(giu, gop, lc)
    const them: string[] = []
    if (p.sdt_phu.length) them.push(`SĐT ${p.sdt_phu[0].phone} → lưu thành số phụ`)
    if (p.dia_chi_them.length) them.push('địa chỉ còn lại → lưu thành địa chỉ phụ')

    if (!window.confirm(
      `GIỮ LẠI: ${giu.full_name}\nGỘP VÀO (sẽ bị ẩn): ${gop.full_name}\n\n` +
      `Chuyển sang hồ sơ giữ: ${gop.so_may} máy, ${gop.so_ticket} ticket, ${gop.so_plan} lịch bảo trì, ${gop.so_lien_he} liên hệ.` +
      (them.length ? `\n\nGiữ lại thêm:\n  · ${them.join('\n  · ')}` : '') +
      `\n\nĐúng chiều chưa?`
    )) return

    dangGop.current = true
    setBusy(true); setErr(null); setMsg(null)
    const r = await deXuatGopKhach(giu.id, gop.id, p)
    dangGop.current = false
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }

    // Giữ nguyên hồ sơ vừa giữ ở cột trái để gộp tiếp — ca 3 hồ sơ trùng chỉ việc
    // chọn tiếp bên phải, không phải tìm lại từ đầu.
    const moi = await khachDayDu(giu.id)
    datLai(moi ?? giu, null)
    setMsg(
      (r.applied ? 'Đã gộp xong.' : 'Đã gửi đề xuất gộp — chờ quản trị duyệt.') +
      ' Còn hồ sơ trùng nữa? Chọn tiếp ở cột bên phải.',
    )
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <TimKhachChiTiet nhan="Hồ sơ GIỮ LẠI" onChon={(k) => chon(k.id, 'giu')} />
          {giu && <CotHoSo k={giu} vai="giu" />}
        </div>
        <div className="space-y-2">
          <TimKhachChiTiet nhan="Hồ sơ GỘP VÀO (sẽ bị ẩn)" onChon={(k) => chon(k.id, 'gop')} />
          {gop && <CotHoSo k={gop} vai="gop" />}
        </div>
      </div>

      {giu && gop && lc && (
        <>
          <div className="flex justify-center">
            <button type="button" onClick={doiChieu} disabled={busy}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              ⇄ Đảo chiều — giữ &ldquo;{gop.full_name}&rdquo; thay vì &ldquo;{giu.full_name}&rdquo;
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Dòng nào hai bên khác nhau thì <b>bấm chọn giá trị muốn giữ</b>. Dòng giống nhau không cần đụng.
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-slate-100">
                  {TRUONG_GOP.map((t) => {
                    const a = giaTriTruong(giu, t.khoa)
                    const b = giaTriTruong(gop, t.khoa)
                    // channel_id là số — hiện tên kênh cho người đọc, không hiện id.
                    const hienA = t.khoa === 'channel_id' ? (giu.ten_kenh ?? '') : a
                    const hienB = t.khoa === 'channel_id' ? (gop.ten_kenh ?? '') : b
                    const khac = a !== b

                    if (!khac) {
                      return (
                        <tr key={t.khoa}>
                          <td className="w-44 px-3 py-2 font-medium text-slate-500">{t.nhan}</td>
                          <td className="px-3 py-2 text-slate-700" colSpan={2}>{hienA || '—'}</td>
                        </tr>
                      )
                    }
                    return (
                      <tr key={t.khoa} className="bg-amber-50/40">
                        <td className="w-44 px-3 py-2 align-top font-medium text-slate-700">{t.nhan}</td>
                        <td className="px-3 py-2 align-top">
                          <NutChon dangChon={lc.truong[t.khoa]} ben="giu" giaTri={hienA}
                            onChon={() => datTruong(t.khoa, 'giu')} />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <NutChon dangChon={lc.truong[t.khoa]} ben="gop" giaTri={hienB}
                            onChon={() => datTruong(t.khoa, 'gop')} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {(lc.sdtPhuGiuLai || lc.diaChiThem !== 'bo') && (
            <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-3">
              <p className="text-sm font-medium text-sky-900">Giá trị không được chọn làm chính — giữ lại ở đâu?</p>

              {giaTriTruong(giu, 'primary_phone') && giaTriTruong(gop, 'primary_phone')
                && giaTriTruong(giu, 'primary_phone') !== giaTriTruong(gop, 'primary_phone') && (
                <label className="flex items-center gap-2 text-sm text-sky-900">
                  <input type="checkbox" checked={lc.sdtPhuGiuLai}
                    onChange={(e) => setLc({ ...lc, sdtPhuGiuLai: e.target.checked })} />
                  Lưu số{' '}
                  <b className="font-mono">
                    {lc.truong.primary_phone === 'gop'
                      ? giaTriTruong(giu, 'primary_phone')
                      : giaTriTruong(gop, 'primary_phone')}
                  </b>{' '}
                  thành <b>SĐT phụ</b> của khách
                </label>
              )}

              {giaTriTruong(giu, 'address') && giaTriTruong(gop, 'address')
                && giaTriTruong(giu, 'address') !== giaTriTruong(gop, 'address') && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-sky-900">
                  <span>
                    Địa chỉ{' '}
                    <b>{lc.truong.address === 'gop' ? giaTriTruong(giu, 'address') : giaTriTruong(gop, 'address')}</b>
                    {' '}lưu thành:
                  </span>
                  <select value={lc.diaChiThem}
                    onChange={(e) => setLc({ ...lc, diaChiThem: e.target.value as LoaiDiaChi | 'bo' })}
                    className="rounded-lg border border-sky-300 bg-white px-2 py-1 text-sm">
                    {LOAI_DIA_CHI.map((o) => <option key={o.v} value={o.v}>{o.nhan}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {truongKhongCoChoChua(giu, gop).length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <b>Giá trị không được chọn ở {truongKhongCoChoChua(giu, gop).length} trường sau sẽ không có chỗ chứa:</b>{' '}
              {truongKhongCoChoChua(giu, gop).join(', ')}.
              <span className="mt-1 block text-xs text-red-700/90">
                Chúng vẫn nằm nguyên trên hồ sơ bị ẩn (không xoá hẳn), nhưng muốn lấy lại phải nhờ kỹ thuật.
                Chọn kỹ ở bảng trên trước khi bấm.
              </span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button type="button" onClick={chotGop} disabled={busy}
              className="rounded-lg bg-[#b5642a] px-5 py-2.5 font-medium text-white hover:bg-[#8a4a1c] disabled:opacity-50">
              {busy ? 'Đang xử lý…' : `Gộp vào "${giu.full_name}"`}
            </button>
            <span className="text-xs text-slate-500">Nhân viên bấm sẽ vào hàng chờ quản trị duyệt.</span>
          </div>
        </>
      )}

      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      {msg && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
    </div>
  )
}
