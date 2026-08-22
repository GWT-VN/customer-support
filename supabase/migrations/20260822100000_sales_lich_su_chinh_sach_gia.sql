-- CEO chốt 22/08/2026: chính sách giá đại lý phải LƯU LẠI CÁC PHIÊN BẢN.
-- Trước đây sửa một ô là XOÁ dòng cũ rồi chèn dòng mới => mất sạch dấu vết.
-- Nay: dòng cũ chuyển 'thay_the' + đóng hieu_luc_den, dòng mới chèn 'ban_hanh'.

-- 1) Ai đặt mức này. Trước đó bị mượn tạm cột ghi_chu — tách ra cho đúng nghĩa,
--    vì ghi_chu là chỗ người dùng viết lý do, không phải chỗ máy ghi danh tính.
alter table public.sales_chinh_sach_gia
  add column if not exists nguoi_dat text;

-- 2) Mỗi (bậc, mã) chỉ được có ĐÚNG MỘT bản đang áp.
--    Không có chốt này thì một lần lỗi giữa chừng là hai mức cùng hiệu lực,
--    và bảng giá đọc ra con số tuỳ may rủi.
create unique index if not exists sales_csg_mot_ban_dang_ap
  on public.sales_chinh_sach_gia (bac, internal_code)
  where trang_thai = 'ban_hanh';

-- 3) Tra lịch sử theo thời điểm sửa.
create index if not exists sales_csg_lich_su_idx
  on public.sales_chinh_sach_gia (cap_nhat_luc desc);

comment on column public.sales_chinh_sach_gia.nguoi_dat is
  'Email người đặt mức này. Dòng trang_thai=thay_the là bản cũ, giữ lại để tra lịch sử.';
