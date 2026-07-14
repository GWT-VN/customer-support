# GWT Customer Care — Phase 0 Implementation Plan (Nền + kích hoạt bảo hành)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng nền dữ liệu CSKH trên Supabase (khách hàng đa-SĐT, máy đã lắp, bảo hành), di trú serial + khách từ Odoo, và một Retool ops app MVP để nhân viên tra cứu và kích hoạt bảo hành.

**Architecture:** Mở rộng project Supabase `GWT-Masterdata` (`qynpywysgltspmgnhhga`) bằng migration mới cho domain CSKH — KHÔNG đụng masterdata sản phẩm sẵn có. RLS bật đủ, domain khách hàng anon không đọc. Logic kích hoạt bảo hành đóng gói thành Postgres RPC dùng chung. Script Python di trú đọc Odoo export → upsert Supabase. Lớp vận hành là Retool nối thẳng Postgres.

**Tech Stack:** Supabase (Postgres 17) · SQL migrations (Supabase CLI / MCP `apply_migration`) · Python 3 + `openpyxl` + `supabase-py` cho script di trú · pytest · Retool.

## Global Constraints

- Project đích DUY NHẤT: Supabase `GWT-Masterdata` id `qynpywysgltspmgnhhga` (Tokyo).
- Khóa sản phẩm = `code`; mọi FK sang sản phẩm dùng `products.code` (không UUID).
- **Bảng mới BẬT RLS ngay trong cùng migration tạo bảng**; domain CSKH: **anon KHÔNG có policy đọc** (dữ liệu riêng tư); ghi/đọc qua `service_role`.
- View mới `security_invoker = true`.
- **KHÔNG chạy `schema/current_schema.sql` / `seeds/*.sql` lên DB live.** Chỉ áp migration mới.
- Sau khi đổi schema: dump lại `schema/current_schema.sql` + cập nhật `docs/schema-description.md` + commit CẢ BỘ (migration + snapshot + docs) vào repo GWT-Masterdata cùng phiên.
- Không commit `.env`/key. `service_role key` chỉ server-side.
- Timestamp migration: UTC `YYYYMMDDHHMMSS` (dùng thời điểm thực khi tạo file).
- Serial giữ nguyên định dạng Odoo (vd `F00000156TCK00010001`); `ticket_code` giữ chuỗi `GWT-2600xx` (Phase 1).

## Data reality (đã kiểm chứng từ file thật — bắt buộc xử đúng)

- Odoo `GWT Serial` export cột: `Activated date, Customer, Expired date, Parent serial, Product name, Serial, Warranty activated`. **Không có SĐT.**
- File mẫu chỉ 80 dòng; DB Odoo có 1.594 serial → chạy thật cần export đầy đủ.
- Serial KHÔNG gắn khách (Customer rỗng) = tồn kho, **không** đưa vào `installed_base` Phase 0.
- `Customer` có thể kèm nguồn trong ngoặc: `Nguyễn Trung Hiếu (Shopee)` → tách `source`.
- Product name dạng `[MÃ] Tên`; `MÃ` có thể là `products.code` HOẶC `product_variants.sku`.

---

### Task 1: Migration — bảng khách hàng & liên hệ (customers + customer_contacts)

**Files:**
- Create: `GWT-Masterdata/supabase/migrations/<UTCts>_cskh_customers.sql`
- Test: `GWT-Masterdata/tests/cskh/test_customers_schema.sql` (verification queries)

**Interfaces:**
- Produces: bảng `public.customers(id uuid, full_name text, primary_phone text, source text, partner_ref text, province text, address text, notes text, created_at, updated_at)`; bảng `public.customer_contacts(id uuid, customer_id uuid, phone text, contact_name text, role text, is_primary bool, zalo_ok bool)`; index `idx_customer_contacts_phone`.

- [ ] **Step 1: Viết migration SQL**

