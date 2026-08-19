'use client'

import { useState, type ReactNode } from 'react'

/**
 * Tab cho hồ sơ khách. Chỉ lo việc bật/tắt — nội dung từng tab vẫn do server
 * component dựng rồi truyền vào qua `noiDung`, nên không có gì bị kéo xuống client.
 *
 * Render HẾT mọi tab rồi ẩn bằng thuộc tính `hidden`, không tháo khỏi cây: đang gõ
 * dở trong ô sửa thông tin mà bấm sang tab khác rồi quay lại thì chữ vẫn còn.
 */
export function KhachTabs({ tabs }: { tabs: { khoa: string; nhan: string; noiDung: ReactNode }[] }) {
  const [dangMo, setDangMo] = useState(tabs[0]?.khoa ?? '')

  return (
    <div>
      <div className="flex gap-0.5 border-b border-slate-200 overflow-x-auto" role="tablist">
        {tabs.map((t) => {
          const on = t.khoa === dangMo
          return (
            <button
              key={t.khoa}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setDangMo(t.khoa)}
              className={
                'relative whitespace-nowrap px-3.5 py-2.5 text-sm ' +
                (on ? 'text-[#8a4a1c] font-semibold' : 'text-slate-500 font-medium hover:text-slate-900')
              }
            >
              {t.nhan}
              {on && <span className="absolute left-2.5 right-2.5 -bottom-px h-0.5 rounded bg-[#b5642a]" />}
            </button>
          )
        })}
      </div>

      {tabs.map((t) => (
        <div key={t.khoa} hidden={t.khoa !== dangMo} className="pt-4">
          {t.noiDung}
        </div>
      ))}
    </div>
  )
}
