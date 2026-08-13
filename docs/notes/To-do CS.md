Thao tác hàng loạt (áp dụng cả các trang khác)
- Export: export danh sách khách hàng kèm sđt và địa chỉ yêu cầu bắt buộc được admin duyệt mới được xuất (còn ko bao gồm sđt và địa chỉ thì có thể xuất)
- Cập nhật hàng loạt: sẽ cho chọn trường muốn sửa và thông tin muốn sửa thành (ví dụ sửa trạng thái hàng loạt, sửa ngày hàng loạt, cập nhật ghi chú hàng loạt) - cho chọn từ dropdown list (nếu trường đó là chọn) hoặc cho nhập tay (nếu trường đó là nhập tay)
- Xoá hàng loạt 
  
Tuỳ chỉnh cột hiển thị trong bảng: 
- Có phép các trường được hiển thị trong cột 
- Thay đổi thứ tự 
- Sẽ luôn có trường bắt buộc ko được xoá (ví dụ trong máy đã lắp là cột serial, trong bảng khách hàng thì là sđt khách, trong bảng ticket thì là id ticket)
- Có thể áp dụng view này cho cá nhân hoặc tất cả mọi người cùng xem bảng


Khách - Thiếu trang View All 
  
  
Máy đã lắp - Trang View All 
- Đổi Lắp thành: Ngày bắt đâu BH 


Khách - Trang Detail 
- Bổ sung thêm nguồn khách hàng: cần sử dụng chung nguồn với sales 
- 

Yêu cầu mới (ghi nhận 2026-08-13, chưa có spec — 3 mục đều cần tài khoản/phí bên thứ ba):
1. Cổng khách hàng xem web: KH tự xem được ngày kích hoạt BH + lịch bảo trì của mình
   (luồng: CS tạo lịch -> KT nhập thông tin -> KH view). App hiện tại 100% nội bộ,
   cần route công khai riêng — hướng mới hoàn toàn.
2. Chatbot nhắc thay lõi/bảo trì đến hạn, gửi thẳng Zalo của KH; kênh 2 là Messenger.
   Gửi fail thì phải báo lại CS. (Spec gốc 2026-07-12 đã định Zalo ZNS ở Phase 3,
   chưa build; Messenger + báo-fail là phần thêm mới.)
3. Kích hoạt bảo hành xong tự gửi SMS thông báo cho KH. (Spec gốc chọn Zalo ZNS,
   chưa có luồng bắn tin ngay khi kích hoạt — cần chọn nhà cung cấp SMS + duyệt template.)