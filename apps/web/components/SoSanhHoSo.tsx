'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Khối so sánh SONG SONG hai hồ sơ — dùng chung cho hai chỗ khác nhau:
 *
 *  · `/khach/gop`     — hồ sơ giữ  vs  hồ sơ bị gộp
 *  · `/bao-tri/map`   — lịch bảo trì chưa map  vs  khách ứng viên
 *
 * CEO 20/08/2026: "khi search khách cần xem đc detail của khách thì tôi mới dám
 * click … tốt nhất là cho luôn cùng vào mục gộp khách được ko cho đỡ phải code
 * nhiều". Nên phía trái nhận DỮ LIỆU ĐÃ CHUẨN HOÁ chứ không nhận `KhachDayDu` —
 * lịch bảo trì không phải hồ sơ khách (nó chỉ có tên + SĐT lấy từ Asana), nhét nó
 * vào kiểu khách là bịa ra những trường không tồn tại.
 */

export type PhiaSoSanh = {
  tieuDe: string
  /** Chip "đang có": Máy (CS) · Đơn Sales · Lịch bảo trì · Ticket… */
  nhan?: string[]
  dong: { nhan: string; giaTri: string }[]
  /** Mở hồ sơ đầy đủ ở tab mới, nếu phía này là một bản ghi có trang riêng. */
  href?: string
}

const MAU_NHAN: Record<string, string> = {
  'Máy (CS)': 'bg-[#fbeadd] text-[#8a4a1c]',
  'Đơn Sales': 'bg-[#dcf0f3] text-[#0b7d8c]',
  'Lịch bảo trì': 'bg-emerald-100 text-emerald-800',
  Ticket: 'bg-amber-100 text-amber-800',
  'Chưa có dữ liệu': 'bg-slate-100 text-slate-500',
}

function Cot({ p, nhanMau }: { p: PhiaSoSanh; nhanMau: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[11px] font-bold uppercase tracking-wide ${nhanMau}`}>{p.tieuDe}</span>
        {p.href && (
          <Link href={p.href} prefetch={false} target="_blank" className="shrink-0 text-xs text-[#0a6771] underline">
            Mở ↗
          </Link>
        )}
      </div>
      {p.nhan && p.nhan.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {p.nhan.map((n) => (
            <span key={n} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${MAU_NHAN[n] ?? 'bg-slate-100 text-slate-600'}`}>
              {n}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * `trai` và `phai` phải có CÙNG danh sách nhãn dòng, cùng thứ tự — gọi bên nào
 * thiếu dòng thì truyền chuỗi rỗng, đừng bỏ dòng, kẻo hai cột lệch hàng nhau.
 */
export function SoSanhHoSo({
  trai, phai, hanhDong,
}: { trai: PhiaSoSanh; phai: PhiaSoSanh; hanhDong?: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-2 gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
        <Cot p={trai} nhanMau="text-slate-500" />
        <Cot p={phai} nhanMau="text-emerald-700" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <tbody className="divide-y divide-slate-100">
            {trai.dong.map((d, i) => {
              const b = phai.dong[i]?.giaTri ?? ''
              const a = d.giaTri
              // Chỉ tô khi CẢ HAI đều có mà khác nhau. Một bên trống là "thiếu
              // thông tin", không phải "mâu thuẫn" — tô đỏ hết thì CS nhờn mắt.
              const choiNhau = a !== '' && b !== '' && a.trim().toLowerCase() !== b.trim().toLowerCase()
              return (
                <tr key={d.nhan} className={choiNhau ? 'bg-amber-50/50' : ''}>
                  <td className="w-36 px-3 py-2 font-medium text-slate-500">{d.nhan}</td>
                  <td className="px-3 py-2 text-slate-700">{a || <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-2 text-slate-900">{b || <span className="text-slate-300">—</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {hanhDong && <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-3 py-2.5">{hanhDong}</div>}
    </div>
  )
}
