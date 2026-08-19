-- 26_map_customer_code_sales.sql
-- D1 — Map khách CSKH ↔ khách Sales theo SĐT chuẩn hoá (khớp 1:1, đã verify 0 nhập
-- nhằng / 0 CS trùng). Điền cs_customers.customer_code = customers.customer_code.
-- Cột customer_code trước đó TRỐNG 100% nên chỉ ĐIỀN, không ghi đè. SĐT là khoá
-- chính (user chốt), tên lệch (65 ca) chỉ là cách viết, vẫn map.

with norm_cs as (
  select id, regexp_replace(coalesce(primary_phone,''),'\D','','g') as p_raw
  from public.cs_customers where trang_thai is distinct from 'da_xoa'
),
cs as (
  select id, case when p_raw like '84%' then substr(p_raw,3)
                  when p_raw like '0%'  then substr(p_raw,2) else p_raw end as p
  from norm_cs
),
norm_sa as (
  select customer_code, regexp_replace(coalesce(phone_chuan,phone,''),'\D','','g') as p_raw
  from public.customers where customer_code is not null and customer_code <> ''
),
sa as (
  select customer_code, case when p_raw like '84%' then substr(p_raw,3)
                             when p_raw like '0%'  then substr(p_raw,2) else p_raw end as p
  from norm_sa
),
map as (
  select cs.id as cs_id, min(sa.customer_code) as sales_code
  from cs join sa on sa.p = cs.p and length(cs.p) >= 9
  group by cs.id
  having count(distinct sa.customer_code) = 1   -- chỉ map ca 1:1 xác định
)
update public.cs_customers c
set customer_code = m.sales_code, updated_at = now()
from map m
where c.id = m.cs_id
  and (c.customer_code is null or c.customer_code = '');
