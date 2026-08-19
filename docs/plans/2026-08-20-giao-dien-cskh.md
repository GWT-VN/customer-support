# Làm lại giao diện khu CSKH — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Áp bộ giao diện của mockup Sales/Work lên toàn khu CSKH, đồng thời sửa 7 lỗi giao diện CEO đã dump trong `BACKLOG.md`, không đụng DB/RPC/phân quyền.

**Architecture:** Ba lớp, làm từ ngoài vào trong. (1) Lớp **token bảng dùng chung** — `bang/giaoDien.ts` vốn đã là điểm cắm duy nhất cho mọi trang danh sách, đổi ở đây là 8 trang ăn theo. (2) Lớp **vỏ trang** — thêm `components/DauTrang.tsx` để mọi trang có cùng kiểu tiêu đề + phụ đề + nút hành động. (3) Lớp **luồng thao tác** — ba trang đổi cách dùng (hồ sơ khách chuyển tab, đăng ký BH đưa hàng chờ duyệt lên đầu, calendar bảo trì bấm được). Logic nghiệp vụ, server action, và quyền giữ nguyên 100%.

**Tech Stack:** Next.js 16.2.10 (App Router, React 19 server components), Tailwind 4, TypeScript 5, Vitest 4.

**Spec:** Mockup đã duyệt 20/08/2026 — artifact "GWT CSKH" https://claude.ai/code/artifact/e84ffc67-768a-47a2-b166-05d3424028dc (màn cuối "Đổi gì & ảnh hưởng" là bản đặc tả phạm vi). Lỗi nguồn: `BACKLOG.md` mục 🐞 LỖI CẦN SỬA #1, #2, #3, #6, #8, #9, #10.

## Global Constraints

- **Không đụng** DB, migration, RPC, `lib/quyen.ts`, `lib/supabase.ts`. Không thêm cột, không đổi chữ ký server action trừ khi task nói rõ.
- **Không đổi đường dẫn cũ.** `/`, `/khach-hang`, `/ticket`, `/bao-tri`, `/dang-ky-bh`… phải còn chạy — link đã gửi nhân viên không được hỏng.
- **SĐT: CẢNH BÁO, KHÔNG CHẶN.** CEO chốt 20/08/2026. Dữ liệu cũ dạng `84…`/9 số vẫn lưu được, chỉ hiện cảnh báo hổ phách. Rào ở server (`chuanHoaSdt` trong `app/actions.ts`) **giữ nguyên**, không siết.
- **Bảng màu** lấy từ mockup: nav `#0c2a2e`, accent teal `#0e8c9a` / đậm `#0a6771` / nhạt `#e2f2f3`, màu định danh CSKH cam đất `#b5642a` / đậm `#8a4a1c` / nhạt `#fbeadd`, nền trang `slate-50`. Dùng lớp Tailwind sẵn có khi khớp; màu ngoài thang Tailwind viết `[#0e8c9a]`.
- **Tiếng Việt** cho mọi chữ hiện ra và mọi tên hàm/biến mới, theo lệ repo.
- Sau **mỗi task**: `npx tsc --noEmit` sạch + `npm run test` xanh + commit. Task cuối thêm `npm run lint` và `npm run build`.
- Lệnh chạy từ `apps/web/`.
- Làm trong worktree `/Users/medici/gwt-worktrees/cskh-giao-dien`, nhánh `feat/cskh-giao-dien`.

**Đã kiểm chứng là CÓ SẴN, không cần task riêng:** lỗi #3 ("cho điền sđt/tên trước rồi tra, có SĐT trùng thì trả ra KH luôn") — `components/KhachPicker.tsx` đã tra `timKhachTheoSdt` ngay khi gõ xong SĐT và mời chọn khách cũ thay vì tạo trùng; `DangKyBHForm` và `TaoTicketForm` đều dùng component này. Việc còn lại chỉ là xác nhận bằng mắt ở bước kiểm tra cuối.

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `bang/giaoDien.ts` | Sửa: bộ lớp CSS mặc định của bộ bảng → tông mockup | 1 |
| `components/DauTrang.tsx` | Tạo: tiêu đề + phụ đề + khu nút của mọi trang CSKH | 2 |
| `app/page.tsx`, `app/khach-hang/page.tsx`, `app/ticket/page.tsx`, `app/serial/page.tsx`, `app/loi/page.tsx`, `app/bao-tri/page.tsx` | Sửa: dùng `DauTrang` | 2 |
| `app/tong-quan/actions.ts` | Tạo: đếm số cho 4 ô | 3 |
| `app/tong-quan/page.tsx` | Tạo: màn Tổng quan CSKH | 3 |
| `components/TopNavClient.tsx` | Sửa: thêm mục "Tổng quan" đầu tầng 2 của CSKH | 3 |
| `components/DangKyBHForm.tsx` | Sửa: thêm ô Tỉnh cho địa chỉ lắp | 4 |
| `components/TaoKhachButton.tsx` | Tạo: nút + hộp thoại tạo khách, bọc `KhachPicker` | 5 |
| `app/khach-hang/page.tsx` | Sửa: gắn nút "＋ Tạo khách" | 5 |
| `lib/sdt.ts` + `lib/sdt.test.ts` | Tạo: chuẩn hoá + cảnh báo SĐT dùng chung | 6 |
| `components/KhachPicker.tsx`, `components/CustomerEditor.tsx` | Sửa: dùng `lib/sdt.ts`, hiện cảnh báo | 6 |
| `components/KhachTabs.tsx` | Tạo: lớp bọc client render tab cho hồ sơ khách | 7 |
| `app/khach/[id]/page.tsx` | Sửa: đầu trang cố định + 4 ô số + bọc tab | 7 |
| `app/dang-ky-bh/page.tsx` | Sửa: banner chờ duyệt lên đầu | 8 |
| `lib/lichThang.ts` + `lib/lichThang.test.ts` | Tạo: tính lưới tháng (tách khỏi JSX để test được) | 9 |
| `components/LichBaoTriThang.tsx` | Sửa: ô ngày bấm được, nút "Tháng này", panel ngày đã chọn | 9 |
| `app/bao-tri/page.tsx` | Sửa: nhận `?ngay=` và truyền xuống calendar | 9 |

---

### Task 1: Bộ giao diện mới cho bảng dùng chung

Đây là task đòn bẩy lớn nhất: `bang/giaoDien.ts` là điểm cắm duy nhất của ô tìm, chip lọc, chip sắp xếp, tiêu đề cột, phân trang, ô lọc, thanh chọn dòng. Đổi ở đây thì `/`, `/khach-hang`, `/ticket`, `/serial`, `/loi`, `/bao-tri`, `/khach`, `/nhom-loi` đổi theo cùng lúc.

