-- cs — cs_customers: thêm email cá nhân, ngày sinh, sales phụ trách (21/08/2026)
--
-- Vì sao: đợt thống nhất schema khách giữa CS và Sales (CEO chốt 21/08/2026 —
-- "không bỏ ô nào của bên nào, trùng thì dùng chung một tên"). Ba trường này Sales
-- có mà CS chưa có, nên CS thêm để hai bên tả cùng một khách bằng cùng bộ ô.
--
-- KHÔNG thêm `phone2`: CS đã có `customer_contacts` (1-N) cho SĐT phụ và
-- `customer_addresses` cho địa chỉ phụ; màn Gộp khách trùng ghi thẳng vào hai bảng đó.
-- Thêm một cột phẳng nữa là đẻ ra nguồn sự thật THỨ HAI cho cùng một dữ kiện.
-- CEO chốt: Sales làm giống CS, dùng chung hai bảng trên.
--
-- An toàn: thuần ADD COLUMN, nullable, không đổi giá trị nào, không đụng bảng của Sales.
-- Chạy lại được nhiều lần (IF NOT EXISTS).
--
-- ⚠️ `cs_customers` là BẢNG DÙNG CHUNG — đã báo phiên Sales trước khi chạy (SYSTEM.md §7.1).

alter table public.cs_customers
  add column if not exists email      text,
  add column if not exists ngay_sinh  date;

-- sales_owner: nhân viên Sales đang chăm khách này.
-- ON DELETE SET NULL chứ KHÔNG cascade: người nghỉ việc bị xoá khỏi `staff` thì hồ sơ
-- khách phải ở lại, chỉ mất tên người phụ trách. Cascade ở đây là mất khách.
alter table public.cs_customers
  add column if not exists sales_owner uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cs_customers_sales_owner_fkey'
      and conrelid = 'public.cs_customers'::regclass
  ) then
    alter table public.cs_customers
      add constraint cs_customers_sales_owner_fkey
      foreign key (sales_owner) references public.staff(id) on delete set null;
  end if;
end $$;

-- Tra "khách của nhân viên X" là truy vấn Sales sẽ dùng thường xuyên; cột thưa
-- (phần lớn null lúc đầu) nên đánh index có điều kiện cho gọn.
create index if not exists idx_cs_customers_sales_owner
  on public.cs_customers (sales_owner)
  where sales_owner is not null;

comment on column public.cs_customers.email       is 'Email CÁ NHÂN của khách. Khác email_cty (email công ty, dùng cho hoá đơn).';
comment on column public.cs_customers.ngay_sinh   is 'Ngày sinh khách (Sales dùng để chúc mừng / phân khúc).';
comment on column public.cs_customers.sales_owner is 'Nhân viên Sales phụ trách khách này -> staff.id. Null = chưa gán.';
