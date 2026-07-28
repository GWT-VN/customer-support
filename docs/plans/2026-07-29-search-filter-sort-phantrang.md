# Search / Filter / Sort / Phân trang — kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tìm kiếm không dấu, lọc, sắp xếp và phân trang cho 5 trang danh sách của app CSKH.

**Architecture:** Chuẩn hoá bỏ dấu ở **cả hai đầu** — cột sinh sẵn `*_kd` trong database (có index trigram) và hàm thuần `boDau()` chuẩn hoá chuỗi người dùng gõ. Mọi trạng thái lọc/sắp xếp/trang nằm trên URL để gửi link cho nhau được. Tên cột sắp xếp luôn đi qua **danh sách trắng** trước khi vào `.order()`.

**Tech Stack:** Next.js 16.2.10 (App Router, Turbopack) · React 19 · Supabase (`supabase-js` 2.110) · Postgres `unaccent` + `pg_trgm` · Tailwind 4 · Vitest

## Global Constraints

- Project Supabase đích: **GWT-SalesTracking** `bwzmqfbcgouhvhoslmmm`.
- **Chỉ đường ĐỌC.** Không `insert`/`update`/`delete` lên dữ liệu khách, máy, ticket, bảo trì, lịch lõi. Migration chỉ thêm cột sinh sẵn, index, và tạo lại view.
- **Giữ nguyên bảng đang hiển thị**: không đổi cột, thứ tự cột, badge, link. Chỉ thêm thanh điều khiển phía trên và thanh phân trang phía dưới. Trang chi tiết không đụng.
- Bảng mới/cột mới: RLS đã bật ở bảng gốc, không thêm policy nào.
- `AGENTS.md` bắt buộc: đọc guide trong `node_modules/next/dist/docs/` trước khi viết code Next.
- Next 16 gọi middleware là **Proxy** (`proxy.ts`, export hàm `proxy`).
- Comment, thông báo, tên biến nghiệp vụ viết **tiếng Việt** theo phong cách repo.
- Repo dùng codegraph: tra `codegraph_explore` trước khi grep/read.
- Mỗi task kết thúc bằng `npx vitest run` + `npm run lint` + `npm run build` đều sạch, rồi mới commit.

---

## Cấu trúc file

| File | Trách nhiệm |
|---|---|
| `supabase-cskh/migrations/06_tim_kiem_khong_dau.sql` | *Tạo.* `unaccent` + `pg_trgm`, hàm `khong_dau()` IMMUTABLE, cột sinh sẵn + index trigram, tạo lại view để lộ cột |
| `app-cskh/lib/timkiem.ts` | *Tạo.* **Hàm thuần**: `boDau()`, `chuanHoaTuKhoa()`, `sapXepHopLe()` (danh sách trắng cột) |
| `app-cskh/lib/timkiem.test.ts` | *Tạo.* Unit test cho 3 hàm trên |
| `app-cskh/app/actions.ts` | *Sửa.* Các hàm truy vấn nhận thêm `sapXep`, `trang`; trả kèm `tong` |
| `app-cskh/components/OTimKiem.tsx` | *Tạo.* Ô tìm kiếm gõ-tới-đâu-lọc-tới-đó (debounce 300ms, `router.replace`) |
| `app-cskh/components/ThanhDangLoc.tsx` | *Tạo.* "Đang lọc: … · 12/465 · Xoá lọc" |
| `app-cskh/components/PhanTrang.tsx` | *Tạo.* Nút chuyển trang, giữ nguyên các tham số lọc khác |
| `app-cskh/components/TieuDeCotSapXep.tsx` | *Tạo.* Tiêu đề cột bấm được + mũi tên chiều sắp xếp |
| `app-cskh/app/{,ticket,loi,khach,nhom-loi}/page.tsx` | *Sửa.* Gắn 4 component trên; **không đụng phần `<table>`** |
| `app-cskh/app/{may/[serial],khach/[id],ticket/[code],nhom-loi/[code]}/loading.tsx` | *Tạo.* Khung xương khi đang tải |

