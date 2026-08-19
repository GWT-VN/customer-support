-- 08 — Phần 4 (2026-07-29): khách tạo thẳng từ app CSKH (đại lý/Shopee đăng ký sau)
-- cần admin duyệt. Khách cũ đã di trú giữ 'da_duyet' để không ảnh hưởng luồng hiện tại.

alter table public.cs_customers
  add column if not exists trang_thai text not null default 'da_duyet'
    check (trang_thai in ('da_duyet','cho_duyet'));
comment on column public.cs_customers.trang_thai is
  'da_duyet (mặc định, khách cũ) | cho_duyet (tạo mới từ CS, chờ admin duyệt).';
