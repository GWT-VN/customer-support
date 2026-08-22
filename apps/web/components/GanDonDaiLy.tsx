'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ganDonDaiLyChoMay, type DonDaiLy } from '@/app/actions'
import { OChonGoiY } from '@/bang/OChonGoiY'

/**
 * Nối một con máy với ĐƠN CỦA ĐẠI LÝ đã bán ra nó.
 *
 * CEO dump 22/08/2026: khách kích hoạt bảo hành trên CS thường **không có bên Sales** vì họ
 * không mua trực tiếp — người mua là **đại lý**. Cần biết khách này của đại lý nào, theo đơn nào,
 * để còn tính hoa hồng/bậc đại lý và để biết gọi ai khi máy có vấn đề trong thời gian bảo hành.
 *
 * Đặt ở MÁY chứ không ở hồ sơ khách: một khách có thể mua máy lọc tổng qua đại lý A rồi mua thêm
 * máy uống qua đại lý B. Gắn vào khách thì phải chọn một và mất phần kia.
 */
export function GanDonDaiLy({
  serial, daiLyTen, daiLyDon, donList,
}: {
  serial: string
  daiLyTen: string | null
  daiLyDon: string | null
  donList: DonDaiLy[]
}) {
  const router = useRouter()
  const [chon, setChon] = useState(daiLyDon ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function luu(orderCode: string | null) {
    setBusy(true); setErr(null); setMsg(null)
    const r = await ganDonDaiLyChoMay(serial, orderCode)
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    setMsg(orderCode ? 'Đã gắn đơn đại lý.' : 'Đã gỡ.')
    router.refresh()
  }

  return (
    <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h3 className="text-sm font-medium text-slate-900">Máy này bán qua đại lý nào?</h3>
        <p className="text-xs text-slate-400">
          Khách kích hoạt bảo hành thường không mua trực tiếp — người mua là đại lý.
          Gắn đơn để biết máy này thuộc đại lý nào.
        </p>
      </div>

      {daiLyTen ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <span>Đại lý: <strong>{daiLyTen}</strong></span>
          {daiLyDon && <span className="font-mono text-xs">· đơn {daiLyDon}</span>}
          <button type="button" onClick={() => { setChon(''); luu(null) }} disabled={busy}
            className="ml-auto text-xs text-slate-500 underline hover:text-red-600 disabled:opacity-50">
            gỡ
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate-400">Chưa gắn đơn đại lý nào.</p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[320px] flex-1">
          <OChonGoiY
            giaTri={chon || null}
            onChon={setChon}
            tuyChon={donList.map((d) => ({
              gt: d.order_code,
              nhan: `${d.dai_ly} · ${d.order_code}`,
              // Gõ tên khách trên đơn cũng ra — CS thường nhớ tên khách hơn mã đơn.
              phu: [d.ngay, d.khach_tren_don, d.mat_hang].filter(Boolean).join(' · '),
            }))}
            choTrong="Gõ tên đại lý, mã đơn hoặc tên khách trên đơn…"
          />
        </div>
        <button type="button" onClick={() => luu(chon || null)} disabled={busy || !chon}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
          {busy ? 'Đang lưu…' : 'Gắn đơn'}
        </button>
      </div>

      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </section>
  )
}
