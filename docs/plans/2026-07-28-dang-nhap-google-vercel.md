# Đăng nhập Google + deploy Vercel — kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm đăng nhập Google có rào chặn theo email, và auto-deploy app CSKH lên Vercel từ GitHub.

**Architecture:** Luật vào cửa tách làm hai lớp — một hàm **thuần** không đụng DB (`lib/auth.ts`, unit test được) và một lớp đọc `cs_staff` gắn vào `requireStaff()` (`lib/supabase.ts`). Cả đăng nhập Google lẫn mật khẩu đều đi qua đúng một điểm chặn đó. Route `/auth/callback` chỉ lo đổi code lấy session và báo lỗi tử tế.

**Tech Stack:** Next.js 16.2.10 (App Router, Turbopack) · React 19 · Supabase (`@supabase/ssr` 0.12, `supabase-js` 2.110) · Tailwind 4 · Vitest (thêm mới, chỉ để test luật vào cửa)

## Global Constraints

- **Next.js 16 đổi tên Middleware → Proxy.** File là `proxy.ts` ở gốc app, export hàm tên `proxy`. Không tạo `middleware.ts`.
- **`AGENTS.md` bắt buộc:** đọc guide trong `node_modules/next/dist/docs/` trước khi viết code Next, không suy từ trí nhớ.
- **Mọi bảng mới bật RLS ngay trong cùng migration tạo bảng**, không policy nào → chỉ `service_role` truy cập (quy ước repo).
- **Tên bảng CSKH có tiền tố `cs_`** — tránh đụng bảng team Sales sắp publish (chốt 2026-07-24).
- **Trigger `updated_at`** dùng lại hàm sẵn có `public.set_updated_at()`, đặt tên `trg_<bảng>_updated_at`.
- **Email luôn chuẩn hoá về chữ thường** trước khi so sánh hoặc ghi.
- **Không đưa email vào query string** của URL redirect (dữ liệu cá nhân).
- Project Supabase đích: **GWT-SalesTracking** `bwzmqfbcgouhvhoslmmm`. KHÔNG phải `qynpywysgltspmgnhhga`.
- Ngôn ngữ: comment, thông báo lỗi, tên biến nghiệp vụ viết **tiếng Việt** theo phong cách repo hiện có.

---

## Cấu trúc file

| File | Trách nhiệm |
|---|---|
| `supabase-cskh/migrations/02_cs_staff.sql` | *Tạo mới.* Bảng `cs_staff` + RLS + trigger + nạp 2 email đang dùng |
| `app-cskh/lib/auth.ts` | *Tạo mới.* **Hàm thuần, không import gì** — luật vào cửa 4 dòng. Đây là chỗ duy nhất chứa luật |
| `app-cskh/lib/auth.test.ts` | *Tạo mới.* Unit test cho luật, gồm ca `hoat_dong=false` thắng luật domain |
| `app-cskh/lib/supabase.ts` | *Sửa.* Thêm lớp đọc `cs_staff`, nối vào `requireStaff()` |
| `app-cskh/app/auth/callback/route.ts` | *Tạo mới.* Đổi code OAuth lấy session, xét luật, xử lý lỗi |
| `app-cskh/app/auth/actions.ts` | *Tạo mới.* Server Action xác nhận quyền cho đường đăng nhập mật khẩu |
| `app-cskh/app/login/page.tsx` | *Sửa.* Thêm nút Google, hiện thông báo lỗi từ `?loi=` |
| `app-cskh/proxy.ts` | *Sửa.* Mở ngoại lệ `/auth` |
| `app-cskh/.env.example` | *Sửa.* Đang trỏ nhầm project cũ |
| `app-cskh/README.md` · `docs/CHECKLIST.md` | *Sửa.* Cập nhật hướng dẫn + tiến độ |
| `docs/huong-dan-cau-hinh-google-vercel.md` | *Tạo mới.* Hướng dẫn 3 việc user tự làm |

**Vì sao tách `lib/auth.ts` thuần:** nếu để luật gọi thẳng DB thì không test được nếu không dựng mock. Tách phần quyết định (thuần) khỏi phần đọc dữ liệu (IO) khiến luật — thứ đang bảo vệ PII của 293 khách — có test tự động thật. Cũng tránh vòng import: `supabase.ts` → `auth.ts` một chiều.

