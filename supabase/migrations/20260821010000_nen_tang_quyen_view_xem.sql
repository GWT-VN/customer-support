-- Quyền thứ 52: "Xem view bảng đã lưu" (he_thong.view_xem) — MỌI vai trò.
--
-- Vì sao phải tách khỏi he_thong.view_chung: hàm listBangView() được gọi khi vẽ
-- MỌI trang danh sách (máy, khách, ticket, bảo trì, lõi, serial). Nó đang đòi
-- he_thong.view_chung — vốn là quyền GHI view dùng chung, mức Trưởng CSKH.
--
-- Hậu quả đo được khi thử tay 21/08 bằng một tài khoản NV CSKH thật, với cầu dao
-- MA_TRAN_QUYEN=on: mở trang chủ là bị đá về "/?loi=khong_du_quyen" ngay, và mọi
-- trang danh sách khác cũng vậy. Tức là bật ma trận lên production khi chưa vá
-- thì toàn bộ nhân viên thường mất quyền dùng app.
--
-- Quyền ĐỌC này cho hết mọi vai trò; quyền GHI view chung giữ nguyên ở Trưởng CSKH.

insert into public.quyen_vai_tro (vai_tro, ma_quyen)
select v, 'he_thong.view_xem'
from unnest(array[
  'ceo', 'admin', 'quan_tri_ht',
  'kt_giam_doc', 'ky_thuat', 'ctv_lap_dat',
  'cs_manager', 'cs',
  'sales_manager', 'sales',
  'marketing', 'kho', 'ke_toan', 'tai_chinh'
]) as v
on conflict do nothing;
