'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { themSerialKho, nhapSerialBang, type CatalogChon, type KetQuaNhapLo } from '@/app/actions'
import { phanTichBangSerial } from '@/lib/danhSach'
import { SerialRo } from '@/components/SerialRo'
import { ChonCatalog } from '@/components/ChonCatalog'

/** Ô chọn sản phẩm (catalog) — gõ để lọc theo tên + mã nội bộ. */
function ChonSanPham({
  catalog, value, onChange,
}: { catalog: CatalogChon[]; value: string; onChange: (ic: string) => void }) {
  return <ChonCatalog catalog={catalog} value={value} onChange={onChange} placeholder="Gõ tên hoặc mã nội bộ sản phẩm…" />
}

export function NhapKhoSerial({ catalog }: { catalog: CatalogChon[] }) {
  const [che, setChe] = useState<'don' | 'lo'>('don')
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button onClick={() => setChe('don')}
          className={`px-3 py-1.5 rounded-lg text-sm border ${che === 'don' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'}`}>
          Tạo 1 serial
        </button>
        <button onClick={() => setChe('lo')}
          className={`px-3 py-1.5 rounded-lg text-sm border ${che === 'lo' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'}`}>
          Import lô
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Ký tự dễ nhầm được tô màu để soát: <SerialRo serial="lI10O" /> = L thường · i HOA · số một · số không · chữ O.
      </p>
      {che === 'don' ? <TaoDon catalog={catalog} /> : <ImportLo catalog={catalog} />}
    </div>
  )
}

function TaoDon({ catalog }: { catalog: CatalogChon[] }) {
  const router = useRouter()
  const [ic, setIc] = useState('')
  const [serial, setSerial] = useState('')
  const [mqt, setMqt] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function tao() {
    setBusy(true); setErr(null); setMsg(null)
    const r = await themSerialKho({ serial, internal_code: ic, ma_quoc_te: mqt })
    setBusy(false)
    if (!r.ok) setErr(r.error)
    else { setMsg(`Đã thêm serial ${serial.trim()} vào kho.`); setSerial(''); setMqt(''); router.refresh() }
  }

  return (
    <div className="rounded-lg border p-3 space-y-2 bg-slate-50">
      <ChonSanPham catalog={catalog} value={ic} onChange={setIc} />
      <input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Serial *"
        className="rounded-lg border px-3 py-2 text-slate-900 font-mono text-sm w-full" />
      {serial.trim() && (
        <div className="text-xs text-slate-500">Soát serial: <SerialRo serial={serial.trim()} className="text-sm" /></div>
      )}
      <input value={mqt} onChange={(e) => setMqt(e.target.value)} placeholder="Mã quốc tế (tuỳ chọn)"
        className="rounded-lg border px-3 py-2 text-slate-900 text-sm w-full" />
      <div className="flex items-center gap-3">
        <button onClick={tao} disabled={busy || !serial.trim() || !ic}
          className="rounded-lg bg-slate-900 text-white px-4 py-2 font-medium disabled:opacity-50 text-sm">
          {busy ? 'Đang thêm…' : 'Thêm vào kho'}
        </button>
        {msg && <span className="text-sm text-emerald-700">{msg}</span>}
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </div>
  )
}

