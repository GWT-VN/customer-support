-- 43_vai_tro_ky_thuat.sql
-- Thêm vai trò 'ky_thuat' vào tập role hợp lệ của staff.
-- Kỹ thuật đăng nhập app CSKH nhưng CHỈ thấy lịch chuyến của mình (gating ở tầng app,
-- xem lib/quyen.ts:laChiKyThuat + lib/auth.ts:VAI_TRO_VAO_APP). Không có quyền CS/quản lý
-- (coQuyenQuanLy/laQuyenAdmin không tính ky_thuat).
alter table public.staff drop constraint if exists chk_vai_tro;
alter table public.staff add constraint chk_vai_tro
  check (vai_tro <@ '{admin,cs_manager,cs,sales_manager,sales,ky_thuat}'::text[]);