**Files:**
- Modify: `apps/web/bang/giaoDien.ts` (chỉ phần `GIAO_DIEN_MAC_DINH`, giữ nguyên `type GiaoDienBang`)

**Interfaces:**
- Consumes: không có (task đầu)
- Produces: `GIAO_DIEN_MAC_DINH: GiaoDienBang` — cùng tên, cùng kiểu, chỉ đổi giá trị chuỗi. Không task nào phải sửa theo.

- [ ] **Step 1: Đọc lại type để không sót khoá**

Run: `sed -n 12,66p apps/web/bang/giaoDien.ts`

Mọi khoá trong `GiaoDienBang` phải còn nguyên trong `GIAO_DIEN_MAC_DINH` — thiếu 1 khoá là tsc đỏ ngay, đó là lưới an toàn.

- [ ] **Step 2: Thay giá trị của `GIAO_DIEN_MAC_DINH`**

Giữ nguyên khối chú thích ở đầu file và toàn bộ `type GiaoDienBang`. Thay từ dòng `export const GIAO_DIEN_MAC_DINH` tới hết file bằng:

```ts
/**
 * Tông của nền tảng GWT (theo mockup Sales/CSKH): nền teal nhạt, thẻ trắng bo 12px,
 * accent teal #0e8c9a. Đổi giao diện toàn bộ trang danh sách = sửa DUY NHẤT ở đây.
 */
export const GIAO_DIEN_MAC_DINH: GiaoDienBang = {
  oTimKiem_khung: 'relative',
  oTimKiem_input:
    'w-full rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 pr-10 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-[#0e8c9a] focus:ring-2 focus:ring-[#e2f2f3]',
  oTimKiem_nutXoa: 'absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900',

  dangLoc_khung: 'flex items-center justify-between gap-3 flex-wrap text-sm',
  dangLoc_nhomChip: 'flex items-center gap-2 flex-wrap',
  dangLoc_chip:
    'inline-flex items-center gap-1 py-1 rounded-full border border-[#bfe2e5] bg-[#e2f2f3] text-[#0a6771] text-xs font-medium',
  dangLoc_chipCoNutGo: 'pl-2.5 pr-1.5',
  dangLoc_chipTron: 'px-2.5',
  dangLoc_nutGoChip:
    'flex-none grid place-items-center w-4 h-4 rounded-full leading-none text-[#0a6771]/60 hover:bg-[#bfe2e5] hover:text-[#0a6771]',
  dangLoc_soDong: 'text-slate-500',
  dangLoc_nutXoaLoc: 'text-slate-600 underline hover:text-slate-900 flex-none',

  sapXep_chip:
    'inline-flex items-center gap-1.5 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-700 text-xs font-medium',
  sapXep_chipCoNutGo: 'pl-2.5 pr-1.5',
  sapXep_chipTron: 'px-2.5',
  sapXep_muiTen: 'text-[#0e8c9a]',
  sapXep_ghiChu: 'text-slate-500',
  sapXep_nutGo:
    'flex-none grid place-items-center w-4 h-4 rounded-full leading-none text-slate-400 hover:bg-slate-200 hover:text-slate-900',

  tieuDe_o: 'text-left px-4 py-2.5 font-semibold text-[10.5px] uppercase tracking-wider text-slate-400',
  tieuDe_oDangSap: 'bg-white text-slate-700',
  tieuDe_link: 'inline-flex items-center gap-1 hover:text-slate-700',
  tieuDe_linkDangSap: 'font-bold text-slate-800',
  tieuDe_muiTenDangSap: 'text-[#0e8c9a]',
  tieuDe_muiTenThuong: 'text-slate-300',

  phanTrang_khung: 'flex items-center justify-center gap-3 text-sm',
  phanTrang_nut:
    'rounded-[9px] border border-slate-200 bg-white text-slate-700 px-3 py-1.5 shadow-sm hover:border-slate-300 hover:bg-slate-50',
  phanTrang_nutTat: 'rounded-[9px] border border-slate-200 bg-white text-slate-300 px-3 py-1.5',
  phanTrang_chuSo: 'text-slate-500 tabular-nums',

  boLoc_khung: 'relative inline-flex max-w-full',
  boLoc_select:
    'w-48 max-w-full truncate appearance-none rounded-[10px] border border-slate-200 bg-white pl-3 pr-8 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-[#0e8c9a] focus:ring-2 focus:ring-[#e2f2f3]',
  boLoc_muiTen: 'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400',

  chon_khung: 'space-y-4',
  chon_oTh: 'w-10 px-4 py-2.5',
  chon_oTd: 'w-10 px-4 py-3',
  chon_checkbox: 'align-middle accent-[#0e8c9a]',
  chon_thanh:
    'flex items-center gap-x-3 gap-y-1 flex-wrap rounded-[10px] border border-[#0c2a2e] bg-[#0c2a2e] px-3 py-2 text-sm text-white',
  chon_thanhPhuChu: 'text-teal-100/70',
  chon_thanhCanhBao: 'text-amber-300',
  chon_nutChonToanBo:
    'underline decoration-dotted underline-offset-2 text-teal-200 hover:text-white disabled:opacity-50',
  chon_nutBoChon: 'text-teal-100/70 underline hover:text-white',
  chon_loi: 'text-red-300',
  chon_khuHanhDong: 'flex items-center gap-2 flex-wrap ml-auto',
  chon_chuaCoHanhDong: 'ml-auto text-xs text-teal-100/50',
}
```

- [ ] **Step 3: Kiểm tra kiểu + test**

Run: `cd apps/web && npx tsc --noEmit && npm run test`

Expected: tsc không in gì; test xanh hết. Test hiện có là logic thuần, không bám vào chuỗi CSS — nếu đỏ nghĩa là có test bám chuỗi CSS, phải đọc kỹ chứ đừng sửa test cho qua.

- [ ] **Step 4: Commit**

```bash
git add apps/web/bang/giaoDien.ts
git commit -m "style(cskh): bộ bảng dùng chung đổi sang tông mockup nền tảng"
```

---

### Task 2: Đầu trang dùng chung cho các trang danh sách

Hiện mỗi trang tự viết `<header><h1>`, không có phụ đề, nút hành động đặt lung tung. Mockup dùng một kiểu thống nhất: tiêu đề + một dòng phụ đề nói rõ đang xem gì + khu nút bên phải.

