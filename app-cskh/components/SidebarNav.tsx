'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

/**
 * Menu dọc bên trái, gom theo nhóm nghiệp vụ (thay thanh ngang 12 mục cũ).
 * Thêm trang mới = bỏ vào nhóm sẵn, không phình ngang.
 *
 * Mobile: ẩn sau nút ☰. Desktop (lg+): cột cố định luôn hiện.
 */
type Muc = { href: string; nhan: string }
type Nhom = { ten: string; muc: readonly Muc[] }

const NHOM: readonly Nhom[] = [
  { ten: 'Máy & khách', muc: [
    { href: '/', nhan: 'Máy đã lắp' },
    { href: '/serial', nhan: 'Kho serial' },
    { href: '/khach-hang', nhan: 'Khách hàng' },
    { href: '/khach', nhan: 'Khách cần dọn' },
    { href: '/can-don', nhan: 'Data cần dọn' },
    { href: '/kenh', nhan: 'Kênh / đối tác' },
  ] },
  { ten: 'Ticket & lỗi', muc: [
    { href: '/ticket', nhan: 'Ticket' },
    { href: '/nhom-loi', nhan: 'Nhóm lỗi' },
  ] },
  { ten: 'Bảo hành', muc: [
    { href: '/dang-ky-bh', nhan: 'Đăng ký BH' },
    { href: '/bh-cho-kich-hoat', nhan: 'Chờ kích hoạt BH' },
  ] },
] as const

/** Nhóm "Bảo trì" — gom mọi mục liên quan. Mục quản lý chỉ hiện với cấp quản lý. */
function nhomBaoTri(laQuanLy: boolean): Nhom {
  return { ten: 'Bảo trì', muc: [
    { href: '/bao-tri', nhan: 'Lịch bảo trì' },
    { href: '/loi', nhan: 'Lịch thay lõi' },
    ...(laQuanLy ? [
      { href: '/bao-tri/map', nhan: 'Map khách' },
      { href: '/bao-tri/len-lich', nhan: 'Lên lịch & gói' },
      { href: '/ky-thuat', nhan: 'Gán lịch kỹ thuật' },
      { href: '/ky-thuat/lich', nhan: 'Xem lịch kỹ thuật' },
    ] : []),
  ] }
}

// Cấp QUẢN LÝ (admin | cs_manager): duyệt.
const NHOM_QUANLY: Nhom = { ten: 'Quản lý', muc: [
  { href: '/duyet', nhan: 'Chờ duyệt' },
] }
// CHỈ admin: doanh số, catalog, nhật ký, nhân viên.
const NHOM_ADMIN: Nhom = { ten: 'Quản trị', muc: [
  { href: '/doanh-so', nhan: 'Doanh số' },
  { href: '/dong-bo-catalog', nhan: 'Đồng bộ catalog' },
  { href: '/audit', nhan: 'Nhật ký thao tác' },
  { href: '/nhan-vien', nhan: 'Nhân viên' },
] }

// Trang chi tiết -> mục cha nào sáng. Không map bằng tiền tố URL bừa (xem DieuHuong cũ).
const CHA: ReadonlyArray<readonly [string, string]> = [
  ['/may/', '/'], ['/ticket/', '/ticket'], ['/nhom-loi/', '/nhom-loi'],
] as const

function mucDangMo(pathname: string, hrefs: string[]): string | null {
  if (hrefs.includes(pathname)) return pathname
  return CHA.find(([tienTo]) => pathname.startsWith(tienTo))?.[1] ?? null
}

export function SidebarNav({ laAdmin, laQuanLy }: { laAdmin: boolean; laQuanLy: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  // admin cũng là quản lý -> thấy cả 2 nhóm. cs_manager chỉ thấy nhóm Quản lý.
  const nhom = [
    ...NHOM,
    nhomBaoTri(laQuanLy),
    ...(laQuanLy ? [NHOM_QUANLY] : []),
    ...(laAdmin ? [NHOM_ADMIN] : []),
  ]
  const dangMo = mucDangMo(pathname, nhom.flatMap((n) => n.muc.map((m) => m.href)))

  return (
    <aside className="lg:w-60 lg:shrink-0 lg:border-r border-b bg-white">
      {/* Thanh mobile: nút mở/đóng */}
      <div className="lg:hidden flex items-center justify-between px-4 py-2.5">
        <span className="text-sm font-semibold text-slate-900">Menu</span>
        <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
          className="rounded-lg border px-3 py-1.5 text-sm text-slate-600">
          {open ? '✕ Đóng' : '☰ Menu'}
        </button>
      </div>

      <nav className={`${open ? 'block' : 'hidden'} lg:block px-3 pb-4 lg:pt-4 space-y-4`}>
        {nhom.map((n) => (
          <div key={n.ten}>
            <div className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {n.ten}
            </div>
            <ul className="space-y-0.5">
              {n.muc.map((m) => {
                const active = m.href === dangMo
                return (
                  <li key={m.href}>
                    <Link href={m.href} onClick={() => setOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={
                        'block rounded-lg px-2.5 py-1.5 text-sm transition-colors ' +
                        (active
                          ? 'bg-slate-900 text-white font-medium'
                          : 'text-slate-600 hover:bg-slate-100')
                      }>
                      {m.nhan}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}
