-- Che SĐT trong DB LOCAL: GIỮ tên/địa chỉ, đổi SĐT thành số fake 10 số
-- (unique, tất định từ SĐT thật → cùng số thật ↔ cùng số fake ở mọi bảng).
-- Chỉ update cột THƯỜNG; customers.phone_chuan là GENERATED -> tự tính lại từ phone.
-- Chạy SAU khi nạp data prod vào local.

update public.customers set
  phone     = case when phone     is not null then '09'||lpad((abs(hashtext(coalesce(phone_chuan,phone)))%100000000)::text,8,'0') end,
  phone_no0 = case when phone_no0 is not null then  '9'||lpad((abs(hashtext(coalesce(phone_chuan,phone)))%100000000)::text,8,'0') end;

update public.cs_customers  set primary_phone = case when primary_phone is not null then '09'||lpad((abs(hashtext(primary_phone))%100000000)::text,8,'0') end;
update public.customer_contacts set phone     = case when phone         is not null then '09'||lpad((abs(hashtext(phone))%100000000)::text,8,'0') end;
update public.company_customers  set phone    = case when phone         is not null then '09'||lpad((abs(hashtext(phone))%100000000)::text,8,'0') end;
update public.ky_thuat      set sdt           = case when sdt           is not null then '09'||lpad((abs(hashtext(sdt))%100000000)::text,8,'0') end;
update public.maintenance_plan set source_phone = case when source_phone is not null then '09'||lpad((abs(hashtext(source_phone))%100000000)::text,8,'0') end;
update public.sales_orders  set phone         = case when phone         is not null then '09'||lpad((abs(hashtext(phone))%100000000)::text,8,'0') end;
update public.cs_customer_code_remap_20260812 set phone = case when phone is not null then '09'||lpad((abs(hashtext(phone))%100000000)::text,8,'0') end;
