# GWT Customer Care — Phase 0 Implementation Plan (Nền + kích hoạt bảo hành)

> ✅ **PHASE 0 ĐÃ HOÀN THÀNH 2026-07-15.** Checkbox trong file này KHÔNG được tick (giữ nguyên làm tài liệu).
> Tiến độ toàn dự án theo dõi tại **[../CHECKLIST.md](../CHECKLIST.md)** — cập nhật sau mỗi việc xong.

> **Bản v2 — cập nhật 2026-07-15** theo masterdata catalog v4. Thay đổi lớn so với v1 (2026-07-12):
> nhóm `products` (website) **đã bị XOÁ khỏi DB** ngày 2026-07-14 → không còn nguồn số năm bảo hành;
> khoá sản phẩm chuyển sang `catalog_item."Mã nội bộ"`; `v_catalog_all_codes` đã xoá → tra mã qua
> `supplier_code` / RPC `search_catalog`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng nền dữ liệu CSKH trên Supabase (khách đa-SĐT, máy đã lắp, bảo hành), di trú serial + khách từ Odoo, và một lớp vận hành MVP để nhân viên tra cứu và kích hoạt bảo hành.

**Architecture:** Mở rộng project Supabase `GWT-Masterdata` (`qynpywysgltspmgnhhga`) bằng migration mới cho domain CSKH — KHÔNG đụng masterdata catalog sẵn có. RLS bật đủ, domain khách hàng anon KHÔNG đọc. Logic kích hoạt bảo hành đóng gói thành Postgres RPC. Script Python di trú đọc Odoo export → upsert Supabase.

**Tech Stack:** Supabase (Postgres 17) · SQL migrations (Supabase MCP `apply_migration`) · Python 3 + `openpyxl` + `supabase-py` · pytest.

## Ba khoá quản lý (chốt 2026-07-15)

| Thực thể | Khoá | Ghi chú |
|---|---|---|
| **Khách hàng** | **SĐT** (`customers.primary_phone`, UNIQUE) | Odoo KHÔNG có SĐT → khách từ Odoo tạm `null` + cờ `needs_phone`; điền ở Phase 0.5 |
| **Máy được bảo hành** | **Serial** (`installed_base.serial` PK) | Serial là khoá nối 2 nguồn (Odoo ↔ Excel Theo Dõi BH) |
| **Sản phẩm** | **Mã nội bộ** (`catalog_item."Mã nội bộ"`) **+ mã đối tác/kho** | Odoo nhập theo mã hãng → resolve qua `supplier_code` / `search_catalog`; giữ `source_product_code` để truy vết |

## Global Constraints

- Project đích DUY NHẤT: Supabase `GWT-Masterdata` id `qynpywysgltspmgnhhga` (Tokyo).
- **Khoá sản phẩm = `"Mã nội bộ"`** (text). FK sang catalog dùng `catalog_item("Mã nội bộ")`.
- ⚠️ `products`/`product_variants`/`suppliers` **ĐÃ XOÁ 2026-07-14** — không tham chiếu. Backup ở `GWT-Masterdata/backups/`.
- ⚠️ `v_catalog_all_codes` **ĐÃ XOÁ** — tra mã lạ dùng RPC `search_catalog(query, limit_n)` hoặc join thẳng `supplier_code`.
- **Bảng mới BẬT RLS ngay trong cùng migration tạo bảng**; domain CSKH: **anon KHÔNG có policy** (dữ liệu riêng tư); đọc/ghi qua `service_role`.
- View mới `security_invoker = true`.
- **KHÔNG chạy `schema/current_schema.sql` / `seeds/*.sql` lên DB live.**
- Sau khi đổi schema: dump lại `schema/current_schema.sql` + cập nhật `docs/schema-description.md` + commit CẢ BỘ vào repo GWT-Masterdata cùng phiên.
- Không commit `.env`/key. `service_role key` chỉ server-side.
- Timestamp migration: UTC `YYYYMMDDHHMMSS` (thời điểm thực khi tạo file).
- Serial giữ nguyên định dạng Odoo (vd `F00000156TCK00010001`); `ticket_code` giữ chuỗi `GWT-2600xx` (Phase 1).