```sql
-- <UTCts>_cskh_customers.sql
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  primary_phone text,
  source text,
  partner_ref text,
  province text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
-- Domain khách hàng: KHÔNG cấp policy cho anon. service_role bỏ qua RLS.
-- (Không tạo policy select cho anon/authenticated → mặc định chặn.)
```

- [ ] **Step 2: Áp migration & verify RLS bật, anon bị chặn**

Run (Supabase MCP `apply_migration` lên `qynpywysgltspmgnhhga`, rồi verify):
```sql
select relrowsecurity from pg_class where relname='customers';   -- expect: t
select relrowsecurity from pg_class where relname='customer_contacts'; -- expect: t
select count(*) from pg_policies where tablename='customers';    -- expect: 0 (anon chặn)
```
Expected: `customers` & `customer_contacts` tồn tại, RLS = true, 0 policy.

- [ ] **Step 3: Verify anon key KHÔNG đọc được**

Run (REST bằng anon key):
```bash
curl -s "$SUPABASE_URL/rest/v1/customers?select=id" -H "apikey: $ANON_KEY" | head
```
Expected: mảng rỗng `[]` hoặc lỗi RLS — KHÔNG trả dữ liệu.

- [ ] **Step 4: Commit migration**

```bash
git -C GWT-Masterdata add supabase/migrations/<UTCts>_cskh_customers.sql tests/cskh/test_customers_schema.sql
git -C GWT-Masterdata commit -m "feat(cskh): add customers + customer_contacts tables with RLS"
```

---

### Task 2: Migration — installed_base + warranty

**Files:**
- Create: `GWT-Masterdata/supabase/migrations/<UTCts>_cskh_installed_base.sql`
- Test: `GWT-Masterdata/tests/cskh/test_installed_base_schema.sql`

**Interfaces:**
- Consumes: `customers.id`, `customer_contacts.id` (Task 1); `products.code` (masterdata sẵn có).
- Produces: bảng `public.installed_base(serial text PK, product_code text→products.code nullable, model_freetext text, customer_id uuid, parent_serial text self-FK, notify_contact_id uuid, install_date date, install_address text, channel_source text, status text, created_at, updated_at)`; bảng `public.warranty(id uuid, serial text→installed_base, activated bool, start_date date, full_end date, core_end date, policy_note text)`.

- [ ] **Step 1: Viết migration SQL**

```sql
-- <UTCts>_cskh_installed_base.sql
create table if not exists public.installed_base (
  serial text primary key,
  product_code text references public.products(code),
  model_freetext text,
  customer_id uuid references public.customers(id),
  parent_serial text references public.installed_base(serial),
  notify_contact_id uuid references public.customer_contacts(id),
  install_date date,
  install_address text,
  channel_source text,
  status text not null default 'active' check (status in ('active','moved','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_product_or_freetext check (product_code is not null or model_freetext is not null)
);
create index if not exists idx_installed_base_customer on public.installed_base(customer_id);
create index if not exists idx_installed_base_parent on public.installed_base(parent_serial);

create table if not exists public.warranty (
  id uuid primary key default gen_random_uuid(),
  serial text not null references public.installed_base(serial) on delete cascade,
  activated boolean not null default false,
  start_date date,
  full_end date,
  core_end date,
  policy_note text
);
create index if not exists idx_warranty_serial on public.warranty(serial);

alter table public.installed_base enable row level security;
alter table public.warranty enable row level security;
-- CSKH domain: không policy anon.
```

- [ ] **Step 2: Áp migration & verify**

Run:
```sql
select relrowsecurity from pg_class where relname in ('installed_base','warranty'); -- expect t,t
insert into public.installed_base(serial, model_freetext) values ('TEST-CHK-1','TQ test'); -- ràng buộc chk_product_or_freetext qua
delete from public.installed_base where serial='TEST-CHK-1';
```
Expected: RLS = true; insert máy TQ (product_code null + model_freetext) qua được check constraint.

- [ ] **Step 3: Commit**