**Files:**
- Create: `apps/web/components/DauTrang.tsx`
- Modify: `apps/web/app/page.tsx`, `apps/web/app/khach-hang/page.tsx`, `apps/web/app/ticket/page.tsx`, `apps/web/app/serial/page.tsx`, `apps/web/app/loi/page.tsx`, `apps/web/app/bao-tri/page.tsx`

**Interfaces:**
- Consumes: Task 1 (không gọi trực tiếp)
- Produces: `DauTrang({ tieuDe, phuDe?, children? }): JSX.Element` — server component, `children` là khu nút bên phải.

- [ ] **Step 1: Tạo `components/DauTrang.tsx`**

```tsx
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
```

- [ ] **Step 2: Áp vào `app/page.tsx`**

Thay khối:

```tsx
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">Máy đã lắp</h1>
        </header>
```

bằng:

```tsx
        <DauTrang
          tieuDe="Máy đã lắp"
          phuDe={`${tong.toLocaleString('vi-VN')} máy · lọc theo sản phẩm, bảo hành, ngày lắp`}
        />
```

Thêm `import { DauTrang } from '@/components/DauTrang'`.

- [ ] **Step 3: Áp vào 5 trang còn lại**

Cùng khuôn: đổi `<header>…<h1>X</h1></header>` thành `<DauTrang tieuDe="X" phuDe={…} />`, thêm import. Phụ đề dùng biến đã có sẵn trong scope từng trang:

- `app/khach-hang/page.tsx` → ``phuDe={`${tong.toLocaleString('vi-VN')} khách`}``
- `app/ticket/page.tsx` → ``phuDe={`${tong.toLocaleString('vi-VN')} ticket`}``
- `app/serial/page.tsx` → `phuDe="Serial trong kho, đã xuất và chờ nhập"`
- `app/loi/page.tsx` → `phuDe="Lõi tới hạn thay theo từng máy"`
- `app/bao-tri/page.tsx` → `phuDe="Gói bảo trì theo hợp đồng · bấm “Đã bảo trì” sau mỗi chuyến"`

Nếu tên biến tổng ở trang nào khác `tong`, dùng đúng tên biến của trang đó — đọc file trước khi sửa, đừng đoán.

- [ ] **Step 4: Kiểm tra kiểu + test**

Run: `cd apps/web && npx tsc --noEmit && npm run test`

Expected: sạch, xanh.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/DauTrang.tsx apps/web/app
git commit -m "style(cskh): đầu trang dùng chung có phụ đề cho các trang danh sách"
```

---

### Task 3: Màn Tổng quan CSKH

Màn mới. Vào khu CSKH hiện rơi thẳng vào bảng 2.400 máy, không nói gì về việc cần làm.

**Files:**
- Create: `apps/web/app/tong-quan/actions.ts`
- Create: `apps/web/app/tong-quan/page.tsx`
- Modify: `apps/web/components/TopNavClient.tsx` (mảng `cskhTrang`)

**Interfaces:**
- Consumes: `DauTrang` (Task 2)
- Produces: `soLieuTongQuan(): Promise<SoLieuTongQuan>` với
  `type SoLieuTongQuan = { bhChoDuyet: number; ticketMo: number; baoTriTuan: number; canDon: number }`

- [ ] **Step 1: Xác nhận tên hàm đếm có thật**

Run: `grep -n "export async function \(searchTickets\|khachCanDon\|maintenanceCounts\|listKhachChoDuyet\)" apps/web/app/actions.ts`

Ghi lại tên thật + kiểu trả về. Tên nào không khớp thì dùng tên thật và sửa Step 2 cho đúng — **không bịa hàm mới, không viết truy vấn mới**.

- [ ] **Step 2: Viết `app/tong-quan/actions.ts`**

```ts
'use server'

import { listKhachChoDuyet, maintenanceCounts, searchTickets, khachCanDon } from '@/app/actions'
import { requireStaff } from '@/lib/supabase'

export type SoLieuTongQuan = {
  bhChoDuyet: number
  ticketMo: number
  baoTriTuan: number
  canDon: number
}

/**
 * Bốn con số của màn Tổng quan. Gọi lại các hàm đếm sẵn có thay vì viết truy vấn
 * mới — số ở đây phải KHỚP số người dùng thấy khi bấm vào từng trang, lệch số là
 * mất tin ngay.
 */
export async function soLieuTongQuan(): Promise<SoLieuTongQuan> {
  await requireStaff()
  const [choDuyet, dem, ticket, canDon] = await Promise.all([
    listKhachChoDuyet(),
    maintenanceCounts(),
    searchTickets('', { trang: 1 }),
    khachCanDon(),
  ])
  return {
    bhChoDuyet: choDuyet.length,
    ticketMo: ticket.tong,
    baoTriTuan: (dem['sắp đến hạn (≤30 ngày)'] ?? 0) + (dem['QUÁ HẠN'] ?? 0),
    canDon: canDon.length,
  }
}
```

- [ ] **Step 3: Xác nhận tên trường của khách chờ duyệt**

Run: `grep -n "KhachChoDuyet" apps/web/app/actions.ts | head`

Dùng đúng tên trường thật cho `id`, `full_name`, `primary_phone` ở Step 4.

- [ ] **Step 4: Viết `app/tong-quan/page.tsx`**

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { coTheVaoCS, laChiKyThuatVien, requireNhanSu } from '@/lib/supabase'
import { listKhachChoDuyet } from '@/app/actions'
import { DauTrang } from '@/components/DauTrang'
import { soLieuTongQuan } from './actions'

export const metadata = { title: 'Tổng quan · GWT CSKH' }
export const dynamic = 'force-dynamic'

const O = [
  { khoa: 'bhChoDuyet', nhan: 'BH chờ kích hoạt', href: '/dang-ky-bh', mau: 'bg-red-500' },
  { khoa: 'ticketMo', nhan: 'Ticket đang mở', href: '/ticket', mau: 'bg-amber-500' },
  { khoa: 'baoTriTuan', nhan: 'Bảo trì cần làm', href: '/bao-tri', mau: 'bg-[#0e8c9a]' },
  { khoa: 'canDon', nhan: 'Data cần dọn', href: '/khach', mau: 'bg-slate-400' },
] as const

export default async function TongQuanPage() {
  await requireNhanSu()
  if (await laChiKyThuatVien()) redirect('/ky-thuat/cua-toi')
  if (!(await coTheVaoCS())) redirect('/work')

  const [so, choDuyet] = await Promise.all([soLieuTongQuan(), listKhachChoDuyet()])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <DauTrang tieuDe="Tổng quan CSKH" phuDe="Việc cần chạm hôm nay" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {O.map((o) => (
            <Link
              key={o.khoa}
              href={o.href}
              prefetch={false}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <span className={`w-[7px] h-[7px] rounded-full ${o.mau}`} />
                {o.nhan}
              </div>
              <div className="mt-1.5 text-[26px] font-bold tracking-tight tabular-nums text-slate-900">
                {so[o.khoa].toLocaleString('vi-VN')}
              </div>
            </Link>
          ))}
        </div>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <h2 className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-900">
            Bảo hành chờ duyệt ({choDuyet.length})
          </h2>
          {choDuyet.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Không có hồ sơ nào chờ duyệt.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {choDuyet.slice(0, 5).map((k) => (
                <li key={k.id} className="px-4 py-3 text-sm text-slate-700">
                  <span className="font-medium">{k.full_name}</span>
                  {k.primary_phone && (
                    <span className="font-mono text-xs text-slate-500"> · {k.primary_phone}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50">
            <Link href="/dang-ky-bh" prefetch={false} className="text-sm font-medium text-[#0a6771] hover:underline">
              Xem tất cả →
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
```