## Data reality (đã kiểm chứng từ file thật)

**Nguồn 1 — Odoo `GWT Serial` export** (`Hệ thống CRM/GWT Serial (gwt.serial).xlsx`):
- Cột: `Activated date, Customer, Expired date, Parent serial, Product name, Serial, Warranty activated`. **Không có SĐT.**
- File hiện chỉ **80 dòng mẫu**; DB Odoo có ~1.594 serial → chạy thật cần export đầy đủ.
- Serial KHÔNG gắn khách (Customer rỗng) = tồn kho, **không** đưa vào `installed_base`.
- `Customer` có thể kèm nguồn trong ngoặc: `Nguyễn Trung Hiếu (Shopee)` → tách `source`.
- `Product name` dạng `[MÃ] Tên`; `MÃ` thường là **mã đối tác/hãng** → resolve qua `supplier_code`.

**Nguồn 2 — Excel "Theo Dõi Bảo Hành"** (761KB, dùng ở **Phase 0.5**):
- Sheet `Lọc tổng` / `Khác`: `Khách Hàng, SĐT, Địa Chỉ, Liên hệ, Model Lắp Đặt, Serial Number, Lắp mới, Đăng ký bảo hành, Lịch thay định kỳ, Chi tiết bảo trì`.
- Sheet `Bảo trì`: tên, SĐT, serial, Lần 1–4.
- SĐT lộn xộn (dạng số mất số 0 đầu: `965226668.0`); SĐT phụ (giúp việc) nằm trong cột `Liên hệ`; cell serial đa giá trị (máy + lõi).

**Masterdata catalog hiện có** (đã verify live 2026-07-15): `catalog_item` 311 (PK `"Mã nội bộ"`) · `supplier_code` 32 (PK `"Mã đối tác"`, FK→catalog_item) · `catalog_category` 63 · `product_filter` 37 · `product_bundle` 19 · `product_variant` 2 · view `v_catalog_sheet` 311 · view `v_catalog_category` 63 · RPC `search_catalog`.

> ⚠️ **Catalog KHÔNG có số năm bảo hành.** Chỉ 58 máy trong `catalog_item` (`"Danh mục cấp 1"='Machines'`), không cột `warranty_*_years` nào → **Task 4 tạo bảng `warranty_policy` riêng**.

---

### Task 1: Migration — khách hàng & liên hệ (khoá SĐT)

**Files:**
- Create: `GWT-Masterdata/supabase/migrations/<UTCts>_cskh_customers.sql`

**Interfaces:**
- Produces: `public.customers(id uuid, primary_phone text UNIQUE, full_name, source, partner_ref, province, address, needs_phone bool, notes, created_at, updated_at)`; `public.customer_contacts(id uuid, customer_id uuid, phone, contact_name, role, is_primary, zalo_ok)`; index `idx_customer_contacts_phone`.

- [ ] **Step 1: Viết migration SQL**

```sql
-- <UTCts>_cskh_customers.sql
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  primary_phone text unique,          -- KHOÁ TỰ NHIÊN. null được (khách Odoo chưa có SĐT).
  full_name text not null,
  source text,
  partner_ref text,
  province text,
  address text,
  needs_phone boolean not null default false,   -- true = chờ enrich ở Phase 0.5
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.customers.primary_phone is
  'Khoá tự nhiên của khách. UNIQUE cho phép nhiều NULL (khách từ Odoo chưa có SĐT → needs_phone=true).';

create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  phone text,
  contact_name text,
  role text check (role in ('owner','family','helper','manager','other')),
  is_primary boolean not null default false,
  zalo_ok boolean not null default true
);
create index if not exists idx_customer_contacts_phone on public.customer_contacts(phone);
create index if not exists idx_customer_contacts_customer on public.customer_contacts(customer_id);

alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
-- Domain khách hàng: KHÔNG policy cho anon/authenticated → mặc định chặn. service_role bỏ qua RLS.
```