```bash
git -C GWT-Masterdata add supabase/migrations/<UTCts>_cskh_installed_base.sql tests/cskh/test_installed_base_schema.sql
git -C GWT-Masterdata commit -m "feat(cskh): add installed_base + warranty tables with RLS"
```

---

### Task 3: Migration — RPC `activate_warranty(serial)`

**Files:**
- Create: `GWT-Masterdata/supabase/migrations/<UTCts>_cskh_activate_warranty.sql`
- Test: `GWT-Masterdata/tests/cskh/test_activate_warranty.sql`

**Interfaces:**
- Consumes: `installed_base.serial`, `installed_base.product_code`; `products.warranty_full_years`, `products.warranty_core_years`.
- Produces: function `public.activate_warranty(p_serial text, p_start date default current_date) returns public.warranty` — tạo/cập nhật 1 dòng `warranty` cho serial, tính `full_end`/`core_end` từ số năm bảo hành của `product_code`. Nếu `product_code` null (máy TQ) → `full_end`/`core_end` = null, chỉ set `activated`+`start_date`.

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
  select p.warranty_full_years, p.warranty_core_years
    into v_full_years, v_core_years
  from public.installed_base ib
  left join public.products p on p.code = ib.product_code
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

> Lưu ý: cần unique constraint trên `warranty.serial` để `on conflict (serial)` chạy. Thêm ngay trong migration này:
```sql
alter table public.warranty add constraint uq_warranty_serial unique (serial);
```

- [ ] **Step 2: Test trên serial thật đã có trong masterdata**

Run:
```sql
-- Chuẩn bị: 1 serial POU có product_code hợp lệ (vd CTD50NG là SKU → cần product_code gốc)
insert into public.customers(full_name) values ('Test KH') returning id \gset
insert into public.installed_base(serial, product_code, customer_id) values ('TEST-W-1','CTS10', :'id');
select * from public.activate_warranty('TEST-W-1', date '2025-01-01');
-- expect: activated=true, start_date=2025-01-01, full_end/core_end tính từ products.warranty_*_years của CTS10
select full_end, core_end from public.warranty where serial='TEST-W-1';
-- cleanup
delete from public.warranty where serial='TEST-W-1';
delete from public.installed_base where serial='TEST-W-1';
delete from public.customers where full_name='Test KH';
```
Expected: dòng warranty với `full_end`/`core_end` đúng bằng start + số năm bảo hành của CTS10.

- [ ] **Step 3: Test máy TQ (product_code null)**

Run:
```sql
insert into public.installed_base(serial, model_freetext) values ('TEST-TQ-1','GTUN-5800EN');
select activated, full_end, core_end from public.activate_warranty('TEST-TQ-1', date '2025-01-01');
-- expect: activated=true, full_end=null, core_end=null
delete from public.warranty where serial='TEST-TQ-1';
delete from public.installed_base where serial='TEST-TQ-1';
```
Expected: activated=true, end dates null (không có số năm để tính).

- [ ] **Step 4: Commit**

```bash
git -C GWT-Masterdata add supabase/migrations/<UTCts>_cskh_activate_warranty.sql tests/cskh/test_activate_warranty.sql
git -C GWT-Masterdata commit -m "feat(cskh): add activate_warranty RPC computing end dates from masterdata"
```

---

### Task 4: Migration — view `v_installed_base` + dump snapshot + docs

**Files:**
- Create: `GWT-Masterdata/supabase/migrations/<UTCts>_cskh_v_installed_base.sql`
- Modify: `GWT-Masterdata/schema/current_schema.sql` (dump lại)
- Modify: `GWT-Masterdata/docs/schema-description.md` (thêm domain CSKH)

**Interfaces:**
- Consumes: customers, installed_base, warranty, products (các Task trước + masterdata).
- Produces: view `public.v_installed_base` trả `serial, product_code, product_name, kind, customer_id, customer_name, primary_phone, parent_serial, install_date, status, warranty_activated, warranty_full_end, warranty_core_end`.

- [ ] **Step 1: Viết view SQL (`security_invoker=true`)**