---

## Task 1: Bảng `cs_staff`

**Files:**
- Create: `supabase-cskh/migrations/02_cs_staff.sql`

**Interfaces:**
- Produces: bảng `public.cs_staff` với cột `email` (unique, chữ thường), `hoat_dong` (bool), `vai_tro` (text)

- [ ] **Step 1: Viết migration**

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- cs_staff — nhân viên được phép vào app CSKH
--
-- Bảng này VỪA là danh sách CHO PHÉP (email ngoài @gwt.vn vẫn vào được nếu có
-- tên ở đây), VỪA là danh sách CẤM (hoat_dong = false thắng cả luật domain,
-- dùng để khoá người nghỉ việc ngay mà không cần chờ xoá tài khoản Google).
--
-- Luật đầy đủ: docs/specs/2026-07-28-dang-nhap-google-va-deploy-vercel.md mục 4
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.cs_staff (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  ho_ten     text,
  vai_tro    text not null default 'nhan_vien',
  hoat_dong  boolean not null default true,
  ghi_chu    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cs_staff_email_chu_thuong check (email = lower(email))
);

comment on table public.cs_staff is
  'Nhân viên được vào app CSKH. Vừa là allowlist vừa là blocklist; vai_tro chừa cho giai đoạn 2 (UI phân quyền), giai đoạn 1 chỉ ghi không đọc.';

drop trigger if exists trg_cs_staff_updated_at on public.cs_staff;
create trigger trg_cs_staff_updated_at
  before update on public.cs_staff
  for each row execute function public.set_updated_at();

-- RLS bật, KHÔNG policy nào → chỉ service_role đọc/ghi (giống các bảng CSKH khác)
alter table public.cs_staff enable row level security;

-- Nạp sẵn 2 tài khoản đang tồn tại (Authentication > Users, 2026-07-28)
insert into public.cs_staff (email, vai_tro, ghi_chu) values
  ('bella@gwt.vn', 'nhan_vien', 'Tài khoản đang dùng trước khi bật đăng nhập Google'),
  ('ai@gwt.vn',    'nhan_vien', 'Quản trị, nhận việc 2026-07-28')
on conflict (email) do nothing;
```

- [ ] **Step 2: Áp migration**

Dùng MCP Supabase `apply_migration` với `project_id = bwzmqfbcgouhvhoslmmm`, tên migration `cs_staff`.

- [ ] **Step 3: Verify bằng SQL, KHÔNG tin migration chạy xong là xong**

```sql
select
  (select count(*) from public.cs_staff)                                    as so_dong,
  (select relrowsecurity from pg_class where relname = 'cs_staff')          as rls_bat,
  (select count(*) from pg_policies where tablename = 'cs_staff')           as so_policy,
  (select count(*) from pg_trigger where tgname = 'trg_cs_staff_updated_at') as co_trigger;
```

Kỳ vọng: `so_dong = 2` · `rls_bat = true` · `so_policy = 0` · `co_trigger = 1`.
Sai bất kỳ ô nào thì dừng, sửa migration, chạy lại — không đi tiếp.

- [ ] **Step 4: Commit**

```bash
git add supabase-cskh/migrations/02_cs_staff.sql
git commit -m "feat(auth): bảng cs_staff — allowlist kiêm blocklist cho app CSKH"
```

---

## Task 2: Luật vào cửa (hàm thuần + test)

**Files:**
- Create: `app-cskh/lib/auth.ts`
- Test: `app-cskh/lib/auth.test.ts`
- Modify: `app-cskh/package.json`

**Interfaces:**
- Produces: `DOMAIN_CONG_TY`, `chuanHoaEmail(email)`, `xetLuatVaoCua(email, dong)`, kiểu `KetQuaVaoCua`, `DongStaff`

- [ ] **Step 1: Cài vitest**

```bash
npm --prefix app-cskh install -D vitest
```

Thêm vào `app-cskh/package.json` phần `scripts`:

```json
"test": "vitest run"
```

- [ ] **Step 2: Viết test TRƯỚC (phải fail)**

Tạo `app-cskh/lib/auth.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { xetLuatVaoCua } from './auth'

