-- 03 — Đợt 2 ticket (2026-07-28): người xử lý (staff) + chi phí/vật tư/đổi serial (ticket_muc).
-- Chỉ THÊM. v_tickets thêm cột người phụ trách ở cuối (CREATE OR REPLACE không cho chèn giữa).

create table if not exists public.staff (
  id       uuid primary key default gen_random_uuid(),
  email    text unique,
  ten      text not null,
  vai_tro  text not null default 'cs',      -- cs | ky_thuat | quan_ly | admin (dùng cho Đợt 3)
  hoat_dong boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.staff enable row level security;
insert into public.staff (email, ten, vai_tro) values
  ('admin@gwt.vn','Admin','admin'),
  ('ai@gwt.vn','AI','admin'),
  ('bella@gwt.vn','Bella','cs'),
  ('marketing@gwt.vn','Marketing','cs'),
  ('tk@gwt.vn','Thu Kho','cs')
on conflict (email) do nothing;

alter table public.tickets add column if not exists cs_phu_trach uuid references public.staff(id);
alter table public.tickets add column if not exists ky_thuat     uuid references public.staff(id);

create table if not exists public.ticket_muc (
  id          uuid primary key default gen_random_uuid(),
  ticket_code text not null references public.tickets(ticket_code) on delete cascade,
  loai        text not null check (loai in ('thu_phi','vat_tu','doi_may')),
  mo_ta       text,
  so_tien     numeric,
  tinh_phi    boolean not null default false,   -- true=thu phí khách · false=miễn phí
  serial_cu   text,
  serial_moi  text,
  tac_gia     text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_ticket_muc_code on public.ticket_muc(ticket_code, created_at);
alter table public.ticket_muc enable row level security;

create or replace view public.v_tickets as
 SELECT t.ticket_code, t.state, t.ticket_type, t.description, t.last_note, t.province, t.created_at,
    t.serial, t.source_serial,
    COALESCE(ci."Tên ngắn gọn (đề xuất)", ib.model_freetext) AS product_name,
    ib.internal_code,
    t.source_serial IS NOT NULL AND t.serial IS NULL AS may_khong_trong_he_thong,
    COALESCE(t.customer_id, ib.customer_id) AS customer_id,
    COALESCE(c.full_name, cm.full_name, t.source_customer) AS customer_name,
    COALESCE(c.primary_phone, cm.primary_phone) AS primary_phone,
    COALESCE(CASE WHEN w.id IS NOT NULL THEN w.activated ELSE wp.activated END, false) AS warranty_activated,
    CASE WHEN w.id IS NOT NULL THEN w.full_end ELSE wp.full_end END AS warranty_full_end,
    CASE WHEN w.id IS NOT NULL THEN w.core_end ELSE wp.core_end END AS warranty_core_end,
    CASE WHEN CASE WHEN w.id IS NOT NULL THEN w.full_end ELSE wp.full_end END IS NULL THEN NULL::boolean
         ELSE CASE WHEN w.id IS NOT NULL THEN w.full_end ELSE wp.full_end END >= CURRENT_DATE END AS con_han_may,
    CASE WHEN CASE WHEN w.id IS NOT NULL THEN w.core_end ELSE wp.core_end END IS NULL THEN NULL::boolean
         ELSE CASE WHEN w.id IS NOT NULL THEN w.core_end ELSE wp.core_end END >= CURRENT_DATE END AS con_han_loi,
    w.id IS NULL AND wp.id IS NOT NULL AS bh_theo_me,
    t.khan,
    t.cs_phu_trach, t.ky_thuat,
    scs.ten AS cs_ten, skt.ten AS ky_thuat_ten
   FROM tickets t
     LEFT JOIN installed_base ib ON ib.serial = t.serial
     LEFT JOIN catalog_item ci ON ci."Mã nội bộ" = ib.internal_code
     LEFT JOIN cs_customers c ON c.id = t.customer_id
     LEFT JOIN cs_customers cm ON cm.id = ib.customer_id
     LEFT JOIN warranty w ON w.serial = t.serial
     LEFT JOIN warranty wp ON wp.serial = ib.parent_serial
     LEFT JOIN staff scs ON scs.id = t.cs_phu_trach
     LEFT JOIN staff skt ON skt.id = t.ky_thuat;
