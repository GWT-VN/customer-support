-- Ba quyền cho module Khuyến mãi & Chiết khấu — CEO chốt 21/08/2026:
--   "NV sales / trưởng sales được LÊN chương trình, chỉ CEO mới có quyền DUYỆT
--    — bổ sung vào bảng phân quyền để sau có thể cấp thêm cho trưởng sales."
--
-- ⚠️ VÌ SAO PHẢI CÓ MIGRATION NÀY: `MAC_DINH` trong lib/nen-tang/quyen.ts chỉ là
-- mức mặc định lúc SEED. Đổi mặc định trong code KHÔNG tự đổi dữ liệu đã seed —
-- bài học khu Nền tảng rút ra hôm 21/08 (bảng còn cho cs/cs_manager quyền xem
-- doanh số dù code đã hạ từ lâu). Nên phải chèn tay vào quyen_vai_tro.
--
-- Mức mặc định tương ứng trong code:
--   sales.ctkm.xem   -> SALES + chiXem  => admin, sales_manager, sales, ceo
--   sales.ctkm.soan  -> SALES           => admin, sales_manager, sales
--   sales.ctkm.duyet -> CEO (mức mới)   => admin, ceo
--
-- Trưởng Sales muốn có quyền duyệt thì TICK trên màn ma trận, không sửa code.
insert into public.quyen_vai_tro (vai_tro, ma_quyen)
select v, q from (values
  ('admin','sales.ctkm.xem'), ('sales_manager','sales.ctkm.xem'),
  ('sales','sales.ctkm.xem'), ('ceo','sales.ctkm.xem'),
  ('admin','sales.ctkm.soan'), ('sales_manager','sales.ctkm.soan'), ('sales','sales.ctkm.soan'),
  ('admin','sales.ctkm.duyet'), ('ceo','sales.ctkm.duyet')
) as t(v,q)
where not exists (
  select 1 from public.quyen_vai_tro x where x.vai_tro = t.v and x.ma_quyen = t.q
);
