'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { deXuatGopKhach, khachDayDu } from '@/app/actions'
import { TimKhachChiTiet } from '@/components/TimKhachChiTiet'
import { nguonKhach, soSanhKhach, truongOLai, type DongSoSanh, type KhachDayDu } from '@/lib/gopKhach'

/**
 * Màn gộp 2 hồ sơ khách trùng — so sánh SONG SONG rồi mới cho bấm.
 *
 * Bản trước chỉ hiện tên + SĐT trong một hộp nhỏ. Rất nhiều khách không có SĐT
 * nên CS không có gì để phân biệt "Anh Ánh" này với "Anh Ánh" kia, phải mở từng
 * hồ sơ ở tab khác rồi nhớ trong đầu — mà bấm nhầm thì một hồ sơ bị ẩn đi.
 *
 * Ba thứ màn này bắt buộc phải có trước khi bấm:
 *  1. Đủ trường của CẢ HAI hồ sơ, cạnh nhau, tô rõ chỗ khác.
 *  2. Hồ sơ nào đến từ đâu (CS / Sales / Bảo trì / Ticket) — chọn giữ bên nào.
 *  3. Danh sách trường sẽ Ở LẠI hồ sơ bị ẩn, nói thẳng ra chứ không giấu.
 */

const MAU_NGUON: Record<string, string> = {
  CS: 'bg-[#fbeadd] text-[#8a4a1c]',
  Sales: 'bg-[#dcf0f3] text-[#0b7d8c]',
  'Bảo trì': 'bg-emerald-100 text-emerald-800',
  Ticket: 'bg-amber-100 text-amber-800',
  'Chưa có dữ liệu': 'bg-slate-100 text-slate-500',
}

