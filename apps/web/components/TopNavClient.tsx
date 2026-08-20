'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { dangXuat } from '@/app/auth/actions'

/**
 * Thanh điều hướng NGANG 2 tầng cho nền tảng GWT (thay Sidebar dọc).
 *
 *  Tầng 1 (nền tối): nút lưới (tất cả ứng dụng) · logo · TAB MODULE (lọc theo quyền)
 *                    · chuông Discord · ⚙️ Quản trị (quản lý/admin) · email + Đăng xuất.
 *  Tầng 2 (nền trắng): các TRANG của module đang mở; module nhiều trang -> gom dropdown.
 *
 * Quyền: khu Việc cho mọi nhân sự; khu CSKH chỉ khi coTheVaoCS. Đúng luật hiện có.
 * Khi gộp thêm Sales/Kho… vào nền tảng thì THÊM module vào mảng `MODULES` là xong.
 */

type Trang = { nhan: string; href: string; soon?: boolean }
type Nhom = { nhan: string; trang: Trang[] }
type MucTrang = Trang | Nhom
type Module = { key: string; nhan: string; mau: string; href: string; icon: keyof typeof ICON; trang: MucTrang[] }

const laNhom = (m: MucTrang): m is Nhom => 'trang' in m

// Trang chi tiết -> mục cha nào sáng (không map bằng tiền tố URL bừa).
const CHA: ReadonlyArray<readonly [string, string]> = [
  ['/may/', '/'], ['/ticket/', '/ticket'], ['/nhom-loi/', '/nhom-loi'],
  // '/khach/gop' phải đứng TRƯỚC '/khach/': find() lấy cái khớp đầu tiên, để sau
  // thì màn gộp lại sáng đèn ở mục "Khách hàng".
  ['/khach/gop', '/khach/gop'], ['/khach/', '/khach-hang'],
  ['/sales/don/', '/sales'], ['/sales/khach/', '/sales/khach'],
]
function khopHref(pathname: string, href: string): boolean {
  if (pathname === href) return true
  const cha = CHA.find(([tienTo]) => pathname.startsWith(tienTo))?.[1]
  return cha === href
}

const ICON = {
  check: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />,
  headset: <path d="M4 13a8 8 0 0 1 16 0M4 13v4a2 2 0 0 0 2 2h1v-6H6a2 2 0 0 0-2 2Zm16 0v4a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2Z" />,
  cart: <path d="M2.5 3.5h2l2.2 11a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.2L20 7H6M9 20.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm9 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />,
} as const
function Ic({ name, cls = 'w-4 h-4' }: { name: keyof typeof ICON; cls?: string }) {
  return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">{ICON[name]}</svg>
}

