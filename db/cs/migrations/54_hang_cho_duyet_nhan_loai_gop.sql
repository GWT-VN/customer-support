-- 54 — hàng chờ duyệt phải nhận được loại 'gop'.
--
-- LỖI THẬT, CEO gặp 20/08/2026 khi bấm "Gộp vào Chị Ngọt" bằng tài khoản KHÔNG
-- phải admin:
--     new row for relation "yeu_cau_thay_doi" violates check constraint
--     "yeu_cau_thay_doi_loai_check"
--
-- Migration 46 thêm phép gộp và cho nhân viên thường "đề xuất gộp → chờ quản trị
-- duyệt", nhưng KHÔNG mở ràng buộc `loai` của bảng hàng chờ (vốn chỉ có sua/xoa/
-- doi_serial từ trước). Nên đường đề xuất đó CHƯA BAO GIỜ chạy được — mọi lần thử
-- trước đều bằng tài khoản admin, mà admin áp thẳng, không đi qua hàng chờ.
--
-- Bài học ghi lại: tính năng nào có hai đường (admin áp ngay / nhân viên chờ duyệt)
-- thì phải thử CẢ HAI, không thể thử mỗi đường admin rồi coi là xong.

alter table yeu_cau_thay_doi drop constraint if exists yeu_cau_thay_doi_loai_check;

alter table yeu_cau_thay_doi
  add constraint yeu_cau_thay_doi_loai_check
  check (loai in ('sua', 'xoa', 'doi_serial', 'gop'));
