-- ─────────────────────────────────────────────────────────────────────────────
-- Tìm KHÔNG DẤU cho trang Lịch bảo trì (/bao-tri).
--
-- Vấn đề: migration 06 chỉ bỏ dấu cho cs_customers, nên /bao-tri vẫn so nguyên
-- văn — gõ `nguyen` KHÔNG ra "Nguyễn", gõ `bao tri` không ra "Bảo trì". Đây là
-- trang DUY NHẤT còn sót, 4 trang kia đã bỏ dấu từ đợt trước.
--
-- v_maintenance_due tìm trên 4 nguồn, hai nguồn nằm ở bảng CHƯA có cột bỏ dấu:
--   customer_name = coalesce(c.full_name, mp.source_customer_name)
--                     ^ đã có ten_kd     ^ CHƯA có -> thêm mp.ten_kd
--   section       = mv.section            CHƯA có -> thêm mv.section_kd
--   bo_may        = mp.bo_may             CHƯA có -> thêm mp.bo_may_kd
--
-- Cách làm y hệt migration 06: cột SINH SẴN (generated) từ public.khong_dau().
-- Cột sinh sẵn tự tính lại mỗi khi dòng đổi -> không bao giờ lệch pha với cột
-- gốc, và bỏ cột đi thì dữ liệu gốc vẫn nguyên vẹn. KHÔNG ghi đè cột nào.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists unaccent;
create extension if not exists pg_trgm;

alter table public.maintenance_plan
  add column if not exists ten_kd text
    generated always as (public.khong_dau(source_customer_name)) stored;

alter table public.maintenance_plan
  add column if not exists bo_may_kd text
    generated always as (public.khong_dau(bo_may)) stored;

alter table public.maintenance_visit
  add column if not exists section_kd text
    generated always as (public.khong_dau(section)) stored;

create index if not exists idx_maintenance_plan_ten_kd
  on public.maintenance_plan using gin (ten_kd gin_trgm_ops);
create index if not exists idx_maintenance_plan_bo_may_kd
  on public.maintenance_plan using gin (bo_may_kd gin_trgm_ops);
create index if not exists idx_maintenance_visit_section_kd
  on public.maintenance_visit using gin (section_kd gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────────────────────
-- Tạo lại view — GIỮ NGUYÊN 14 cột cũ, đúng tên, đúng thứ tự (app select('*')).
-- Chỉ THÊM 3 cột vào cuối. Định nghĩa gốc lấy từ pg_get_viewdef trước khi sửa.
--
-- ten_kd phải coalesce ĐÚNG KHUÔN customer_name (c trước, mp sau). Migration 06
-- đã vấp đúng chỗ này ở v_tickets: thiếu một nhánh fallback là 8/83 ticket biến
-- mất khỏi kết quả tìm dù tên vẫn hiện trên màn hình.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view public.v_maintenance_due
with (security_invoker = true) as
select
  mv.id as visit_id,
  mv.asana_task_id,
  mv.lan_thu,
  mv.due_date,
  mv.completed_at,
  mp.id as plan_id,
  mp.loai_goi,
  mp.tong_lan,
  mp.bo_may,
  coalesce(c.full_name, mp.source_customer_name) as customer_name,
  coalesce(c.primary_phone, mp.source_phone) as primary_phone,
  mp.customer_id is null as chua_khop_khach,
  mv.section,
  case
    when mv.completed_at is not null then 'đã xong'::text
    when mv.due_date is null then 'không rõ hạn'::text
    when mv.due_date < current_date then 'QUÁ HẠN'::text
    when mv.due_date <= (current_date + 30) then 'sắp đến hạn (≤30 ngày)'::text
    else 'còn hạn'::text
  end as tinh_trang,
  -- MOI: cot bo dau de tim kiem khong dau
  coalesce(c.ten_kd, mp.ten_kd) as ten_kd,
  mv.section_kd,
  mp.bo_may_kd
from maintenance_visit mv
  left join maintenance_plan mp on mp.id = mv.plan_id
  left join cs_customers c on c.id = mp.customer_id;
