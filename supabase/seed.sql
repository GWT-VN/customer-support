-- ============================================================================
-- seed.sql — DỮ LIỆU GIẢ cho môi trường LOCAL (chạy sau migration khi `supabase db reset`).
-- TUYỆT ĐỐI không chứa PII khách hàng thật. Chỉ để code/test cho vui.
-- Áp dụng cho MỌI module (dùng chung staff). Thêm data giả cho module mới ở cuối file.
-- ============================================================================

-- --- Nhân sự giả: mỗi vai trò 1 người (để test phân quyền menu/route) ---
insert into public.staff (email, ten, vai_tro, hoat_dong) values
  ('dev.admin@gwt.vn',    'Dev Admin',        array['admin'],                 true),
  ('dev.cs@gwt.vn',       'Dev CSKH',         array['cs'],                    true),
  ('dev.csm@gwt.vn',      'Dev Trưởng CSKH',  array['cs_manager'],            true),
  ('dev.sales@gwt.vn',    'Dev Sales',        array['sales'],                 true),
  ('dev.salesm@gwt.vn',   'Dev Trưởng Sales', array['sales_manager'],         true),
  ('dev.kythuat@gwt.vn',  'Dev Kỹ thuật',     array['ky_thuat'],              true),
  ('dev.multi@gwt.vn',    'Dev Kiêm nhiệm',   array['cs','sales'],            true),
  ('dev.locked@gwt.vn',   'Dev Nghỉ việc',    array['cs'],                    false)
on conflict (email) do nothing;

-- --- Team Work đã được seed trong migration work_00_init (marketing/sales/cskh/ky_thuat).
--     Cho vài người vào team để test bảng team sau này. ---
insert into work.team_member (team_id, staff_id, role_in_team)
select t.id, s.id, 'member'
from work.team t
join public.staff s on s.email in ('dev.admin@gwt.vn','dev.sales@gwt.vn','dev.cs@gwt.vn')
where t.key in ('sales','cskh')
on conflict do nothing;

-- --- Vài việc giả cho khu Work (dùng chính RPC để đúng luồng) ---
select public.work_tao_viec('dev.admin@gwt.vn', 'Việc demo: duyệt báo giá khách A', 1::smallint,
       now() + interval '1 day', (select id from work.team where key='sales'));
select public.work_tao_viec('dev.sales@gwt.vn', 'Việc demo: gọi khách B khảo sát', 2::smallint,
       now() + interval '2 day', (select id from work.team where key='sales'));
select public.work_tao_viec('dev.cs@gwt.vn',    'Việc demo: xử lý ticket máy lọc', 2::smallint,
       now(), (select id from work.team where key='cskh'));

-- ============================================================================
-- Data giả cho module CS (customers/tickets…) — THÊM KHI CẦN.
--   Lưu ý: nhiều bảng CS có cột NOT NULL; xem schema baseline trước khi insert.
--   Gợi ý: chèn vài customer giả (mã KHDEMO*), KHÔNG dùng SĐT/địa chỉ thật.
-- ============================================================================
