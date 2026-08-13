'use client'

import { useEffect, useState } from 'react'
import { searchCustomers, taoKhachChoDuyet, timKhachTheoSdt, type KhachTom, type KhachKhopSdt } from '@/app/actions'
import { ChonTinh } from '@/components/ChonTinh'

/** SĐT VN hợp lệ (chuẩn hoá 84/thiếu số 0 rồi kiểm) — khớp đúng rào ở server. */
function sdtHopLe(raw: string): boolean {
  let s = (raw ?? '').replace(/\D/g, '')
  if (s.startsWith('84')) s = '0' + s.slice(2)
  else if (s.length === 9) s = '0' + s
  return /^0\d{9,10}$/.test(s)
}

/**
 * Chọn khách (tìm trong cs_customers) hoặc tạo mới -> chờ admin duyệt.
 * onPick trả (id, nhãn hiển thị, khách). Không setState đồng bộ trong effect (tránh lỗi eslint).
 *
 * Tạo khách mới: SĐT BẮT BUỘC + đúng định dạng + không trùng. Nhập xong SĐT sẽ tra:
 *  - đã là khách CS  -> mời chọn luôn, không tạo trùng;
 *  - khớp khách Sales -> tự điền info (dùng luôn), cho sửa lại địa chỉ.
 */