- [ ] **Step 2: Áp migration & verify RLS bật, anon bị chặn**

```sql
select relrowsecurity from pg_class where relname in ('customers','customer_contacts'); -- expect: t,t
select count(*) from pg_policies where tablename in ('customers','customer_contacts');  -- expect: 0
```

- [ ] **Step 3: Verify anon key KHÔNG đọc được**

```bash
curl -s "$SUPABASE_URL/rest/v1/customers?select=id" -H "apikey: $ANON_KEY" | head
```
Expected: mảng rỗng `[]` hoặc lỗi RLS — KHÔNG trả dữ liệu.

- [ ] **Step 4: Verify khoá SĐT**

```sql
insert into public.customers(full_name, primary_phone) values ('KH A','0900000001');
insert into public.customers(full_name, primary_phone) values ('KH B','0900000001'); -- expect: LỖI unique
insert into public.customers(full_name, needs_phone) values ('KH Odoo 1', true);
insert into public.customers(full_name, needs_phone) values ('KH Odoo 2', true);      -- expect: OK (2 NULL)
delete from public.customers where full_name like 'KH %';
```
Expected: trùng SĐT bị chặn; nhiều khách `primary_phone` NULL vẫn insert được.

---

### Task 2: Migration — installed_base (khoá Serial) + warranty

**Files:**
- Create: `GWT-Masterdata/supabase/migrations/<UTCts>_cskh_installed_base.sql`

**Interfaces:**
- Consumes: `customers.id`, `customer_contacts.id` (Task 1); **`catalog_item("Mã nội bộ")`**.
- Produces: `public.installed_base(serial text PK, internal_code text→catalog_item nullable, source_product_code text, model_freetext text, customer_id uuid, parent_serial text self-FK, notify_contact_id uuid, install_date date, install_address text, channel_source text, status text, created_at, updated_at)`; `public.warranty(id uuid, serial text UNIQUE→installed_base, activated bool, start_date, full_end, core_end, policy_note)`.

- [ ] **Step 1: Viết migration SQL**

```sql
-- <UTCts>_cskh_installed_base.sql
create table if not exists public.installed_base (
  serial text primary key,                                    -- KHOÁ MÁY
  internal_code text references public.catalog_item("Mã nội bộ"),  -- KHOÁ SP (chuẩn)
  source_product_code text,          -- mã gốc trên export Odoo (thường là mã đối tác/hãng) — truy vết
  model_freetext text,               -- máy không có trong catalog (vd hàng TQ)
  customer_id uuid references public.customers(id),
  parent_serial text references public.installed_base(serial),
  notify_contact_id uuid references public.customer_contacts(id),
  install_date date,
  install_address text,
  channel_source text,
  status text not null default 'active' check (status in ('active','moved','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_code_or_freetext check (internal_code is not null or model_freetext is not null)
);
create index if not exists idx_installed_base_customer on public.installed_base(customer_id);
create index if not exists idx_installed_base_parent on public.installed_base(parent_serial);
create index if not exists idx_installed_base_internal_code on public.installed_base(internal_code);

create table if not exists public.warranty (
  id uuid primary key default gen_random_uuid(),
  serial text not null unique references public.installed_base(serial) on delete cascade,
  activated boolean not null default false,
  start_date date,
  full_end date,
  core_end date,
  policy_note text
);

alter table public.installed_base enable row level security;
alter table public.warranty enable row level security;
-- CSKH domain: không policy anon.
```

> `warranty.serial` phải **UNIQUE** để `on conflict (serial)` trong RPC chạy (Task 4).

- [ ] **Step 2: Áp migration & verify**

