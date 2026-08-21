-- Mở danh sách vai trò lên 13 role toàn công ty (nền tảng tài khoản dùng chung).
--
-- Vì sao: trước đây app chỉ phục vụ CSKH nên chk_vai_tro chỉ có 6 giá trị.
-- Nay nền tảng tài khoản dùng chung cho mọi module, cần đủ vai trò các bộ phận.
--
-- KHÔNG đụng dữ liệu dòng nào — chỉ nới ràng buộc. Vai trò mới chưa gán cho ai
-- và chưa có quyền gì ở GĐ1.
-- Spec: docs/superpowers/specs/2026-08-20-nen-tang-tai-khoan-phan-quyen-design.md
--
-- Luật "cùng bộ phận thì trưởng ⊕ nhân viên" CỐ TÌNH không cài ở DB: hiện có hai
-- người giữ cả cs lẫn cs_manager từ trước, thêm CHECK là migration đổ. Luật áp ở
-- tầng app lúc GHI (apps/web/lib/nen-tang/nhan-su-luat.ts:chuanBiVaiTroDeGhi), dữ liệu cũ
-- tự dọn dần ở lần admin bấm lưu kế tiếp.

alter table public.staff drop constraint if exists chk_vai_tro;
alter table public.staff add constraint chk_vai_tro
  check (vai_tro <@ '{
    ceo, admin,
    kt_giam_doc, ky_thuat, ctv_lap_dat,
    cs_manager, cs,
    sales_manager, sales,
    marketing, kho, ke_toan, tai_chinh
  }'::text[]);
