-- cs — người đại diện công ty (ký hợp đồng)
--
-- ⚠️ File này TỪNG nằm ở `db/cs/migrations/51_…` — thư mục LƯU TRỮ mà Supabase CLI không đọc
-- (xem `db/MIGRATIONS-CONVENTION.md`). Hậu quả đo được 22/08/2026: local có đủ 2 cột nên màn
-- hình chạy ngon, còn **production KHÔNG có cột nào**. Mà cả màn TẠO lẫn màn SỬA khách đều gửi
-- 2 trường này trong payload ⇒ merge lên prod là **vỡ cả nút Lưu hồ sơ khách**, không phải chỉ
-- mất 2 ô. Đúng vệt bẫy migration 46. Đã chuyển về đúng thư mục và áp prod.
--
-- CEO 20/08/2026: "Thông tin công ty cần người đại diện nữa".
--
-- Hợp đồng cần biết ký với AI, chức danh gì. Trước đây thông tin này (nếu có) nằm
-- lẫn trong ô ghi chú như tên công ty và MST — đúng vấn đề migration 50 vừa dọn.
--
-- Tách hai cột chứ không gộp một chuỗi "Nguyễn Văn A - Giám đốc": tên và chức danh
-- in ở hai chỗ khác nhau trên hợp đồng, gộp lại thì lúc xuất phải cắt chuỗi bằng
-- dấu gạch — thứ luôn hỏng khi tên người có gạch ngang.

alter table cs_customers
  add column if not exists nguoi_dai_dien text,
  add column if not exists chuc_vu_dai_dien text;

comment on column cs_customers.nguoi_dai_dien    is 'Người đại diện công ty ký hợp đồng.';
comment on column cs_customers.chuc_vu_dai_dien  is 'Chức danh người đại diện (Giám đốc, Tổng giám đốc…).';