```sql
-- <UTCts>_cskh_v_installed_base.sql
create or replace view public.v_installed_base
with (security_invoker = true) as
select
  ib.serial,
  ib.product_code,
  coalesce(p.name_vie, ib.model_freetext) as product_name,
  p.kind,
  ib.customer_id,
  c.full_name as customer_name,
  c.primary_phone,
  ib.parent_serial,
  ib.install_date,
  ib.status,
  w.activated as warranty_activated,
  w.full_end as warranty_full_end,
  w.core_end as warranty_core_end
from public.installed_base ib
left join public.products p on p.code = ib.product_code
left join public.customers c on c.id = ib.customer_id
left join public.warranty w on w.serial = ib.serial;
```

- [ ] **Step 2: Áp migration & verify view chạy**

Run:
```sql
select * from public.v_installed_base limit 1; -- không lỗi (kể cả khi rỗng)
```
Expected: query chạy, cột đúng như interface.

- [ ] **Step 3: Dump snapshot + cập nhật docs**

Run:
```bash
# Dump schema hiện trạng (pg_dump schema-only qua connection string service_role)
supabase db dump --schema public -f GWT-Masterdata/schema/current_schema.sql
```
Thêm mục "NHÓM 4 · CSKH" vào `docs/schema-description.md` mô tả 4 bảng + view mới (customers, customer_contacts, installed_base, warranty, v_installed_base) — nêu rõ RLS: anon KHÔNG đọc.

- [ ] **Step 4: Commit cả bộ (migration + snapshot + docs)**

```bash
git -C GWT-Masterdata add supabase/migrations/<UTCts>_cskh_v_installed_base.sql schema/current_schema.sql docs/schema-description.md
git -C GWT-Masterdata commit -m "feat(cskh): add v_installed_base view; refresh snapshot + docs"
```

---

### Task 5: Script di trú Odoo → Supabase (Python, TDD)

**Files:**
- Create: `GWT-CustomerCare/migrate/odoo_serials.py`
- Create: `GWT-CustomerCare/migrate/parse.py`
- Test: `GWT-CustomerCare/migrate/tests/test_parse.py`
- Fixture: `GWT-CustomerCare/migrate/tests/fixtures/gwt_serial_sample.xlsx` (copy từ `Hệ thống CRM/GWT Serial (gwt.serial).xlsx`)

**Interfaces:**
- Consumes: view `v_installed_base`, RPC `activate_warranty` (server-side, service_role); masterdata `products`, `product_variants` để map mã.
- Produces:
  - `parse.split_source(customer_raw: str) -> tuple[str, str|None]` — `"Nguyễn Trung Hiếu (Shopee)"` → `("Nguyễn Trung Hiếu", "Shopee")`; không ngoặc → `(name, None)`.
  - `parse.extract_code(product_name: str) -> str|None` — `"[CTD50NG] Máy..."` → `"CTD50NG"`; không có ngoặc → `None`.
  - `parse.resolve_product_code(bracket_code: str, products: set[str], variants: dict[str,str]) -> str|None` — trả `products.code` nếu khớp; nếu là SKU thì trả `variants[sku]`; else `None`.
  - `odoo_serials.migrate(xlsx_path, supabase_client)` — upsert customers + installed_base, gọi `activate_warranty` cho dòng `Warranty activated = True`.

- [ ] **Step 1: Viết test parse (fail trước)**

```python
# tests/test_parse.py
from migrate import parse

def test_split_source_with_paren():
    assert parse.split_source("Nguyễn Trung Hiếu (Shopee)") == ("Nguyễn Trung Hiếu", "Shopee")

def test_split_source_no_paren():
    assert parse.split_source("Bùi Thu Hà") == ("Bùi Thu Hà", None)

def test_extract_code():
    assert parse.extract_code("[CTD50NG] Máy lọc nước GE CTD50") == "CTD50NG"
    assert parse.extract_code("Máy không mã") is None

def test_resolve_product_code_direct():
    assert parse.resolve_product_code("GEUT-50B04-G", {"GEUT-50B04-G"}, {}) == "GEUT-50B04-G"

def test_resolve_product_code_via_sku():
    assert parse.resolve_product_code("CTS10NB", {"CTS10"}, {"CTS10NB": "CTS10"}) == "CTS10"

def test_resolve_product_code_unknown():
    assert parse.resolve_product_code("XYZ", {"CTS10"}, {}) is None
```

