'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { luuNhap, banHanh, type CtkmInput } from './actions'
import { OChonGoiY } from '@/bang'
import { giaSauGiam, mucApDung, type KieuGiam } from '../_ctkm'

type Kenh = { id: number; l1: string; l2: string }
type Sp = { ma: string; ten: string; gia: number | null }

const vnd = new Intl.NumberFormat('vi-VN')
const tien = (n: number | null | undefined) => (n == null ? '—' : vnd.format(Math.round(n)) + ' ₫')

const inp = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100'
const lbl = 'block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1'
const card = 'rounded-xl border border-slate-200 bg-white shadow-sm'

/** Mức mặc định khi đổi kiểu giảm — 12% và 12 đồng là hai thứ khác hẳn nhau. */
const MUC_GOI_Y: Record<KieuGiam, number> = { PCT: 10, TIEN: 1000000, CON: 0 }

/**
 * Một bước của form. Khai báo NGOÀI component cha — nếu định nghĩa bên trong thì mỗi
 * lần cha render lại là một kiểu component MỚI, React tháo cả cây con rồi dựng lại:
 * ô đang gõ mất nội dung và mất luôn con trỏ. Lỗi thật, không phải chuyện dọn dẹp.
 */
function Buoc({
  so, tieuDe, phu, children,
}: { so: number; tieuDe: string; phu?: string; children: React.ReactNode }) {
  return (
    <section className={card}>
      <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[#0e8c9a] text-xs font-bold text-white">{so}</span>
        <div>
          <h2 className="text-sm font-bold text-slate-900">{tieuDe}</h2>
          {phu && <p className="text-xs text-slate-500">{phu}</p>}
        </div>
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  )
}

export function CtkmForm({
  kenhDs,
  spDs,
  initial,
  coQuyenDuyet,
}: {
  kenhDs: Kenh[]
  spDs: Sp[]
  initial?: CtkmInput
  coQuyenDuyet: boolean
}) {
  const router = useRouter()
  const [dangChay, batDau] = useTransition()
  const [loi, setLoi] = useState<string | null>(null)

  const [ten, setTen] = useState(initial?.ten ?? '')
  const [moTa, setMoTa] = useState(initial?.mo_ta_khach ?? '')
  const [luuY, setLuuY] = useState(initial?.luu_y_noi_bo ?? '')
  const [tuNgay, setTuNgay] = useState(initial?.tu_ngay ?? '')
  const [denNgay, setDenNgay] = useState(initial?.den_ngay ?? '')
  const [nhomKhach, setNhomKhach] = useState(initial?.nhom_khach ?? 'TAT_CA')
  const [kieu, setKieu] = useState<KieuGiam>(initial?.kieu_giam ?? 'PCT')
  const [mucChung, setMucChung] = useState<number | null>(initial?.muc_chung ?? 10)
  const [giamToiDa, setGiamToiDa] = useState<number | null>(initial?.giam_toi_da ?? null)
  const [donToiThieu, setDonToiThieu] = useState(initial?.don_toi_thieu ?? 0)
  const [slToiThieu, setSlToiThieu] = useState(initial?.sl_toi_thieu ?? 1)
  const [kenh, setKenh] = useState<number[]>(initial?.kenh ?? [])
  const [sp, setSp] = useState(initial?.sp ?? [])
  const [qua, setQua] = useState(initial?.qua ?? [])

  const [cap1, setCap1] = useState(kenhDs[0]?.l1 ?? '')
  const cap2Ds = useMemo(() => kenhDs.filter((k) => k.l1 === cap1), [kenhDs, cap1])
  const cac1 = useMemo(() => [...new Set(kenhDs.map((k) => k.l1))], [kenhDs])
  const tenKenh = (id: number) => {
    const k = kenhDs.find((x) => x.id === id)
    return k ? (k.l2 ? `${k.l1} · ${k.l2}` : k.l1) : `#${id}`
  }
  const giaCua = (ma: string) => spDs.find((s) => s.ma === ma)?.gia ?? null

  function doiKieu(k: KieuGiam) {
    setKieu(k)
    setMucChung(MUC_GOI_Y[k])
    setSp((ds) => ds.map((s) => ({ ...s, muc: null })))
    if (k !== 'PCT') setGiamToiDa(null)
  }

  function themKenhCap1() {
    const ids = cap2Ds.map((k) => k.id)
    setKenh((ds) => [...new Set([...ds, ...ids])])
  }

  function luu(roiBanHanh: boolean) {
    setLoi(null)
    const payload: CtkmInput = {
      id: initial?.id, ten, mo_ta_khach: moTa || null, luu_y_noi_bo: luuY || null,
      tu_ngay: tuNgay, den_ngay: denNgay || null, nhom_khach: nhomKhach,
      kieu_giam: kieu, muc_chung: mucChung, giam_toi_da: giamToiDa,
      don_toi_thieu: donToiThieu, sl_toi_thieu: slToiThieu, kenh, sp, qua,
    }
    batDau(async () => {
      const r = await luuNhap(payload)
      if (!r.ok) return setLoi(r.error)
      if (roiBanHanh && r.id) {
        const b = await banHanh(r.id)
        if (!b.ok) return setLoi(b.error)
      }
      router.push('/sales/ctkm')
      router.refresh()
    })
  }


  return (
    <div className="space-y-4 pb-24">
      {loi && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{loi}</p>}

      <Buoc so={1} tieuDe="Thông tin chung">
        <div><label className={lbl}>Tên chương trình *</label>
          <input className={inp} value={ten} onChange={(e) => setTen(e.target.value)} placeholder="Deal 10.10 Shopee" /></div>
        <div><label className={lbl}>Mô tả hiện cho khách</label>
          <textarea className={inp} rows={2} value={moTa} onChange={(e) => setMoTa(e.target.value)} /></div>
        <div><label className={lbl}>Lưu ý nội bộ <span className="font-normal normal-case tracking-normal text-slate-400">(khách không thấy)</span></label>
          <textarea className={inp} rows={2} value={luuY} onChange={(e) => setLuuY(e.target.value)} placeholder="Ngân sách, điều kiện, ai duyệt…" /></div>
      </Buoc>

      <Buoc so={2} tieuDe="Thời gian áp dụng" phu="Đơn có ngày nằm trong khoảng này mới được hưởng">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={lbl}>Từ ngày *</label>
            <input type="date" className={inp} value={tuNgay} onChange={(e) => setTuNgay(e.target.value)} /></div>
          <div><label className={lbl}>Đến ngày</label>
            <input type="date" className={inp} value={denNgay} onChange={(e) => setDenNgay(e.target.value)} />
            <p className="mt-1 text-xs text-slate-400">Để trống = chạy vô thời hạn</p></div>
        </div>
      </Buoc>

      <Buoc so={3} tieuDe="Áp dụng cho ai" phu="Khách đã gán bậc đại lý KHÔNG ăn chương trình này — họ hưởng giá theo bậc">
        <div>
          <label className={lbl}>Kênh bán — chọn 2 cấp từ danh mục kênh</label>
          <div className="flex flex-wrap items-end gap-2">
            <select className={inp + ' w-auto min-w-[150px]'} value={cap1} onChange={(e) => setCap1(e.target.value)}>
              {cac1.map((a) => <option key={a}>{a}</option>)}
            </select>
            <select className={inp + ' w-auto min-w-[180px]'} id="cap2" defaultValue="">
              <option value="">— Toàn bộ {cap1} ({cap2Ds.length}) —</option>
              {cap2Ds.map((k) => <option key={k.id} value={k.id}>{k.l2 || '(không có cấp 2)'}</option>)}
            </select>
            <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:border-teal-400"
              onClick={() => {
                const el = document.getElementById('cap2') as HTMLSelectElement | null
                const v = el?.value
                if (!v) themKenhCap1()
                else setKenh((ds) => (ds.includes(Number(v)) ? ds : [...ds, Number(v)]))
              }}>＋ Thêm kênh</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {kenh.length === 0 ? (
              <span className="text-xs text-rose-600">Chưa chọn kênh nào — chương trình sẽ không áp cho đơn nào.</span>
            ) : kenh.map((id) => (
              <span key={id} className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800">
                {tenKenh(id)}
                <button type="button" className="text-teal-600 hover:text-rose-600" onClick={() => setKenh((ds) => ds.filter((x) => x !== id))}>✕</button>
              </span>
            ))}
          </div>
        </div>
        <div><label className={lbl}>Nhóm khách</label>
          <select className={inp} value={nhomKhach} onChange={(e) => setNhomKhach(e.target.value)}>
            <option value="TAT_CA">Tất cả khách lẻ</option>
            <option value="MOI">Chỉ khách mới (chưa có đơn nào)</option>
            <option value="DA_MUA">Chỉ khách đã mua</option>
            <option value="CHI_DINH">Danh sách chỉ định</option>
          </select></div>
      </Buoc>

      <Buoc so={4} tieuDe="Sản phẩm & mức giảm" phu="Đặt mức chung, hoặc chỉnh riêng từng mã">
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className={lbl}>Kiểu giảm</label>
            <select className={inp} value={kieu} onChange={(e) => doiKieu(e.target.value as KieuGiam)}>
              <option value="PCT">Giảm theo % — vd giảm 12%</option>
              <option value="TIEN">Giảm số tiền — vd giảm 5.000.000đ</option>
              <option value="CON">Giảm CÒN — chốt giá bán</option>
            </select></div>
          <div><label className={lbl}>Mức chung {kieu === 'PCT' ? '(%)' : '(₫)'}</label>
            <input type="number" className={inp} value={mucChung ?? ''} onChange={(e) => setMucChung(e.target.value === '' ? null : Number(e.target.value))} /></div>
          {kieu === 'PCT' && (
            <div><label className={lbl}>Giảm tối đa (₫)</label>
              <input type="number" className={inp} value={giamToiDa ?? ''} onChange={(e) => setGiamToiDa(e.target.value === '' ? null : Number(e.target.value))} />
              <p className="mt-1 text-xs text-slate-400">Trần cho số tiền giảm</p></div>
          )}
        </div>

        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Sản phẩm ({sp.length === 0 ? 'chưa chọn = áp mọi sản phẩm' : sp.length})
            </span>
            <span className="flex-1" />
            <div className="w-full sm:w-[320px]">
              <OChonGoiY
                giaTri={null}
                choPhepXoa={false}
                choTrong="＋ Gõ mã hoặc tên sản phẩm…"
                tuyChon={spDs
                  .filter((s) => !sp.some((x) => x.internal_code === s.ma))
                  .map((s) => ({ gt: s.ma, nhan: s.ten, phu: s.gia ? tien(s.gia) : undefined }))}
                onChon={(ma) => {
                  if (ma && !sp.some((s) => s.internal_code === ma)) setSp((ds) => [...ds, { internal_code: ma, muc: null }])
                }}
              />
            </div>
          </div>
          {sp.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[10px] uppercase tracking-wide text-slate-500">
                  <tr><th className="py-1">Sản phẩm</th><th className="py-1 text-right">Niêm yết</th>
                    <th className="py-1 text-center">Mức riêng</th><th className="py-1 text-right">Giá sau giảm</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sp.map((s, i) => {
                    const g = giaCua(s.internal_code)
                    const m = mucApDung(s.muc, mucChung)
                    return (
                      <tr key={s.internal_code}>
                        <td className="py-1.5">
                          <div className="font-medium text-slate-800">{spDs.find((x) => x.ma === s.internal_code)?.ten ?? s.internal_code}</div>
                          <div className="font-mono text-[11px] text-slate-400">{s.internal_code}</div>
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-slate-600">{tien(g)}</td>
                        <td className="py-1.5 text-center">
                          <input type="number" className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                            placeholder={String(mucChung ?? '')} value={s.muc ?? ''}
                            onChange={(e) => setSp((ds) => ds.map((x, j) => j === i ? { ...x, muc: e.target.value === '' ? null : Number(e.target.value) } : x))} />
                        </td>
                        <td className="py-1.5 text-right font-semibold tabular-nums text-teal-700">{tien(giaSauGiam(kieu, g, m, giamToiDa))}</td>
                        <td className="py-1.5 text-right">
                          <button type="button" className="text-slate-400 hover:text-rose-600" onClick={() => setSp((ds) => ds.filter((_, j) => j !== i))}>✕</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={lbl}>Đơn tối thiểu (₫)</label>
            <input type="number" className={inp} value={donToiThieu} onChange={(e) => setDonToiThieu(Number(e.target.value) || 0)} />
            <p className="mt-1 text-xs text-slate-400">0 = không yêu cầu</p></div>
          <div><label className={lbl}>Số lượng tối thiểu</label>
            <input type="number" className={inp} value={slToiThieu} onChange={(e) => setSlToiThieu(Number(e.target.value) || 1)} /></div>
        </div>
      </Buoc>

      <Buoc so={5} tieuDe="Quà tặng kèm" phu="Cùng chương trình — không phải tạo chương trình riêng">
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Quà ({qua.length})</span>
            <span className="flex-1" />
            <div className="w-full sm:w-[320px]">
              <OChonGoiY
                giaTri={null}
                choPhepXoa={false}
                choTrong="＋ Gõ mã hoặc tên quà tặng…"
                tuyChon={spDs.map((s) => ({ gt: s.ma, nhan: s.ten, phu: s.gia ? tien(s.gia) : undefined }))}
                onChon={(ma) => {
                  if (ma) setQua((ds) => [...ds, { internal_code_qua: ma, so_luong: 1, gia_tri_quy_doi: giaCua(ma), dieu_kien: null }])
                }}
              />
            </div>
          </div>
          {qua.length === 0 ? (
            <p className="py-3 text-center text-sm text-slate-400">Chương trình này không có quà.</p>
          ) : (
            <div className="space-y-2">
              {qua.map((q, i) => (
                <div key={i} className="grid grid-cols-12 items-center gap-2">
                  <div className="col-span-12 sm:col-span-4">
                    <div className="text-sm font-medium text-slate-800">{spDs.find((x) => x.ma === q.internal_code_qua)?.ten ?? q.internal_code_qua}</div>
                    <div className="font-mono text-[11px] text-slate-400">{q.internal_code_qua}</div>
                  </div>
                  <input type="number" className="col-span-3 sm:col-span-1 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                    value={q.so_luong} onChange={(e) => setQua((ds) => ds.map((x, j) => j === i ? { ...x, so_luong: Number(e.target.value) || 1 } : x))} />
                  <input type="number" className="col-span-5 sm:col-span-3 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                    value={q.gia_tri_quy_doi ?? ''} placeholder="giá trị quy đổi"
                    onChange={(e) => setQua((ds) => ds.map((x, j) => j === i ? { ...x, gia_tri_quy_doi: e.target.value === '' ? null : Number(e.target.value) } : x))} />
                  <input className="col-span-11 sm:col-span-3 rounded border border-slate-300 px-2 py-1 text-sm"
                    value={q.dieu_kien ?? ''} placeholder="điều kiện nhận"
                    onChange={(e) => setQua((ds) => ds.map((x, j) => j === i ? { ...x, dieu_kien: e.target.value || null } : x))} />
                  <button type="button" className="col-span-1 text-slate-400 hover:text-rose-600"
                    onClick={() => setQua((ds) => ds.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Quà ghi vào đơn thành dòng <b>tính 0 đ</b>. Giá trị quy đổi chỉ để tính chi phí chương trình, không cộng vào tiền khách trả.
          </p>
        </div>
      </Buoc>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Nháp — chưa áp cho đơn nào</span>
        <span className="flex-1" />
        <button type="button" disabled={dangChay} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:border-slate-400 disabled:opacity-50"
          onClick={() => router.push('/sales/ctkm')}>Huỷ</button>
        <button type="button" disabled={dangChay} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:border-teal-400 disabled:opacity-50"
          onClick={() => luu(false)}>{dangChay ? 'Đang lưu…' : 'Lưu nháp'}</button>
        {coQuyenDuyet && (
          <button type="button" disabled={dangChay} className="rounded-lg bg-[#0e8c9a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a6771] disabled:opacity-50"
            onClick={() => luu(true)}>Lưu &amp; ban hành</button>
        )}
      </div>
    </div>
  )
}
