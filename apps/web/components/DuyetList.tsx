'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { duyetYeuCau, duyetNhieuYeuCau, tuChoiYeuCau, type YeuCauThayDoi } from '@/app/actions'

const NHAN_BANG: Record<string, string> = {
  cs_customers: 'Khách',
  customer_contacts: 'SĐT phụ',
  filter_replacement: 'Lịch thay lõi',
  installed_base: 'Máy đã lắp',
}
const NHAN_COT: Record<string, string> = {
  full_name: 'Tên', primary_phone: 'SĐT', address: 'Địa chỉ', province: 'Tỉnh/TP', notes: 'Ghi chú',
  filter_code: 'Mã lõi', replaced_at: 'Ngày thay', note: 'Ghi chú',
  phone: 'SĐT', contact_name: 'Tên', role: 'Vai trò', zalo_ok: 'Zalo',
  customer_id: 'Khách (id)', install_date: 'Ngày lắp', install_address: 'Địa chỉ lắp', serial_moi: 'Serial mới',
}
const NHAN_LOAI: Record<string, string> = { xoa: 'XOÁ', sua: 'SỬA', doi_serial: 'ĐỔI SERIAL', gop: 'GỘP' }

function tomTat(y: YeuCauThayDoi): string {
  if (y.loai === 'xoa') return 'Xoá'
  // Gộp khách: payload chỉ có gop_id (uuid) — hiện UUID thô cho người duyệt là vô nghĩa.
  // ly_do đã là câu tiếng Việt mô tả đúng việc sắp làm (xem moTaGop() ở lib/gopKhach.ts),
  // dùng lại thay vì bịa tóm tắt khác từ payload.
  if (y.loai === 'gop') return y.ly_do || 'Gộp 2 hồ sơ khách trùng thành một.'
  const p = y.payload ?? {}
  return Object.entries(p)
    .filter(([k]) => k !== 'needs_phone' && k !== 'notes')
    .map(([k, v]) => `${NHAN_COT[k] ?? k}: ${v ?? '—'}`).join(' · ')
}

