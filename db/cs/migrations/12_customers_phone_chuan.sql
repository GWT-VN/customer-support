-- 12 — Chuẩn hoá SĐT bảng `customers` (mirror Sales) + view chờ kích hoạt dùng nó (2026-07-29)
--
-- Vấn đề: Google Sheet lưu SĐT dạng SỐ nên mất số 0 đầu — 201/203 dòng chỉ còn
-- 9 chữ số, không join thẳng được sang `cs_customers.primary_phone` (10 số).
--
-- Cách chữa: cột GENERATED. Bảng này là mirror 1 chiều (mỗi lần sync XOÁ SẠCH rồi
-- ghi lại), nên cột thường sẽ mất; cột generated nằm ở schema nên sống sót, và
-- không cần sửa gì bên Google Sheet.

begin;

alter table public.customers
  add column if not exists phone_chuan text
  generated always as (
    case
      when phone is null or btrim(phone) = '' then null
      when length(regexp_replace(phone, '\D', '', 'g')) = 9  then '0' || regexp_replace(phone, '\D', '', 'g')
      when length(regexp_replace(phone, '\D', '', 'g')) = 10
       and left(regexp_replace(phone, '\D', '', 'g'), 1) = '0' then regexp_replace(phone, '\D', '', 'g')
      else regexp_replace(phone, '\D', '', 'g')
    end
  ) stored;

create index if not exists customers_phone_chuan_idx on public.customers (phone_chuan);

comment on column public.customers.phone_chuan is
  'SĐT chuẩn hoá (thêm lại số 0 đầu). GENERATED -> tự tính, sync xoá-ghi không làm mất. Dùng cột này để ghép sang cs_customers.primary_phone.';

-- View chờ kích hoạt: join thẳng bằng phone_chuan (thay cho so 9 số cuối),
-- và bổ sung địa chỉ để CSKH kích hoạt ngay theo thông tin khách từ đơn hàng.
drop view if exists public.v_bh_cho_kich_hoat;

create view public.v_bh_cho_kich_hoat
with (security_invoker = true) as
select
  'da_lap_chua_kich_hoat'::text as nguon,
  ib.serial,
  ib.internal_code as ma_noi_bo,
  sr.ten_noi_bo,
  k.id             as customer_id,
  k.full_name      as ten_khach,
  k.primary_phone  as sdt_khach,
  k.address        as dia_chi,
  ib.install_date  as ngay_lap,
  null::date       as ngay_dat_hang,
  null::text       as ma_don,
  1                as so_luong,
  ib.created_at    as tao_luc
from public.installed_base ib
left join public.warranty        w  on w.serial  = ib.serial
left join public.serial_registry sr on sr.serial = ib.serial
left join public.cs_customers    k  on k.id      = ib.customer_id
where w.activated is not true

union all

select
  'don_sales_chua_gan_may'::text,
  null,
  cp.internal_code,
  cp.product_name,
  k.id,
  coalesce(k.full_name, c.name),
  coalesce(k.primary_phone, c.phone_chuan),
  coalesce(k.address, c.address),
  null::date,
  cp.order_date,
  cp.order_code,
  cp.quantity::int,
  cp.synced_at
from public.customer_purchases cp
join public.customers c on c.customer_code = cp.customer_code
left join public.cs_customers k on k.primary_phone = c.phone_chuan
where cp.category_l1 = 'Machines'
  and not exists (
    select 1 from public.installed_base ib
     where ib.customer_id = k.id
       and ib.internal_code = cp.internal_code
  );

comment on view public.v_bh_cho_kich_hoat is
  'Hàng chờ kích hoạt bảo hành cho CSKH. nguon=da_lap_chua_kich_hoat (có serial, bấm là xong) | don_sales_chua_gan_may (đơn bán có máy, chỉ cần điền serial). Kích hoạt xong dòng tự biến mất. CÓ PII -> security_invoker.';

commit;
