'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Menu chính — khai báo MỘT chỗ, hiện ở mọi trang.
 *
 * Trước đây mỗi trang tự chép một bộ link riêng, nên menu lệch nhau: trang chủ
 * có đủ 4 mục, /loi chỉ có 2, /khach chỉ có 1. Đứng ở /khach muốn sang /nhom-loi
 * phải vòng qua trang chủ.
 */
const MUC = [
  { href: '/', nhan: 'Máy đã lắp' },
  { href: '/ticket', nhan: 'Ticket' },
  { href: '/loi', nhan: 'Lịch thay lõi' },
  { href: '/nhom-loi', nhan: 'Nhóm lỗi' },
  { href: '/khach', nhan: 'Khách cần dọn' },
] as const

/**
 * Trang chi tiết cũng phải sáng đúng mục cha: đang ở /ticket/GWT-260035 thì
 * "Ticket" sáng, nhờ vậy luôn nhìn ra đường quay lại danh sách.
 */
function dangO(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

export function DieuHuong() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {MUC.map(({ href, nhan }) => {
        const active = dangO(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={
              'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors ' +
              (active
                ? 'bg-slate-900 text-white font-medium'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')
            }
          >
            {nhan}
          </Link>
        )
      })}
    </nav>
  )
}