**Vì sao tách `lib/timkiem.ts` thuần:** giống `lib/auth.ts` và `lib/quyen.ts` đã làm — phần quyết định (bỏ dấu, danh sách trắng cột) tách khỏi phần đọc DB nên test được thật. Danh sách trắng cột là chốt chặn injection, bắt buộc phải có test.

---

## Task 1: Database — bỏ dấu + index trigram

**Files:**
- Create: `supabase-cskh/migrations/06_tim_kiem_khong_dau.sql`

**Interfaces:**
- Produces: hàm `public.khong_dau(text) -> text`; cột `ten_kd` trên `cs_customers`, `dia_chi_kd` trên `cs_customers`; view `v_installed_base` và `v_tickets` lộ thêm các cột `_kd`

- [ ] **Step 1: Viết migration**

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Tìm kiếm KHÔNG DẤU.
--
-- Vấn đề: đang dùng ilike thuần nên gõ `huong` KHÔNG ra `Hương`, gõ `hung yen`
-- không ra `Hưng Yên`. Tên khách trong DB lại có chỗ gõ thiếu dấu, chỗ đủ dấu.
--
-- Cách làm: chuẩn hoá ở CẢ HAI ĐẦU — cột sinh sẵn bỏ dấu trong DB (có index
-- trigram) và hàm boDau() chuẩn hoá chuỗi người dùng gõ (lib/timkiem.ts).
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- unaccent() KHÔNG immutable (phụ thuộc dictionary hiện hành) nên không dùng
-- thẳng trong cột sinh sẵn/index được. Bọc lại với dictionary chỉ định rõ.
-- LƯU Ý: chữ 'đ' KHÔNG bỏ dấu được bằng unaccent — phải thay tay.
-- (Bài học đã ghi trong CHECKLIST: NFD không decompose U+0111.)
create or replace function public.khong_dau(t text)
returns text
language sql
immutable strict parallel safe
as $$
  select lower(replace(replace(public.unaccent('public.unaccent', t), 'đ', 'd'), 'Đ', 'D'))
$$;

comment on function public.khong_dau(text) is
  'Bo dau tieng Viet + ve chu thuong. IMMUTABLE de dung duoc trong cot sinh san va index.';

alter table public.cs_customers
  add column if not exists ten_kd text
    generated always as (public.khong_dau(full_name)) stored;

alter table public.cs_customers
  add column if not exists dia_chi_kd text
    generated always as (public.khong_dau(coalesce(address, '') || ' ' || coalesce(province, ''))) stored;

create index if not exists idx_cs_customers_ten_kd
  on public.cs_customers using gin (ten_kd gin_trgm_ops);
create index if not exists idx_cs_customers_dia_chi_kd
  on public.cs_customers using gin (dia_chi_kd gin_trgm_ops);
```

- [ ] **Step 2: Tra cấu trúc view hiện tại TRƯỚC khi tạo lại**

Chạy qua MCP Supabase `execute_sql` với `project_id = bwzmqfbcgouhvhoslmmm`:

```sql
select viewname, definition from pg_views
where schemaname = 'public' and viewname in ('v_installed_base', 'v_tickets');
```

Chép định nghĩa hiện tại ra, **thêm** `c.ten_kd`, `c.dia_chi_kd` vào danh sách cột — giữ nguyên mọi cột cũ, không đổi tên, không đổi thứ tự. App đang `select('*')` nên mất một cột là vỡ trang.

- [ ] **Step 3: Áp migration**

Dùng MCP `apply_migration`, tên `tim_kiem_khong_dau`. View tạo lại phải có `security_invoker = true` theo quy ước repo.

- [ ] **Step 4: Verify bằng SQL, không tin migration chạy xong là xong**

```sql
select
  public.khong_dau('Nguyễn Thị Hương')                                as thu_bo_dau,
  public.khong_dau('Đoàn Văn Đức')                                    as thu_chu_d,
  (select count(*) from public.cs_customers where ten_kd like '%huong%') as tim_duoc_huong,
  (select count(*) from pg_indexes where indexname = 'idx_cs_customers_ten_kd') as co_index;
