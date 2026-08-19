-- ============================================================================
-- CSKH — DDL nguồn để DỰNG project Supabase MỚI (tách khỏi GWT-Masterdata)
-- Sinh 2026-07-24 bằng cách introspect TRỰC TIẾP Postgres sống của GWT-Masterdata
-- (qynpywysgltspmgnhhga), KHÔNG dựa vào snapshot/migration — vì 4 bảng
-- (issue_group, issue_override, maintenance_plan, maintenance_visit) không có
-- file migration nguồn (tạo trực tiếp qua MCP).
--
-- ⚠️ CHƯA ÁP — chờ có URL/key project mới (Phase 0 bước 3). File này là nguồn chuẩn.
--
-- KHÁC BIỆT so với bản gốc GWT-Masterdata (có chủ đích):
--   1. BỎ FK installed_base.internal_code -> catalog_item (không FK xuyên project).
--      Giữ cột text + index. Tính hợp lệ kiểm ở tầng RPC/mirror.
--   2. 6 bảng catalog trở thành BẢNG GƯƠNG read-only (mirror từ GWT-Masterdata qua
--      Edge Function cron). Giữ đúng tên bảng + tên cột (tiếng Việt) nên view/RPC
--      gần như không đổi.
--   3. activate_warranty phân biệt "mirror chưa có SKU" vs "SP không áp dụng BH"
--      (trước đây cả hai đều ra full_end=null giống nhau — lỗi âm thầm).
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ── Hàm dùng chung: tự cập nhật updated_at ──────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path to 'public','pg_temp'
as $$ begin new.updated_at = now(); return new; end; $$;

-- ============================================================================
-- PHẦN A · BẢNG GƯƠNG CATALOG (read-only, mirror từ GWT-Masterdata)
-- Đồng bộ định kỳ bằng Edge Function. App/RPC CSKH chỉ ĐỌC. Không FK sang các
-- bảng này (để mirror truncate+reload không vướng). Giữ "Last updated" cho
-- incremental sync.
-- ============================================================================

create table if not exists public.catalog_item (
  "STT" integer,
  "Danh mục cấp 1" text,
  "Danh mục cấp 2" text,
  "Danh mục cấp 3" text,
  "Máy liên quan" text,
  "Mã nội bộ" text primary key,
  "Tên ngắn gọn (đề xuất)" text,
  "Trạng thái" text,
  "Mã cũ" text,
  "Mã đối tác/Kho" text,
  "Thời gian thay" text,
  "Tính chất" text,
  "Note" text,
  "Last updated" timestamptz not null default now()
);

create table if not exists public.supplier_code (
  "Mã đối tác" text primary key,
  "Mã nội bộ" text not null,
  "Tên" text,
  "Loại mã" text,
  "Last updated" timestamptz not null default now()
);

create table if not exists public.catalog_category (
  "Cấp 1" text,
  "Cấp 2" text,
  "Cấp 3" text,
  "Mã danh mục" text primary key,
  "Mã cha" text,
  "Last updated" timestamptz not null default now(),
  "Tên" text,
  "Cấp" smallint
);

create table if not exists public.product_bundle (
  id bigint primary key,
  "STT" integer,
  "Mã thành phẩm" text,
  "Tên thành phẩm" text,
  "Mã thành phần" text,
  "Tên thành phần" text,
  "Số lượng" numeric,
  "Lưu ý" text,
  "Last updated" timestamptz not null default now()
);

create table if not exists public.product_filter (
  id bigint primary key,
  "STT" integer,
  "Máy (model)" text,
  "Mã lõi lọc" text,
  "Tên lõi lọc" text,
  "Chu kỳ thay (tháng)" text,
  "Ghi chú" text,
  "Last updated" timestamptz not null default now()
);