describe('xetLuatVaoCua', () => {
  it('luật 3: email @gwt.vn chưa có trong bảng thì được vào', () => {
    expect(xetLuatVaoCua('ai@gwt.vn', null)).toEqual({ duocVao: true, nguon: 'domain' })
  })

  it('luật 3: chữ HOA vẫn được vào (chuẩn hoá chữ thường)', () => {
    expect(xetLuatVaoCua('AI@GWT.VN', null)).toEqual({ duocVao: true, nguon: 'domain' })
  })

  it('luật 2: email ngoài domain nhưng có trong bảng và đang bật thì được vào', () => {
    expect(xetLuatVaoCua('freelancer@gmail.com', { hoat_dong: true }))
      .toEqual({ duocVao: true, nguon: 'cs_staff' })
  })

  it('luật 1 THẮNG luật 3: @gwt.vn nhưng hoat_dong=false thì bị từ chối', () => {
    expect(xetLuatVaoCua('nghi-viec@gwt.vn', { hoat_dong: false }))
      .toEqual({ duocVao: false, lyDo: 'bi_khoa' })
  })

  it('luật 4: email lạ bị từ chối', () => {
    expect(xetLuatVaoCua('nguoi-la@gmail.com', null))
      .toEqual({ duocVao: false, lyDo: 'ngoai_danh_sach' })
  })

  it('luật 4: domain giả mạo kiểu @gwt.vn.hacker.com bị từ chối', () => {
    expect(xetLuatVaoCua('ke@gwt.vn.hacker.com', null))
      .toEqual({ duocVao: false, lyDo: 'ngoai_danh_sach' })
  })

  it('luật 4: email rỗng bị từ chối', () => {
    expect(xetLuatVaoCua('', null)).toEqual({ duocVao: false, lyDo: 'ngoai_danh_sach' })
  })
})
```

- [ ] **Step 3: Chạy test, xác nhận FAIL**

```bash
npm --prefix app-cskh test
```

Kỳ vọng: fail vì `./auth` chưa tồn tại.

- [ ] **Step 4: Viết `lib/auth.ts`**

```ts
/**
 * Luật vào cửa app CSKH — HÀM THUẦN: không đụng DB, không import gì.
 *
 * Đây là chỗ DUY NHẤT chứa luật. Mọi đường đăng nhập (Google, mật khẩu) đều
 * phải đi qua đây, nếu không thì chặn một đường còn đường kia vẫn hở.
 *
 * Spec: docs/specs/2026-07-28-dang-nhap-google-va-deploy-vercel.md mục 4
 */

export const DOMAIN_CONG_TY = '@gwt.vn'

/** Dòng tương ứng trong cs_staff, hoặc null nếu chưa có ai ghi */
export type DongStaff = { hoat_dong: boolean } | null

export type KetQuaVaoCua =
  | { duocVao: true; nguon: 'cs_staff' | 'domain' }
  | { duocVao: false; lyDo: 'bi_khoa' | 'ngoai_danh_sach' }

export function chuanHoaEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

