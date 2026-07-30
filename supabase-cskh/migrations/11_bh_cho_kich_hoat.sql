-- 11 — Hàng chờ kích hoạt bảo hành + đổi tên trạng thái serial (2026-07-29)
--
-- User chốt:
--   * `ton_kho` đổi tên thành `chua_kich_hoat`.
--   * "Đơn sales nào tạo với máy thì đẩy ra request pending cần kích hoạt BH,
--      kích hoạt xong thì khỏi bảng" -> làm bằng VIEW, không phải bảng:
--      dòng TỰ BIẾN MẤT khi warranty.activated = true, không cần job dọn rác,
--      không có nguy cơ bảng pending lệch với sự thật ở installed_base/warranty.

begin;

create or replace view public.v_serial_kho
with (security_invoker = true) as
select
  s.stt, s.serial,
  s.internal_code as ma_noi_bo, s.ten_noi_bo, s.model as ma_goc, s.po,
  case
    when w.activated is true   then 'da_kich_hoat'
    when ib.serial is not null then 'da_lap_chua_kich_hoat'
    else                            'chua_kich_hoat'
  end as trang_thai,
  (ib.serial is not null)      as da_lap,
  coalesce(w.activated, false) as bh_kich_hoat,
  ib.customer_id, k.full_name as ten_khach, k.primary_phone as sdt_khach,
  ib.install_date as ngay_lap, ib.parent_serial as serial_me,
  w.start_date as bh_bat_dau, w.full_end as bh_het_han, w.core_end as bh_loi_het_han,
  s.created_at, s.updated_at
from public.serial_registry s
left join public.installed_base ib on ib.serial = s.serial
left join public.warranty      w  on w.serial  = s.serial
left join public.cs_customers  k  on k.id      = ib.customer_id;

-- Hai nguồn việc cho CSKH:
--   A. Máy đã lắp (có serial) mà warranty chưa activated -> bấm kích hoạt được ngay.
--   B. Đơn sales có MÁY mà chưa thấy máy nào lắp cho khách đó -> phải gắn serial trước.
-- SĐT bên sales mất số 0 đầu (Google Sheet lưu dạng số) -> ghép theo 9 số cuối.
create or replace view public.v_bh_cho_kich_hoat
with (security_invoker = true) as
select
  'da_lap_chua_kich_hoat'::text as nguon,
  ib.serial,
  ib.internal_code as ma_noi_bo,
  sr.ten_noi_bo,
  k.id             as customer_id,
  k.full_name      as ten_khach,
  k.primary_phone  as sdt_khach,
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
  coalesce(k.primary_phone, c.phone),
  null::date,
  cp.order_date,
  cp.order_code,
  cp.quantity::int,
  cp.synced_at
from public.customer_purchases cp
join public.customers c on c.customer_code = cp.customer_code
left join public.cs_customers k
       on right(regexp_replace(k.primary_phone, '\D', '', 'g'), 9)
        = right(regexp_replace(c.phone,         '\D', '', 'g'), 9)
       and c.phone is not null
where cp.category_l1 = 'Machines'
  and not exists (
    select 1 from public.installed_base ib
     where ib.customer_id = k.id
       and ib.internal_code = cp.internal_code
  );

comment on view public.v_bh_cho_kich_hoat is
  'Hàng chờ kích hoạt bảo hành cho CSKH. nguon=da_lap_chua_kich_hoat (có serial, kích hoạt ngay) | don_sales_chua_gan_may (đơn bán có máy nhưng chưa gắn serial). Kích hoạt xong dòng tự biến mất. CÓ PII -> security_invoker.';

commit;
