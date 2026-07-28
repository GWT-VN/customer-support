-- 02 — Đợt 1 tính năng ticket (2026-07-28): cờ Khẩn + nhật ký ghi chú theo thời gian.
-- Chỉ THÊM, không đụng dữ liệu cũ. App đọc v_tickets theo tên cột nên khan để cuối là được.

alter table public.tickets add column if not exists khan boolean not null default false;

create table if not exists public.ticket_note (
  id          uuid primary key default gen_random_uuid(),
  ticket_code text not null references public.tickets(ticket_code) on delete cascade,
  noi_dung    text not null,
  tac_gia     text,                 -- email nhân viên ghi (từ phiên đăng nhập)
  created_at  timestamptz not null default now()
);
create index if not exists idx_ticket_note_code on public.ticket_note(ticket_code, created_at desc);
alter table public.ticket_note enable row level security;  -- 0 policy: chỉ service_role (app)

-- Thêm t.khan vào cuối v_tickets (CREATE OR REPLACE không cho chèn cột giữa)
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
    t.khan
   FROM tickets t
     LEFT JOIN installed_base ib ON ib.serial = t.serial
     LEFT JOIN catalog_item ci ON ci."Mã nội bộ" = ib.internal_code
     LEFT JOIN cs_customers c ON c.id = t.customer_id
     LEFT JOIN cs_customers cm ON cm.id = ib.customer_id
     LEFT JOIN warranty w ON w.serial = t.serial
     LEFT JOIN warranty wp ON wp.serial = ib.parent_serial;
