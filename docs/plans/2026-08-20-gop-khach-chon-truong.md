# Gộp khách: chọn từng trường, không vứt SĐT/địa chỉ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps dùng checkbox (`- [ ]`).

**Goal:** Gộp 2 hồ sơ khách mà **không mất gì**: SĐT thừa thành số phụ, địa chỉ thừa thành địa chỉ có phân loại, mọi trường xung đột do CS chọn chứ không do máy quyết ngầm.

**Architecture:** Ba lớp. (1) **Chỗ chứa** — bảng `customer_addresses` mới (soi theo `customer_contacts` sẵn có), để địa chỉ thứ hai có nhà chứ không bị nhét vào ghi chú. (2) **Phép gộp** — `gop_khach` nhận thêm `p_chon jsonb` mô tả CS chọn gì; không truyền thì chạy y như cũ, nên hàng chờ duyệt cũ không vỡ. (3) **Giao diện** — một khối so sánh song song dùng chung cho cả `/khach/gop` lẫn `/bao-tri/map`.

**Tech Stack:** Next.js 16.2.10, React 19, Tailwind 4, TypeScript 5, Vitest 4, Postgres (Supabase `bwzmqfbcgouhvhoslmmm`).

**Spec:** Phản hồi CEO 20/08/2026 sau khi check bản gộp đầu tiên. Đo trên prod: 14 nhóm trùng tên, **tất cả đúng 2 hồ sơ**; **12/14 nhóm cả hai đều có SĐT**; **12/14 nhóm hai địa chỉ khác nhau** → mất mát là ca THƯỜNG, không phải ngoại lệ.

## Global Constraints

- **Không vỡ hàng chờ duyệt đang có.** `gop_khach(p_giu, p_gop)` gọi 2 tham số phải chạy nguyên như cũ.
- **Không xoá cứng gì.** Hồ sơ bị gộp vẫn ẩn mềm, lần ngược lại được.
- **Ba quyết định CEO đã chốt 20/08:** bảng địa chỉ riêng có phân loại · giữ gộp 2 hồ sơ mỗi lượt (không làm N-way) · khối so sánh dùng chung cho `/khach/gop` và `/bao-tri/map`.
- Sau mỗi task: `npx tsc --noEmit` + `npm run test` + commit. Task cuối thêm `npm run lint` + `npm run build`.
- Migration áp **LOCAL trước**, prod chỉ áp ngay trước khi merge (luật `CLAUDE.md`).
- Worktree `~/gwt-worktrees/gop-khach-man-rieng`, nhánh `feat/gop-khach-man-rieng`. Cổng dev **3300**.

## Sự thật đã kiểm chứng (đừng đoán lại)

| Thứ | Sự thật |
|---|---|
| SĐT phụ | `customer_contacts(customer_id, phone, contact_name, role, is_primary, zalo_ok)` — **đã có**, không cần bảng mới |
| Địa chỉ | `cs_customers` chỉ có **một** ô `address`. `address_truoc_sap_nhap` là vết sáp nhập tỉnh, **không được mượn** |
| Khách Sales | Bảng riêng `customers`, nối bằng `cs_customers.customer_code`. Gộp khách **luôn là gộp 2 dòng trong `cs_customers`** |
| "Khách từ bảo trì" | **Không tồn tại** — plan chưa map chỉ là dòng `maintenance_plan` có `source_customer_name`/`source_phone` |
| Hàng chờ duyệt | `apDungThayDoi()` trong `app/actions.ts` gọi `db.rpc('gop_khach', { p_giu, p_gop })`, đọc `payload.gop_id` |

---

### Task 1: Bảng `customer_addresses`

**Files:** Create `db/cs/migrations/48_customer_addresses.sql`

- [ ] **Step 1: Viết migration**

Soi đúng khuôn `customer_contacts`: khoá ngoại có `on delete cascade`, index theo `customer_id`, cấp quyền cho `service_role`.

