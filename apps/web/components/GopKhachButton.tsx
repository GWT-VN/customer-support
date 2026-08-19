'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { deXuatGopKhach } from '@/app/actions'
import { KhachPicker } from '@/components/KhachPicker'

/**
 * Gộp một hồ sơ khách TRÙNG vào hồ sơ đang mở.
 *
 * Hồ sơ đang mở luôn là bản GIỮ LẠI — để CS khỏi phải nghĩ về chiều gộp. Muốn
 * giữ bản kia thì mở bản kia rồi gộp ngược. Server còn chặn lần nữa nếu bản bị
 * gộp mới là bản nhiều dữ liệu hơn.
 */
export function GopKhachButton({ giuId, tenGiu }: { giuId: string; tenGiu: string }) {
  const [mo, setMo] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const router = useRouter()
  // Chốt chặn "sự thật" cho việc đang gộp — không phụ thuộc riêng vào state busy
  // (state cập nhật bất đồng bộ, có thể chưa kịp re-render kịp click thứ hai).
  // Thao tác này ẩn cả một hồ sơ khách nên tuyệt đối không được chạy 2 lần cùng lúc.
  const dangGop = useRef(false)

  async function gop(gopId: string, nhan: string) {
    if (dangGop.current) return
    if (!window.confirm(`Gộp "${nhan}" vào "${tenGiu}"?\n\nMáy, ticket, lịch bảo trì của hồ sơ kia sẽ chuyển sang đây. Hồ sơ kia bị ẩn đi (không xoá hẳn).`)) return
    dangGop.current = true
    setBusy(true); setErr(null); setMsg(null)
    const r = await deXuatGopKhach(giuId, gopId)
    dangGop.current = false
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    // Đóng picker ngay trong cả 2 nhánh — nếu đã gộp xong thì hồ sơ kia đã ẩn
    // (không được để picker mở ra mời gộp tiếp một hồ sơ vừa biến mất); nếu
    // mới xếp hàng chờ duyệt thì việc gộp cũng chưa xảy ra, không cần mở lại.
    setMo(false)
    setMsg(r.applied ? 'Đã gộp xong.' : 'Đã gửi đề xuất gộp — chờ quản trị duyệt.')
    router.refresh()
  }

  return (
    <div className="space-y-1.5">
      <button onClick={() => { setMo(!mo); setErr(null) }} disabled={busy}
        className="rounded-lg border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
        Gộp hồ sơ trùng vào đây
      </button>
      {mo && (
        <div className="rounded-lg border bg-white p-3 space-y-2 max-w-lg">
          <p className="text-xs text-slate-600">
            Chọn hồ sơ <strong>bị trùng</strong> — dữ liệu của nó sẽ chuyển sang <strong>{tenGiu}</strong>.
          </p>
          {busy ? (
            // Ẩn hẳn picker trong lúc đang gộp — kể cả link "đổi" của nó cũng
            // active mọi lúc, nếu để lộ ra thì bấm được là bắn request thứ 2.
            <p className="text-xs text-slate-500">Đang xử lý…</p>
          ) : (
            <KhachPicker onPick={(id, nhan) => gop(id, nhan)} />
          )}
        </div>
      )}
      {err && <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1.5">{err}</p>}
      {msg && <p className="text-xs text-emerald-700">{msg}</p>}
    </div>
  )
}
