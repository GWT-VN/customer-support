-- 48 — địa chỉ phụ của khách (nhà / công ty / lắp đặt).
--
-- Ca thật (CEO 20/08/2026): cô Mai - Ô Chợ Dừa và Chị Mai là một người, nhưng một
-- hồ sơ ghi địa chỉ nhà, hồ sơ kia ghi địa chỉ công ty
-- ("L.03-TMDV, tầng lửng, cao ốc H3, 384 Hoàng Diệu, Phường 9, Quận 4, TP.HCM").
-- Gộp lại thì `cs_customers` chỉ có MỘT ô `address` — một trong hai địa chỉ hết chỗ.
--
-- Đo trên production: 12/14 nhóm khách trùng tên có hai địa chỉ KHÁC nhau. Nên đây
-- là ca thường, không phải ngoại lệ — nhét vào ghi chú là hỏng dữ liệu có hệ thống.
--
-- Soi đúng khuôn `customer_contacts` (bảng SĐT phụ đã chạy ổn): khoá ngoại cascade,
-- index theo customer_id, chỉ service_role đụng được. `cs_customers.address` VẪN là
-- địa chỉ chính — bảng này chỉ chứa các địa chỉ THÊM, không thay thế nó.
--
-- Cố ý KHÔNG mượn `address_truoc_sap_nhap`: cột đó giữ vết địa chỉ trước đợt sáp
-- nhập tỉnh/phường 2025, mượn làm địa chỉ công ty là phá mất ý nghĩa lịch sử.

create table if not exists customer_addresses (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references cs_customers(id) on delete cascade,
  dia_chi     text not null,
  loai        text not null default 'khac',
  ghi_chu     text,
  created_at  timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'customer_addresses_loai_check') then
    alter table customer_addresses
      add constraint customer_addresses_loai_check
      check (loai in ('nha', 'cty', 'lap_dat', 'khac'));
  end if;
end $$;

create index if not exists idx_customer_addresses_customer on customer_addresses(customer_id);

comment on table customer_addresses is
  'Địa chỉ THÊM của khách (nhà/công ty/lắp đặt). cs_customers.address vẫn là địa chỉ chính.';
comment on column customer_addresses.loai is 'nha | cty | lap_dat | khac';

revoke all on table customer_addresses from public, anon, authenticated;
grant select, insert, update, delete on table customer_addresses to service_role;
