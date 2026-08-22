-- cs — địa chỉ phụ có TỈNH, SĐT phụ có GHI CHÚ (22/08/2026)
--
-- 🔴 VÁ LỖI PRODUCTION. CEO báo "bảng chi tiết khách trên prod bị lỗi" — nguyên nhân là TÔI:
-- code đọc/ghi `customer_addresses.tinh` và `customer_contacts.ghi_chu`, hai cột đó CÓ trên
-- máy local nhưng **KHÔNG có trên production**, nên `.select()` ném lỗi PostgREST và cả trang
-- hồ sơ khách chết.
--
-- Đây là lần thứ BA cùng một bẫy trong repo này (mig 46 · nguoi_dai_dien · lần này), và là lần
-- đầu chính tôi gây ra — sau khi đã hai lần bắt người khác dính. Local xanh KHÔNG chứng minh
-- prod chạy được; `tsc` + test + build đều sạch vì chúng không biết schema prod.
--
-- Bài học đã có sẵn trong CLAUDE.md ("đối chiếu migration local vs prod trước khi merge") —
-- tôi bỏ qua vì nghĩ "chỉ thêm 2 cột nhỏ". Đúng chỗ dễ chủ quan nhất.

alter table public.customer_addresses add column if not exists tinh text;
alter table public.customer_contacts  add column if not exists ghi_chu text;

comment on column public.customer_addresses.tinh is
  'Tỉnh/TP của địa chỉ phụ — ô RIÊNG, không gõ lẫn vào ô địa chỉ (CEO chốt 22/08/2026, giống màn tạo khách).';
comment on column public.customer_contacts.ghi_chu is
  'Ghi chú cho SĐT phụ: giờ gọi được, số của ai… Có ở CẢ màn tạo lẫn màn sửa.';