create table if not exists public.product_warranty (
  internal_code text primary key,
  full_years integer,
  core_years integer,
  core_scope text,
  warranty_text text,
  source text not null default 'mirror',
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- PHẦN B · 10 BẢNG CSKH (di trú nguyên trạng, dữ liệu cá nhân)
-- ============================================================================

-- ⚠️ ĐỔI TÊN customers -> cs_customers (2026-07-24): tránh đụng bảng `customers` mà
-- Sales sắp publish (khách + PII do Sales sở hữu — xem docs/specs/2026-07-24-cs-data-contract.md).
-- CS giữ bảng khách nội bộ TẠM (293 khách Odoo lịch sử) + cột customer_code để map dần
-- sang Sales.customers khi họ implement (Phase 5). Đối chiếu tăng dần, không mất link máy↔khách.
create table if not exists public.cs_customers (
  id uuid primary key default gen_random_uuid(),
  primary_phone text unique,               -- khoá tự nhiên; null được (khách Odoo chưa có SĐT)
  full_name text not null,
  source text, partner_ref text, province text, address text,
  needs_phone boolean not null default false,
  notes text,
  customer_code text,                       -- map sang Sales.customers.customer_code (null tới khi đối chiếu)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_cs_customers_needs_phone on public.cs_customers(needs_phone) where needs_phone;
create index if not exists idx_cs_customers_code on public.cs_customers(customer_code) where customer_code is not null;

create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.cs_customers(id) on delete cascade,
  phone text, contact_name text,
  role text check (role in ('owner','family','helper','manager','other')),
  is_primary boolean not null default false,
  zalo_ok boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_customer_contacts_customer on public.customer_contacts(customer_id);
create index if not exists idx_customer_contacts_phone on public.customer_contacts(phone);

create table if not exists public.installed_base (
  serial text primary key,
  internal_code text,                       -- ⚠️ BỎ FK -> catalog_item (mirror khác project). Giữ text + index.
  source_product_code text,
  model_freetext text,
  customer_id uuid references public.cs_customers(id),
  parent_serial text references public.installed_base(serial),   -- self-FK bộ lọc tổng mẹ/con
  notify_contact_id uuid references public.customer_contacts(id),
  install_date date, install_address text, channel_source text,
  status text not null default 'active' check (status in ('active','moved','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_code_or_freetext check (internal_code is not null or model_freetext is not null)
);
create index if not exists idx_installed_base_customer on public.installed_base(customer_id);
create index if not exists idx_installed_base_internal_code on public.installed_base(internal_code);
create index if not exists idx_installed_base_parent on public.installed_base(parent_serial);

create table if not exists public.warranty (
  id uuid primary key default gen_random_uuid(),
  serial text not null unique references public.installed_base(serial) on delete cascade,
  activated boolean not null default false,
  start_date date, full_end date, core_end date, policy_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tickets (
  ticket_code text primary key,             -- GWT-YYnnnn giữ nguyên từ Odoo
  serial text references public.installed_base(serial) on update cascade,
  source_serial text,
  customer_id uuid references public.cs_customers(id),
  source_customer text,
  ticket_type text,                          -- cố ý KHÔNG check (Odoo thêm loại bất kỳ lúc nào)
  state text not null default 'Open' check (state in ('Open','Done','Cancel')),
  description text, last_note text, province text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tickets_serial on public.tickets(serial);
create index if not exists idx_tickets_source_serial on public.tickets(source_serial);
create index if not exists idx_tickets_customer on public.tickets(customer_id);
create index if not exists idx_tickets_state on public.tickets(state);
create index if not exists idx_tickets_created on public.tickets(created_at desc);

create table if not exists public.filter_replacement (
  id uuid primary key default gen_random_uuid(),
  serial text not null references public.installed_base(serial) on update cascade on delete cascade,
  filter_code text not null,
  replaced_at date not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_filter_repl_serial on public.filter_replacement(serial);
create index if not exists idx_filter_repl_code on public.filter_replacement(serial, filter_code, replaced_at desc);

create table if not exists public.issue_group (
  code text primary key,
  ten text not null,
  mo_ta text,
  muc_do text not null check (muc_do in ('an_toan','nghiem_trong','thuong','nhe','khong_loi')),
  bao_hang boolean not null default false,
  mau_mo_ta text not null,
  mau_may text,
  thu_tu int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.issue_override (
  ticket_code text not null references public.tickets(ticket_code) on update cascade on delete cascade,
  group_code  text not null references public.issue_group(code)    on update cascade on delete cascade,
  gan boolean not null,
  ly_do text, nguoi_sua text,
  created_at timestamptz not null default now(),
  primary key (ticket_code, group_code)
);

create table if not exists public.maintenance_plan (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.cs_customers(id),
  serial text references public.installed_base(serial),
  source_folder text not null,
  source_customer_name text, source_phone text, bo_may text,
  loai_goi text not null check (loai_goi in ('hop_dong','tang_noi_bo')),
  ngay_ky_hd date, so_nam numeric, chu_ky_thang int, tong_lan int,
  ghi_chu text,
  trang_thai text not null default 'dang_hoat_dong'
    check (trang_thai in ('dang_hoat_dong','dung_phuc_vu','het_han')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_hop_dong_co_tong_lan check (loai_goi <> 'hop_dong' or tong_lan is not null)
);
create index if not exists idx_maintenance_plan_customer on public.maintenance_plan(customer_id);
create index if not exists idx_maintenance_plan_serial on public.maintenance_plan(serial);

create table if not exists public.maintenance_visit (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.maintenance_plan(id),
  asana_task_id text unique,
  section text, ten_task text, lan_thu int,
  due_date date, completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_maintenance_visit_plan on public.maintenance_visit(plan_id);
create index if not exists idx_maintenance_visit_due on public.maintenance_visit(due_date);

-- ── Trigger updated_at ──────────────────────────────────────────────────────
do $$ declare t text; begin
  foreach t in array array['cs_customers','installed_base','warranty','tickets','issue_group','maintenance_plan'] loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format('create trigger trg_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ============================================================================
-- PHẦN C · VIEW (nguyên văn từ bản gốc — bảng gương giữ đúng tên cột nên không đổi)
-- ============================================================================

create or replace view public.v_machine_filter with (security_invoker=true) as
with pf as (
  select trim(x) as model, pf."Mã lõi lọc" as filter_code, pf."Tên lõi lọc" as filter_name,
         pf."Chu kỳ thay (tháng)" as chu_ky_raw
  from public.product_filter pf,
       lateral unnest(string_to_array(replace(pf."Máy (model)", '/', E'\n'), E'\n')) x
  where trim(x) <> ''
),
parsed as (
  select model, filter_code, filter_name, chu_ky_raw,
         (regexp_match(chu_ky_raw, '(\d+)'))[1]::int as so_dau,
         (regexp_match(chu_ky_raw, '-\s*(\d+)'))[1]::int as so_sau,
         chu_ky_raw ~* 'năm' as la_nam
  from pf
),
chu_ky as (
  select model, filter_code, filter_name, chu_ky_raw,
         case when la_nam then so_dau*12 else so_dau end as thang_min,
         case when la_nam then coalesce(so_sau,so_dau)*12 else coalesce(so_sau,so_dau) end as thang_max
  from parsed
),
direct as (
  select ci."Mã nội bộ" as internal_code, k.filter_code, k.filter_name, k.chu_ky_raw,
         k.thang_min, k.thang_max, k.model as source_model,
         case when ci."Mã nội bộ" = k.model then 'mã nội bộ'
              when exists (select 1 from public.supplier_code sc where sc."Mã đối tác"=k.model and sc."Mã nội bộ"=ci."Mã nội bộ") then 'mã đối tác'
              else 'tên thương mại' end as cach_khop,
         null::text as via_component
  from chu_ky k
  join public.catalog_item ci on ci."Danh mục cấp 1"='Machines' and (
        ci."Mã nội bộ" = k.model
     or exists (select 1 from public.supplier_code sc where sc."Mã đối tác"=k.model and sc."Mã nội bộ"=ci."Mã nội bộ")
     or ci."Tên ngắn gọn (đề xuất)" ~* ('(^|[^A-Z0-9])'||k.model||'($|[^A-Z0-9])'))
   and ci."Mã nội bộ" <> 'GEUT-B04-G-NF'
),
via_bundle as (
  select b."Mã thành phẩm" as internal_code, d.filter_code, d.filter_name, d.chu_ky_raw,
         d.thang_min, d.thang_max, d.source_model, 'qua combo: '||b."Mã thành phần" as cach_khop,
         b."Mã thành phần" as via_component
  from public.product_bundle b join direct d on d.internal_code = b."Mã thành phần"
)
select * from direct union select * from via_bundle;

create or replace view public.v_installed_base with (security_invoker=true) as
select ib.serial, ib.internal_code,
  coalesce(ci."Tên ngắn gọn (đề xuất)", ib.model_freetext) as product_name,
  ci."Danh mục cấp 1" as category_l1, ci."Danh mục cấp 2" as category_l2,
  ib.source_product_code, ib.customer_id, c.full_name as customer_name, c.primary_phone, c.needs_phone,
  ib.parent_serial, ib.install_date, ib.install_address, ib.status,
  coalesce(case when w.id is not null then w.activated else wp.activated end, false) as warranty_activated,
  case when w.id is not null then w.start_date else wp.start_date end as warranty_start,
  case when w.id is not null then w.full_end   else wp.full_end   end as warranty_full_end,
  case when w.id is not null then w.core_end   else wp.core_end   end as warranty_core_end,
  case when (case when w.id is not null then w.full_end else wp.full_end end) is null then null
       else (case when w.id is not null then w.full_end else wp.full_end end) >= current_date end as con_han_may,
  case when (case when w.id is not null then w.core_end else wp.core_end end) is null then null
       else (case when w.id is not null then w.core_end else wp.core_end end) >= current_date end as con_han_loi,
  (pw.internal_code is not null) as co_chinh_sach_bh,
  (w.id is null and wp.id is not null) as bh_theo_me
from public.installed_base ib
left join public.catalog_item ci on ci."Mã nội bộ" = ib.internal_code
left join public.cs_customers c on c.id = ib.customer_id
left join public.warranty w on w.serial = ib.serial
left join public.warranty wp on wp.serial = ib.parent_serial
left join public.product_warranty pw on pw.internal_code = ib.internal_code;

create or replace view public.v_tickets with (security_invoker=true) as
select t.ticket_code, t.state, t.ticket_type, t.description, t.last_note, t.province, t.created_at,
  t.serial, t.source_serial,
  coalesce(ci."Tên ngắn gọn (đề xuất)", ib.model_freetext) as product_name, ib.internal_code,
  (t.source_serial is not null and t.serial is null) as may_khong_trong_he_thong,
  coalesce(t.customer_id, ib.customer_id) as customer_id,
  coalesce(c.full_name, cm.full_name, t.source_customer) as customer_name,
  coalesce(c.primary_phone, cm.primary_phone) as primary_phone,
  coalesce(case when w.id is not null then w.activated else wp.activated end, false) as warranty_activated,
  case when w.id is not null then w.full_end else wp.full_end end as warranty_full_end,
  case when w.id is not null then w.core_end else wp.core_end end as warranty_core_end,
  case when (case when w.id is not null then w.full_end else wp.full_end end) is null then null
       else (case when w.id is not null then w.full_end else wp.full_end end) >= current_date end as con_han_may,
  case when (case when w.id is not null then w.core_end else wp.core_end end) is null then null
       else (case when w.id is not null then w.core_end else wp.core_end end) >= current_date end as con_han_loi,
  (w.id is null and wp.id is not null) as bh_theo_me
from public.tickets t
left join public.installed_base ib on ib.serial = t.serial
left join public.catalog_item ci on ci."Mã nội bộ" = ib.internal_code
left join public.cs_customers c on c.id = t.customer_id
left join public.cs_customers cm on cm.id = ib.customer_id
left join public.warranty w on w.serial = t.serial
left join public.warranty wp on wp.serial = ib.parent_serial;

create or replace view public.v_core_forecast with (security_invoker=true) as
select ib.serial, ib.internal_code,
  coalesce(ci."Tên ngắn gọn (đề xuất)", ib.model_freetext) as product_name,
  mf.filter_code, mf.filter_name, mf.chu_ky_raw, mf.thang_min, mf.thang_max, ib.install_date,
  fr.replaced_at as lan_thay_gan_nhat,
  coalesce(fr.replaced_at, ib.install_date) as moc_tinh,
  (coalesce(fr.replaced_at, ib.install_date) + make_interval(months => mf.thang_min))::date as han_som,
  (coalesce(fr.replaced_at, ib.install_date) + make_interval(months => mf.thang_max))::date as han_muon,
  (coalesce(fr.replaced_at, ib.install_date) + make_interval(months => mf.thang_min))::date - current_date as con_bao_nhieu_ngay,
  case when ib.install_date is null then 'không rõ (máy thiếu ngày lắp)'
       when (coalesce(fr.replaced_at, ib.install_date) + make_interval(months => mf.thang_min))::date < current_date then 'QUÁ HẠN'
       when (coalesce(fr.replaced_at, ib.install_date) + make_interval(months => mf.thang_min))::date <= current_date + 30 then 'sắp đến hạn (≤30 ngày)'
       else 'còn hạn' end as tinh_trang,
  ib.customer_id, c.full_name as customer_name, c.primary_phone, c.needs_phone
from public.installed_base ib
join public.v_machine_filter mf on mf.internal_code = ib.internal_code
left join public.catalog_item ci on ci."Mã nội bộ" = ib.internal_code
left join public.cs_customers c on c.id = ib.customer_id
left join lateral (
  select r.replaced_at from public.filter_replacement r
  where r.serial = ib.serial and r.filter_code = mf.filter_code
  order by r.replaced_at desc limit 1
) fr on true
where ib.status = 'active'
  and not (mf.via_component is not null and exists (
    select 1 from public.installed_base ch
    where ch.parent_serial = ib.serial and ch.internal_code = mf.via_component and ch.status = 'active'));

create or replace view public.v_maintenance_due with (security_invoker=true) as
select mv.id as visit_id, mv.asana_task_id, mv.lan_thu, mv.due_date, mv.completed_at,
  mp.id as plan_id, mp.loai_goi, mp.tong_lan, mp.bo_may,
  coalesce(c.full_name, mp.source_customer_name) as customer_name,
  coalesce(c.primary_phone, mp.source_phone) as primary_phone,
  (mp.customer_id is null) as chua_khop_khach, mv.section,
  case when mv.completed_at is not null then 'đã xong'
       when mv.due_date is null then 'không rõ hạn'
       when mv.due_date < current_date then 'QUÁ HẠN'
       when mv.due_date <= current_date + 30 then 'sắp đến hạn (≤30 ngày)'
       else 'còn hạn' end as tinh_trang
from public.maintenance_visit mv
left join public.maintenance_plan mp on mp.id = mv.plan_id
left join public.cs_customers c on c.id = mp.customer_id;

-- ============================================================================
-- PHẦN D · RPC activate_warranty — cải tiến phân biệt mirror-lag vs không-áp-dụng-BH
-- Bản gốc: catalog chưa có internal_code VÀ product_warranty không có dòng đều ra
-- full_end=null giống hệt SP "Không áp dụng BH" -> lỗi âm thầm. Nay:
--   - internal_code có nhưng KHÔNG thấy trong catalog_item mirror -> RAISE WARNING
--     + ghi dấu vào policy_note (nghi mirror lag, cần kiểm), KHÔNG chặn kích hoạt.
--   - internal_code có trong catalog nhưng product_warranty rỗng -> SP không áp dụng
--     BH hợp lệ, ghi policy_note bình thường.
-- Giữ nguyên return type `warranty` để app hiện tại (chỉ check error) không phải đổi.
-- ============================================================================
create or replace function public.activate_warranty(p_serial text, p_start date default current_date)
returns public.warranty language plpgsql security definer set search_path to 'public'
as $$
declare
  v_full int; v_core int; v_note text;
  v_internal text; v_in_catalog boolean; v_row public.warranty;
begin
  select ib.internal_code, pw.full_years, pw.core_years, pw.core_scope
    into v_internal, v_full, v_core, v_note
  from public.installed_base ib
  left join public.product_warranty pw on pw.internal_code = ib.internal_code
  where ib.serial = p_serial;

  if not found then
    raise exception 'serial % không có trong installed_base', p_serial;
  end if;
  if p_start is null then
    raise exception 'p_start không được null (serial %)', p_serial;
  end if;

  -- Phân biệt mirror-lag: internal_code có nhưng không thấy trong catalog gương.
  if v_internal is not null then
    select exists(select 1 from public.catalog_item ci where ci."Mã nội bộ" = v_internal)
      into v_in_catalog;
    if not v_in_catalog then
      raise warning 'internal_code % chưa có trong catalog mirror (nghi mirror lag) — serial %', v_internal, p_serial;
      v_note := coalesce(v_note || ' | ', '') || '⚠️ internal_code chưa có trong catalog mirror lúc kích hoạt, hạn BH có thể tính thiếu — kiểm lại sau khi mirror đồng bộ.';
    end if;
  end if;

  insert into public.warranty(serial, activated, start_date, full_end, core_end, policy_note)
  values (p_serial, true, p_start,
    case when v_full is not null then (p_start + make_interval(years => v_full))::date end,
    case when v_core is not null then (p_start + make_interval(years => v_core))::date end,
    v_note)
  on conflict (serial) do update
    set activated=true, start_date=excluded.start_date, full_end=excluded.full_end,
        core_end=excluded.core_end, policy_note=excluded.policy_note
  returning * into v_row;
  return v_row;
end; $$;

-- ============================================================================
-- PHẦN E · RLS
--   - 10 bảng CSKH: RLS bật, CỐ Ý 0 policy (dữ liệu cá nhân, chỉ service_role).
--   - 6 bảng gương catalog: RLS bật + policy select_all cho anon/authenticated
--     (giống bản gốc — không nhạy cảm; nhưng chỉ service_role/Edge Function GHI).
-- ============================================================================
do $$ declare t text; begin
  foreach t in array array['cs_customers','customer_contacts','installed_base','warranty',
                           'tickets','filter_replacement','issue_group','issue_override',
                           'maintenance_plan','maintenance_visit'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
  foreach t in array array['catalog_item','supplier_code','catalog_category',
                           'product_bundle','product_filter','product_warranty'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_select_all on public.%I', t, t);
    execute format('create policy %I_select_all on public.%I for select to anon, authenticated using (true)', t, t);
  end loop;
end $$;

revoke all on function public.activate_warranty(text, date) from anon, authenticated;