- [ ] **Step 5: Thêm mục vào thanh nav**

Trong `components/TopNavClient.tsx`, mảng `cskhTrang` (nhánh `else` của `chiKyThuat`), thêm **phần tử đầu tiên**:

```tsx
        { nhan: 'Tổng quan', href: '/tong-quan' },
```

Không đổi `cskh.href` — bấm tab CSKH vẫn về `/` như cũ, không làm người quen việc hụt chân.

- [ ] **Step 6: Kiểm tra kiểu + test**

Run: `cd apps/web && npx tsc --noEmit && npm run test`

Expected: sạch, xanh.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/tong-quan apps/web/components/TopNavClient.tsx
git commit -m "feat(cskh): màn Tổng quan gom việc cần làm trong ngày"
```

---

### Task 4: Tách ô Tỉnh/TP ở địa chỉ lắp đặt (lỗi #1)

`components/ChonTinh.tsx` đã có sẵn và đã dùng ở `KhachPicker`. Form đăng ký BH thì địa chỉ lắp vẫn là một ô chữ trơn (`dcLap`), CS gõ lẫn tỉnh vào đó.

**Ràng buộc đã kiểm chứng:** `installed_base` **không có cột tỉnh** — chỉ có `install_address` (chữ trơn), và server action `dangKyBaoHanh` chỉ nhận `install_address`. Vì Global Constraints cấm đổi DB và chữ ký server action, ô tỉnh mới là **ô nhập riêng trên giao diện, giá trị được ghép vào cuối `install_address` khi lưu**. Người dùng hết gõ lẫn, dữ liệu vẫn về đúng một cột như cũ.

**Files:**
- Modify: `apps/web/components/DangKyBHForm.tsx`

**Interfaces:**
- Consumes: `ChonTinh({ value, onChange, className? })` — đã có sẵn, không sửa
- Produces: không có gì cho task sau

- [ ] **Step 1: Thêm state tỉnh**

Cạnh `const [dcLap, setDcLap] = useState('')`, thêm:

```tsx
  const [tinhLap, setTinhLap] = useState('')
```

Và trong phần reset sau khi lưu thành công (dòng có `setDcLap(''); setDungDcKhach(true)`), thêm `setTinhLap('')`.

- [ ] **Step 2: Ghép tỉnh vào địa chỉ khi lưu**

Tìm chỗ tính `dcLapCuoi` (địa chỉ lắp cuối cùng gửi lên). Ngay trước `async function luu()`, thêm:

```tsx
  // Tỉnh là ô riêng trên giao diện cho CS khỏi gõ lẫn, nhưng `installed_base` chỉ
  // có một cột địa chỉ chữ trơn — nên ghép lại khi lưu thay vì đổi schema.
  const diaChiDayDu = [dcLapCuoi.trim(), tinhLap.trim()].filter(Boolean).join(', ')
```

Rồi trong `luu()`, đổi `install_address: dcLapCuoi.trim() || undefined` thành:

```tsx
      install_address: diaChiDayDu || undefined,
```

Nếu tên biến địa chỉ cuối trong file không phải `dcLapCuoi`, dùng đúng tên thật — đọc file trước khi sửa.

- [ ] **Step 3: Thêm ô chọn tỉnh cạnh ô địa chỉ lắp**

Ngay dưới ô nhập `dcLap` (chỉ hiện khi `!dungDcKhach`, tức là khi địa chỉ lắp khác địa chỉ khách):

```tsx
          <div className="mt-2">
            <label className="text-sm font-medium text-slate-700">Tỉnh / TP</label>
            <ChonTinh value={tinhLap} onChange={setTinhLap} />
            <p className="text-xs text-slate-400 mt-1">
              Ô riêng để khỏi gõ lẫn vào địa chỉ — địa chỉ lắp có thể khác địa chỉ khách.
            </p>
          </div>
```

Thêm `import { ChonTinh } from '@/components/ChonTinh'`.

- [ ] **Step 3: Kiểm tra kiểu + test**

Run: `cd apps/web && npx tsc --noEmit && npm run test`

Expected: sạch, xanh.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/DangKyBHForm.tsx
git commit -m "fix(bh): tách ô Tỉnh/TP khỏi ô địa chỉ lắp đặt"
```

---

### Task 5: Nút "＋ Tạo khách" ở menu Khách hàng (lỗi #2)

Hiện chỉ tạo được khách qua đường vòng (ticket / kích hoạt BH). `KhachPicker` đã làm sẵn toàn bộ việc tra SĐT + tạo khách chờ duyệt — chỉ thiếu chỗ gọi.

**Files:**
- Create: `apps/web/components/TaoKhachButton.tsx`
- Modify: `apps/web/app/khach-hang/page.tsx`

**Interfaces:**
- Consumes: `KhachPicker` (đọc props thật ở Step 1), `DauTrang` (Task 2)
- Produces: `TaoKhachButton(): JSX.Element` — client component, không nhận props

- [ ] **Step 1: Đọc chữ ký `KhachPicker`**

Run: `sed -n 20,70p apps/web/components/KhachPicker.tsx`

Ghi lại đúng tên props (`onPick`, và props bắt buộc nào khác) — Step 2 phải khớp.

- [ ] **Step 2: Viết `components/TaoKhachButton.tsx`**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { KhachPicker } from '@/components/KhachPicker'

/**
 * Nút tạo khách ngay trên trang Khách hàng. Trước đây muốn thêm khách phải đi
 * vòng qua ticket hoặc kích hoạt BH — CEO báo là lỗi #2.
 *
 * Không viết lại luồng tạo: bọc thẳng KhachPicker (đã có tra SĐT chống trùng,
 * tạo khách chờ admin duyệt). Tạo xong thì làm mới danh sách.
 */