```sql
create table if not exists customer_addresses (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references cs_customers(id) on delete cascade,
  dia_chi     text not null,
  loai        text not null default 'khac',
  ghi_chu     text,
  created_at  timestamptz not null default now(),
  constraint customer_addresses_loai_check check (loai in ('nha','cty','lap_dat','khac'))
);
create index if not exists idx_customer_addresses_customer on customer_addresses(customer_id);
comment on table customer_addresses is
  'Địa chỉ phụ của khách (nhà / công ty / lắp đặt). cs_customers.address vẫn là địa chỉ CHÍNH.';
revoke all on table customer_addresses from public, anon, authenticated;
grant select, insert, update, delete on table customer_addresses to service_role;
```

- [ ] **Step 2: Áp LOCAL + kiểm**

```bash
docker exec -i supabase_db_gwt-platform psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < db/cs/migrations/48_customer_addresses.sql
docker exec -i supabase_db_gwt-platform psql -U postgres -d postgres -tAc "select count(*) from customer_addresses;"
```
Expected: `CREATE TABLE` … và `0`.

- [ ] **Step 3: Commit**

---

### Task 2: `gop_khach` nhận lựa chọn của CS

**Files:** Create `db/cs/migrations/49_gop_khach_chon_truong.sql`

`p_chon` là `jsonb`, **mặc định null = chạy y hệt bản cũ**.

```jsonc
{
  "truong":       { "full_name": "…", "address": "…", "province": "…", … },  // giá trị CUỐI cho bản giữ
  "sdt_phu":      [ { "phone": "…", "contact_name": "…", "role": "khac" } ],
  "dia_chi_them": [ { "dia_chi": "…", "loai": "cty", "ghi_chu": "…" } ]
}
```

- [ ] **Step 1: Viết migration** — giữ nguyên toàn bộ phần dời 5 bảng + ẩn mềm của migration 46. Chỉ thêm:
  - `p_chon jsonb default null` vào chữ ký (dùng `create or replace`, **không drop** — drop là mất quyền `grant`).
  - Nhánh `if p_chon is not null`: lấy giá trị trường từ `p_chon->'truong'`, `insert` `sdt_phu` vào `customer_contacts` (bỏ qua số đã tồn tại của khách đó), `insert` `dia_chi_them` vào `customer_addresses`.
  - `p_chon is null` → chạy nguyên luật coalesce cũ.
- [ ] **Step 2: Áp LOCAL, thử cả 2 đường** — gọi 2 tham số (phải y như cũ) và gọi 3 tham số.
- [ ] **Step 3: Commit**

---

### Task 3: Luật dựng `p_chon` — hàm thuần, TDD

**Files:** Create `apps/web/lib/gopKhachChon.ts` + `.test.ts`

**Produces:**
- `type ChonTruong = 'giu' | 'gop'`
- `type LuaChon = { truong: Record<string, ChonTruong>; sdtPhu: boolean; diaChiThem: 'cty' | 'nha' | 'khac' | 'bo' }`
- `dungPChon(giu, gop, luaChon): PChon` — dựng đúng jsonb cho RPC
- `macDinhLuaChon(giu, gop): LuaChon` — mặc định an toàn: trường nào bản giữ trống thì lấy bản gộp; SĐT thừa **luôn** thành số phụ; địa chỉ thừa **luôn** giữ, loại mặc định `khac`

- [ ] **Step 1: Viết test trước** — phủ: bản giữ trống thì lấy bên gộp · cả hai có thì mặc định giữ bên giữ · SĐT hai bên khác nhau thì số bên gộp vào `sdtPhu` · SĐT giống nhau thì KHÔNG đẻ số phụ trùng · địa chỉ giống nhau thì không thêm · chọn `bo` thì không thêm gì.
- [ ] **Step 2: Chạy cho ĐỎ** · **Step 3: Viết hàm** · **Step 4: Chạy cho XANH** · **Step 5: Commit**

---

### Task 4: Khối so sánh dùng chung

