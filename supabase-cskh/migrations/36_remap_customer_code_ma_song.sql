-- Remap cs_customers.customer_code từ mã CHẾT (0 đơn) sang mã SỐNG (có đơn).
--
-- Bối cảnh: bug trùng customer_code phía Sales (build DM_KHACH index SĐT chưa chuẩn
-- hoá → 1 người 2 mã). CS map (migration 26) trúng mã cũ KHÔNG có đơn → v_customer_360
-- ra 0 đơn cho cả 120 khách đã map. Sales báo bug này ở Sales-CS-hop-dong-sales_orders.md §5.
--
-- Soi DB 2026-08-12: 120/120 mã CS map = 0 đơn; 120/120 đều có ĐÚNG 1 mã sống cùng SĐT
-- (0 nhập nhằng, 0 mã mới trùng). → remap 1-1 theo SĐT → mã có đơn ("ưu tiên mã sống").
--
-- ĐÃ ÁP qua MCP 2026-08-12. Verify sau remap: 120/120 trỏ mã có đơn; v_customer_360
-- hiện 120 khách / 145 đơn (trước: 0). Backup giữ để revert + đối chiếu bảng canonical Sales.

-- Backup mapping cũ→mới (giữ lại, KHÔNG drop — dùng đối chiếu canonical của Sales sau).
create table if not exists public.cs_customer_code_remap_20260812 (
  cs_id uuid primary key,
  ma_cu text,
  ma_moi text,
  phone text,
  remap_luc timestamptz default now()
);

with live as (
  select distinct c.customer_code, c.phone_chuan
  from public.customers c
  join (select distinct customer_code from public.customer_purchases) p on p.customer_code = c.customer_code
  where c.phone_chuan is not null
)
insert into public.cs_customer_code_remap_20260812 (cs_id, ma_cu, ma_moi, phone)
select cs.id, cs.customer_code,
       (select l.customer_code from live l where l.phone_chuan = cs.primary_phone),
       cs.primary_phone
from public.cs_customers cs
where cs.customer_code is not null
  and (select count(*) from live l where l.phone_chuan = cs.primary_phone) = 1
  and cs.customer_code <> (select l.customer_code from live l where l.phone_chuan = cs.primary_phone)
on conflict (cs_id) do nothing;

-- Remap (chỉ dòng đúng mã_cũ để idempotent — chạy lại không đụng dòng đã sửa).
update public.cs_customers cs
set customer_code = r.ma_moi, updated_at = now()
from public.cs_customer_code_remap_20260812 r
where r.cs_id = cs.id and cs.customer_code = r.ma_cu;
