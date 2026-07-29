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
  { href: '/bao-tri', nhan: 'Lịch bảo trì' },
  { href: '/nhom-loi', nhan: 'Nhóm lỗi' },
  { href: '/khach', nhan: 'Khách cần dọn' },
] as const

const MUC_ADMIN = { href: '/nhan-vien', nhan: 'Nhân viên' } as const

/**
 * Trang chi tiết thuộc mục nào.
 *
 * KHÔNG so khớp bằng tiền tố URL được — app này là đồ thị, không phải cây:
 *  · /may/[serial] chẳng trùng tiền tố mục nào, nhưng máy liệt kê ở trang chủ
 *  · /khach/[id] trùng tiền tố /khach, nhưng "Khách cần dọn" là danh sách khách
 *    LỖI DỮ LIỆU, không phải trang cha của mọi khách. Sáng mục đó là nói sai.
 *
 * Chi tiết khách cố ý KHÔNG ánh xạ vào đâu: nó vào được từ máy, ticket, lịch
 * lõi, nhóm lỗi... không có mục cha thật. Thà không sáng gì còn hơn sáng sai.
 */
const MUC_CHA: ReadonlyArray<readonly [tienTo: string, muc: string]> = [
  ['/may/', '/'],
  ['/ticket/', '/ticket'],
  ['/nhom-loi/', '/nhom-loi'],
] as const

function mucDangMo(pathname: string, muc: readonly { href: string }[]): string | null {
  if (muc.some((m) => m.href === pathname)) return pathname
  return MUC_CHA.find(([tienTo]) => pathname.startsWith(tienTo))?.[1] ?? null
}

export function DieuHuongClient({ laAdmin }: { laAdmin: boolean }) {
  const pathname = usePathname()
  const muc = laAdmin ? [...MUC, MUC_ADMIN] : MUC
  const dangMo = mucDangMo(pathname, muc)

  // KHÔNG dùng overflow-x-auto: trang khung hẹp (vd /khach max-w-4xl có đoạn mô tả dài
  // bên trái) sẽ ép menu co lại, biến thành vùng cuộn và CẮT CỤT nhãn — "Khách cần dọn"
  // chỉ còn hiện "Khác". Cho xuống dòng và cấm co lại thay vì cuộn.
  return (
    <nav className="flex items-center justify-end gap-x-4 gap-y-1 flex-wrap shrink-0">
      {muc.map(({ href, nhan }) => {
        const active = href === dangMo
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={
              'whitespace-nowrap text-sm transition-colors ' +
              (active
                ? 'text-slate-900 font-semibold'
                : 'text-slate-400 hover:text-slate-900')
            }
          >
            {nhan}
          </Link>
        )
      })}
    </nav>
  )
}
