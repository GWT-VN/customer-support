-- cs — nối MÁY ĐÃ LẮP với ĐƠN CỦA ĐẠI LÝ đã bán ra nó (22/08/2026)
--
-- CEO dump 22/08/2026, nguyên văn:
--   · Khách hàng kích hoạt bảo hành trên CS (ko có sales vì ko mua máy)
--   · Người mua máy là 1 khách hàng đại lý
--   · Cần gắn lại với nhau để biết khách mua này của đại lý nào theo đơn hàng nào của đại lý
--
-- ĐẶT Ở `installed_base` CHỨ KHÔNG Ở `cs_customers` — cân nhắc kỹ:
-- "Đại lý nào bán" là sự thật của TỪNG CON MÁY, không phải của con người. Một khách có thể mua
-- máy lọc tổng qua đại lý A rồi mua thêm máy uống qua đại lý B; nhét vào hồ sơ khách thì phải
-- chọn một trong hai và mất phần còn lại. Đặt ở máy thì hồ sơ khách vẫn tổng hợp lên được
-- (gom các máy của khách), còn chiều ngược lại thì không.
--
-- LƯU TÊN ĐẠI LÝ chứ không chỉ khoá ngoại: `sales_order_lines` bị XOÁ SẠCH RỒI NẠP LẠI mỗi lần
-- sync từ Google Sheet. Chỉ giữ `order_code` thì hôm nào đơn bị sửa/xoá trên Sheet là mất luôn
-- dấu vết đại lý — mà đây là thông tin bảo hành, phải sống lâu hơn một lần sync.
-- Tên đại lý chép lại tại thời điểm gán = ảnh chụp, không phụ thuộc bảng bị nạp lại.
--
-- Số liệu lúc làm (đo prod 22/08): 27 đơn đại lý · 10 đại lý · 502 máy đã lắp, trong đó mới 32
-- máy có ghi nguồn (`channel_source`, chữ tự do, không tra ngược ra đơn được).

alter table public.installed_base
  add column if not exists dai_ly_ten     text,
  add column if not exists dai_ly_don     text,
  add column if not exists dai_ly_gan_luc timestamptz;

comment on column public.installed_base.dai_ly_ten is
  'TÊN đại lý đã bán con máy này (chép từ sales_order_lines.channel_detail lúc gán). Chép chứ không tham chiếu: bảng đơn bị xoá-nạp-lại mỗi lần sync Sheet.';
comment on column public.installed_base.dai_ly_don is
  'Mã đơn của đại lý (sales_order_lines.order_code). Có thể trỏ tới đơn đã bị sync xoá — khi đó vẫn còn dai_ly_ten để biết ai bán.';
comment on column public.installed_base.dai_ly_gan_luc is
  'Lúc gán, để biết ảnh chụp tên đại lý lấy ở thời điểm nào.';

-- Tra "đại lý này đã bán những máy nào" — câu hỏi chính CEO cần trả lời.
create index if not exists ix_installed_base_dai_ly
  on public.installed_base (dai_ly_ten)
  where dai_ly_ten is not null;
