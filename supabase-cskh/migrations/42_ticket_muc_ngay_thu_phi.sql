-- 42 — Ghi NGÀY THU PHÍ cho từng hạng mục ticket (2026-08-13).
--
-- Trước đây ticket_muc chỉ có created_at (lúc NHẬP mục), không tách được ngày
-- THỰC SỰ thu tiền của khách. Thêm 1 cột nullable, an toàn ngược:
--  · code cũ không đọc cột này -> không gãy khi cột xuất hiện;
--  · dòng lịch sử + mục miễn phí giữ null.
--
-- KHÔNG đổi v_doanh_so_cskh: doanh số vẫn tính theo created_at. Cột này chỉ để
-- LOG ngày thu; nếu sau muốn tính doanh số theo ngày thu thì sửa view riêng.

alter table public.ticket_muc
  add column if not exists ngay_thu_phi date;

comment on column public.ticket_muc.ngay_thu_phi is
  'Ngày thu phí khách cho hạng mục tinh_phi=true (null nếu miễn phí / chưa thu). Chỉ để log, không dùng tính doanh số.';
