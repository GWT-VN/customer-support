'use client'

import { useTransition } from 'react'
import { xoaLech, type DongLech } from '@/lib/nen-tang/ma-tran'
import { HO_SO_QUYEN, laMaQuyenHopLe } from '@/lib/nen-tang/quyen'

export function BangLechQuyen({ ds }: { ds: DongLech[] }) {
  const [dangChay, batDau] = useTransition()

  if (ds.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-900">
        <p className="font-medium">Chưa ghi nhận lệch nào.</p>
        <p>
          Nghĩa là mọi thao tác có người dùng thật đi qua từ lúc đo tới giờ, ma trận đều
          nói giống luật cũ. Bảng này chỉ có nghĩa khi <b>đã có người dùng app một thời gian</b> —
          trống ngay sau khi bật thì chỉ là chưa ai chạm tới, không phải đã an toàn.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          <b>{ds.length}</b> chỗ ma trận nói khác luật cũ. Hàng <span className="text-red-700">đỏ</span> = ma
          trận sẽ <b>CHẶN</b> việc mà hôm nay họ vẫn làm được; hàng <span className="text-amber-700">hổ phách</span> =
          ma trận sẽ <b>MỞ</b> thêm việc mới.
        </p>
        <button
          type="button"
          disabled={dangChay}
          onClick={() => batDau(async () => { await xoaLech() })}
          className="shrink-0 rounded-lg border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          Xoá nhật ký, đo lại
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Người</th>
              <th className="text-left px-3 py-2 font-medium">Việc</th>
              <th className="text-left px-3 py-2 font-medium">Hôm nay</th>
              <th className="text-left px-3 py-2 font-medium">Ma trận nói</th>
              <th className="text-right px-3 py-2 font-medium">Số lần</th>
              <th className="text-left px-3 py-2 font-medium">Gần nhất</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {ds.map((d, i) => {
              const seChan = d.luat_cu && !d.ma_tran
              return (
                <tr key={i} className={seChan ? 'bg-red-50' : 'bg-amber-50'}>
                  <td className="px-3 py-2 font-mono text-xs">{d.email ?? '—'}</td>
                  <td className="px-3 py-2">
                    {laMaQuyenHopLe(d.ma_quyen) ? HO_SO_QUYEN[d.ma_quyen].nhan : d.ma_quyen}
                    <div className="text-[10px] font-mono text-slate-400">{d.ma_quyen}</div>
                  </td>
                  <td className="px-3 py-2">{d.luat_cu ? 'làm được' : 'bị chặn'}</td>
                  <td className={`px-3 py-2 font-medium ${seChan ? 'text-red-700' : 'text-amber-700'}`}>
                    {d.ma_tran ? 'cho làm' : 'CHẶN'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{d.so_lan}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {new Date(d.lan_cuoi).toLocaleString('vi-VN')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