```sql
select relrowsecurity from pg_class where relname in ('installed_base','warranty'); -- expect t,t
-- FK trỏ đúng catalog_item + check constraint qua với máy ngoài catalog:
insert into public.installed_base(serial, model_freetext) values ('TEST-CHK-1','GTUN-5800EN hàng TQ');
insert into public.installed_base(serial, internal_code) values ('TEST-CHK-2','KHONG-CO-MA'); -- expect: LỖI FK
delete from public.installed_base where serial='TEST-CHK-1';
```
Expected: RLS = true; máy freetext qua được; mã sai bị FK chặn.

---

### Task 3: Migration — bảng `warranty_policy` (nguồn số năm bảo hành)

**Files:**
- Create: `GWT-Masterdata/supabase/migrations/<UTCts>_cskh_warranty_policy.sql`

**Interfaces:**
- Consumes: `catalog_item("Mã nội bộ")`.
- Produces: `public.warranty_policy(internal_code text PK→catalog_item, full_years int, core_years int, policy_note text, updated_at)`.

> **Vì sao cần bảng này:** nhóm `products` (chứa `warranty_full_years`/`warranty_core_years`) đã bị XOÁ 2026-07-14, và `catalog_item` không có cột số năm bảo hành nào. Không có bảng này thì `activate_warranty` không tính được ngày hết hạn.

- [ ] **Step 1: Viết migration SQL**

```sql
-- <UTCts>_cskh_warranty_policy.sql
create table if not exists public.warranty_policy (
  internal_code text primary key references public.catalog_item("Mã nội bộ") on update cascade,
  full_years int check (full_years >= 0),
  core_years int check (core_years >= 0),
  policy_note text,
  updated_at timestamptz not null default now()
);
comment on table public.warranty_policy is
  'Chính sách bảo hành theo mã nội bộ. Nguồn DUY NHẤT tính full_end/core_end (nhóm products đã xoá 2026-07-14). Thiếu dòng → activate_warranty vẫn bật nhưng để null ngày hết hạn.';

alter table public.warranty_policy enable row level security;
-- Không policy anon (chính sách nội bộ). service_role ghi.
```

- [ ] **Step 2: Seed khung cho 58 máy trong catalog**

```sql
-- Tạo sẵn dòng rỗng cho mọi máy để nhân viên điền dần (full_years/core_years = null)
insert into public.warranty_policy(internal_code)
select "Mã nội bộ" from public.catalog_item where "Danh mục cấp 1" = 'Machines'
on conflict (internal_code) do nothing;
select count(*) from public.warranty_policy;              -- expect: 58
select count(*) from public.warranty_policy where full_years is null;  -- expect: 58 (chờ nghiệp vụ điền)
```
Expected: 58 dòng khung, chờ business điền số năm.

> ⚠️ **Cần bạn cung cấp:** số năm bảo hành (`full_years`, `core_years`) cho từng máy. Backup `backups/website_products_backup_2026-07-14.json` có `warranty_*_years` của ~10 máy cũ — dùng đối chiếu nếu muốn.

---

### Task 4: Migration — RPC `activate_warranty(serial)`

**Files:**
- Create: `GWT-Masterdata/supabase/migrations/<UTCts>_cskh_activate_warranty.sql`

**Interfaces:**
- Consumes: `installed_base.serial`, `installed_base.internal_code`; **`warranty_policy.full_years/core_years`**.
- Produces: `public.activate_warranty(p_serial text, p_start date default current_date) returns public.warranty`.

- [ ] **Step 1: Viết function SQL**

```sql
-- <UTCts>_cskh_activate_warranty.sql
create or replace function public.activate_warranty(p_serial text, p_start date default current_date)
returns public.warranty
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_years int;
  v_core_years int;
  v_row public.warranty;
begin
  select wp.full_years, wp.core_years
    into v_full_years, v_core_years
  from public.installed_base ib
  left join public.warranty_policy wp on wp.internal_code = ib.internal_code
  where ib.serial = p_serial;

  if not found then
    raise exception 'serial % not in installed_base', p_serial;
  end if;

  insert into public.warranty(serial, activated, start_date, full_end, core_end)
  values (
    p_serial, true, p_start,
    case when v_full_years is not null then (p_start + make_interval(years => v_full_years))::date end,
    case when v_core_years is not null then (p_start + make_interval(years => v_core_years))::date end
  )
  on conflict (serial) do update
    set activated = true, start_date = excluded.start_date,
        full_end = excluded.full_end, core_end = excluded.core_end
  returning * into v_row;
  return v_row;
end;
$$;
```