function ImportLo({ catalog }: { catalog: CatalogChon[] }) {
  const router = useRouter()
  const [ic, setIc] = useState('')
  const [mqt, setMqt] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [kq, setKq] = useState<KetQuaNhapLo | null>(null)

  // Xem trước: phân tích bảng (Serial|PO|Ngày), đếm hợp lệ + trùng trong lô + có PO/ngày.
  const truoc = useMemo(() => {
    const dong = phanTichBangSerial(text)
    const gap = new Set<string>(); const trung = new Set<string>()
    for (const d of dong) { if (gap.has(d.serial)) trung.add(d.serial); else gap.add(d.serial) }
    return {
      tong: dong.length, duy: gap.size, trung: [...trung], dong,
      coPo: dong.filter((d) => d.po).length, coNgay: dong.filter((d) => d.ngay).length,
    }
  }, [text])

  async function nhap() {
    setBusy(true); setErr(null); setKq(null)
    const r = await nhapSerialBang({ dong: truoc.dong, internal_code: ic, ma_quoc_te: mqt })
    setBusy(false)
    if (!r.ok) setErr(r.error)
    else { setKq(r.kq); setText(''); router.refresh() }
  }

  // Đọc file .xlsx/.csv -> đổ vào ô văn bản (dạng Tab) rồi tái dùng phanTichBangSerial.
  // Import xlsx động để không phình bundle chung.
  async function docFile(f: File) {
    setErr(null)
    try {
      const ten = f.name.toLowerCase()
      if (ten.endsWith('.csv') || ten.endsWith('.txt')) {
        setText(await f.text())
        return
      }
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const aoa = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, blankrows: false })
      setText(aoa.map((row) => (row ?? []).map((c) => (c ?? '').toString().trim()).join('\t')).join('\n'))
    } catch {
      setErr('Không đọc được file — thử lưu lại .xlsx/.csv rồi tải lại, hoặc dán tay.')
    }
  }

  return (
    <div className="rounded-lg border p-3 space-y-2 bg-slate-50">
      <ChonSanPham catalog={catalog} value={ic} onChange={setIc} />
      <p className="text-xs text-slate-500">
        Dán từ Excel — mỗi dòng: <span className="font-mono">Serial</span> ·{' '}
        <span className="font-mono">PO</span> (tuỳ chọn) · <span className="font-mono">Ngày nhập</span> (tuỳ chọn,
        dd/mm/yyyy). Cách nhau bằng Tab/phẩy. Dòng tiêu đề tự bỏ.
      </p>
      <div className="flex items-center gap-2 text-sm">
        <label className="rounded-lg border bg-white px-3 py-1.5 text-slate-700 cursor-pointer hover:bg-slate-50">
          📄 Chọn file .xlsx/.csv
          <input type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) docFile(f); e.target.value = '' }} />
        </label>
        <span className="text-xs text-slate-400">hoặc dán trực tiếp bên dưới</span>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8}
        placeholder={"F00000...0001\tPO-2026-08\t05/08/2026\nF00000...0002\tPO-2026-08\t05/08/2026"}
        className="rounded-lg border px-3 py-2 text-slate-900 font-mono text-xs w-full" />
      <input value={mqt} onChange={(e) => setMqt(e.target.value)} placeholder="Mã quốc tế chung (tuỳ chọn)"
        className="rounded-lg border px-3 py-2 text-slate-900 text-sm w-full" />
      {truoc.tong > 0 && (
        <p className="text-xs text-slate-600">
          {truoc.duy} serial hợp lệ{truoc.tong !== truoc.duy && ` · ${truoc.tong - truoc.duy} trùng trong danh sách`}
          {' · '}{truoc.coPo} có PO · {truoc.coNgay} có ngày
          {truoc.trung.length > 0 && <span className="text-amber-700"> (trùng: {truoc.trung.slice(0, 5).join(', ')}{truoc.trung.length > 5 ? '…' : ''})</span>}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button onClick={nhap} disabled={busy || truoc.duy === 0 || !ic}
          className="rounded-lg bg-slate-900 text-white px-4 py-2 font-medium disabled:opacity-50 text-sm">
          {busy ? 'Đang nhập…' : `Nhập ${truoc.duy} serial`}
        </button>
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>

      {kq && (
        <div className="rounded-lg border bg-white p-3 space-y-2 text-sm">
          <p className="text-emerald-700 font-medium">
            ✅ Thêm mới {kq.them}/{kq.tong} serial vào kho.
          </p>
          {kq.boQua.length > 0 && (
            <div>
              <p className="text-amber-700 font-medium">Bỏ qua {kq.boQua.length}:</p>
              <ul className="mt-1 max-h-48 overflow-auto divide-y border rounded-lg">
                {kq.boQua.map((b, i) => (
                  <li key={i} className="px-2 py-1 flex justify-between gap-3">
                    <SerialRo serial={b.serial} className="text-xs" />
                    <span className="text-xs text-slate-500 flex-none">{b.ly_do}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
