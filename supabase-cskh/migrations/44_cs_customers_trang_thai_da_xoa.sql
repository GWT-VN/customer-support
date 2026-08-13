-- 44 — Nới CHECK cs_customers.trang_thai để nhận 'da_xoa' (2026-08-13).
--
-- Bug: xoá khách (xoaKhach -> guiYeuCauThayDoi -> apDungThayDoi) ghi
-- trang_thai='da_xoa', và searchCustomers/listKhachHang lọc bằng
-- neq('trang_thai','da_xoa'). Nhưng CHECK cũ chỉ cho ('da_duyet','cho_duyet')
-- -> lệnh xoá VI PHẠM ràng buộc, văng lỗi (nút "Xoá khách" không dùng được).
-- Nới CHECK cho khớp code (soft-delete = ẩn khách, không xoá cứng).

alter table public.cs_customers drop constraint if exists cs_customers_trang_thai_check;

alter table public.cs_customers
  add constraint cs_customers_trang_thai_check
  check (trang_thai = any (array['da_duyet'::text, 'cho_duyet'::text, 'da_xoa'::text]));