- [ ] **Step 2: Test máy có policy đầy đủ**

```sql
insert into public.customers(full_name, primary_phone) values ('Test KH','0900000099') returning id \gset
-- chọn 1 máy thật trong catalog:
insert into public.warranty_policy(internal_code, full_years, core_years)
values ('GTUN-5800EN-G', 2, 5) on conflict (internal_code) do update set full_years=2, core_years=5;
insert into public.installed_base(serial, internal_code, customer_id)
values ('TEST-W-1','GTUN-5800EN-G', :'id');
select activated, start_date, full_end, core_end from public.activate_warranty('TEST-W-1', date '2025-01-01');
-- expect: activated=t, start=2025-01-01, full_end=2027-01-01, core_end=2030-01-01
```

- [ ] **Step 3: Test máy CHƯA có policy (đa số hiện nay) + máy freetext**

```sql
insert into public.installed_base(serial, model_freetext) values ('TEST-TQ-1','GTUN hàng TQ');
select activated, full_end, core_end from public.activate_warranty('TEST-TQ-1', date '2025-01-01');
-- expect: activated=t, full_end=null, core_end=null (không có policy để tính)
-- cleanup
delete from public.warranty where serial in ('TEST-W-1','TEST-TQ-1');
delete from public.installed_base where serial in ('TEST-W-1','TEST-TQ-1');
delete from public.customers where full_name='Test KH';
```
Expected: bật được nhưng ngày hết hạn null — không crash.

---

### Task 5: Migration — view `v_installed_base` + snapshot + docs

**Files:**
- Create: `GWT-Masterdata/supabase/migrations/<UTCts>_cskh_v_installed_base.sql`
- Modify: `GWT-Masterdata/schema/current_schema.sql`, `GWT-Masterdata/docs/schema-description.md`

**Interfaces:**
- Produces: view `public.v_installed_base` → `serial, internal_code, product_name, category_l1, customer_id, customer_name, primary_phone, parent_serial, install_date, status, warranty_activated, warranty_full_end, warranty_core_end`.

- [ ] **Step 1: Viết view SQL (`security_invoker=true`)**

```sql
-- <UTCts>_cskh_v_installed_base.sql
create or replace view public.v_installed_base
with (security_invoker = true) as
select
  ib.serial,
  ib.internal_code,
  coalesce(ci."Tên ngắn gọn (đề xuất)", ib.model_freetext) as product_name,
  ci."Danh mục cấp 1" as category_l1,
  ib.customer_id,
  c.full_name    as customer_name,
  c.primary_phone,
  ib.parent_serial,
  ib.install_date,
  ib.status,
  w.activated as warranty_activated,
  w.full_end  as warranty_full_end,
  w.core_end  as warranty_core_end
from public.installed_base ib
left join public.catalog_item ci on ci."Mã nội bộ" = ib.internal_code
left join public.customers    c  on c.id = ib.customer_id
left join public.warranty     w  on w.serial = ib.serial;
```

- [ ] **Step 2: Áp migration & verify view chạy**

```sql
select * from public.v_installed_base limit 1;  -- không lỗi kể cả khi rỗng
```

- [ ] **Step 3: Dump snapshot + cập nhật docs + commit cả bộ**

Thêm mục "NHÓM 4 · CSKH" vào `docs/schema-description.md` mô tả 5 bảng + view (customers, customer_contacts, installed_base, warranty_policy, warranty, v_installed_base) — nêu rõ RLS: anon KHÔNG đọc.

