'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import type { BangQuyen, MaQuyen } from '@/lib/nen-tang/quyen'

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

/**
 * Nhóm "Bảo trì" — mỗi mục hiện đúng khi CÓ quyền vào trang nó dẫn tới, không
 * gom vào một cờ laQuanLy như trước. Cặp (mã quyền, luật cũ) khớp lời gọi
 * chanNeuThieuQuyen() ở trang tương ứng.
 */
function nhomBaoTri(co: (ma: MaQuyen) => boolean): Nhom {
  return { ten: 'Bảo trì', muc: [
    { href: '/bao-tri', nhan: 'Lịch bảo trì' },
    { href: '/loi', nhan: 'Lịch thay lõi' },
    ...(co('cs.bao_tri.tao_plan') ? [
      { href: '/bao-tri/map', nhan: 'Map khách' },
      { href: '/bao-tri/len-lich', nhan: 'Lên lịch & gói' },
    ] : []),
    ...(co('cs.ky_thuat.ho_so') ? [{ href: '/ky-thuat', nhan: 'Gán lịch kỹ thuật' }] : []),
    ...(co('cs.ky_thuat.xep_lich') ? [{ href: '/ky-thuat/lich', nhan: 'Xem lịch kỹ thuật' }] : []),
    ...(co('cs.ky_thuat.ho_so') ? [{ href: '/ky-thuat/nhan-su', nhan: 'Danh sách kỹ thuật' }] : []),
  ] }
}

/** Mục quản lý / quản trị — mỗi mục một quyền riêng, xem chú thích nhomBaoTri(). */
function nhomQuanTri(co: (ma: MaQuyen) => boolean): Nhom[] {
  const duyet = co('cs.yeu_cau.xem') ? [{ href: '/duyet', nhan: 'Chờ duyệt' }] : []
  const qt = [
    ...(co('cs.bao_cao.doanh_so') ? [{ href: '/doanh-so', nhan: 'Doanh số' }] : []),
    ...(co('he_thong.catalog') ? [{ href: '/dong-bo-catalog', nhan: 'Đồng bộ catalog' }] : []),
    ...(co('he_thong.nhat_ky') ? [{ href: '/audit', nhan: 'Nhật ký thao tác' }] : []),
    ...(co('he_thong.nhan_su.xem') ? [{ href: '/nhan-vien', nhan: 'Nhân viên' }] : []),
  ]
  return [
    ...(duyet.length ? [{ ten: 'Quản lý', muc: duyet }] : []),
    ...(qt.length ? [{ ten: 'Quản trị', muc: qt }] : []),
  ]
}

// Trang chi tiết -> mục cha nào sáng. Không map bằng tiền tố URL bừa (xem DieuHuong cũ).
const CHA: ReadonlyArray<readonly [string, string]> = [
  ['/may/', '/'], ['/ticket/', '/ticket'], ['/nhom-loi/', '/nhom-loi'],
] as const

function mucDangMo(pathname: string, hrefs: string[]): string | null {
  if (hrefs.includes(pathname)) return pathname
  return CHA.find(([tienTo]) => pathname.startsWith(tienTo))?.[1] ?? null
}

// Kỹ thuật hiện trường (chỉ vai trò ky_thuat): giao diện rút gọn, chỉ lịch của mình.
const NHOM_KY_THUAT: Nhom = { ten: 'Kỹ thuật', muc: [
  { href: '/ky-thuat/cua-toi', nhan: 'Lịch của tôi' },
] }

// Khu Công việc (Work) — hiện cho MỌI nhân sự, xuyên phòng ban.
const NHOM_WORK: Nhom = { ten: 'Công việc', muc: [
  { href: '/work', nhan: 'Việc của tôi' },
] }

export function SidebarNav({ quyen, chiKyThuat = false, coTheVaoCS = true }: {
  quyen: BangQuyen; chiKyThuat?: boolean; coTheVaoCS?: boolean
}) {
  // Thiếu khoá = chưa hỏi = coi như không có: hỏng theo hướng ẨN, không hở.
  const co = (ma: MaQuyen) => quyen[ma] === true
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  // Khu Công việc luôn hiện. Nhóm CS chỉ hiện với người vào được khu CS (Sales thuần
  // không thấy menu khách/ticket). Chỉ kỹ thuật -> menu rút gọn (chỉ lịch + việc).
  const nhomCS = coTheVaoCS ? [...NHOM, nhomBaoTri(co), ...nhomQuanTri(co)] : []
  const nhom = chiKyThuat ? [NHOM_WORK, NHOM_KY_THUAT] : [NHOM_WORK, ...nhomCS]
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
