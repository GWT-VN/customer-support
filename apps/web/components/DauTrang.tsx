import type { ReactNode } from 'react'

/**
 * Đầu trang chuẩn của khu CSKH: tiêu đề + một dòng phụ đề nói rõ đang xem gì
 * + khu nút bên phải. Server component (không state) nên trang nào cũng dùng được.
 *
 * `phuDe` là chỗ trả lời câu "màn này đang cho tôi xem cái gì, bao nhiêu cái" —
 * trước đây người dùng phải tự đoán từ bảng bên dưới.
 */
export function DauTrang({
  tieuDe,
  phuDe,
  children,
}: {
  tieuDe: string
  phuDe?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">{tieuDe}</h1>
        {phuDe ? <p className="text-sm text-slate-500 mt-0.5">{phuDe}</p> : null}
      </div>
      {children ? <div className="flex items-center gap-2 flex-wrap">{children}</div> : null}
    </header>
  )
}