```

Kỳ vọng: `nguyen thi huong` · `doan van duc` · `tim_duoc_huong > 0` · `co_index = 1`.
Nếu `thu_chu_d` còn chữ `đ` thì phần thay tay chưa chạy — dừng, sửa, chạy lại.

- [ ] **Step 5: Verify view không mất cột**

```sql
select count(*) as so_cot from information_schema.columns
where table_schema='public' and table_name='v_installed_base';
```

So với số cột trước khi sửa (đếm trước ở Step 2). Phải **nhiều hơn đúng số cột vừa thêm**, không được ít đi.

- [ ] **Step 6: Commit**

```bash
git add supabase-cskh/migrations/06_tim_kiem_khong_dau.sql
git commit -m "feat(db): tìm kiếm không dấu — unaccent + pg_trgm + cột sinh sẵn"
```

---

## Task 2: Hàm thuần bỏ dấu + danh sách trắng cột sắp xếp

**Files:**
- Create: `app-cskh/lib/timkiem.ts`, `app-cskh/lib/timkiem.test.ts`

**Interfaces:**
- Produces: `boDau(s: string): string` · `chuanHoaTuKhoa(q: string): string` · `sapXepHopLe(cot: string | undefined, chieu: string | undefined, choPhep: readonly string[], macDinh: SapXep): SapXep` · `type SapXep = { cot: string; tang: boolean }`

- [ ] **Step 1: Viết test TRƯỚC (phải fail)**

Tạo `app-cskh/lib/timkiem.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { boDau, chuanHoaTuKhoa, sapXepHopLe } from './timkiem'

describe('boDau', () => {
  it('bỏ dấu tiếng Việt và về chữ thường', () => {
    expect(boDau('Nguyễn Thị Hương')).toBe('nguyen thi huong')
    expect(boDau('Hưng Yên')).toBe('hung yen')
  })

  it('chữ đ phải thành d — NFD không tách được U+0111', () => {
    expect(boDau('Đoàn Văn Đức')).toBe('doan van duc')
    expect(boDau('đ')).toBe('d')
  })

  it('chuỗi đã không dấu thì giữ nguyên', () => {
    expect(boDau('nguyen van a')).toBe('nguyen van a')
  })

  it('chuỗi rỗng và khoảng trắng', () => {
    expect(boDau('')).toBe('')
    expect(boDau('  ')).toBe('  ')
  })
})

describe('chuanHoaTuKhoa', () => {
  it('bỏ dấu, cắt khoảng trắng thừa hai đầu', () => {
    expect(chuanHoaTuKhoa('  Hương  ')).toBe('huong')
  })

  it('gộp khoảng trắng giữa các từ', () => {
    expect(chuanHoaTuKhoa('Hưng    Yên')).toBe('hung yen')
  })
})