/** Hàng chờ duyệt yêu cầu SỬA/XOÁ (admin). Duyệt -> áp thật; Từ chối -> bỏ. */
export function DuyetList({ items }: { items: YeuCauThayDoi[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  // kind quyết định màu: thành công toàn bộ (emerald), có phần lỗi (amber),
  // thất bại toàn bộ (red) — để người dùng nhận ra kết quả mà không cần đọc số.
  const [msg, setMsg] = useState<{ text: string; kind: 'ok' | 'partial' | 'fail' } | null>(null)
  const [chon, setChon] = useState<Set<string>>(new Set())

  // Danh sách items đổi sau mỗi lần duyệt (đơn lẻ hoặc hàng loạt), có thể còn id
  // đã biến mất khỏi `chon` từ trước đó — lọc lại ngay khi render thay vì set
  // state trong effect, để "Chọn tất cả" luôn khớp thực tế và duyệt hàng loạt
  // lần sau không gửi id đã duyệt/không còn tồn tại.
  const chonHopLe = useMemo(() => {
    const idsConLai = new Set(items.map((x) => x.id))
    return new Set([...chon].filter((id) => idsConLai.has(id)))
  }, [chon, items])

  const doiChon = (id: string) => setChon((c) => {
    const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n
  })

  async function lam(id: string, duyet: boolean) {
    setBusy(id); setErr(null); setMsg(null)
    const r = duyet ? await duyetYeuCau(id) : await tuChoiYeuCau(id)
    setBusy(null)
    if (!r.ok) setErr(r.error)
    else router.refresh()
  }

  async function duyetHangLoat() {
    const ids = [...chonHopLe]
    if (!window.confirm(`Duyệt ${ids.length} yêu cầu đã chọn? Thao tác này áp thay đổi thật lên dữ liệu.`)) return
    setBusy('hangloat'); setErr(null); setMsg(null)
    const r = await duyetNhieuYeuCau(ids)
    setBusy(null)
    // Không xoá lựa chọn ở đây: duyetNhieuYeuCau chỉ trả số lượng + thông điệp lỗi,
    // không trả id nào lỗi, nên không thể biết chính xác mục nào vẫn còn "cho_duyet".
    // Cứ để nguyên `chon` — mục đã duyệt xong sẽ tự rớt khỏi `items` sau router.refresh(),
    // và chonHopLe (useMemo phía trên) tự lọc theo items mới nên mục lỗi vẫn giữ được chọn
    // để bấm duyệt lại ngay, mục đã xong thì không còn trong danh sách để mà chọn nhầm.
    const kind: 'ok' | 'partial' | 'fail' =
      r.loi.length === 0 ? 'ok' : r.da_duyet === 0 ? 'fail' : 'partial'
    setMsg({ text: `Đã duyệt ${r.da_duyet}/${ids.length} yêu cầu.`, kind })
    if (r.loi.length) setErr(`${r.loi.length} yêu cầu lỗi: ${r.loi.join(' · ')}`)
    router.refresh()
  }

  if (!items.length) return <p className="text-sm text-slate-400">Không có yêu cầu sửa/xoá nào chờ duyệt.</p>
  return (
    <div className="space-y-2">
      {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
      {msg && (
        <p className={
          'text-sm rounded-lg px-3 py-2 ' +
          (msg.kind === 'ok' ? 'text-emerald-700 bg-emerald-50'
            : msg.kind === 'fail' ? 'text-red-600 bg-red-50' : 'text-amber-800 bg-amber-50')
        }>{msg.text}</p>
      )}
      {items.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <label className="flex items-center gap-1.5 text-slate-600">
            <input type="checkbox"
              checked={chonHopLe.size === items.length && items.length > 0}
              onChange={(e) => setChon(e.target.checked ? new Set(items.map((x) => x.id)) : new Set())} />
            Chọn tất cả ({items.length})
          </label>
          {chonHopLe.size > 0 && (
            <button disabled={busy !== null} onClick={duyetHangLoat}
              className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 font-medium disabled:opacity-50">
              Duyệt {chonHopLe.size} mục đã chọn
            </button>
          )}
        </div>
      )}
      <ul className="divide-y border rounded-lg">
        {items.map((y) => (
          <li key={y.id} className="px-3 py-2.5 flex items-start justify-between gap-3">
            <input type="checkbox" checked={chon.has(y.id)} onChange={() => doiChon(y.id)} className="mt-1" />
            <div className="min-w-0 text-sm flex-1">
              <div className="text-slate-900">
                <span className={
                  'text-[10px] font-medium px-1.5 py-0.5 rounded mr-1.5 ' +
                  // Gộp khách ẩn mềm + dời dữ liệu 5 bảng — không đảo ngược dễ dàng như SỬA,
                  // nên xếp cùng màu "nguy hiểm" với XOÁ thay vì màu SỬA trung tính.
                  (y.loai === 'xoa' || y.loai === 'gop' ? 'bg-red-100 text-red-700'
                    : y.loai === 'doi_serial' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-700')
                }>{NHAN_LOAI[y.loai] ?? y.loai}</span>
                {NHAN_BANG[y.doi_tuong] ?? y.doi_tuong}
              </div>
              <div className="text-slate-600 mt-0.5 break-words">{tomTat(y)}</div>
              {/* Với gop, ly_do đã hiện làm dòng tóm tắt chính ở trên — không lặp lại nhỏ xám bên dưới. */}
              {y.ly_do && y.loai !== 'gop' && <div className="text-xs text-slate-400 mt-0.5">{y.ly_do}</div>}
              <div className="text-[11px] text-slate-400 mt-0.5">
                {y.nguoi_gui ?? '—'} · {new Date(y.created_at).toLocaleString('vi-VN', { hour12: false })}
              </div>
            </div>
            <div className="flex gap-2 flex-none">
              <button onClick={() => lam(y.id, true)} disabled={busy !== null}
                className="rounded-lg bg-emerald-600 text-white px-3 py-1 text-xs font-medium disabled:opacity-50">
                {busy === y.id ? '…' : 'Duyệt'}
              </button>
              <button onClick={() => lam(y.id, false)} disabled={busy !== null}
                className="rounded-lg border px-3 py-1 text-xs text-slate-600 disabled:opacity-50">
                Từ chối
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