**Files:** Create `apps/web/components/SoSanhHoSo.tsx`

Một khối, hai chỗ dùng. Nhận 2 "phía" đã chuẩn hoá nên `/bao-tri/map` truyền được plan (không phải hồ sơ khách) vào phía trái.

```ts
type PhiaSoSanh = {
  tieuDe: string
  nhan: string[]                    // "CS" · "Sales" · "Có lịch bảo trì" · "Có ticket"
  dong: { nhan: string; giaTri: string }[]
  href?: string                     // mở hồ sơ ở tab mới, nếu có
}
```

- [ ] **Step 1: Viết component** — 2 cột, tô dòng khác nhau, `nhan` thành chip màu.
- [ ] **Step 2: Đổi nhãn nguồn** — `nguonKhach()` hiện trả "Bảo trì" nghe như *hồ sơ đến từ bảo trì*, sai. Đổi tiêu đề khối thành **"Đang có"** và nhãn thành `Máy (CS)` · `Đơn Sales` · `Lịch bảo trì` · `Ticket`. Sửa cả test.
- [ ] **Step 3: Commit**

---

### Task 5: `/khach/gop` — chọn từng trường + gộp tiếp

**Files:** Modify `apps/web/components/GopKhachManHinh.tsx`, `apps/web/app/actions.ts`

- [ ] **Step 1:** mỗi dòng xung đột có 2 nút chọn (giữ ● / gộp ○); dòng SĐT và Địa chỉ thêm dòng phụ *"số kia → lưu thành SĐT phụ"* / *"địa chỉ kia → lưu thành [chọn loại]"*.
- [ ] **Step 2:** `deXuatGopKhach(giuId, gopId, luaChon?)` — nhét `chon` vào payload hàng chờ; `apDungThayDoi` đọc `payload.chon` rồi truyền `p_chon`.
- [ ] **Step 3:** gộp xong **giữ nguyên hồ sơ vừa giữ ở cột trái** và xoá cột phải, kèm câu *"Còn hồ sơ trùng nữa? Chọn tiếp bên phải."* — đây là cách xử lý ca 3+ hồ sơ mà không cần bảng N cột.
- [ ] **Step 4:** tsc + test + commit

---

### Task 6: `/bao-tri/map` dùng khối so sánh

**Files:** Modify `apps/web/components/BaoTriQuanLy.tsx`

- [ ] **Step 1:** bấm một gợi ý → mở khối so sánh (trái = plan: tên Asana, SĐT nguồn, bộ máy, tỉnh, số lần; phải = khách ứng viên đủ trường qua `khachDayDu`) → nút **"Đúng người, gán"** trong đó. Bỏ `window.confirm`.
- [ ] **Step 2:** ô "Chọn khách khác" cũng đi qua đúng khối đó.
- [ ] **Step 3:** tsc + test + lint + build + commit

---

### Task 7: Hồ sơ khách hiện địa chỉ phụ

**Files:** Modify `apps/web/components/CustomerEditor.tsx`, `apps/web/app/actions.ts`, `apps/web/app/khach/[id]/page.tsx`

- [ ] **Step 1:** `diaChiCuaKhach(id)` + `themDiaChi` / `xoaDiaChi`.
- [ ] **Step 2:** khối "Địa chỉ khác" trong tab *Sửa thông tin*, giống hệt khối SĐT phụ đang có.
- [ ] **Step 3:** tsc + test + lint + build + commit

---

## Kiểm tra cuối

- [ ] `npx tsc --noEmit && npm run test && npm run lint && npm run build` sạch.
- [ ] Bật `npx next dev -p 3300`, DB local, đưa CEO xem: `/khach/gop` (gộp 2 hồ sơ có đủ SĐT + địa chỉ khác nhau, xem SĐT thừa có vào số phụ, địa chỉ thừa có vào địa chỉ khác) và `/bao-tri/map`.
- [ ] CEO OK → áp migration 48 + 49 lên prod → merge `main`.
