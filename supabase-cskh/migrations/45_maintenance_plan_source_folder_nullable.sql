-- 45 — maintenance_plan.source_folder: bỏ NOT NULL
--
-- LỖI: nút "+ Tạo lịch mới cho khách" (/bao-tri/len-lich) LUÔN thất bại với
--   null value in column "source_folder" ... violates not-null constraint
-- nên CS bấm Tạo lịch, form không báo gì ở gần nút (lỗi hiện tít trên đầu
-- trang, ngoài tầm nhìn) rồi tưởng đã tạo — kiểm tra lại thì không có lịch nào.
--
-- source_folder là DẤU VẾT NHẬP LIỆU: tên thư mục Drive của đợt import hợp
-- đồng bảo trì cũ. Plan tạo thẳng trên app không đến từ thư mục nào cả, nên
-- NOT NULL ở đây là sai ngay từ đầu. NULL = "không sinh ra từ import".
--
-- Dữ liệu cũ không đụng tới: 78 plan hiện có đều đã có source_folder.

alter table maintenance_plan alter column source_folder drop not null;

comment on column maintenance_plan.source_folder is
  'Tên thư mục Drive của đợt import hợp đồng bảo trì cũ. NULL = plan tạo thẳng trên app CSKH.';
