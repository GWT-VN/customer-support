-- 52 — ghi chú cho SĐT phụ + tỉnh cho địa chỉ phụ.
--
-- CEO 20/08/2026:
--   · "SĐT phụ phải thêm ghi chú: ví dụ sđt này có dùng zalo hay ko dùng"
--   · "Địa chỉ phụ: … các địa chỉ này cũng cần chọn tỉnh riêng 1 trường"
--
-- `customer_contacts` ĐÃ có cột `zalo_ok` (boolean) nhưng giao diện chưa bao giờ
-- cho sửa — nên thêm `ghi_chu` cho những thứ không phải Zalo ("số cơ quan, giờ
-- hành chính mới nghe", "số của vợ"), còn Zalo thì bày đúng cột sẵn có ra.
--
-- `customer_addresses.tinh` tách riêng cho ĐỒNG NHẤT với `cs_customers.province`:
-- cả app lọc và gom theo tỉnh, để tỉnh lẫn trong chuỗi địa chỉ là mất khả năng đó.
-- Ngoại lệ DUY NHẤT vẫn là `dia_chi_cty` (migration 50) — địa chỉ thuế phải in
-- nguyên văn một dòng theo đăng ký kinh doanh.

alter table customer_contacts
  add column if not exists ghi_chu text;

alter table customer_addresses
  add column if not exists tinh text;

comment on column customer_contacts.ghi_chu is
  'Ghi chú về số này (giờ gọi được, số của ai…). Zalo dùng cột zalo_ok sẵn có.';
comment on column customer_addresses.tinh is
  'Tỉnh/TP của địa chỉ phụ — tách riêng như cs_customers.province để lọc/gom theo vùng.';