describe('sapXepHopLe — chốt chặn injection', () => {
  const CHO_PHEP = ['install_date', 'serial', 'customer_name'] as const
  const MAC_DINH = { cot: 'install_date', tang: false }

  it('cột hợp lệ thì dùng', () => {
    expect(sapXepHopLe('serial', 'asc', CHO_PHEP, MAC_DINH))
      .toEqual({ cot: 'serial', tang: true })
  })

  it('cột LẠ bị bỏ qua, rơi về mặc định', () => {
    expect(sapXepHopLe('mat_khau', 'asc', CHO_PHEP, MAC_DINH)).toEqual(MAC_DINH)
  })

  it('chuỗi tấn công cũng rơi về mặc định', () => {
    expect(sapXepHopLe('id; drop table cs_customers', 'asc', CHO_PHEP, MAC_DINH))
      .toEqual(MAC_DINH)
  })

  it('thiếu tham số thì dùng mặc định', () => {
    expect(sapXepHopLe(undefined, undefined, CHO_PHEP, MAC_DINH)).toEqual(MAC_DINH)
  })

  it('chiều chỉ nhận asc/desc, khác đi coi như desc', () => {
    expect(sapXepHopLe('serial', 'lung tung', CHO_PHEP, MAC_DINH))
      .toEqual({ cot: 'serial', tang: false })
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

```bash
npm --prefix app-cskh test
```

Kỳ vọng: fail vì `./timkiem` chưa tồn tại.

- [ ] **Step 3: Viết `lib/timkiem.ts`**

```ts
/**
 * Tìm kiếm và sắp xếp — HÀM THUẦN, không đụng DB, không import gì.
 *
 * boDau() phải khớp ĐÚNG với hàm khong_dau() dưới Postgres
 * (supabase-cskh/migrations/06_tim_kiem_khong_dau.sql). Lệch nhau là gõ ra
 * kết quả rỗng mà không ai hiểu vì sao.
 */

export function boDau(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // bỏ dấu thanh + dấu mũ
    .replace(/đ/g, 'd')               // U+0111 KHÔNG decompose được bằng NFD
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

/** Chuẩn hoá chuỗi người dùng gõ trước khi đưa vào truy vấn. */
export function chuanHoaTuKhoa(q: string): string {
  return boDau(q).trim().replace(/\s+/g, ' ')
}

export type SapXep = { cot: string; tang: boolean }

/**
 * Cột sắp xếp lấy từ URL mà đưa thẳng vào .order() là lỗ hổng.
 * Ngoài danh sách trắng thì bỏ qua, rơi về mặc định.
 */
export function sapXepHopLe(
  cot: string | undefined,
  chieu: string | undefined,
  choPhep: readonly string[],
  macDinh: SapXep
): SapXep {
  if (!cot || !choPhep.includes(cot)) return macDinh
  return { cot, tang: chieu === 'asc' }
}
```

- [ ] **Step 4: Chạy test, xác nhận PASS**

```bash
npm --prefix app-cskh test
```

Kỳ vọng: toàn bộ test mới pass, và 16 test sẵn có (`auth.test.ts`, `quyen.test.ts`) vẫn xanh.

- [ ] **Step 5: Verify `boDau()` khớp `khong_dau()` trên DB thật**

Chạy qua MCP `execute_sql`:

```sql
select public.khong_dau('Nguyễn Thị Hương') as db_ra;
```

Phải bằng đúng `'nguyen thi huong'` — trùng kết quả test JS ở Step 1. Lệch là dừng lại sửa cho khớp, đây là lỗi âm thầm khó truy nhất của cả plan này.

- [ ] **Step 6: Commit**

```bash
git add app-cskh/lib/timkiem.ts app-cskh/lib/timkiem.test.ts
git commit -m "feat(tim-kiem): hàm thuần bỏ dấu + danh sách trắng cột sắp xếp"
```

---

## Task 3: Truy vấn nhận tìm-kiếm-không-dấu, sắp xếp, phân trang

**Files:**
- Modify: `app-cskh/app/actions.ts` — `searchMachines`, `searchTickets`, `coreForecast`, `listToFix`

**Interfaces:**
- Consumes: `chuanHoaTuKhoa`, `sapXepHopLe`, `type SapXep` (Task 2); cột `ten_kd`, `dia_chi_kd` (Task 1)
- Produces: `type KetQuaTrang<T> = { rows: T[]; tong: number; trang: number; soTrang: number }`; `searchMachines(q, tuyChon?)`, `searchTickets(q, state?, onlyKhan?, mineId?, tuyChon?)`, `coreForecast(tinhTrang, q, tuyChon?)`, `listToFix(tuyChon?)` — mỗi hàm trả `KetQuaTrang<...>` thay vì mảng trần

- [ ] **Step 1: Đọc mã hiện tại bằng codegraph, KHÔNG grep**

```
codegraph_explore("searchMachines searchTickets coreForecast listToFix")
```

Ghi lại đúng chữ ký và kiểu trả về hiện tại — 5 nơi gọi các hàm này (`app/page.tsx`, `app/ticket/page.tsx`, `app/loi/page.tsx`, `app/khach/page.tsx`, `components/LoiCuaMay.tsx`) đều phải sửa theo.

- [ ] **Step 2: Thêm kiểu và hằng số dùng chung vào đầu `actions.ts`**

```ts
import { chuanHoaTuKhoa, sapXepHopLe, type SapXep } from '@/lib/timkiem'

export const MOI_TRANG = 50

export type KetQuaTrang<T> = {
  rows: T[]
  tong: number
  trang: number
  soTrang: number
}

export type TuyChonDanhSach = {
  trang?: number
  cot?: string
  chieu?: string
}

/** Cột được phép sắp xếp — ngoài danh sách này bị bỏ qua (chống injection). */
export const COT_MAY = ['install_date', 'serial', 'customer_name', 'product_name'] as const
export const COT_TICKET = ['created_at', 'ticket_code', 'state', 'customer_name'] as const
export const COT_LOI = ['han_som', 'serial', 'customer_name'] as const
export const COT_KHACH = ['full_name', 'province'] as const
```

- [ ] **Step 3: Sửa `searchMachines` — tìm không dấu + phân trang + sắp xếp**

Giữ nguyên mọi cột `select`, chỉ đổi phần lọc/đếm/phân trang:

```ts
export async function searchMachines(
  q: string,
  tuyChon: TuyChonDanhSach = {}
): Promise<KetQuaTrang<Machine>> {
  await requireStaff()
  const sx = sapXepHopLe(tuyChon.cot, tuyChon.chieu, COT_MAY, {
    cot: 'install_date', tang: false,
  })
  const trang = Math.max(1, tuyChon.trang ?? 1)
  const tu = (trang - 1) * MOI_TRANG

  let truyVan = dataClient()
    .from('v_installed_base')
    .select('*', { count: 'exact' })

  const kw = chuanHoaTuKhoa(q)
  if (kw) {
    // ten_kd/dia_chi_kd đã bỏ dấu sẵn trong DB; serial và SĐT vốn không dấu
    truyVan = truyVan.or(
      `ten_kd.ilike.%${kw}%,dia_chi_kd.ilike.%${kw}%,` +
      `serial.ilike.%${kw}%,primary_phone.ilike.%${kw}%`
    )
  }

  const { data, error, count } = await truyVan
    .order(sx.cot, { ascending: sx.tang, nullsFirst: false })
    .range(tu, tu + MOI_TRANG - 1)
  if (error) throw new Error(error.message)

  const tong = count ?? 0
  return {
    rows: (data ?? []) as Machine[],
    tong,
    trang,
    soTrang: Math.max(1, Math.ceil(tong / MOI_TRANG)),
  }
}
```

⚠️ Ký tự `%`, `,`, `(`, `)` trong `kw` phá cú pháp `.or()` của PostgREST. `chuanHoaTuKhoa` đã bỏ dấu nhưng chưa lọc ký tự này — thêm vào `lib/timkiem.ts`:

```ts
/** PostgREST dùng dấu phẩy và ngoặc làm cú pháp .or() — phải bỏ khỏi từ khoá. */
export function antoanChoOr(kw: string): string {
  return kw.replace(/[,()%*]/g, ' ').replace(/\s+/g, ' ').trim()
}
```

kèm test:

```ts
it('bỏ ký tự phá cú pháp .or() của PostgREST', () => {
  expect(antoanChoOr('a,b(c)%d')).toBe('a b c d')
})
```

Dùng `antoanChoOr(chuanHoaTuKhoa(q))` ở mọi chỗ ghép `.or()`.

- [ ] **Step 4: Sửa `searchTickets`, `coreForecast`, `listToFix` theo cùng khuôn**

Mỗi hàm: thêm `{ count: 'exact' }`, `sapXepHopLe` với danh sách trắng tương ứng, `.range()`, trả `KetQuaTrang`. Giữ nguyên toàn bộ điều kiện lọc sẵn có (`state`, `khan`, `mine`, `tinh_trang`, `needs_phone`).

⚠️ `coreForecast` đang được `components/LoiCuaMay.tsx` gọi với `coreForecast('', serial)` để lấy lõi của MỘT máy rồi lọc trong JS. Chỗ đó **không phân trang** — thêm tham số `tuyChon.tatPhanTrang?: boolean`, khi bật thì bỏ `.range()`, trả toàn bộ. Không sửa `LoiCuaMay.tsx` sẽ mất lõi của máy có >50 dòng.

- [ ] **Step 5: Sửa 5 nơi gọi cho khớp kiểu trả về mới**

`app/page.tsx`, `app/ticket/page.tsx`, `app/loi/page.tsx`, `app/khach/page.tsx` đổi từ
`const machines = await searchMachines(q)` sang `const { rows, tong, trang, soTrang } = await searchMachines(q, {...})`,
rồi `.map` trên `rows`. **Không đổi gì bên trong `<table>`.**

`components/LoiCuaMay.tsx` đổi sang `(await coreForecast('', serial, { tatPhanTrang: true })).rows`.

- [ ] **Step 6: Verify**

```bash
npm --prefix app-cskh test && npm --prefix app-cskh run lint && npm --prefix app-cskh run build
```

Cả ba phải sạch. Sau đó chạy dev server, mở `/` gõ `huong` (không dấu) — phải ra khách tên `Hương`. Đây là mục đích của cả Task 1–3.

- [ ] **Step 7: Commit**

```bash
git add app-cskh/app app-cskh/components app-cskh/lib
git commit -m "feat(tim-kiem): truy vấn nhận tìm không dấu, sắp xếp có whitelist, phân trang"
```

---

## Task 4: Ô tìm kiếm gõ-tới-đâu-lọc-tới-đó + thanh đang lọc + phân trang

**Files:**
- Create: `app-cskh/components/OTimKiem.tsx`, `app-cskh/components/ThanhDangLoc.tsx`, `app-cskh/components/PhanTrang.tsx`
- Modify: 5 trang danh sách — thay `<form>` tìm kiếm hiện tại

**Interfaces:**
- Consumes: `KetQuaTrang` (Task 3)
- Produces: `<OTimKiem placeholder={string} />` · `<ThanhDangLoc dieuKien={{nhan: string, giaTri: string}[]} hienThi={number} tong={number} />` · `<PhanTrang trang={number} soTrang={number} />`

- [ ] **Step 1: Viết `OTimKiem.tsx`**

```tsx
'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

/**
 * Gõ tới đâu lọc tới đó, hoãn 300ms để không bắn truy vấn mỗi phím.
 *
 * Dùng router.replace() chứ KHÔNG push: push thì mỗi ký tự là một mục lịch sử,
 * gõ "hương" xong phải bấm Back 5 lần mới thoát. Đổi lại Back sẽ rời trang chứ
 * không xoá từ khoá — nên đường về là nút "Xoá lọc" ở ThanhDangLoc.
 */
export function OTimKiem({ placeholder }: { placeholder: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [q, setQ] = useState(searchParams.get('q') ?? '')
  const [, batDau] = useTransition()
  const lanDau = useRef(true)

  useEffect(() => {
    if (lanDau.current) { lanDau.current = false; return }
    const hen = setTimeout(() => {
      const sp = new URLSearchParams(searchParams.toString())
      if (q) sp.set('q', q)
      else sp.delete('q')
      sp.delete('trang')          // đổi từ khoá thì về trang 1
      batDau(() => router.replace(`${pathname}?${sp}`))
    }, 300)
    return () => clearTimeout(hen)
  }, [q, pathname, router, searchParams])

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border px-4 py-2.5 pr-10 text-slate-900 bg-white"
      />
      {q && (
        <button
          type="button"
          onClick={() => setQ('')}
          aria-label="Xoá từ khoá"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900"
        >
          ×
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Viết `ThanhDangLoc.tsx`**

Hiện điều kiện đang bật + `hienThi`/`tong` + nút Xoá lọc (link về `pathname` trần).
Khi không có điều kiện nào thì chỉ hiện `"{tong} kết quả"`.

Đây cũng là chỗ vá lỗi cắt-cứng-50-dòng: trước đây lọc ra 80 kết quả chỉ thấy 50 mà tưởng là hết.

- [ ] **Step 3: Viết `PhanTrang.tsx`**

Nút "Trước"/"Sau" + "Trang 2 / 10", giữ nguyên mọi tham số khác trên URL, chỉ đổi `trang`.
Ẩn hẳn khi `soTrang <= 1`.

- [ ] **Step 4: Gắn vào 5 trang danh sách**

Thay `<form className="flex gap-2">…</form>` hiện có bằng `<OTimKiem />`, đặt `<ThanhDangLoc />` ngay dưới, `<PhanTrang />` dưới `<table>`. **Không đụng phần `<table>`.**

Nhớ bọc `<Suspense>` quanh phần dùng `useSearchParams` — Next 16 lỗi khi build nếu thiếu, và lỗi này **chỉ lộ ra lúc `npm run build`**, chạy dev vẫn bình thường.

- [ ] **Step 5: Verify**

```bash
npm --prefix app-cskh test && npm --prefix app-cskh run lint && npm --prefix app-cskh run build
```

Rồi mở dev server: gõ vào ô tìm kiếm thấy danh sách tự lọc sau ~300ms không cần bấm Enter; thanh trạng thái hiện đúng `x/tổng`; bấm Xoá lọc về danh sách đầy đủ; chuyển trang giữ nguyên từ khoá.

- [ ] **Step 6: Commit**

```bash
git add app-cskh/components app-cskh/app
git commit -m "feat(ui): ô tìm gõ-tới-đâu-lọc-tới-đó + thanh đang lọc + phân trang"
```

---

## Task 5: Sắp xếp bằng cách bấm tiêu đề cột + bộ lọc bổ sung

**Files:**
- Create: `app-cskh/components/TieuDeCotSapXep.tsx`
- Modify: 5 trang danh sách — bọc tiêu đề cột; thêm bộ lọc

**Interfaces:**
- Consumes: `COT_MAY`, `COT_TICKET`, `COT_LOI`, `COT_KHACH` (Task 3)
- Produces: `<TieuDeCotSapXep cot={string} nhan={string} />`

- [ ] **Step 1: Viết `TieuDeCotSapXep.tsx`**

Client component: đọc `cot`/`chieu` từ URL, render `<th>` chứa link đổi sang cột đó (bấm lại cột đang sắp thì đảo chiều), kèm mũi tên ▲/▼. Giữ nguyên các tham số khác, xoá `trang` khi đổi sắp xếp.

- [ ] **Step 2: Bọc tiêu đề các cột được phép sắp xếp**

Chỉ bọc những cột nằm trong danh sách trắng tương ứng. Cột khác giữ nguyên `<th>` thường — bấm không có tác dụng thì đừng cho bấm.

- [ ] **Step 3: Thêm bộ lọc**

- `/` — trạng thái bảo hành (còn hạn / hết máy còn lõi / hết hẳn / chưa kích hoạt), tỉnh
- `/ticket` — thêm nhóm lỗi, người phụ trách (giữ nguyên 4 bộ lọc sẵn có)
- `/khach` — tỉnh, thiếu SĐT

Mỗi bộ lọc là một tham số URL, đọc trong `searchParams`, đẩy xuống hàm truy vấn dưới dạng điều kiện `.eq()`/`.in()`. Điều kiện đang bật phải xuất hiện trong `<ThanhDangLoc />` và gỡ được riêng.

- [ ] **Step 4: Verify**

```bash
npm --prefix app-cskh test && npm --prefix app-cskh run lint && npm --prefix app-cskh run build
```

Trên dev server: bấm tiêu đề cột đổi thứ tự và mũi tên đúng chiều; bấm lại đảo chiều; đổi trang giữ nguyên sắp xếp; **gõ tay `?cot=mat_khau` lên URL không làm vỡ trang** mà rơi về sắp xếp mặc định — đây là ca chứng minh danh sách trắng hoạt động.

- [ ] **Step 5: Commit**

```bash
git add app-cskh/components app-cskh/app
git commit -m "feat(ui): sắp xếp bằng tiêu đề cột + bộ lọc theo trạng thái/tỉnh/nhóm lỗi"
```

---

## Task 6: `loading.tsx` + prefetch khi rê chuột

**Files:**
- Create: `app-cskh/app/may/[serial]/loading.tsx`, `app-cskh/app/khach/[id]/loading.tsx`, `app-cskh/app/ticket/[code]/loading.tsx`, `app-cskh/app/nhom-loi/[code]/loading.tsx`
- Create: `app-cskh/components/LinkRePrefetch.tsx`
- Modify: 17 link chi tiết trong các bảng danh sách

**Interfaces:**
- Produces: `<LinkRePrefetch href={string} className={string}>{children}</LinkRePrefetch>`

- [ ] **Step 1: Đọc guide trước khi viết**

`node_modules/next/dist/docs/01-app/02-guides/prefetching.md` — mục "Hover-triggered prefetch". Bảng "Prefetching static vs dynamic routes" nói rõ: trang động **không** được prefetch **trừ khi có `loading.js`**. Đó là lý do Task này ghép hai việc vào một.

- [ ] **Step 2: Viết 4 file `loading.tsx`**

Khung xương đơn giản khớp bố cục trang tương ứng (thanh tiêu đề + vài khối `bg-slate-200 animate-pulse` cỡ bằng các `<section>` thật). Không cần cầu kỳ — mục đích là bấm vào thấy phản hồi ngay thay vì đứng im.

- [ ] **Step 3: Viết `LinkRePrefetch.tsx`**

Theo đúng mẫu trong guide:

```tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'

/**
 * Chỉ nạp trước khi chuột chạm vào — không nạp hàng loạt theo tầm nhìn.
 *
 * Trước đây để prefetch mặc định thì trang chủ 50 dòng × 2 link = 100 trang
 * động được render sẵn ở server, mỗi trang lại tự truy vấn DB. Tắt hẳn thì
 * bấm vào bị khựng. Rê chuột là điểm cân bằng: người ta luôn rê trước khi bấm.
 */
export function LinkRePrefetch({
  href, className, children,
}: { href: string; className?: string; children: React.ReactNode }) {
  const [nong, setNong] = useState(false)
  return (
    <Link
      href={href}
      prefetch={nong ? null : false}
      onMouseEnter={() => setNong(true)}
      className={className}
    >
      {children}
    </Link>
  )
}
```

- [ ] **Step 4: Thay 17 link chi tiết**

Tìm bằng codegraph, không grep. Chỉ thay link **trong bảng danh sách** (`/may/…`, `/khach/…`, `/ticket/…`, `/nhom-loi/…` dạng động). Giữ nguyên `<Link>` thường cho menu và các link tĩnh.

- [ ] **Step 5: Verify**

```bash
npm --prefix app-cskh test && npm --prefix app-cskh run lint && npm --prefix app-cskh run build
```

Trên dev server, mở tab Network: **tải trang danh sách không thấy loạt request `/may/...`**; rê chuột lên một dòng mới thấy một request; bấm vào thấy khung xương hiện ngay.

- [ ] **Step 6: Cập nhật CHECKLIST và commit**

Tick 5 mục giai đoạn 2 trong `docs/CHECKLIST.md` (search, filter, sort, phân trang, loading+prefetch).

```bash
git add app-cskh docs/CHECKLIST.md
git commit -m "feat(ui): loading.tsx cho 4 trang chi tiết + prefetch khi rê chuột"
```

---

## Rủi ro đã biết

- **`boDau()` (JS) và `khong_dau()` (SQL) lệch nhau** — lỗi âm thầm tệ nhất của plan này: gõ ra rỗng mà không báo lỗi gì. Task 2 Step 5 verify chéo bằng cùng một chuỗi thử.
- **Tạo lại view làm mất cột** — app đang `select('*')`, thiếu một cột là vỡ trang. Task 1 Step 5 đếm cột trước/sau.
- **Ký tự đặc biệt phá cú pháp `.or()`** của PostgREST — `antoanChoOr()` lọc, có test.
- **`useSearchParams` thiếu `<Suspense>`** — chỉ lộ ra lúc `npm run build`, chạy dev vẫn bình thường.
- **`coreForecast` bị `LoiCuaMay` gọi để lấy lõi một máy** — phân trang nhầm chỗ này sẽ nuốt mất lõi. Task 3 Step 4 có `tatPhanTrang`.
