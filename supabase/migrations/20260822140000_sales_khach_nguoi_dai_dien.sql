-- CEO chốt 22/08/2026: màn tạo/sửa khách bên Sales phải có ĐỦ ô như bên CSKH,
-- trong đó có Người đại diện + Chức danh của công ty xuất hoá đơn.
--
-- Đặt vào `public.customers` (bảng của Sales), KHÔNG đụng `cs_customers`.
-- Hai cột này Apps Script KHÔNG ghi (đo `Code.gs:customersPayload` ngày 22/08:
-- chỉ 14 cột, không có hai cột này) ⇒ sửa trong app KHÔNG bị đè ở lần dựng lại
-- DM_KHACH kế tiếp. Cùng nhóm với channel_id / email / sales_owner.
--
-- Tên cột đặt GIỐNG HỆT `cs_customers` để hai khu đọc cùng một tên cho cùng một
-- dữ kiện — lệch tên là sớm muộn có người map nhầm.
alter table public.customers
  add column if not exists nguoi_dai_dien  text,
  add column if not exists chuc_vu_dai_dien text;

comment on column public.customers.nguoi_dai_dien is
  'Nguoi dai dien cua cong ty xuat hoa don. Cot cua APP — Apps Script khong ghi de.';
comment on column public.customers.chuc_vu_dai_dien is
  'Chuc danh nguoi dai dien. Cot cua APP — Apps Script khong ghi de.';