```bash
git -C GWT-Masterdata add supabase/migrations/ schema/current_schema.sql docs/schema-description.md
git -C GWT-Masterdata commit -m "feat(cskh): domain CSKH — customers/installed_base/warranty + v_installed_base"
```

---

### Task 6: Script di trú Odoo → Supabase (Python, TDD)

**Files:**
- Create: `migrate/parse.py`, `migrate/odoo_serials.py`
- Test: `migrate/tests/test_parse.py`
- Fixture: `migrate/tests/fixtures/gwt_serial_sample.xlsx` (copy từ `Hệ thống CRM/GWT Serial (gwt.serial).xlsx`)

**Interfaces:**
- Consumes: `supplier_code`, RPC `search_catalog`, `catalog_item` (đọc); `customers`, `installed_base`, RPC `activate_warranty` (ghi, service_role).
- Produces:
  - `parse.split_source(customer_raw) -> (name, source|None)`
  - `parse.extract_code(product_name) -> str|None` — `"[GTUN-5800EN] Máy..."` → `"GTUN-5800EN"`
  - `parse.resolve_internal_code(raw_code, internal_codes: set, supplier_map: dict) -> str|None` — khớp mã nội bộ trực tiếp; nếu là mã đối tác thì trả `supplier_map[raw]`; else `None`
  - `odoo_serials.migrate(xlsx_path, sb) -> stats`

- [ ] **Step 1: Viết test parse (fail trước)**

```python
# tests/test_parse.py
from migrate import parse

def test_split_source_with_paren():
    assert parse.split_source("Nguyễn Trung Hiếu (Shopee)") == ("Nguyễn Trung Hiếu", "Shopee")

def test_split_source_no_paren():
    assert parse.split_source("Bùi Thu Hà") == ("Bùi Thu Hà", None)

def test_extract_code():
    assert parse.extract_code("[GTUN-5800EN] Máy lọc nước GE") == "GTUN-5800EN"
    assert parse.extract_code("Máy không mã") is None

def test_resolve_internal_direct():
    assert parse.resolve_internal_code("GTEF-15A01-G", {"GTEF-15A01-G"}, {}) == "GTEF-15A01-G"

def test_resolve_internal_via_supplier_code():
    # mã đối tác GTUN-5800EN -> mã nội bộ GTUN-5800EN-G (dữ liệu thật)
    assert parse.resolve_internal_code("GTUN-5800EN", {"GTUN-5800EN-G"},
                                       {"GTUN-5800EN": "GTUN-5800EN-G"}) == "GTUN-5800EN-G"

def test_resolve_unknown():
    assert parse.resolve_internal_code("XYZ", {"GTS10"}, {}) is None
```

- [ ] **Step 2: Chạy test — verify FAIL** (`ModuleNotFoundError: migrate.parse`)

- [ ] **Step 3: Viết `parse.py`**

```python
# migrate/parse.py
import re

_PAREN = re.compile(r"^(.*?)\s*\(([^)]+)\)\s*$")
_BRACKET = re.compile(r"\[([^\]]+)\]")

def split_source(customer_raw: str):
    m = _PAREN.match((customer_raw or "").strip())
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return (customer_raw or "").strip(), None

def extract_code(product_name: str):
    if not product_name:
        return None
    m = _BRACKET.search(product_name)
    return m.group(1).strip() if m else None

def resolve_internal_code(raw_code, internal_codes, supplier_map):
    """raw_code có thể là mã nội bộ HOẶC mã đối tác/kho (Odoo nhập theo mã hãng)."""
    if not raw_code:
        return None
    if raw_code in internal_codes:
        return raw_code
    return supplier_map.get(raw_code)
```

- [ ] **Step 4: Chạy test — verify PASS** (6 passed)

- [ ] **Step 5: Viết `odoo_serials.migrate`**

