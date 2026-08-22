-- Bộ cột khách chung CS ⇄ Sales — CEO chốt 21/08/2026.
-- Cột MỚI đặt tên GIỐNG HỆT ở cả `customers` (Sales) và `cs_customers` (CS).
-- CS đã chạy phần của mình: email · ngay_sinh · sales_owner
-- (migration 20260821100000_cs_khach_email_ngaysinh_salesowner.sql).
--
-- ⛔ KHÔNG có `phone2`. CEO chốt: "Sales làm giống CS chỗ đt phụ, địa chỉ phụ,
--    ko thêm phone2" -> SĐT phụ dùng `customer_contacts`, địa chỉ phụ dùng
--    `customer_addresses` (bảng 1-N của CS, đang chạy production).
--
-- ⚠️ `on delete set null` cho khoá ngoại, KHÔNG cascade — yêu cầu khu Nền tảng:
--    `staff.id` đã có 5 khoá ngoại cascade và nút "xoá nhân sự" phải rào chặt vì thế.
--    Nhân sự nghỉ thì khách mất người chăm, chứ khách không được biến mất.
alter table public.customers add column if not exists channel_id  integer references public.dim_channel(id) on delete set null;
alter table public.customers add column if not exists sales_owner uuid    references public.staff(id)       on delete set null;
alter table public.customers add column if not exists email       text;
alter table public.customers add column if not exists ngay_sinh   date;
alter table public.customers add column if not exists dia_chi_cty text;
alter table public.customers add column if not exists sdt_cty     text;
alter table public.customers add column if not exists email_cty   text;
alter table public.customers add column if not exists source      text;

-- Cột không dấu để tìm kiếm — CHÉP ĐÚNG biểu thức của cs_customers, chỉ đổi tên cột
-- nguồn (`full_name` -> `name`). Lệch biểu thức là hai khu tìm ra kết quả khác nhau.
alter table public.customers add column if not exists ten_kd text
  generated always as (public.khong_dau(name)) stored;
alter table public.customers add column if not exists dia_chi_kd text
  generated always as (public.khong_dau((coalesce(address, ''::text) || ' '::text) || coalesce(province, ''::text))) stored;

comment on column public.customers.channel_id  is 'Kênh khách đến từ -> dim_channel.id. Khoá kênh dùng chung, xem SYSTEM.md §4.';
comment on column public.customers.sales_owner is 'Nhân sự Sales chăm sóc khách này -> staff.id. Cùng tên/ý nghĩa với cs_customers.sales_owner.';
comment on column public.customers.email       is 'Email CÁ NHÂN — khác email_cty (email công ty).';
comment on column public.customers.source      is 'Nguồn khách. Cùng tên/ý nghĩa với cs_customers.source.';

create index if not exists customers_channel_id_idx  on public.customers(channel_id)  where channel_id is not null;
create index if not exists customers_sales_owner_idx on public.customers(sales_owner) where sales_owner is not null;