export function xetLuatVaoCua(email: string, dong: DongStaff): KetQuaVaoCua {
  const e = chuanHoaEmail(email)

  // Luật 1 & 2 — có tên trong bảng thì BẢNG quyết định, kể cả email @gwt.vn.
  // Thứ tự này quan trọng: hoat_dong=false phải thắng luật domain bên dưới,
  // đó chính là cơ chế khoá người nghỉ việc.
  if (dong) {
    return dong.hoat_dong
      ? { duocVao: true, nguon: 'cs_staff' }
      : { duocVao: false, lyDo: 'bi_khoa' }
  }

  // Luật 3 — chưa có tên nhưng đúng domain công ty
  if (e.endsWith(DOMAIN_CONG_TY)) return { duocVao: true, nguon: 'domain' }

  // Luật 4
  return { duocVao: false, lyDo: 'ngoai_danh_sach' }
}
```

- [ ] **Step 5: Chạy test, xác nhận PASS**

```bash
npm --prefix app-cskh test
```

Kỳ vọng: 7 test pass.

- [ ] **Step 6: Commit**

```bash
git add app-cskh/lib/auth.ts app-cskh/lib/auth.test.ts app-cskh/package.json app-cskh/package-lock.json
git commit -m "feat(auth): luật vào cửa dạng hàm thuần + 7 unit test"
```

---

## Task 3: Nối luật vào `requireStaff()`

**Files:**
- Modify: `app-cskh/lib/supabase.ts:46-51`

**Interfaces:**
- Consumes: `xetLuatVaoCua`, `chuanHoaEmail`, `KetQuaVaoCua` từ Task 2
- Produces: `kiemTraVaoCua(email)`, `ghiNhanNhanVienMoi(email)`, `LoiKhongCoQuyen`, `requireStaff()` đã siết

- [ ] **Step 1: Thêm import ở đầu `lib/supabase.ts`**

```ts
import { chuanHoaEmail, xetLuatVaoCua, type KetQuaVaoCua } from './auth'
```

- [ ] **Step 2: Thay khối `requireStaff()` hiện tại bằng**

```ts
/** Người đăng nhập hợp lệ nhưng KHÔNG có quyền vào hệ thống CSKH. */
export class LoiKhongCoQuyen extends Error {
  constructor(public lyDo: 'bi_khoa' | 'ngoai_danh_sach') {
    super('FORBIDDEN')
    this.name = 'LoiKhongCoQuyen'
  }
}

/** Đọc cs_staff rồi xét luật. Dùng chung cho requireStaff() và route callback. */
export async function kiemTraVaoCua(email: string): Promise<KetQuaVaoCua> {
  const e = chuanHoaEmail(email)
  const { data, error } = await dataClient()
    .from('cs_staff')
    .select('hoat_dong')
    .eq('email', e)
    .maybeSingle()
  if (error) throw error
  return xetLuatVaoCua(e, data ?? null)
}

/** Ghi nhận người vào lần đầu theo luật domain. KHÔNG đụng dòng đã có. */
export async function ghiNhanNhanVienMoi(email: string) {
  const { error } = await dataClient()
    .from('cs_staff')
    .upsert({ email: chuanHoaEmail(email) }, { onConflict: 'email', ignoreDuplicates: true })
  if (error) throw error
}