```python
# migrate/odoo_serials.py
import openpyxl
from migrate import parse

def load_rows(xlsx_path):
    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    header = [str(h).strip() for h in rows[0]]
    return [dict(zip(header, r)) for r in rows[1:]]

def load_catalog(sb):
    internal = {r["Mã nội bộ"] for r in
                sb.table("catalog_item").select('"Mã nội bộ"').execute().data}
    supplier = {r["Mã đối tác"]: r["Mã nội bộ"] for r in
                sb.table("supplier_code").select('"Mã đối tác","Mã nội bộ"').execute().data}
    return internal, supplier

def migrate(xlsx_path, sb):
    internal_codes, supplier_map = load_catalog(sb)
    rows = load_rows(xlsx_path)
    seen = {}                       # name -> customer_id
    stats = {"installed": 0, "activated": 0, "skipped_stock": 0, "unresolved_codes": []}

    # Lượt 1 — customers + installed_base (chưa gắn parent_serial)
    for r in rows:
        serial = (r.get("Serial") or "").strip()
        cust_raw = (r.get("Customer") or "").strip()
        if not serial or not cust_raw:
            stats["skipped_stock"] += 1          # tồn kho, chưa gắn khách
            continue
        name, source = parse.split_source(cust_raw)
        if name not in seen:
            seen[name] = sb.table("customers").insert({
                "full_name": name, "source": source,
                "needs_phone": True,             # Odoo không có SĐT -> Phase 0.5 điền
            }).execute().data[0]["id"]
        raw = parse.extract_code(r.get("Product name") or "")
        code = parse.resolve_internal_code(raw, internal_codes, supplier_map)
        if raw and not code:
            stats["unresolved_codes"].append(raw)   # gom lại -> bổ sung vào supplier_code
        sb.table("installed_base").upsert({
            "serial": serial,
            "internal_code": code,
            "source_product_code": raw,
            "model_freetext": None if code else (raw or r.get("Product name")),
            "customer_id": seen[name],
        }).execute()
        stats["installed"] += 1

    # Lượt 2 — parent_serial (cha phải tồn tại trước) + kích hoạt bảo hành
    for r in rows:
        serial = (r.get("Serial") or "").strip()
        if not serial or not (r.get("Customer") or "").strip():
            continue
        parent = (r.get("Parent serial") or "").strip() or None
        if parent:
            sb.table("installed_base").update({"parent_serial": parent}).eq("serial", serial).execute()
        if r.get("Warranty activated") in (True, "True", "true", 1):
            start = r.get("Activated date")
            sb.rpc("activate_warranty", {
                "p_serial": serial,
                "p_start": str(start)[:10] if start else None,
            }).execute()
            stats["activated"] += 1
    return stats
```

- [ ] **Step 6: Test integration trên fixture (project staging TRỐNG, KHÔNG phải live)**

Run: `python -m pytest migrate/tests/test_migrate_integration.py -v` — assert `stats["installed"] > 0`, `v_installed_base` có dòng, và **in ra `stats["unresolved_codes"]`** để bổ sung `supplier_code`.

- [ ] **Step 7: Commit**

> ⚠️ Chạy thật lên live CHỈ sau khi có export đầy đủ ~1.594 serial và đã review `stats`. Dùng service_role key server-side.

---

### Task 7: Lớp vận hành MVP (CHƯA CHỐT CÔNG CỤ)

**Interfaces:** Consumes `v_installed_base`, `customers`, `customer_contacts`, RPC `activate_warranty`.

> ⏸️ **Chờ quyết định:** Retool (kéo-thả, nhanh, trả phí/user) vs tự dựng web app (Next.js, toàn quyền, tốn công). Không chặn Task 1–6.

