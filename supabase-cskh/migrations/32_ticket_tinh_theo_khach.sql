-- 32_ticket_tinh_theo_khach.sql
-- Tỉnh/TP của ticket gắn với KHÁCH (chủ máy) thay vì cột t.province raw từ Odoo.
-- Ưu tiên: tỉnh khách (theo customer_id ticket, rồi theo chủ máy) -> fallback raw.
-- (User chốt: dùng tỉnh/địa chỉ khách; địa chỉ lắp đã có "dùng địa chỉ khách" ở đăng ký BH.)

create or replace view public.v_tickets as
 select t.ticket_code,
    t.state,
    t.ticket_type,
    t.description,
    t.last_note,
    coalesce(c.province, cm.province, t.province) as province,
    t.created_at,
    t.serial,
    t.source_serial,
    coalesce(ci."Tên ngắn gọn (đề xuất)", ib.model_freetext) as product_name,
    ib.internal_code,
    ((t.source_serial is not null) and (t.serial is null)) as may_khong_trong_he_thong,
    coalesce(t.customer_id, ib.customer_id) as customer_id,
    coalesce(c.full_name, cm.full_name, t.source_customer) as customer_name,
    coalesce(c.primary_phone, cm.primary_phone) as primary_phone,
    coalesce(case when (w.id is not null) then w.activated else wp.activated end, false) as warranty_activated,
    case when (w.id is not null) then w.full_end else wp.full_end end as warranty_full_end,
    case when (w.id is not null) then w.core_end else wp.core_end end as warranty_core_end,
    case when (case when (w.id is not null) then w.full_end else wp.full_end end is null) then null::boolean
         else (case when (w.id is not null) then w.full_end else wp.full_end end >= current_date) end as con_han_may,
    case when (case when (w.id is not null) then w.core_end else wp.core_end end is null) then null::boolean
         else (case when (w.id is not null) then w.core_end else wp.core_end end >= current_date) end as con_han_loi,
    ((w.id is null) and (wp.id is not null)) as bh_theo_me,
    t.khan,
    t.cs_phu_trach,
    t.ky_thuat,
    scs.ten as cs_ten,
    skt.ten as ky_thuat_ten,
    coalesce(c.ten_kd, cm.ten_kd, khong_dau(t.source_customer)) as ten_kd,
    coalesce(c.dia_chi_kd, cm.dia_chi_kd) as dia_chi_kd
   from tickets t
     left join installed_base ib on ((ib.serial = t.serial))
     left join catalog_item ci on ((ci."Mã nội bộ" = ib.internal_code))
     left join cs_customers c on ((c.id = t.customer_id))
     left join cs_customers cm on ((cm.id = ib.customer_id))
     left join warranty w on ((w.serial = t.serial))
     left join warranty wp on ((wp.serial = ib.parent_serial))
     left join staff scs on ((scs.id = t.cs_phu_trach))
     left join staff skt on ((skt.id = t.ky_thuat));