- [ ] **Step 2: Chạy test — verify FAIL**

Run: `cd GWT-CustomerCare && python -m pytest migrate/tests/test_parse.py -v`
Expected: FAIL (`ModuleNotFoundError: migrate.parse`).

- [ ] **Step 3: Viết `parse.py`**

```python
# migrate/parse.py
import re

_PAREN = re.compile(r"^(.*?)\s*\(([^)]+)\)\s*$")
_BRACKET = re.compile(r"\[([^\]]+)\]")

def split_source(customer_raw: str):
    m = _PAREN.match(customer_raw.strip())
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return customer_raw.strip(), None

def extract_code(product_name: str):
    if not product_name:
        return None
    m = _BRACKET.search(product_name)
    return m.group(1).strip() if m else None

def resolve_product_code(bracket_code, products, variants):
    if bracket_code in products:
        return bracket_code
    if bracket_code in variants:
        return variants[bracket_code]
    return None
```

- [ ] **Step 4: Chạy test — verify PASS**

Run: `python -m pytest migrate/tests/test_parse.py -v`
Expected: 6 passed.

- [ ] **Step 5: Viết `odoo_serials.migrate` (upsert + activate)**

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

def migrate(xlsx_path, sb):
    products = {r["code"] for r in sb.table("products").select("code").execute().data}
    variants = {r["sku"]: r["product_code"]
                for r in sb.table("product_variants").select("sku,product_code").execute().data}
    rows = load_rows(xlsx_path)
    seen_customers = {}   # name -> customer_id
    stats = {"installed": 0, "activated": 0, "skipped_stock": 0}

    for r in rows:
        serial = (r.get("Serial") or "").strip()
        cust_raw = (r.get("Customer") or "").strip()
        if not serial or not cust_raw:
            stats["skipped_stock"] += 1          # tồn kho, chưa gắn khách
            continue
        name, source = parse.split_source(cust_raw)
        if name not in seen_customers:
            cid = sb.table("customers").insert(
                {"full_name": name, "source": source}).execute().data[0]["id"]
            seen_customers[name] = cid
        code = parse.resolve_product_code(parse.extract_code(r.get("Product name") or ""),
                                          products, variants)
        sb.table("installed_base").upsert({
            "serial": serial,
            "product_code": code,
            "model_freetext": None if code else parse.extract_code(r.get("Product name") or ""),
            "customer_id": seen_customers[name],
            "parent_serial": (r.get("Parent serial") or None),
        }).execute()
        stats["installed"] += 1
        if r.get("Warranty activated") in (True, "True", "true", 1):
            start = r.get("Activated date")
            sb.rpc("activate_warranty",
                   {"p_serial": serial, "p_start": str(start)[:10] if start else None}).execute()
            stats["activated"] += 1
    return stats