- [ ] **Step 1:** Chốt công cụ.
- [ ] **Step 2: Màn hình "Máy đã lắp"** — table từ `v_installed_base`; tìm theo `serial` / `customer_name` / `primary_phone`; cột trạng thái bảo hành. *Acceptance:* tìm theo SĐT ra đúng máy.
- [ ] **Step 3: Nút "Kích hoạt bảo hành"** — gọi `activate_warranty(serial, start_date)` → refresh. *Acceptance:* row cập nhật `warranty_activated=true`, `full_end` đúng số năm trong `warranty_policy`.
- [ ] **Step 4: Màn hình "Khách hàng"** — sửa khách + list `customer_contacts` (thêm SĐT role owner/family/helper/manager). *Acceptance:* thêm SĐT giúp việc → xuất hiện trong `customer_contacts`.
- [ ] **Step 5:** Ghi tài liệu bàn giao + commit.

---

## Definition of Done (Phase 0)

- 5 bảng + 1 view CSKH sống trên `qynpywysgltspmgnhhga`, RLS bật, anon không đọc được.
- Khoá đúng 3 tầng: khách = SĐT (unique) · máy = serial (PK) · SP = mã nội bộ (FK `catalog_item`) + truy vết `source_product_code`.
- `warranty_policy` có khung 58 máy; `activate_warranty` tính đúng `full_end`/`core_end` khi có policy, không crash khi thiếu.
- Snapshot + `docs/schema-description.md` cập nhật & commit ở GWT-Masterdata.
- Script di trú chạy được trên export Odoo (mẫu qua test; live khi có export đầy đủ), sinh `stats` + danh sách `unresolved_codes`.

## Việc cần người cung cấp (không code được)

1. **Số năm bảo hành** (`full_years`/`core_years`) cho 58 máy → điền `warranty_policy`.
2. **File export Odoo đầy đủ ~1.594 serial** (hiện chỉ có 80 dòng mẫu) → chạy Task 6 Step thật.
3. **Chốt lớp vận hành** (Retool vs tự dựng) → Task 7.

## Ngoài phạm vi Phase 0

- ~~**Phase 0.5** — Enrich SĐT/địa chỉ/liên hệ phụ từ Excel "Theo Dõi Bảo Hành"~~ **XONG 2026-07-15** — nhưng kết quả khác hẳn dự kiến:
  - ✅ **Địa chỉ: 277/293 khách** — nguồn hoá ra là `Contact (res.partner).xlsx` (Phone + Street), khớp bằng SĐT. Không phải file Theo Dõi BH.
  - ✅ **SĐT chính: 284/293** — đã xong ngay ở Phase 0 nhờ export Odoo mới có cột `Customer/Phone`. Mục tiêu gốc của Phase 0.5 thành thừa.
  - ❌ **SĐT phụ: KHÔNG nhập được.** 4/11 "SĐT phụ" thực ra **đã là `primary_phone` của khách khác** (Odoo lưu SĐT người liên hệ làm SĐT chính) → nhập vào là nhân đôi. 7/11 còn lại thuộc khách **không có trong DB**. Thêm nữa vài dòng bị **kéo-thả fill Excel** nên số tự tăng dần (`Mrs.Thuỷ/Thành` 0865884194/195/196; `Anh Cường` 098 6667622→6667628) — SĐT giả. Chứng minh + test: `migrate/contacts.py::audit_lien_he`.
  - ❌ **11 khách thiếu/lỗi SĐT: 0/11 dò được** — file Theo Dõi BH không chứa serial nào của họ.
  - Còn lại: 16 khách thiếu địa chỉ, 11 khách thiếu/lỗi SĐT → **sửa tay qua app** (`/khach`), không có nguồn tự động.
- **Phase 1** — `tickets` + ops ghi nhận lỗi.
- **Phase 2** — `ticket_issue_groups` + báo cáo lãnh đạo WhatsApp.
- **Phase 3** — `filter_schedule`/`salt_schedule`/`maintenance_*`/`water_profile` + reminder Zalo ZNS + `v_core_forecast` + mở rộng RPC thành `activate_and_seed`. (Dữ liệu lịch bảo trì có sẵn ở Excel "Theo Dõi" + `product_filter` 37 dòng máy↔lõi.)
- **Phase 4** — `kb_articles` + knowledge agent.
- DB role least-privilege riêng cho lớp vận hành (MVP tạm dùng service_role).