export function TaoKhachButton() {
  const [mo, setMo] = useState(false)
  const router = useRouter()

  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        className="rounded-[9px] bg-[#b5642a] px-4 py-2 text-sm font-medium text-white hover:bg-[#8a4a1c]"
      >
        ＋ Tạo khách
      </button>

      {mo && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="font-semibold text-slate-900">Tạo khách mới</h2>
              <button
                type="button"
                onClick={() => setMo(false)}
                className="text-slate-400 hover:text-slate-900"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>
            <KhachPicker
              onPick={() => {
                setMo(false)
                router.refresh()
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}
```

Nếu `KhachPicker` cần props khác ngoài `onPick`, truyền đủ theo chữ ký đọc được ở Step 1.

- [ ] **Step 3: Gắn nút vào trang**

Trong `app/khach-hang/page.tsx`, đổi `DauTrang` (đã đặt ở Task 2) thành có `children`:

```tsx
        <DauTrang tieuDe="Khách hàng" phuDe={`${tong.toLocaleString('vi-VN')} khách`}>
          <TaoKhachButton />
        </DauTrang>
```

Thêm import. Nút xuất Excel nếu đang nằm chỗ khác thì để nguyên chỗ cũ, đừng dời.

- [ ] **Step 4: Kiểm tra kiểu + test**

Run: `cd apps/web && npx tsc --noEmit && npm run test`

Expected: sạch, xanh.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/TaoKhachButton.tsx apps/web/app/khach-hang/page.tsx
git commit -m "feat(khach): tạo khách ngay trên trang Khách hàng"
```

---

### Task 6: Cảnh báo SĐT không đúng chuẩn (lỗi #6) — TDD

CEO chốt **cảnh báo, không chặn**: dữ liệu cũ dạng `84…` hoặc thiếu số 0 vẫn phải lưu được, chỉ hiện chữ hổ phách nhắc. Logic đang bị chép ở hai nơi (`app/actions.ts` và `components/KhachPicker.tsx`) — gom về một file có test.

**Files:**
- Create: `apps/web/lib/sdt.ts`
- Create: `apps/web/lib/sdt.test.ts`
- Modify: `apps/web/components/KhachPicker.tsx`, `apps/web/components/CustomerEditor.tsx`

**Interfaces:**
- Consumes: không có
- Produces:
  - `chuanHoaSdt(raw: string | null | undefined): { chuan: string; cuoi9: string; hopLe: boolean }`
  - `sdtChuanMuc(raw: string | null | undefined): boolean` — luật CEO: **đúng 10 số, bắt đầu bằng 0**
  - `canhBaoSdt(raw: string | null | undefined): string | null` — câu cảnh báo, `null` nếu không có gì để nhắc

- [ ] **Step 1: Viết test trước — `lib/sdt.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { chuanHoaSdt, sdtChuanMuc, canhBaoSdt } from './sdt'

describe('chuanHoaSdt', () => {
  it('giữ nguyên SĐT 10 số bắt đầu bằng 0', () => {
    expect(chuanHoaSdt('0900000001').chuan).toBe('0900000001')
  })
  it('đổi 84… và +84… về 0…', () => {
    expect(chuanHoaSdt('84900000001').chuan).toBe('0900000001')
    expect(chuanHoaSdt('+84 900 000 001').chuan).toBe('0900000001')
  })
  it('thêm số 0 cho số 9 chữ số (nguồn Google Sheet)', () => {
    expect(chuanHoaSdt('900000001').chuan).toBe('0900000001')
  })
  it('bỏ mọi ký tự không phải số', () => {
    expect(chuanHoaSdt('090-000.00 01').chuan).toBe('0900000001')
  })
  it('rỗng/null không nổ', () => {
    expect(chuanHoaSdt(null).chuan).toBe('')
    expect(chuanHoaSdt(undefined).hopLe).toBe(false)
  })
  it('cuoi9 là 9 số cuối để đối chiếu', () => {
    expect(chuanHoaSdt('0900000001').cuoi9).toBe('900000001')
  })
})

describe('sdtChuanMuc — luật CEO: đúng 10 số, bắt đầu bằng 0', () => {
  it('đúng chuẩn', () => {
    expect(sdtChuanMuc('0900000001')).toBe(true)
  })
  it('11 số là KHÔNG chuẩn, dù cũ vẫn cho lưu', () => {
    expect(sdtChuanMuc('09000000012')).toBe(false)
  })
  it('84… sau khi chuẩn hoá thành 10 số thì đạt chuẩn', () => {
    expect(sdtChuanMuc('84900000001')).toBe(true)
  })
  it('quá ngắn thì không đạt', () => {
    expect(sdtChuanMuc('091234')).toBe(false)
  })
  it('rỗng thì không đạt', () => {
    expect(sdtChuanMuc('')).toBe(false)
  })
})

describe('canhBaoSdt — cảnh báo chứ không chặn', () => {
  it('SĐT đúng chuẩn thì không cảnh báo', () => {
    expect(canhBaoSdt('0900000001')).toBeNull()
  })
  it('ô rỗng thì không cảnh báo (chỗ khác lo việc bắt buộc)', () => {
    expect(canhBaoSdt('')).toBeNull()
    expect(canhBaoSdt(null)).toBeNull()
  })
  it('nhập 84… thì nhắc dạng chuẩn', () => {
    expect(canhBaoSdt('84900000001')).toContain('0900000001')
  })
  it('số 11 chữ số thì nói rõ là phải 10 số', () => {
    expect(canhBaoSdt('09000000012')).toContain('10 số')
  })
})
```

- [ ] **Step 2: Chạy test cho nó ĐỎ**

Run: `cd apps/web && npm run test -- sdt`

Expected: FAIL — không tìm thấy module `./sdt`.

- [ ] **Step 3: Viết `lib/sdt.ts`**

```ts
/**
 * Một nguồn sự thật cho SĐT của cả app. Trước đây luật này bị chép ở
 * `app/actions.ts` và `components/KhachPicker.tsx`, sửa một chỗ là lệch chỗ kia.
 *
 * CEO chốt 20/08/2026: SĐT chuẩn là **đúng 10 số, bắt đầu bằng 0**. Nhưng dữ liệu
 * cũ có `84…` và số thiếu số 0 đầu, nên đây là **CẢNH BÁO, KHÔNG CHẶN LƯU** —
 * mở hồ sơ cũ ra sửa vẫn lưu được, chỉ hiện chữ nhắc.
 */

/** Chuẩn hoá về `0` + 9 số cuối. Nhận cả `84…`, `+84…`, số dính dấu, thiếu số 0 đầu. */
export function chuanHoaSdt(raw: string | null | undefined): {
  chuan: string
  cuoi9: string
  hopLe: boolean
} {
  let so = (raw ?? '').replace(/\D/g, '')
  if (so.startsWith('84')) so = '0' + so.slice(2)
  else if (so.length === 9) so = '0' + so
  // `hopLe` giữ đúng độ rộng của rào server hiện hành (10 HOẶC 11 số) — đây là
  // ngưỡng "lưu được", cố tình rộng hơn `sdtChuanMuc` để không chặn dữ liệu cũ.
  const hopLe = /^0\d{9,10}$/.test(so)
  const cuoi9 = so.length >= 9 ? so.slice(-9) : so
  return { chuan: so, cuoi9, hopLe }
}

/** Đúng luật CEO: sau khi chuẩn hoá phải là đúng 10 số và bắt đầu bằng 0. */
export function sdtChuanMuc(raw: string | null | undefined): boolean {
  return /^0\d{9}$/.test(chuanHoaSdt(raw).chuan)
}

/**
 * Câu nhắc hiện dưới ô nhập. `null` = không có gì để nhắc.
 * Ô rỗng KHÔNG cảnh báo ở đây — việc "bắt buộc nhập" là của từng form.
 */
export function canhBaoSdt(raw: string | null | undefined): string | null {
  const goc = (raw ?? '').trim()
  if (goc === '') return null
  if (sdtChuanMuc(goc)) return null

  const { chuan } = chuanHoaSdt(goc)
  if (/^0\d{9}$/.test(chuan)) return `Nên ghi thành ${chuan} — SĐT chuẩn là 10 số bắt đầu bằng 0.`
  return 'SĐT chuẩn là 10 số bắt đầu bằng 0 (vd 0900000001). Vẫn lưu được, nhưng nên sửa lại.'
}
```

- [ ] **Step 4: Chạy test cho nó XANH**

Run: `cd apps/web && npm run test -- sdt`

Expected: PASS toàn bộ.

- [ ] **Step 5: Cắm cảnh báo vào `KhachPicker`**

Bỏ hàm `sdtHopLe` viết tay ở đầu file, thay bằng:

```tsx
import { canhBaoSdt, chuanHoaSdt } from '@/lib/sdt'

const sdtHopLe = (raw: string) => chuanHoaSdt(raw).hopLe
```

Rồi thêm dòng cảnh báo ngay dưới ô nhập SĐT, cạnh chỗ báo lỗi đang có:

```tsx
          {canhBaoSdt(f.primary_phone) && (
            <p className="text-xs text-amber-600 mt-1">{canhBaoSdt(f.primary_phone)}</p>
          )}
```

**Không** đổi điều kiện `disabled` của nút lưu — cảnh báo không được chặn.

- [ ] **Step 6: Cắm cảnh báo vào `CustomerEditor`**

Thêm cùng khối cảnh báo dưới ô `primary_phone` và dưới ô SĐT liên hệ mới, dùng `canhBaoSdt`. Không đổi `if (!np.phone.trim())` — đó là luật bắt buộc nhập, khác chuyện đúng chuẩn.

- [ ] **Step 7: Kiểm tra kiểu + toàn bộ test**

Run: `cd apps/web && npx tsc --noEmit && npm run test`

Expected: sạch, xanh (kể cả test cũ).

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/sdt.ts apps/web/lib/sdt.test.ts apps/web/components/KhachPicker.tsx apps/web/components/CustomerEditor.tsx
git commit -m "feat(khach): cảnh báo SĐT không đúng chuẩn 10 số, không chặn lưu"
```

---

### Task 7: Hồ sơ khách 360 — đầu trang cố định + tab

Trang đang xếp 5 khối dọc, khách nhiều máy phải cuộn rất dài.

**Files:**
- Create: `apps/web/components/KhachTabs.tsx`
- Modify: `apps/web/app/khach/[id]/page.tsx`

**Interfaces:**
- Consumes: các khối sẵn có (`CustomerEditor`, `GanKenh`, `TicketList`, `GopKhachButton`, `WarrantyBadge`, `vnDate`, `NutQuayLai`)
- Produces: `KhachTabs({ tabs }: { tabs: { khoa: string; nhan: string; noiDung: ReactNode }[] }): JSX.Element`

- [ ] **Step 1: Viết `components/KhachTabs.tsx`**

```tsx
'use client'

import { useState, type ReactNode } from 'react'

/**
 * Tab cho hồ sơ khách. Chỉ lo việc bật/tắt — nội dung từng tab vẫn do server
 * component dựng rồi truyền vào qua `noiDung`, nên không có gì bị kéo xuống client.
 *
 * Render HẾT mọi tab rồi ẩn bằng thuộc tính `hidden`, không tháo khỏi cây: gõ dở
 * trong ô sửa thông tin mà bấm sang tab khác rồi quay lại thì chữ vẫn còn.
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
```

- [ ] **Step 2: Xác nhận trường của `customer`**

Run: `grep -n "customer_code\|province" apps/web/app/actions.ts | head`

Trường nào không có thì bỏ khỏi đầu trang ở Step 3 chứ đừng bịa.

- [ ] **Step 3: Dựng lại `app/khach/[id]/page.tsx`**

Giữ nguyên toàn bộ phần lấy dữ liệu ở đầu hàm (`getCustomer`, `Promise.all`, `btDaXong`…). Chỉ thay phần `return`. Trước `return`, khai báo 4 biến JSX bằng cách **bê nguyên JSX của 4 section cũ vào** — không viết lại, không đổi một dòng logic nào bên trong (kể cả phần tính `doNuoc`):

```tsx
  const khoiMay = (
    <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      {/* … nguyên nội dung section "Máy đã lắp" cũ, bỏ dòng <h2> vì tab đã nói rồi … */}
    </section>
  )

  const khoiTicket = (
    <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <TicketList tickets={tickets} empty="Khách này chưa có ticket nào." />
    </section>
  )

  const khoiBaoTri = (
    <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      {/* … nguyên nội dung section "Lịch bảo trì" cũ, giữ cả nút "＋ Tạo lịch bảo trì" … */}
    </section>
  )

  const khoiThongTin = (
    <div className="space-y-4">
      <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-medium text-slate-900 mb-1">Kênh / đối tác</h2>
        <p className="text-xs text-slate-400 mb-2">
          Đại lý/KTS/KOL quản lý khách này (taxonomy chung với Sales).
        </p>
        <GanKenh customerId={customer.id} channelId={customer.channel_id} kenh={kenh} />
      </section>
      <CustomerEditor customer={customer} contacts={contacts} />
    </div>
  )
```

Rồi `return`:

```tsx
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        <NutQuayLai macDinh="/" />

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4 flex-wrap">
            <span className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-[#fbeadd] text-lg font-bold text-[#8a4a1c]">
              {(customer.full_name ?? '?').trim().slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-[200px] flex-1">
              <h1 className="text-xl font-semibold text-slate-900">{customer.full_name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
                {customer.customer_code && <span className="font-mono text-xs">{customer.customer_code}</span>}
                {customer.primary_phone && <span className="font-mono">· {customer.primary_phone}</span>}
                {customer.province && <span>· {customer.province}</span>}
              </div>
            </div>
            <GopKhachButton giuId={customer.id} tenGiu={customer.full_name} />
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
            {[
              { n: String(machines.length), t: 'Máy đã lắp' },
              { n: String(tickets.length), t: 'Ticket' },
              { n: `${btDaXong}/${baoTri.length}`, t: 'Bảo trì đã làm' },
              { n: String(contacts.length), t: 'Liên hệ' },
            ].map((o) => (
              <div key={o.t} className="bg-slate-50 px-3 py-2.5 text-center">
                <div className="text-lg font-bold tabular-nums text-slate-900">{o.n}</div>
                <div className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                  {o.t}
                </div>
              </div>
            ))}
          </div>
        </section>

        <KhachTabs
          tabs={[
            { khoa: 'may', nhan: `Máy (${machines.length})`, noiDung: khoiMay },
            { khoa: 'ticket', nhan: `Ticket (${tickets.length})`, noiDung: khoiTicket },
            { khoa: 'baotri', nhan: `Bảo trì (${baoTri.length})`, noiDung: khoiBaoTri },
            { khoa: 'thongtin', nhan: 'Thông tin & kênh', noiDung: khoiThongTin },
          ]}
        />
      </div>
    </main>
  )
```

Thêm `import { KhachTabs } from '@/components/KhachTabs'`.

- [ ] **Step 4: Kiểm tra kiểu + test**

Run: `cd apps/web && npx tsc --noEmit && npm run test`

Expected: sạch, xanh.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/KhachTabs.tsx "apps/web/app/khach/[id]/page.tsx"
git commit -m "style(khach): hồ sơ khách gom về đầu trang + tab thay vì 5 khối dọc"
```

---

### Task 8: Đăng ký BH — khách chờ duyệt lên đầu (lỗi #9)

CEO: "ko để danh sách khách cần duyệt kích hoạt ở dưới trông rất buồn cười".

**Files:**
- Modify: `apps/web/app/dang-ky-bh/page.tsx`

**Interfaces:**
- Consumes: `KhachChoDuyetList({ items })` — giữ nguyên chữ ký, không sửa component; `DauTrang` (Task 2)
- Produces: không có

- [ ] **Step 1: Đảo thứ tự + đổi khối chờ duyệt thành banner**

Thay phần `return` của `app/dang-ky-bh/page.tsx`:

```tsx
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <DauTrang tieuDe="Đăng ký bảo hành" phuDe="Gắn serial cho khách và kích hoạt bảo hành" />

        {quanLy && choDuyet.length > 0 && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h2 className="text-sm font-semibold text-amber-900">
              {choDuyet.length} khách chờ duyệt kích hoạt
            </h2>
            <p className="text-xs text-amber-800/80 mt-0.5 mb-3">
              Cấp quản lý duyệt trước khi máy vào bảo hành.
            </p>
            <KhachChoDuyetList items={choDuyet} />
          </section>
        )}

        <p className="text-sm bg-sky-50 text-sky-900 rounded-lg px-3 py-2">
          Gắn máy (serial) cho khách và kích hoạt bảo hành. Chọn <strong>1 máy lẻ</strong> hoặc
          <strong> 1 bộ combo</strong> (WH15A/WH30A…). Thông tin máy tự lấy từ kho serial;
          khách mới tạo được ngay nhưng <strong>chờ admin duyệt</strong>.
        </p>
        <ChonKieuLap />
      </div>
    </main>
  )
```

Thêm `import { DauTrang } from '@/components/DauTrang'`.

Chú ý: khối chờ duyệt giờ **chỉ hiện khi có việc** (`choDuyet.length > 0`) — trước đây luôn hiện kể cả rỗng, chiếm chỗ vô ích.

- [ ] **Step 2: Kiểm tra kiểu + test**

Run: `cd apps/web && npx tsc --noEmit && npm run test`

Expected: sạch, xanh.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/dang-ky-bh/page.tsx
git commit -m "fix(bh): đưa khách chờ duyệt lên đầu trang đăng ký bảo hành"
```

---

### Task 9: Calendar bảo trì bấm được + nút "Tháng này" (lỗi #8, #10) — TDD

CEO: "calendar view ko click vào xem các lịch bảo trì trong tháng chi tiết được" và "cho chọn ngay xem tháng này cho nhanh".

Tách phần tính lưới ra file riêng để test được — hiện đang trộn trong JSX.

**Files:**
- Create: `apps/web/lib/lichThang.ts`
- Create: `apps/web/lib/lichThang.test.ts`
- Modify: `apps/web/components/LichBaoTriThang.tsx`
- Modify: `apps/web/app/bao-tri/page.tsx`

**Interfaces:**
- Consumes: `LuotThang` từ `@/app/actions`
- Produces:
  - `thangKe(thang: string, buoc: number): string`
  - `thangHienTai(): string`
  - `oCuaThang(thang: string): (number | null)[]` — lưới đã đệm, tuần bắt đầu Thứ 2, độ dài chia hết cho 7

- [ ] **Step 1: Viết test trước — `lib/lichThang.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { thangKe, oCuaThang } from './lichThang'

describe('thangKe', () => {
  it('lùi một tháng', () => {
    expect(thangKe('2026-09', -1)).toBe('2026-08')
  })
  it('tiến một tháng', () => {
    expect(thangKe('2026-09', 1)).toBe('2026-10')
  })
  it('lùi qua đầu năm', () => {
    expect(thangKe('2026-01', -1)).toBe('2025-12')
  })
  it('tiến qua cuối năm', () => {
    expect(thangKe('2026-12', 1)).toBe('2027-01')
  })
  it('tháng luôn có 2 chữ số', () => {
    expect(thangKe('2026-10', -1)).toBe('2026-09')
  })
})

describe('oCuaThang', () => {
  it('số ô luôn chia hết cho 7', () => {
    expect(oCuaThang('2026-09').length % 7).toBe(0)
    expect(oCuaThang('2026-02').length % 7).toBe(0)
  })
  it('có đủ số ngày của tháng', () => {
    expect(oCuaThang('2026-09').filter((o) => o !== null)).toHaveLength(30)
    expect(oCuaThang('2026-02').filter((o) => o !== null)).toHaveLength(28)
  })
  it('tuần bắt đầu Thứ 2 — 01/09/2026 là Thứ 3 nên có đúng 1 ô đệm trước', () => {
    const o = oCuaThang('2026-09')
    expect(o[0]).toBeNull()
    expect(o[1]).toBe(1)
  })
  it('tháng bắt đầu đúng Thứ 2 thì không đệm — 01/06/2026 là Thứ 2', () => {
    expect(oCuaThang('2026-06')[0]).toBe(1)
  })
})
```

- [ ] **Step 2: Chạy test cho nó ĐỎ**

Run: `cd apps/web && npm run test -- lichThang`

Expected: FAIL — không tìm thấy module `./lichThang`.

- [ ] **Step 3: Viết `lib/lichThang.ts`**

```ts
/**
 * Tính lưới lịch tháng. Tách khỏi component vì phần này là số học thuần
 * (đệm đầu tuần, tháng nhuận, nhảy năm) — chỗ dễ sai nhất mà lại dễ test nhất.
 * Tuần bắt đầu Thứ 2 theo lệ Việt Nam.
 */

/** Nhảy `buoc` tháng từ `thang` (dạng `YYYY-MM`). Âm là lùi. */
export function thangKe(thang: string, buoc: number): string {
  const [y, m] = thang.split('-').map(Number)
  const idx = y * 12 + (m - 1) + buoc
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`
}

/** Tháng hiện tại dạng `YYYY-MM` — cho nút "Tháng này". */
export function thangHienTai(): string {
  return new Date().toISOString().slice(0, 7)
}

/** Các ô của lưới: `null` là ô đệm, số là ngày. Độ dài luôn chia hết cho 7. */
export function oCuaThang(thang: string): (number | null)[] {
  const [y, m] = thang.split('-').map(Number)
  const soNgay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const thu1 = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7 // 0 = Thứ 2

  const o: (number | null)[] = []
  for (let i = 0; i < thu1; i++) o.push(null)
  for (let d = 1; d <= soNgay; d++) o.push(d)
  while (o.length % 7 !== 0) o.push(null)
  return o
}
```

- [ ] **Step 4: Chạy test cho nó XANH**

Run: `cd apps/web && npm run test -- lichThang`

Expected: PASS toàn bộ.

- [ ] **Step 5: Cho ô ngày bấm được + thêm nút "Tháng này"**

Trong `components/LichBaoTriThang.tsx`:

- Bỏ hàm `thangKe` viết tay và phần tính `soNgay`/`thu1`/mảng `o`; import `thangKe`, `thangHienTai`, `oCuaThang` từ `@/lib/lichThang`.
- Đổi chữ ký thành `{ thang, rows, ngay }: { thang: string; rows: LuotThang[]; ngay?: string }`.
- Khai báo cạnh `theoNgay`: `const luotCuaNgay = ngay ? rows.filter((r) => r.due_date === ngay) : []`.
- Bọc mỗi ô có ngày bằng `<Link href={...}>` với href `` `/bao-tri?tt=lich&thang=${thang}&ngay=${thang}-${String(d).padStart(2, '0')}` ``; ô đệm giữ `<div>` như cũ.
- Ô đang chọn (ngày khớp `ngay`) thêm lớp `ring-2 ring-inset ring-[#0e8c9a] bg-[#e2f2f3]`.
- Cạnh hai nút `←`/`→`, thêm:

```tsx
          <Link
            href={`/bao-tri?tt=lich&thang=${thangHienTai()}`}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm hover:bg-slate-50"
          >
            Tháng này
          </Link>
```

- Dưới lưới, khi có `ngay`, hiện panel danh sách lượt của đúng ngày đó:

```tsx
      {ngay && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <h3 className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-900">
            Ngày {ngay.slice(8, 10)}/{ngay.slice(5, 7)}/{ngay.slice(0, 4)} · {luotCuaNgay.length} lượt
          </h3>
          {luotCuaNgay.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">
              Không có lượt bảo trì nào ngày này.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {luotCuaNgay.map((r) => (
                <li key={r.visit_id} className="px-4 py-3 text-sm text-slate-700">
                  <span className="font-medium">{r.customer_name ?? r.bo_may ?? '—'}</span>
                  {r.lan_thu ? <span className="text-slate-400"> · lần {r.lan_thu}</span> : null}
                  {r.completed_at ? (
                    <span className="ml-2 text-xs text-emerald-700">✓ đã làm</span>
                  ) : (
                    <span className="ml-2 text-xs text-amber-600">chưa làm</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
```

- [ ] **Step 6: Cho trang nhận `?ngay=`**

Trong `app/bao-tri/page.tsx`:

- Thêm `ngay?: string` vào kiểu `searchParams` và vào dòng destructure.
- Trên `return`, thêm: `const ngayOk = /^\d{4}-\d{2}-\d{2}$/.test(ngay ?? '') ? ngay : undefined` — chặn giá trị rác trong URL.
- Đổi `<LichBaoTriThang thang={thang} rows={lichRows} />` thành `<LichBaoTriThang thang={thang} rows={lichRows} ngay={ngayOk} />`.

- [ ] **Step 7: Kiểm tra kiểu + toàn bộ test + lint + dựng thử**

Run: `cd apps/web && npx tsc --noEmit && npm run test && npm run lint && npm run build`

Expected: tsc sạch, test xanh hết, lint sạch, build thành công.

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/lichThang.ts apps/web/lib/lichThang.test.ts apps/web/components/LichBaoTriThang.tsx apps/web/app/bao-tri/page.tsx
git commit -m "feat(bao-tri): calendar bấm vào ngày ra danh sách chuyến + nút Tháng này"
```

---

## Kiểm tra cuối (sau Task 9)

- [ ] `cd apps/web && npx tsc --noEmit && npm run test && npm run lint && npm run build` — tất cả sạch.
- [ ] `npm run dev` rồi mở lần lượt và xem bằng mắt: `/tong-quan`, `/`, `/khach-hang`, `/khach/<id>`, `/ticket`, `/dang-ky-bh`, `/bao-tri?tt=lich` — không trang nào vỡ bố cục, không lỗi console.
- [ ] Đẩy nhánh, lấy link preview Vercel, ghi vào `BACKLOG.md` mục ⏳ CHỜ TÔI CHECK kèm danh sách việc CEO cần bấm thử.