function NhanNguon({ k }: { k: KhachDayDu }) {
  return (
    <div className="flex flex-wrap gap-1">
      {nguonKhach(k).map((n) => (
        <span key={n} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${MAU_NGUON[n] ?? 'bg-slate-100 text-slate-600'}`}>
          {n}
        </span>
      ))}
    </div>
  )
}

function CotHoSo({ k, vai }: { k: KhachDayDu; vai: 'giu' | 'gop' }) {
  const giu = vai === 'giu'
  return (
    <div className={`rounded-xl border p-3 ${giu ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[11px] font-bold uppercase tracking-wide ${giu ? 'text-emerald-700' : 'text-slate-500'}`}>
          {giu ? '✓ Giữ lại' : 'Sẽ bị ẩn'}
        </span>
        <Link href={`/khach/${k.id}`} prefetch={false} target="_blank"
          className="text-xs text-[#0a6771] underline">Mở hồ sơ ↗</Link>
      </div>
      <p className="mt-1 font-semibold text-slate-900">{k.full_name}</p>
      <div className="mt-1"><NhanNguon k={k} /></div>
      <p className="mt-2 text-xs text-slate-600">
        {k.so_may} máy · {k.so_ticket} ticket · {k.so_plan} lịch bảo trì · {k.so_lien_he} liên hệ
      </p>
    </div>
  )
}

const MAU_KET_CUC: Record<DongSoSanh['ketCuc'], { chu: string; lop: string }> = {
  'giong-nhau': { chu: '', lop: '' },
  'lap-cho-trong': { chu: 'lấp vào chỗ trống', lop: 'text-emerald-700' },
  'ghi-vao-ghi-chu': { chu: 'ghi vào Ghi chú', lop: 'text-sky-700' },
  'o-lai-ho-so-an': { chu: 'ở lại hồ sơ bị ẩn', lop: 'text-red-700 font-semibold' },
}

export function GopKhachManHinh({
  giuBanDau, gopBanDau,
}: { giuBanDau: KhachDayDu | null; gopBanDau: KhachDayDu | null }) {
  const [giu, setGiu] = useState<KhachDayDu | null>(giuBanDau)
  const [gop, setGop] = useState<KhachDayDu | null>(gopBanDau)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const router = useRouter()
  // Thao tác này ẩn cả một hồ sơ khách — tuyệt đối không được chạy 2 lần cùng lúc.
  // Dùng ref chứ không dựa vào `busy`: state cập nhật bất đồng bộ, click thứ hai
  // có thể lọt qua trước khi re-render.
  const dangGop = useRef(false)

  async function chon(id: string, ben: 'giu' | 'gop') {
    setErr(null); setMsg(null)
    const k = await khachDayDu(id)
    if (!k) { setErr('Không đọc được hồ sơ khách này.'); return }
    if (ben === 'giu') setGiu(k); else setGop(k)
  }

  function doiChieu() {
    setErr(null); setMsg(null)
    setGiu(gop); setGop(giu)
  }

  async function chotGop() {
    if (!giu || !gop || dangGop.current) return
    const oLai = truongOLai(giu, gop)
    const canhBao = oLai.length
      ? `\n\n⚠️ Các trường sau của "${gop.full_name}" sẽ KHÔNG sang hồ sơ giữ:\n   ${oLai.join(', ')}\n(chúng vẫn nằm trên hồ sơ bị ẩn, lấy lại được nhưng phải nhờ kỹ thuật)`
      : ''
    const xacNhan = window.confirm(
      `GIỮ LẠI: ${giu.full_name}\nGỘP VÀO (sẽ bị ẩn): ${gop.full_name}\n\n` +
      `Chuyển sang hồ sơ giữ: ${gop.so_may} máy, ${gop.so_ticket} ticket, ${gop.so_plan} lịch bảo trì, ${gop.so_lien_he} liên hệ.` +
      canhBao +
      `\n\nĐúng chiều chưa?`
    )
    if (!xacNhan) return

    dangGop.current = true
    setBusy(true); setErr(null); setMsg(null)
    const r = await deXuatGopKhach(giu.id, gop.id)
    dangGop.current = false
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    setMsg(r.applied ? 'Đã gộp xong.' : 'Đã gửi đề xuất gộp — chờ quản trị duyệt.')
    setGop(null)
    router.refresh()
  }

  const dong = giu && gop ? soSanhKhach(giu, gop) : []
  const oLai = giu && gop ? truongOLai(giu, gop) : []

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

      {giu && gop && (
        <>
          <div className="flex justify-center">
            <button type="button" onClick={doiChieu} disabled={busy}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              ⇄ Đảo chiều — giữ &ldquo;{gop.full_name}&rdquo; thay vì &ldquo;{giu.full_name}&rdquo;
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Trường</th>
                    <th className="px-3 py-2.5 font-semibold text-emerald-700">Giữ lại</th>
                    <th className="px-3 py-2.5 font-semibold">Gộp vào</th>
                    <th className="px-3 py-2.5 font-semibold">Sau khi gộp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dong.map((d) => {
                    const kc = MAU_KET_CUC[d.ketCuc]
                    return (
                      <tr key={d.nhan} className={d.ketCuc === 'o-lai-ho-so-an' ? 'bg-red-50/60' : ''}>
                        <td className="px-3 py-2 font-medium text-slate-600">{d.nhan}</td>
                        <td className="px-3 py-2 text-slate-900">{d.giu}</td>
                        <td className={`px-3 py-2 ${d.khac ? 'text-slate-900' : 'text-slate-400'}`}>{d.gop}</td>
                        <td className={`px-3 py-2 text-xs ${kc.lop}`}>{kc.chu}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {oLai.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <b>{oLai.length} trường sẽ không sang hồ sơ giữ:</b> {oLai.join(', ')}.
              <span className="block text-xs mt-1 text-red-700/90">
                Chúng vẫn nằm nguyên trên hồ sơ bị ẩn (không xoá hẳn), nhưng muốn lấy lại phải nhờ kỹ thuật.
                Nếu mấy trường này của bên phải mới là đúng, bấm <b>Đảo chiều</b> trước.
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