export function KhachPicker(
  { onPick }: { onPick: (id: string, nhan: string, khach?: KhachTom) => void }
) {
  const [q, setQ] = useState('')
  const [chon, setChon] = useState<string | null>(null)   // nhãn khách đã chọn
  const [sug, setSug] = useState<KhachTom[]>([])
  const [open, setOpen] = useState(false)
  const [taoMo, setTaoMo] = useState(false)
  const [f, setF] = useState({ full_name: '', primary_phone: '', address: '', province: '' })
  const [khop, setKhop] = useState<KhachKhopSdt | null>(null)   // kết quả tra SĐT
  const [dangTra, setDangTra] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const t = q.trim()
    if (!open || !t) return
    let huy = false
    const id = setTimeout(async () => {
      const r = await searchCustomers(t, 8)
      if (!huy) setSug(r)
    }, 250)
    return () => { huy = true; clearTimeout(id) }
  }, [q, open])

  function pick(k: KhachTom) {
    const nhan = `${k.full_name}${k.primary_phone ? ` · ${k.primary_phone}` : ''}`
    setChon(nhan); onPick(k.id, nhan, k); setOpen(false)
  }

  /** Chọn 1 khách ĐÃ CÓ (từ tra SĐT) — không tạo bản trùng. */
  function chonCoSan(k: KhachKhopSdt) {
    if (!k.id) return
    const ten = k.full_name ?? 'Khách'
    const nhan = `${ten}${k.primary_phone ? ` · ${k.primary_phone}` : ''}`
    setChon(nhan)
    onPick(k.id, nhan, {
      id: k.id, full_name: ten, primary_phone: k.primary_phone ?? null,
      trang_thai: k.trang_thai ?? 'da_duyet', address: k.address ?? null, province: k.province ?? null,
    })
    setTaoMo(false)
  }

  /** Nhập xong SĐT -> tra khách CS/Sales. */
  async function traSdt() {
    const sdt = f.primary_phone.trim()
    if (!sdt || !sdtHopLe(sdt)) { setKhop(null); return }
    setDangTra(true)
    const r = await timKhachTheoSdt(sdt)
    setDangTra(false)
    setKhop(r)
    // Khớp khách Sales -> dùng luôn info; địa chỉ cho sửa lại nếu có cập nhật.
    if (r.nguon === 'sales') {
      setF((cur) => ({
        ...cur,
        full_name: r.full_name ?? cur.full_name,
        address: r.address ?? cur.address,
        province: r.province ?? cur.province,
      }))
    }
  }

  async function taoMoi() {
    if (!sdtHopLe(f.primary_phone)) { setErr('SĐT bắt buộc và phải đúng định dạng (vd 0xxxxxxxxx).'); return }
    setBusy(true); setErr(null)
    const r = await taoKhachChoDuyet(f)
    setBusy(false)
    if (!r.ok) {
      setErr(r.error)
      // Server bắt trùng (backstop) -> mời chọn khách đã có.
      if (r.existingId) setKhop({ nguon: 'cs', id: r.existingId, full_name: f.full_name.trim() || undefined, primary_phone: f.primary_phone.trim() })
      return
    }
    const nhan = `${f.full_name.trim()} (chờ duyệt)`
    setChon(nhan)
    onPick(r.id, nhan, {
      id: r.id, full_name: f.full_name.trim(), primary_phone: f.primary_phone.trim() || null,
      trang_thai: 'cho_duyet', address: f.address.trim() || null, province: f.province.trim() || null,
    })
    setTaoMo(false)
  }

  if (chon) {
    return (
      <div className="flex items-center gap-2 rounded-lg border px-3 py-2 bg-emerald-50">
        <span className="text-sm text-slate-900">{chon}</span>
        <button type="button" onClick={() => { setChon(null); setQ('') }}
          className="text-xs text-slate-500 underline ml-auto">đổi</button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Tìm khách theo tên hoặc SĐT…"
          className="w-full rounded-lg border px-3 py-2 text-slate-900"
        />
        {open && q.trim() && (
          <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-lg border bg-white shadow-lg">
            {sug.map((k) => (
              <li key={k.id}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(k)}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100">
                  {k.full_name}
                  {k.primary_phone && <span className="font-mono text-xs text-slate-400"> · {k.primary_phone}</span>}
                  {k.trang_thai === 'cho_duyet' && <span className="text-[10px] text-amber-600"> · chờ duyệt</span>}
                </button>
              </li>
            ))}
            {sug.length === 0 && <li className="px-3 py-1.5 text-xs text-slate-400">Không thấy — tạo khách mới bên dưới.</li>}
          </ul>
        )}
      </div>

      {!taoMo ? (
        <button type="button" onClick={() => setTaoMo(true)}
          className="text-sm text-slate-600 underline">+ Không có? Tạo khách mới (chờ duyệt)</button>
      ) : (
        <div className="rounded-lg border p-3 space-y-2 bg-slate-50">
          <div className="grid sm:grid-cols-2 gap-2">
            <input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })}
              placeholder="Tên khách *" className="rounded-lg border px-3 py-2 text-sm text-slate-900" />
            <input value={f.primary_phone}
              onChange={(e) => { setF({ ...f, primary_phone: e.target.value }); setKhop(null) }}
              onBlur={traSdt} inputMode="tel"
              placeholder="SĐT * (vd 0xxxxxxxxx)"
              className="rounded-lg border px-3 py-2 text-sm text-slate-900 font-mono" />
            <input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })}
              placeholder="Địa chỉ" className="rounded-lg border px-3 py-2 text-sm text-slate-900 sm:col-span-2" />
            <ChonTinh value={f.province} onChange={(v) => setF({ ...f, province: v })}
              className="rounded-lg border px-3 py-2 text-sm text-slate-900 bg-white" />
          </div>

          {dangTra && <p className="text-xs text-slate-400">Đang kiểm tra SĐT…</p>}
          {f.primary_phone.trim() && !sdtHopLe(f.primary_phone) && (
            <p className="text-xs text-amber-700">SĐT chưa đúng định dạng (vd 0xxxxxxxxx).</p>
          )}

          {khop?.nguon === 'cs' && khop.id && (
            <div className="rounded-lg bg-amber-50 text-amber-900 px-3 py-2 text-sm space-y-1.5">
              <p>SĐT này đã là khách: <strong>{khop.full_name ?? '—'}</strong>
                {khop.trang_thai === 'cho_duyet' && ' (chờ duyệt)'} — không tạo trùng.</p>
              <button type="button" onClick={() => chonCoSan(khop)}
                className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm font-medium">Chọn khách này</button>
            </div>
          )}
          {khop?.nguon === 'sales' && (
            <p className="text-xs bg-sky-50 text-sky-800 rounded-lg px-3 py-2">
              Khớp khách đơn Sales — đã điền tên/tỉnh, sửa lại địa chỉ nếu cần rồi bấm Tạo (sẽ tự liên kết mã KH Sales).
            </p>
          )}

          <div className="flex items-center gap-3">
            <button type="button" onClick={taoMoi}
              disabled={busy || !f.full_name.trim() || !sdtHopLe(f.primary_phone) || khop?.nguon === 'cs'}
              className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
              {busy ? 'Đang tạo…' : 'Tạo (chờ duyệt)'}
            </button>
            <button type="button" onClick={() => { setTaoMo(false); setKhop(null) }} className="text-sm text-slate-500 underline">Đóng</button>
            {err && <span className="text-sm text-red-600">{err}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