/** Chặn cổng: chưa đăng nhập HOẶC không có quyền -> throw. */
export async function requireStaff() {
  const { data, error } = await (await authClient()).auth.getUser()
  if (error || !data.user) throw new Error('UNAUTHENTICATED')

  const email = chuanHoaEmail(data.user.email)
  const kq = await kiemTraVaoCua(email)
  if (!kq.duocVao) throw new LoiKhongCoQuyen(kq.lyDo)
  if (kq.nguon === 'domain') await ghiNhanNhanVienMoi(email)

  return data.user
}
```

- [ ] **Step 3: Verify biên dịch và lint sạch**

```bash
npm --prefix app-cskh run lint
```

Kỳ vọng: không lỗi. `actions.ts` gọi `requireStaff()` ở 13 chỗ, không chỗ nào cần sửa vì chữ ký hàm giữ nguyên.

- [ ] **Step 4: Commit**

```bash
git add app-cskh/lib/supabase.ts
git commit -m "feat(auth): requireStaff xét luật vào cửa qua cs_staff"
```

---

## Task 4: Route callback + mở ngoại lệ proxy

**Files:**
- Create: `app-cskh/app/auth/callback/route.ts`
- Modify: `app-cskh/proxy.ts:29-34`

**Interfaces:**
- Consumes: `authClient`, `kiemTraVaoCua`, `ghiNhanNhanVienMoi` (Task 3); `chuanHoaEmail` (Task 2)
- Produces: endpoint `GET /auth/callback`

- [ ] **Step 1: Tạo route handler**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { authClient, ghiNhanNhanVienMoi, kiemTraVaoCua } from '@/lib/supabase'
import { chuanHoaEmail } from '@/lib/auth'

/**
 * Google gọi ngược về đây sau khi người dùng chọn tài khoản.
 * LƯU Ý: lúc này session CHƯA tồn tại -> proxy.ts phải bỏ qua /auth,
 * không thì vòng đăng nhập không bao giờ khép được.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')

  // Người dùng bấm Huỷ, hoặc Google trả lỗi cấu hình
  if (searchParams.get('error')) {
    return NextResponse.redirect(`${origin}/login?loi=google`)
  }
  if (!code) return NextResponse.redirect(`${origin}/login?loi=google`)

  const supabase = await authClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) return NextResponse.redirect(`${origin}/login?loi=google`)

  const email = chuanHoaEmail(data.user.email)
  const kq = await kiemTraVaoCua(email)

  if (!kq.duocVao) {
    // Dọn session ngay: đã xác thực được nhưng không có quyền vào.
    // KHÔNG kèm email vào URL — dữ liệu cá nhân không đưa lên query string.
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?loi=${kq.lyDo}`)
  }

  if (kq.nguon === 'domain') await ghiNhanNhanVienMoi(email)
  return NextResponse.redirect(`${origin}/`)
}
```

- [ ] **Step 2: Sửa `proxy.ts` — thay khối kiểm tra user**

Thay:

```ts
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
```

bằng:

```ts
  // /auth = vòng OAuth quay về, lúc đó CHƯA có session nên phải cho qua
  const DUONG_CONG_KHAI = ['/login', '/auth']
  const congKhai = DUONG_CONG_KHAI.some((p) => request.nextUrl.pathname.startsWith(p))

  if (!user && !congKhai) {
```

- [ ] **Step 3: Verify route tồn tại và proxy không đá nhầm**

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "http://localhost:3000/auth/callback"
```

Kỳ vọng: `307 http://localhost:3000/login?loi=google` — tức route đã chạy và tự xử lý thiếu `code`.
Nếu ra `/login` trơn (không có `?loi=`) thì proxy vẫn đang chặn, ngoại lệ chưa ăn.

- [ ] **Step 4: Commit**

```bash
git add app-cskh/app/auth/callback/route.ts app-cskh/proxy.ts
git commit -m "feat(auth): route /auth/callback + mở ngoại lệ /auth trong proxy"
```

---

## Task 5: Nút Google trên trang login

**Files:**
- Create: `app-cskh/app/auth/actions.ts`
- Modify: `app-cskh/app/login/page.tsx`

**Interfaces:**
- Consumes: `authClient`, `kiemTraVaoCua`, `ghiNhanNhanVienMoi` (Task 3)
- Produces: Server Action `xacNhanQuyenVaoCua()`

- [ ] **Step 1: Server Action cho đường mật khẩu**

Đường Google được xét ở route callback; đường mật khẩu chạy ở client nên cần một Server Action
tương đương, nếu không thì rào chỉ áp một nửa.

```ts
'use server'

import { authClient, ghiNhanNhanVienMoi, kiemTraVaoCua } from '@/lib/supabase'
import { chuanHoaEmail } from '@/lib/auth'

/** Gọi ngay sau khi đăng nhập mật khẩu thành công. Không có quyền -> đăng xuất luôn. */
export async function xacNhanQuyenVaoCua(): Promise<
  { ok: true } | { ok: false; lyDo: 'bi_khoa' | 'ngoai_danh_sach' }
> {
  const supabase = await authClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return { ok: false, lyDo: 'ngoai_danh_sach' }

  const email = chuanHoaEmail(data.user.email)
  const kq = await kiemTraVaoCua(email)

  if (!kq.duocVao) {
    await supabase.auth.signOut()
    return { ok: false, lyDo: kq.lyDo }
  }
  if (kq.nguon === 'domain') await ghiNhanNhanVienMoi(email)
  return { ok: true }
}
```

- [ ] **Step 2: Sửa `app/login/page.tsx`**

Thêm import và bảng thông báo lỗi, ngay dưới các import sẵn có:

```tsx
import { useSearchParams } from 'next/navigation'
import { xacNhanQuyenVaoCua } from '../auth/actions'

const THONG_BAO_LOI: Record<string, string> = {
  bi_khoa: 'Tài khoản của bạn đã bị khoá quyền vào hệ thống CSKH. Liên hệ quản trị.',
  ngoai_danh_sach: 'Tài khoản này chưa được cấp quyền vào hệ thống CSKH. Liên hệ quản trị.',
  google: 'Đăng nhập Google không thành công. Thử lại hoặc dùng email + mật khẩu.',
}
```

Trong component, đọc lỗi từ URL và thêm hàm đăng nhập Google:

```tsx
  const searchParams = useSearchParams()
  const loiTuUrl = THONG_BAO_LOI[searchParams.get('loi') ?? ''] ?? null

  function taoClient() {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  async function dangNhapGoogle() {
    setBusy(true)
    setErr(null)
    const { error } = await taoClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setErr(THONG_BAO_LOI.google)
      setBusy(false)
    }
    // Thành công thì trình duyệt tự chuyển sang Google, không cần làm gì thêm
  }
```

Sửa `submit()` để xét luật sau khi đăng nhập mật khẩu — thay đoạn `router.push('/')`:

```tsx
    const quyen = await xacNhanQuyenVaoCua()
    if (!quyen.ok) {
      setErr(THONG_BAO_LOI[quyen.lyDo])
      setBusy(false)
      return
    }
    router.push('/')
    router.refresh()
```

Thêm nút Google vào JSX, ngay dưới nút "Đăng nhập":

```tsx
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs text-slate-400">hoặc</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <button
          type="button" onClick={dangNhapGoogle} disabled={busy}
          className="w-full rounded-lg border py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Đăng nhập bằng Google
        </button>
```

Và đổi dòng hiện lỗi để gộp cả lỗi từ URL:

```tsx
        {(err ?? loiTuUrl) && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err ?? loiTuUrl}</p>
        )}
```

- [ ] **Step 3: Bọc `useSearchParams` trong Suspense**

`useSearchParams` khiến trang phải render động; Next 16 yêu cầu bọc Suspense nếu không sẽ lỗi khi build. Tách phần form ra thành component con `FormDangNhap` và để `export default function Login()` trả về:

```tsx
export default function Login() {
  return (
    <Suspense>
      <FormDangNhap />
    </Suspense>
  )
}
```

Nhớ `import { Suspense } from 'react'`.

- [ ] **Step 4: Verify build thật, không chỉ dev**

```bash
npm --prefix app-cskh run build
```

Kỳ vọng: build thành công. Đây là bước bắt buộc vì lỗi `useSearchParams` thiếu Suspense **chỉ lộ ra lúc build**, chạy `npm run dev` vẫn bình thường.

- [ ] **Step 5: Commit**

```bash
git add app-cskh/app/login/page.tsx app-cskh/app/auth/actions.ts
git commit -m "feat(auth): nút đăng nhập Google + áp luật cho cả đường mật khẩu"
```

---

## Task 6: Sửa tài liệu và cấu hình lệch

**Files:**
- Modify: `app-cskh/.env.example`, `app-cskh/README.md`, `docs/CHECKLIST.md`
- Create: `docs/huong-dan-cau-hinh-google-vercel.md`

- [ ] **Step 1: Sửa `.env.example`** — đang trỏ project cũ `qynpywysgltspmgnhhga` (GWT-Masterdata) trong khi code đã cutover sang `cs_customers`. Đổi `NEXT_PUBLIC_SUPABASE_URL` thành `https://bwzmqfbcgouhvhoslmmm.supabase.co`, anon key tương ứng, và sửa dòng comment "project GWT-Masterdata" → "project GWT-SalesTracking".

- [ ] **Step 2: Cập nhật `README.md`** — mục "Chạy lần đầu" đổi tên project; thêm mục đăng nhập Google nêu rõ luật vào cửa và cách khoá người nghỉ việc (`hoat_dong = false`); mục Deploy thay hướng dẫn `npx vercel` bằng auto-deploy từ GitHub.

- [ ] **Step 3: Cập nhật `docs/CHECKLIST.md`**

Tick mục đã làm nhưng chưa đánh dấu:
- `Phase 3 cutover` — đã xong ở commit `619e975`

Thêm mục mới:
```markdown
## Đăng nhập Google + deploy Vercel ✅ XONG (2026-07-28)
- [x] Bảng `cs_staff` (allowlist kiêm blocklist) + luật vào cửa 4 dòng, 7 unit test
- [x] Đăng nhập Google + giữ đường mật khẩu, cả hai cùng một điểm chặn
- [x] Auto-deploy Vercel: main→production, preview có Deployment Protection
- [ ] **Giai đoạn 2 — UI phân quyền**: đọc `vai_tro`, màn hình quản lý nhân viên
- [ ] **RLS least-privilege** thay `service_role` (user chốt "làm ngay sau")
- [ ] **Tính năng phụ**: xem nhiều dữ liệu hơn, bộ lọc
```

- [ ] **Step 4: Viết `docs/huong-dan-cau-hinh-google-vercel.md`**

Hướng dẫn 3 việc user tự làm, mỗi bước ghi đúng giá trị cần điền:
1. Google Cloud Console → OAuth client (Web application) → Authorized redirect URI là URL callback **của Supabase** (`https://bwzmqfbcgouhvhoslmmm.supabase.co/auth/v1/callback`), lấy Client ID + Secret
2. Supabase → Authentication → Providers → Google → dán Client ID/Secret; Authentication → URL Configuration → thêm Redirect URLs: `http://localhost:3000/auth/callback`, `https://<domain-production>/auth/callback`, `https://*-<team>.vercel.app/auth/callback`
3. Vercel → Import repo `AIGWTVN/customer-support` → **Root Directory = `app-cskh`** → nhập 3 biến môi trường cho cả Production và Preview → Settings → Deployment Protection bật cho Preview

- [ ] **Step 5: Commit**

```bash
git add app-cskh/.env.example app-cskh/README.md docs/CHECKLIST.md docs/huong-dan-cau-hinh-google-vercel.md
git commit -m "docs(auth): sửa .env.example trỏ nhầm project + hướng dẫn cấu hình Google/Vercel"
```

---

## Task 7: Nghiệm thu

**Files:** không sửa file nào — đây là bước kiểm chứng.

Ba việc cấu hình ở Task 6 Step 4 phải **user tự làm xong** trước khi chạy task này.

- [ ] **Step 1: Chạy toàn bộ test và build**

```bash
npm --prefix app-cskh test && npm --prefix app-cskh run build
```

Kỳ vọng: 7 test pass, build thành công.

- [ ] **Step 2: Kiểm 6 ca nghiệm thu trên `localhost:3000`**

| Ca | Thao tác | Kỳ vọng |
|---|---|---|
| 1 | Đăng nhập Google bằng `ai@gwt.vn` | Vào được trang chủ |
| 2 | Đăng nhập Google bằng Gmail cá nhân | Về `/login`, hiện "chưa được cấp quyền", không có session |
| 3 | Đăng nhập mật khẩu bằng `bella@gwt.vn` | Vào được như cũ |
| 4 | `update cs_staff set hoat_dong=false where email='ai@gwt.vn'` rồi đăng nhập lại | Bị từ chối, hiện "đã bị khoá" — chứng minh luật 1 thắng luật 3 |
| 5 | Trả `hoat_dong=true`, đăng nhập lại | Vào được |
| 6 | Đăng nhập Google bằng một email `@gwt.vn` chưa có trong bảng | Vào được VÀ `cs_staff` tự có dòng mới |

Ca 2 và ca 4 là hai ca quan trọng nhất — chúng là thứ duy nhất chặn người ngoài đọc PII của khách.

- [ ] **Step 3: Verify trên Vercel**

Đẩy nhánh lên GitHub, mở PR → kiểm preview URL có đòi đăng nhập Vercel (Deployment Protection) không.
Merge vào `main` → kiểm production URL đăng nhập Google chạy được.

- [ ] **Step 4: Commit kết quả nghiệm thu vào CHECKLIST**

```bash
git add docs/CHECKLIST.md
git commit -m "docs: nghiệm thu đăng nhập Google + deploy Vercel"
```

---

## Rủi ro đã biết

- **`requireStaff()` giờ có thêm một truy vấn DB mỗi lần gọi.** `actions.ts` gọi nó 13 chỗ; mỗi lần là một lookup theo khoá unique nên rẻ, chấp nhận được với app nội bộ. Nếu sau này thấy chậm thì cache theo request, đừng bỏ kiểm tra.
- **Preview deployment cầm `service_role`.** Deployment Protection phải verify bật thật ở Task 7 Step 3, không chỉ tin là đã bật.
- **Chưa có test tự động cho luồng OAuth** — ca 1–6 ở Task 7 là kiểm tay. Chấp nhận ở giai đoạn này; luật vào cửa (phần dễ sai nhất) đã có test.
