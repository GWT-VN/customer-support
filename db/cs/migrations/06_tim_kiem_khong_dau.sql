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

-- ─────────────────────────────────────────────────────────────────────────────
-- Tạo lại view để lộ ten_kd/dia_chi_kd — GIỮ NGUYÊN mọi cột cũ, không đổi tên,
-- không đổi thứ tự (app đang select('*')). Chỉ THÊM 2 cột mới vào cuối.
-- Định nghĩa gốc lấy từ pg_views (bwzmqfbcgouhvhoslmmm) trước khi sửa, đã qua
-- migration 02_ticket_khan_note.sql và 03_ticket_staff_muc.sql.
--
-- v_tickets có HAI đường tới cs_customers (c qua t.customer_id, cm qua
-- ib.customer_id) — customer_name gốc đã coalesce(c.full_name, cm.full_name,
-- t.source_customer) nên ten_kd/dia_chi_kd cũng coalesce theo đúng khuôn đó,
-- để lộ MỘT cột mỗi loại thay vì bốn cột theo từng alias.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view public.v_installed_base
with (security_invoker = true) as
select
  ib.serial,
  ib.internal_code,
  coalesce(ci."Tên ngắn gọn (đề xuất)", ib.model_freetext) as product_name,
  ci."Danh mục cấp 1" as category_l1,
  ci."Danh mục cấp 2" as category_l2,
  ib.source_product_code,
  ib.customer_id,
  c.full_name as customer_name,
  c.primary_phone,
  c.needs_phone,
  ib.parent_serial,
  ib.install_date,
  ib.install_address,
  ib.status,
  coalesce(
    case when w.id is not null then w.activated else wp.activated end, false
  ) as warranty_activated,
  case when w.id is not null then w.start_date else wp.start_date end as warranty_start,
  case when w.id is not null then w.full_end else wp.full_end end as warranty_full_end,
  case when w.id is not null then w.core_end else wp.core_end end as warranty_core_end,
  case
    when (case when w.id is not null then w.full_end else wp.full_end end) is null then null::boolean
    else (case when w.id is not null then w.full_end else wp.full_end end) >= current_date
  end as con_han_may,
  case
    when (case when w.id is not null then w.core_end else wp.core_end end) is null then null::boolean
    else (case when w.id is not null then w.core_end else wp.core_end end) >= current_date
  end as con_han_loi,
  (pw.internal_code is not null) as co_chinh_sach_bh,
  ((w.id is null) and (wp.id is not null)) as bh_theo_me,
  -- MOI: cot bo dau de tim kiem khong dau (xem ham public.khong_dau o tren)
  c.ten_kd,
  c.dia_chi_kd
from installed_base ib
  left join catalog_item ci on ci."Mã nội bộ" = ib.internal_code
  left join cs_customers c on c.id = ib.customer_id
  left join warranty w on w.serial = ib.serial
  left join warranty wp on wp.serial = ib.parent_serial
  left join product_warranty pw on pw.internal_code = ib.internal_code;

create or replace view public.v_tickets
with (security_invoker = true) as
select
  t.ticket_code,
  t.state,
  t.ticket_type,
  t.description,
  t.last_note,
  t.province,
  t.created_at,
  t.serial,
  t.source_serial,
  coalesce(ci."Tên ngắn gọn (đề xuất)", ib.model_freetext) as product_name,
  ib.internal_code,
  ((t.source_serial is not null) and (t.serial is null)) as may_khong_trong_he_thong,
  coalesce(t.customer_id, ib.customer_id) as customer_id,
  coalesce(c.full_name, cm.full_name, t.source_customer) as customer_name,
  coalesce(c.primary_phone, cm.primary_phone) as primary_phone,
  coalesce(
    case when w.id is not null then w.activated else wp.activated end, false
  ) as warranty_activated,
  case when w.id is not null then w.full_end else wp.full_end end as warranty_full_end,
  case when w.id is not null then w.core_end else wp.core_end end as warranty_core_end,
  case
    when (case when w.id is not null then w.full_end else wp.full_end end) is null then null::boolean
    else (case when w.id is not null then w.full_end else wp.full_end end) >= current_date
  end as con_han_may,
  case
    when (case when w.id is not null then w.core_end else wp.core_end end) is null then null::boolean
    else (case when w.id is not null then w.core_end else wp.core_end end) >= current_date
  end as con_han_loi,
  ((w.id is null) and (wp.id is not null)) as bh_theo_me,
  t.khan,
  t.cs_phu_trach,
  t.ky_thuat,
  scs.ten as cs_ten,
  skt.ten as ky_thuat_ten,
  -- MOI: cot bo dau de tim kiem khong dau; ticket co 2 duong toi cs_customers
  -- (c qua t.customer_id, cm qua ib.customer_id) nen coalesce nhu customer_name.
  -- ten_kd them fallback thu 3 tu t.source_customer (khach chua dang ky trong
  -- cs_customers, may_khong_trong_he_thong=true) de khop DUNG voi 3 fallback
  -- cua customer_name goc — thieu fallback nay thi 8/83 ticket bien mat khoi
  -- ket qua tim kiem du ten van hien tren man hinh qua customer_name.
  -- dia_chi_kd GIU 2 fallback: tickets khong co nguon dia chi tu-do tuong duong.
  coalesce(c.ten_kd, cm.ten_kd, public.khong_dau(t.source_customer)) as ten_kd,
  coalesce(c.dia_chi_kd, cm.dia_chi_kd) as dia_chi_kd
from tickets t
  left join installed_base ib on ib.serial = t.serial
  left join catalog_item ci on ci."Mã nội bộ" = ib.internal_code
  left join cs_customers c on c.id = t.customer_id
  left join cs_customers cm on cm.id = ib.customer_id
  left join warranty w on w.serial = t.serial
  left join warranty wp on wp.serial = ib.parent_serial
  left join staff scs on scs.id = t.cs_phu_trach
  left join staff skt on skt.id = t.ky_thuat;
