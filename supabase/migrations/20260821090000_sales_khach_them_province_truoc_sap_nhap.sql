-- Quy ước Tỉnh/TP chung CS ⇄ Sales, CEO chốt 21/08/2026:
--   province                = tỉnh MỚI (34 tỉnh sau sáp nhập)  ← giống cs_customers
--   province_truoc_sap_nhap = tỉnh nguyên gốc nhập từ Google Sheet
--
-- Migration này CHỈ THÊM CỘT. Không đổi giá trị nào — Apps Script (đã sửa + deploy
-- 21/08) ghi đúng quy ước mới ở lần sync kế tiếp.
--
-- ⚠️ Thứ tự bắt buộc: cột phải tồn tại TRƯỚC khi Apps Script chạy sync, nếu không
-- PostgREST trả lỗi và đứt sync. Xem docs/specs/2026-08-21-sales-don-loc-khach-design.md §4.3.
alter table public.customers          add column if not exists province_truoc_sap_nhap text;
alter table public.sales_order_lines  add column if not exists province_truoc_sap_nhap text;

comment on column public.customers.province_truoc_sap_nhap is
  'Tỉnh/TP trước sáp nhập. Quy ước chung CS/Sales chốt 21/08/2026: province = tỉnh MỚI (34 tỉnh), cột này giữ tỉnh nguyên gốc từ Google Sheet. Cột cũ province_moi sẽ bỏ ở đợt sau.';
comment on column public.sales_order_lines.province_truoc_sap_nhap is
  'Tỉnh/TP trước sáp nhập — xem comment cùng tên ở public.customers.';
