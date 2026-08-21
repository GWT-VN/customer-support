-- Bịt lỗ: NV CSKH và Trưởng CSKH đang XEM ĐƯỢC DOANH SỐ qua ma trận.
--
-- Đợt GĐ3 đã hạ `cs.bao_cao.doanh_so` về mức chỉ-quản-trị trong CODE (vì trang
-- /doanh-so vốn gác admin, còn hàm lấy số phía sau thì hở). Nhưng bảng
-- `quyen_vai_tro` được seed TỪ TRƯỚC đợt đó và không ai dọn lại, nên trong DB hai
-- vai trò `cs` và `cs_manager` vẫn giữ quyền này.
--
-- Với cầu dao MA_TRAN_QUYEN=on, DB mới là thứ quyết định. Thử tay 21/08 bằng một
-- tài khoản chỉ mang vai trò `cs`: mở thẳng /doanh-so ra số bình thường, và mục
-- "Doanh số" còn hiện trong menu bánh răng. Tức là lỗ tưởng đã bịt thì vẫn mở.
--
-- Bài học ghi lại cho phiên sau: đổi mức mặc định trong `lib/nen-tang/quyen.ts`
-- KHÔNG tự đổi dữ liệu đã seed. Đổi mức thì phải kèm một migration dọn DB, và
-- nên đối chiếu lại DB với MAC_DINH trước khi bật ma trận trên production.

delete from public.quyen_vai_tro
where ma_quyen = 'cs.bao_cao.doanh_so'
  and vai_tro in ('cs', 'cs_manager');
