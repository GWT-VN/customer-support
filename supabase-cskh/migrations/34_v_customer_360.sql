-- Chân dung khách 360: cs_customers ⟵customer_code⟶ customers (đơn Sales) + gộp
-- máy đã lắp / bảo hành / ticket / bảo trì. CS sở hữu view (chỉ SELECT).
-- Dùng subquery vô hướng theo cs.id/customer_code để KHÔNG nhân dòng khi join nhiều bảng.
-- security_invoker=true: có PII, chạy theo quyền người gọi (app đọc service_role).
-- Cột đã được Sales duyệt (Sales-tra-loi-CS-v2, 2026-08-12).
create or replace view public.v_customer_360
with (security_invoker = true) as
select
  cs.customer_code,
  cs.full_name                       as ten,
  cs.primary_phone                   as phone_chuan,
  cs.province,
  cs.channel_id,
  c.name                             as sales_name,
  c.phone                            as sales_phone,
  c.first_order_date,
  c.last_order_date,
  -- Đơn (Phase 1: đếm distinct order_code từ customer_purchases)
  (select count(distinct p.order_code) from public.customer_purchases p
     where p.customer_code = cs.customer_code)                       as so_don,
  -- Phase 1 chưa có cột tiền (customer_purchases/customers đều không lưu amount);
  -- Phase 2 sẽ lấy từ sales_orders.total_vat. Giữ cột cho ổn định contract.
  null::bigint                                                       as tong_chi_vat,
  (select count(*) from public.installed_base ib
     where ib.customer_id = cs.id)                                   as so_may_da_lap,
  (select array_agg(ib.serial order by ib.serial) from public.installed_base ib
     where ib.customer_id = cs.id)                                   as ds_serial,
  (select count(*) from public.installed_base ib
     join public.warranty w on w.serial = ib.serial
     where ib.customer_id = cs.id and w.activated and w.full_end >= current_date)
                                                                     as so_may_con_bh,
  (select count(*) from public.tickets t where t.customer_id = cs.id)                       as so_ticket_tong,
  (select count(*) from public.tickets t
     where t.customer_id = cs.id and coalesce(t.state,'') not in ('Done','Cancel'))         as so_ticket_mo,
  -- Bảo trì còn lại = tổng số lần (gói đang hoạt động) - số lượt đã hoàn thành
  (select coalesce(sum(mp.tong_lan),0) from public.maintenance_plan mp
     where mp.customer_id = cs.id and mp.trang_thai = 'dang_hoat_dong')
  - (select count(*) from public.maintenance_visit mv
       join public.maintenance_plan mp on mp.id = mv.plan_id
       where mp.customer_id = cs.id and mp.trang_thai = 'dang_hoat_dong'
         and mv.completed_at is not null)                            as bao_tri_con_lai
from public.cs_customers cs
left join public.customers c on c.customer_code = cs.customer_code;

comment on view public.v_customer_360 is
  'Chân dung 360 của khách CS: gộp đơn Sales + máy/BH/ticket/bảo trì. tong_chi_vat null ở Phase 1 (chờ sales_orders). Sales đã duyệt danh sách cột 2026-08-12.';
