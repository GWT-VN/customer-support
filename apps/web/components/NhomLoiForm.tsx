'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { taoNhomLoi, suaNhomLoi, xoaNhomLoi, type MucDo, type NhomLoiChiTiet } from '@/app/actions'

const MUC_DO: { v: MucDo; nhan: string }[] = [
  { v: 'an_toan', nhan: 'Rủi ro an toàn' },
  { v: 'nghiem_trong', nhan: 'Nghiêm trọng' },
  { v: 'thuong', nhan: 'Thường' },
  { v: 'nhe', nhan: 'Nhẹ' },
  { v: 'khong_loi', nhan: 'Không lỗi (dịch vụ)' },
]

/**
 * Tạo/sửa 1 nhóm lỗi. Mẫu mô tả là REGEX Postgres (các từ khoá cách nhau bởi `|`);
 * server validate biên dịch được mới cho lưu (mẫu hỏng sẽ vỡ trang Nhóm lỗi).
 *
 * `nhom` có -> chế độ SỬA (khoá ô mã); không -> chế độ TẠO. `goiYMau`/`goiYTickets`
 * là gợi ý prefill khi tạo từ cụm "gợi ý gom".
 */
export function NhomLoiForm({
  nhom, goiYMau, goiYTen, goiYTickets,
}: {
  nhom?: NhomLoiChiTiet
  goiYMau?: string
  goiYTen?: string
  goiYTickets?: string[]
}) {
  const router = useRouter()
  const sua = !!nhom
  const [code, setCode] = useState(nhom?.code ?? '')
  const [ten, setTen] = useState(nhom?.ten ?? goiYTen ?? '')
  const [mucDo, setMucDo] = useState<MucDo>(nhom?.muc_do ?? 'thuong')
  const [baoHang, setBaoHang] = useState(nhom?.bao_hang ?? false)
  const [mauMoTa, setMauMoTa] = useState(nhom?.mau_mo_ta ?? goiYMau ?? '')
  const [mauMay, setMauMay] = useState(nhom?.mau_may ?? '')
  const [moTa, setMoTa] = useState(nhom?.mo_ta ?? '')
  const [thuTu, setThuTu] = useState(String(nhom?.thu_tu ?? 100))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function luu() {
    setBusy(true); setErr(null)
    const input = {
      ten, muc_do: mucDo, bao_hang: baoHang, mau_mo_ta: mauMoTa,
      mau_may: mauMay || undefined, mo_ta: moTa || undefined, thu_tu: Number(thuTu) || 100,
    }
    const r = sua
      ? await suaNhomLoi(nhom!.code, input)
      : await taoNhomLoi({ code, ...input })
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    const dest = 'code' in r ? r.code : nhom!.code
    router.push(`/nhom-loi/${dest}`)
    router.refresh()
  }

  async function xoa() {
    if (!nhom) return
    if (!window.confirm(`Xoá nhóm "${nhom.ten}"? Các gán tay của nhóm cũng bị xoá theo.`)) return
    setBusy(true); setErr(null)
    const r = await xoaNhomLoi(nhom.code)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    router.push('/nhom-loi'); router.refresh()
  }

  const oInput = 'w-full rounded-lg border px-3 py-2 text-sm text-slate-900 bg-white'
  const label = 'text-xs font-medium text-slate-600'

  return (
    <div className="bg-white rounded-xl border p-5 space-y-3 max-w-2xl">
      <h2 className="font-medium text-slate-900">{sua ? `Sửa nhóm ${nhom!.code}` : 'Tạo nhóm lỗi mới'}</h2>

      {goiYTickets && goiYTickets.length > 0 && !sua && (
        <p className="text-xs bg-sky-50 text-sky-900 rounded-lg px-3 py-2">
          Gợi ý từ {goiYTickets.length} ticket cùng triệu chứng. Mẫu &amp; tên đã điền sẵn — chỉnh lại rồi lưu.
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <div className={label}>Mã nhóm {sua && <span className="text-slate-400">(không đổi)</span>}</div>
          <input value={code} onChange={(e) => setCode(e.target.value)} disabled={sua}
            placeholder="VD: RO-RI-CHUNG" className={`${oInput} font-mono uppercase disabled:bg-slate-100 disabled:text-slate-500`} />
        </div>
        <div>
          <div className={label}>Thứ tự đọc (nhỏ = ưu tiên)</div>
          <input value={thuTu} onChange={(e) => setThuTu(e.target.value)} inputMode="numeric" className={oInput} />
        </div>
      </div>

      <div>
        <div className={label}>Tên nhóm</div>
        <input value={ten} onChange={(e) => setTen(e.target.value)} placeholder="VD: Rò rỉ nước (máy khác CTS10)" className={oInput} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <div className={label}>Mức độ</div>
          <select value={mucDo} onChange={(e) => setMucDo(e.target.value as MucDo)} className={oInput}>
            {MUC_DO.map((m) => <option key={m.v} value={m.v}>{m.nhan}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 self-end pb-2">
          <input type="checkbox" checked={baoHang} onChange={(e) => setBaoHang(e.target.checked)} />
          Gửi báo cáo hãng (công ty mẹ)
        </label>
      </div>

      <div>
        <div className={label}>Mẫu mô tả (regex) — các từ khoá cách nhau bởi <code className="font-mono">|</code></div>
        <textarea value={mauMoTa} onChange={(e) => setMauMoTa(e.target.value)} rows={2}
          placeholder="rò rỉ|rò nước|chảy nước" className={`${oInput} font-mono`} />
        <p className="text-[11px] text-slate-400 mt-1">
          Ticket có mô tả CHỨA một trong các từ này (không phân biệt hoa thường) sẽ tự vào nhóm.
        </p>
      </div>

      <div>
        <div className={label}>Mẫu model (regex) — tuỳ chọn, chỉ gom khi máy khớp model</div>
        <input value={mauMay} onChange={(e) => setMauMay(e.target.value)} placeholder="VD: CTD50|CTS10" className={`${oInput} font-mono`} />
      </div>

      <div>
        <div className={label}>Mô tả nhóm (tuỳ chọn)</div>
        <input value={moTa} onChange={(e) => setMoTa(e.target.value)} className={oInput} />
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button disabled={busy} onClick={luu} className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
          {busy ? 'Đang lưu…' : sua ? 'Lưu thay đổi' : 'Tạo nhóm'}
        </button>
        {sua && (
          <button disabled={busy} onClick={xoa} className="rounded-lg border border-red-200 text-red-600 px-4 py-2 text-sm hover:bg-red-50 disabled:opacity-50">
            Xoá nhóm
          </button>
        )}
      </div>
    </div>
  )
}