```

> `parent_serial` phải trỏ tới serial đã tồn tại → chạy 2 lượt: lượt 1 upsert mọi serial (bỏ parent), lượt 2 update `parent_serial`. Nếu export không đảm bảo thứ tự cha-trước-con, tách thành 2 vòng trong `migrate`.

- [ ] **Step 6: Test integration trên fixture (staging project, KHÔNG phải live)**

Run: `python -m pytest migrate/tests/test_migrate_integration.py -v` (nối 1 Supabase project TRỐNG để test; assert `stats["installed"]` > 0 và `v_installed_base` có dòng).
Expected: PASS trên project staging.

- [ ] **Step 7: Commit**

```bash
git -C GWT-CustomerCare add migrate/
git -C GWT-CustomerCare commit -m "feat(migrate): Odoo serial export -> Supabase installed_base + warranty"
```

> ⚠️ Chạy thật lên live CHỈ sau khi có export đầy đủ 1.594 serial và đã review `stats`. Dùng service_role key server-side.

---

### Task 6: Retool ops app MVP (acceptance checklist)

**Files:**
- Create: `GWT-CustomerCare/retool/README.md` (ghi cấu hình app + resource)

**Interfaces:**
- Consumes: `v_installed_base`, bảng `customers`, `customer_contacts`, RPC `activate_warranty`.
- Produces: app Retool "GWT CSKH" với 2 màn hình (Khách hàng, Máy đã lắp) + nút kích hoạt bảo hành.

- [ ] **Step 1: Nối resource Postgres tới Supabase**

Trong Retool → Resources → New → PostgreSQL: host/port/db/user từ Supabase connection string (dùng service_role DB user hoặc Postgres pooler `...pooler.supabase.com`). Test connection → OK.
Ghi lại cấu hình (không kèm mật khẩu) vào `retool/README.md`.

- [ ] **Step 2: Màn hình "Máy đã lắp"**

- Table bind query `select * from v_installed_base order by install_date desc nulls last`.
- Search input filter theo `serial` hoặc `customer_name` hoặc `primary_phone`.
- Cột hiển thị trạng thái bảo hành (activated + full_end).
- Acceptance: mở app → thấy serial đã migrate, tìm theo tên khách ra đúng máy.

- [ ] **Step 3: Nút "Kích hoạt bảo hành"**

- Trên row máy chưa activated → nút chạy query `select * from activate_warranty({{ table.selectedRow.serial }}, {{ datePicker.value }})`.
- Sau khi chạy → refresh table.
- Acceptance: chọn 1 serial chưa activated, bấm kích hoạt với ngày bắt đầu → row cập nhật `warranty_activated=true`, `full_end` đúng số năm bảo hành.

- [ ] **Step 4: Màn hình "Khách hàng"**

- Table `select id, full_name, primary_phone, source, province from customers order by created_at desc`.
- Detail panel: form sửa khách + list `customer_contacts` (thêm SĐT với role owner/family/helper/manager).
- Acceptance: thêm 1 SĐT giúp việc cho 1 khách → xuất hiện trong `customer_contacts`.

- [ ] **Step 5: Ghi tài liệu bàn giao**

Viết `retool/README.md`: URL app, resource, danh sách query, cách cấp quyền user CSKH. Commit.
```bash
git -C GWT-CustomerCare add retool/README.md
git -C GWT-CustomerCare commit -m "docs(retool): GWT CSKH ops app MVP config"
```

---

## Definition of Done (Phase 0)

- 4 bảng + 1 view CSKH sống trên `qynpywysgltspmgnhhga`, RLS bật, anon không đọc được.
- RPC `activate_warranty` tính đúng `full_end`/`core_end` từ masterdata; xử đúng máy TQ (null).
- Snapshot `current_schema.sql` + `docs/schema-description.md` đã cập nhật & commit ở GWT-Masterdata.
- Script di trú chạy được trên export Odoo (mẫu qua test; live khi có export đầy đủ), sinh `stats`.
- Retool app: tra cứu khách/serial theo tên–SĐT–serial, kích hoạt bảo hành, quản lý đa-SĐT.

## Ngoài phạm vi Phase 0 (phase sau)

- `tickets` + ops ghi nhận lỗi → **Phase 1**.
- `ticket_issue_groups` + báo cáo lãnh đạo WhatsApp → **Phase 2**.
- `filter_schedule`/`salt_schedule`/`maintenance_*`/`water_profile` + reminder Zalo ZNS + `v_core_forecast` + mở rộng RPC thành `activate_and_seed` → **Phase 3**.
- `kb_articles` + knowledge agent → **Phase 4**.
- Làm giàu SĐT khách từ Excel "Theo Dõi"; dedup/gộp khách trùng.
- DB role least-privilege riêng cho Retool (MVP tạm dùng service_role).