export function TopNavClient({
  laAdmin, laQuanLy, chiKyThuat, coTheVaoCS, coTheVaoSales, email,
}: { laAdmin: boolean; laQuanLy: boolean; chiKyThuat: boolean; coTheVaoCS: boolean; coTheVaoSales: boolean; email: string | null }) {
  const pathname = usePathname()
  const [moOpen, setMoOpen] = useState<string | null>(null) // 'launch' | 'gear' | 'g<idx>' | null
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null)

  // ---- registry: module theo quyền ----
  const viec: Module = {
    key: 'viec', nhan: 'Việc', mau: '#0e8c9a', href: '/work', icon: 'check',
    trang: [
      { nhan: 'Việc của tôi', href: '/work' },
      { nhan: 'Bảng team', href: '/work/team' },
      { nhan: 'Lịch', href: '/work', soon: true },
      { nhan: 'Dự án', href: '/work', soon: true },
    ],
  }
  const cskhTrang: MucTrang[] = chiKyThuat
    ? [{ nhan: 'Lịch của tôi', href: '/ky-thuat/cua-toi' }]
    : [
        { nhan: 'Tổng quan', href: '/tong-quan' },
        { nhan: 'Máy & khách', trang: [
          { nhan: 'Máy đã lắp', href: '/' }, { nhan: 'Kho serial', href: '/serial' },
          { nhan: 'Khách hàng', href: '/khach-hang' }, { nhan: 'Khách cần dọn', href: '/khach' },
          { nhan: 'Gộp khách trùng', href: '/khach/gop' },
          { nhan: 'Kênh / đối tác', href: '/kenh' },
        ] },
        { nhan: 'Ticket & lỗi', trang: [{ nhan: 'Ticket', href: '/ticket' }, { nhan: 'Nhóm lỗi', href: '/nhom-loi' }] },
        { nhan: 'Bảo hành', trang: [{ nhan: 'Đăng ký BH', href: '/dang-ky-bh' }, { nhan: 'Chờ kích hoạt BH', href: '/bh-cho-kich-hoat' }] },
        { nhan: 'Bảo trì', trang: [
          { nhan: 'Lịch bảo trì', href: '/bao-tri' }, { nhan: 'Lịch thay lõi', href: '/loi' },
          ...(laQuanLy ? [
            { nhan: 'Map khách', href: '/bao-tri/map' }, { nhan: 'Lên lịch & gói', href: '/bao-tri/len-lich' },
            { nhan: 'Gán lịch kỹ thuật', href: '/ky-thuat' }, { nhan: 'Xem lịch kỹ thuật', href: '/ky-thuat/lich' },
            { nhan: 'Danh sách kỹ thuật', href: '/ky-thuat/nhan-su' },
          ] : []),
        ] },
      ]
  const cskh: Module = { key: 'cskh', nhan: 'CSKH', mau: '#b5642a', href: chiKyThuat ? '/ky-thuat/cua-toi' : '/', icon: 'headset', trang: cskhTrang }

  const sales: Module = {
    key: 'sales', nhan: 'Sales', mau: '#2f7d8a', href: '/sales', icon: 'cart',
    trang: [
      { nhan: 'Đơn hàng', href: '/sales' },
      { nhan: 'Khách hàng', href: '/sales/khach' },
      { nhan: 'Báo giá', href: '/sales', soon: true },
      { nhan: 'Hợp đồng', href: '/sales', soon: true },
      { nhan: 'Kênh / đối tác', href: '/sales', soon: true },
      { nhan: 'Doanh số', href: '/sales', soon: true },
    ],
  }

  const MODULES: Module[] = [viec, ...(coTheVaoCS ? [cskh] : []), ...(coTheVaoSales ? [sales] : [])]
  const moduleActive = pathname.startsWith('/work')
    ? 'viec'
    : pathname.startsWith('/sales')
      ? 'sales'
      : coTheVaoCS
        ? 'cskh'
        : 'viec'
  const mod = MODULES.find((m) => m.key === moduleActive) ?? viec

  const gearItems: Trang[] = [
    ...(laQuanLy ? [{ nhan: 'Chờ duyệt', href: '/duyet' }] : []),
    ...(laAdmin ? [
      { nhan: 'Doanh số', href: '/doanh-so' }, { nhan: 'Đồng bộ catalog', href: '/dong-bo-catalog' },
      { nhan: 'Nhật ký thao tác', href: '/audit' }, { nhan: 'Nhân viên', href: '/nhan-vien' },
    ] : []),
  ]

  type App = { nhan: string; mau: string; href?: string; live: boolean; icon?: keyof typeof ICON }
  const APPS: App[] = [
    { nhan: 'Việc', mau: '#0e8c9a', href: '/work', live: true, icon: 'check' },
    { nhan: 'CSKH', mau: '#b5642a', href: '/', live: coTheVaoCS, icon: 'headset' },
    { nhan: 'Sales', mau: '#2f7d8a', href: '/sales', live: coTheVaoSales, icon: 'cart' }, { nhan: 'Kho', mau: '#5560c9', live: false },
    { nhan: 'Nhân sự', mau: '#b0518f', live: false }, { nhan: 'Kế toán', mau: '#3f8a6a', live: false },
    { nhan: 'Marketing', mau: '#8a52b8', live: false },
  ]

  const toggle = (k: string) => setMoOpen((v) => (v === k ? null : k))
  const dong = () => setMoOpen(null)
  // Mở dropdown nhóm trang ở toạ độ nút (render FIXED để không bị thanh cuộn overflow cắt mất).
  function moNhom(i: number, el: HTMLElement) {
    if (moOpen === `g${i}`) { dong(); return }
    const r = el.getBoundingClientRect()
    setMenuPos({ left: r.left, top: r.bottom + 6 })
    setMoOpen(`g${i}`)
  }

  return (
    <>
      {/* ============ TẦNG 1 ============ */}
      <div className="bg-[#0c2a2e] text-slate-100 sticky top-0 z-40">
        <div className="max-w-[1320px] mx-auto h-[52px] px-3 flex items-center gap-1">
          {/* app launcher */}
          <button onClick={() => toggle('launch')} aria-label="Tất cả ứng dụng" title="Tất cả ứng dụng"
            className="w-9 h-9 rounded-lg grid place-items-center hover:bg-white/10 shrink-0">
            <svg className="w-[19px] h-[19px]" viewBox="0 0 24 24" fill="currentColor">
              {[5, 12, 19].flatMap((y) => [5, 12, 19].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2" />))}
            </svg>
          </button>

          <div className="flex items-center gap-2 pr-2 shrink-0">
            <span className="w-7 h-7 rounded-lg grid place-items-center shrink-0"
              style={{ background: 'linear-gradient(150deg,#12a3b4,#0a6771)' }}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M12 2.5C12 2.5 5 10 5 15a7 7 0 0 0 14 0c0-5-7-12.5-7-12.5Z" fill="#fff" opacity=".95" /></svg>
            </span>
            <b className="text-[15px] tracking-tight">GWT</b>
          </div>

          {/* module tabs */}
          <nav className="flex items-center gap-0.5 min-w-0 overflow-x-auto [scrollbar-width:none]">
            {MODULES.map((m) => {
              const on = m.key === moduleActive
              return (
                <Link key={m.key} href={m.href} onClick={dong}
                  className={'inline-flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap text-[13.5px] font-semibold transition-colors ' +
                    (on ? 'bg-white/10 text-white' : 'text-teal-100/60 hover:text-white hover:bg-white/5')}>
                  <Ic name={m.icon} />{m.nhan}
                </Link>
              )
            })}
          </nav>

          {/* right cluster */}
          <div className="ml-auto flex items-center gap-1 shrink-0">
            <button title="Thông báo Discord" aria-label="Thông báo"
              className="relative w-9 h-9 rounded-lg grid place-items-center hover:bg-white/10">
              <span className="absolute top-2 right-2 w-[7px] h-[7px] rounded-full bg-red-500 ring-2 ring-[#0c2a2e]" />
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
            </button>

            {gearItems.length > 0 && (
              <div className="relative">
                <button onClick={() => toggle('gear')} title="Quản trị" aria-label="Quản trị"
                  className={'w-9 h-9 rounded-lg grid place-items-center hover:bg-white/10 ' + (moOpen === 'gear' ? 'bg-white/10' : '')}>
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.6 1.6 0 0 0-2.7 1.1 2 2 0 1 1-4 0 1.6 1.6 0 0 0-2.7-1.1 2 2 0 1 1-2.8-2.8A1.6 1.6 0 0 0 2.4 15a2 2 0 1 1 0-4 1.6 1.6 0 0 0 1.5-2.6 2 2 0 1 1 2.8-2.8A1.6 1.6 0 0 0 9.4 4a2 2 0 1 1 4 0 1.6 1.6 0 0 0 2.7 1.1 2 2 0 1 1 2.8 2.8A1.6 1.6 0 0 0 21.6 11a2 2 0 1 1 0 4Z" /></svg>
                </button>
                {moOpen === 'gear' && (
                  <div className="absolute right-0 top-[calc(100%+6px)] min-w-[190px] bg-white text-slate-700 border rounded-xl shadow-xl p-1.5 z-50">
                    <div className="px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Quản trị</div>
                    {gearItems.map((g) => (
                      <Link key={g.href} href={g.href} onClick={dong} className="block px-2.5 py-2 rounded-lg text-[13px] hover:bg-slate-100">{g.nhan}</Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="hidden sm:block text-[12px] text-teal-100/60 max-w-[150px] truncate pl-1">{email}</div>
            <form action={dangXuat}>
              <button type="submit" className="rounded-lg border border-white/15 px-3 py-1.5 text-[12.5px] text-teal-50 hover:bg-white/10">Đăng xuất</button>
            </form>
          </div>
        </div>
      </div>

      {/* ============ TẦNG 2 ============ */}
      <div className="bg-white border-b sticky top-[52px] z-30 shadow-sm">
        <div className="max-w-[1320px] mx-auto h-[46px] px-3 flex items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
          {mod.trang.map((t, i) => {
            if (laNhom(t)) {
              const active = t.trang.some((x) => khopHref(pathname, x.href))
              return (
                <button key={i} onClick={(e) => moNhom(i, e.currentTarget)}
                  className={'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap text-[13.5px] font-medium ' +
                    (active || moOpen === `g${i}` ? 'text-teal-800 bg-teal-50 font-semibold' : 'text-slate-600 hover:bg-slate-100')}>
                  {t.nhan}
                  <svg className="w-3 h-3 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="m6 9 6 6 6-6" /></svg>
                </button>
              )
            }
            if (t.soon) {
              return <span key={i} className="px-3 py-1.5 text-[13.5px] text-slate-300 whitespace-nowrap cursor-default" title="Sắp có">{t.nhan}</span>
            }
            const on = khopHref(pathname, t.href)
            return (
              <Link key={i} href={t.href} onClick={dong}
                className={'px-3 py-1.5 rounded-lg whitespace-nowrap text-[13.5px] ' + (on ? 'text-teal-800 bg-teal-50 font-semibold' : 'text-slate-600 hover:bg-slate-100 font-medium')}>{t.nhan}</Link>
            )
          })}
        </div>
      </div>

      {/* ---- backdrop đóng menu ---- */}
      {moOpen && <button aria-hidden tabIndex={-1} onClick={dong} className="fixed inset-0 z-20 cursor-default" />}

      {/* ---- dropdown nhóm trang (FIXED — thoát khỏi thanh cuộn overflow) ---- */}
      {(() => {
        if (!moOpen || !moOpen.startsWith('g') || !menuPos) return null
        const grp = mod.trang[Number(moOpen.slice(1))]
        if (!grp || !laNhom(grp)) return null
        return (
          <div className="fixed z-50 min-w-[190px] bg-white border rounded-xl shadow-xl p-1.5"
            style={{ left: menuPos.left, top: menuPos.top }}>
            {grp.trang.map((x) => (
              <Link key={x.href} href={x.href} onClick={dong}
                className={'block px-2.5 py-2 rounded-lg text-[13px] ' + (khopHref(pathname, x.href) ? 'bg-teal-50 text-teal-800 font-medium' : 'text-slate-600 hover:bg-slate-100')}>{x.nhan}</Link>
            ))}
          </div>
        )
      })()}

      {/* ---- app launcher ---- */}
      {moOpen === 'launch' && (
        <div className="fixed left-4 top-[60px] w-[min(430px,92vw)] bg-white border rounded-2xl shadow-2xl z-50 p-4">
          <h4 className="text-sm font-bold text-slate-800">Ứng dụng GWT</h4>
          <p className="text-xs text-slate-500 mb-3">Hiện theo phân quyền của bạn</p>
          <div className="grid grid-cols-3 gap-2">
            {APPS.map((a) => {
              const inner = (
                <>
                  <span className="w-11 h-11 rounded-xl grid place-items-center text-white" style={{ background: a.live ? a.mau : '#94a3b8' }}>
                    {a.icon ? <Ic name={a.icon} cls="w-[21px] h-[21px]" /> : <span className="text-lg font-bold">{a.nhan[0]}</span>}
                  </span>
                  <span className="text-[12px] font-semibold text-slate-600">{a.nhan}</span>
                  {!a.live && <span className="text-[9px] font-bold text-amber-600">Sắp có</span>}
                </>
              )
              return a.live && a.href ? (
                <Link key={a.nhan} href={a.href} onClick={dong} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-transparent hover:bg-slate-50 hover:border-slate-200 text-center">{inner}</Link>
              ) : (
                <span key={a.nhan} className="flex flex-col items-center gap-1.5 p-3 rounded-xl opacity-55 text-center cursor-default">{inner}</span>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
