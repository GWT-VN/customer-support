# Lộ trình bỏ Google Sheet + Apps Script cho khu Sales

> CEO chốt 22/08/2026: **app Sales hoàn thiện thì bỏ Apps Script / Google Sheet.**
> Trong lúc build thì vẫn dùng song song.
>
> Tài liệu này là **bản đồ đường đi**, không phải lời hứa ngày tháng. Mỗi chặng có
> **điều kiện ra** đo được — chưa đạt thì chưa sang chặng sau, vì mỗi chặng đều có
> một cách hỏng âm thầm riêng.

## 0. Vì sao phải có lộ trình, không tắt phát một

Đo production ngày 22/08/2026:

| | Số đo |
|---|---:|
| Đơn trong `sales_order_lines` (gương từ Sheet) | **428 đơn / 812 dòng**, từ 02/01/2024 |
| Đơn trong `sales_orders` (app tự tạo) | **0** |
| Khách trong `customers` | 421 |
| Mã hàng có giá niêm yết | 51 / 309 |
| Dòng `Code.gs` + `Shopee.gs` | 3.795 |

**Toàn bộ dữ liệu bán hàng thật đang nằm ở Sheet.** App đã có màn nhập đơn nhưng
chưa ai dùng để nhập đơn thật. Tắt Sheet lúc này là mất chỗ làm việc, không phải
chuyển chỗ làm việc.

## 1. Sheet đang GIỮ những gì

Không phải "một cái sync". Là **sáu vai** khác nhau, mỗi vai phải có người thay:

| # | Vai của Sheet | Ai thay | Khó ở đâu |
|---|---|---|---|
| 1 | **Chỗ nhập đơn** — 4 tab POE/POU/OTHERS/TANG | Màn `/sales/don/moi` (đã có) | Nhập nhanh nhiều dòng, dán từ Excel, sửa hàng loạt — Sheet làm tốt hơn app hiện tại |
| 2 | **Cấp mã đơn** — `newOrderCode`, `fillMaDonTrong` | `nextOrderCode()` trong app (đã có) | Hai nguồn cùng cấp mã thì đụng nhau. Phải tắt một bên **dứt khoát**, không chạy song song |
| 3 | **Dựng DM_KHACH** — gộp đơn thành khách | ❌ **chưa có gì thay** | Đây là chặng nặng nhất, xem §3 |
| 4 | **Bảng tổng hợp** — TONG_HOP, TONG_DON_POE, quà tặng | Báo cáo đọc thẳng DB | Dễ, chỉ là công viết |
| 5 | **Kéo đơn Shopee** — `Shopee.gs`, 540 dòng | ❌ **chưa có gì thay** | Gọi API Shopee có ký HMAC + refresh token. Phải viết lại phía server |
| 6 | **Chuẩn hoá dữ liệu dán tay** — ngày, SĐT, VAT, checkbox | Ràng buộc + ô nhập của app | App nhập đúng từ đầu thì phần lớn nhóm này **biến mất**, không cần thay |

## 2. Thứ tự bắt buộc — và vì sao không đảo được

```
Chặng A ─→ Chặng B ─→ Chặng C ─→ Chặng D
nhập đơn   khách hết   Shopee     tắt Sheet
song song  phụ thuộc   vào thẳng
           vào đơn     app
```

Không đảo được vì: **danh sách khách đang được SUY RA từ đơn.** Chừng nào đơn còn
vào bằng Sheet thì khách còn được dựng lại từ Sheet, và mọi sửa khách trong app
đều bị ghi đè. Phải chuyển đường đơn trước, đường khách mới đứng độc lập được.

## 3. Chặng A — Đơn hàng vào thẳng app

**Mục tiêu:** nhân viên nhập đơn mới trong app, không mở Sheet nữa.

Việc phải làm:
- [ ] Màn nhập đơn đủ nhanh cho người nhập hàng ngày: thêm dòng bằng bàn phím,
      nhân bản dòng, **dán nhiều dòng từ Excel** (đây là thứ Sheet đang hơn hẳn).
- [ ] Nhập được cả 4 loại đơn, gồm **đơn tặng** (`DON_TANG`) — hiện app chưa có
      đường nhập riêng cho nhóm này.
- [ ] Sửa/xoá đơn có nhật ký, vì bỏ Sheet là bỏ luôn lịch sử phiên bản của Google.
- [ ] **Gộp hai kho đơn.** Hiện `sales_order_lines` (gương) và `sales_orders` (app)
      là hai bảng; màn danh sách đã gộp lúc đọc, nhưng báo cáo thì chưa.

**Điều kiện ra:** 100% đơn mới trong 2 tuần liền vào bằng app, 0 đơn nhập ở Sheet.

⚠️ **Bẫy:** ngày tắt đường nhập ở Sheet phải **tắt hẳn**, không để "ai quen cái nào
dùng cái đó". Hai nguồn cùng cấp mã đơn là trùng mã, và `sales_order_lines` bị
**xoá sạch rồi nạp lại** mỗi lần sync — đơn nhập ở app sẽ không bị xoá, nhưng đơn
sửa ở Sheet sẽ đè ngược lại. Trạng thái nửa vời là nguy hiểm nhất.

## 4. Chặng B — Khách thôi phụ thuộc vào đơn

**Đây là chặng đắt nhất, và là câu trả lời cho câu CEO hỏi: "hai bên tạo về chung
một bảng được không".**

Vấn đề gốc: `DM_KHACH` **không phải danh sách khách**, nó là **báo cáo dựng lại từ
đơn**. Hệ quả hôm nay:
- khách chưa từng mua **không thể tồn tại** ⇒ khách CSKH (gọi hỏi, lead) không vào được;
- mọi cột (tên, SĐT, địa chỉ…) **tính lại từ đơn mỗi lần dựng** ⇒ sửa trong app bị ghi đè;
- lịch sử mua nối vào khách **qua `customer_code` do DM_KHACH cấp**.

Việc phải làm, đúng thứ tự:
- [ ] **Đơn trỏ thẳng vào khách** bằng khoá bền (`customer_code`/`ma_kh` ghi vào đơn
      lúc lên đơn), thay vì suy ngược từ SĐT sau khi có đơn.
- [ ] **Sao chép một lần** 421 khách từ `DM_KHACH` sang bảng khách do app làm chủ,
      giữ nguyên mã cũ để không đứt 834 dòng lịch sử mua.
- [ ] **Tắt `syncCsData` phần khách.** Từ đây `customers` do app làm chủ.
- [ ] Sửa khách trong app **có tác dụng thật** — mở khoá toàn bộ ô, xem §6.
- [ ] Lúc này mới bàn được chuyện gộp một bảng khách với CSKH.

**Điều kiện ra:** `buildKhachHang` không còn được chạy; sửa tên khách trong app,
chạy mọi thứ, tên vẫn nguyên sau 1 tuần.

## 5. Chặng C — Shopee vào thẳng app

`Shopee.gs` (540 dòng) kéo đơn + phí + số thực nhận về Sheet. Phải viết lại thành
job phía server: ký HMAC, giữ refresh token, chạy theo lịch.

- [ ] Viết bộ kéo đơn Shopee ở server, ghi thẳng vào bảng đơn của app.
- [ ] Kéo cả **phí và số thực nhận** (`SHOPEE_PHI`) — nếu không thì mất phần lãi thật.
- [ ] Chạy song song đối chiếu 2 tuần: số đơn và số tiền phải khớp Sheet.

**Điều kiện ra:** 2 tuần liền khớp tuyệt đối, rồi mới tắt bên Sheet.

## 6. Chặng D — Tắt Sheet

- [ ] Xuất toàn bộ Sheet ra file lưu trữ, cất một bản ngoài Google.
- [ ] Chuyển Sheet sang **chỉ đọc** (không xoá — giữ 6 tháng làm bản đối chiếu).
- [ ] Gỡ trigger + menu Apps Script.
- [ ] Xoá bảng gương `sales_order_lines` sau khi đã gộp xong (§3).

## 7. Làm được NGAY, không phải chờ chặng nào

Những việc dưới đây **không đụng** đường Sheet, nên làm luôn trong lúc build:

- [x] Chính sách giá đại lý + lịch sử phiên bản · gán bậc đối tác *(xong 22/08)*
- [x] Chương trình khuyến mãi + duyệt theo quyền *(xong 22/08)*
- [x] Lên đơn tự bắt giá theo bậc / khuyến mãi *(xong 22/08)*
- [ ] **Sửa được các ô Sheet KHÔNG giữ.** Sheet chỉ dựng lại: tên, SĐT, địa chỉ,
      tỉnh, công ty, MST, các cột tổng. Những ô **app tự thêm** thì sửa an toàn
      ngay hôm nay: kênh, người phụ trách, email, ngày sinh, địa chỉ/SĐT/email
      công ty, ghi chú. ⇒ Không phải chờ chặng B mới cho sửa hồ sơ.
- [ ] Đếm + cảnh báo khách trùng SĐT (CEO chốt 22/08).
- [ ] Trang hồ sơ khách chia tab, đủ thông tin.

## 8. Ba rủi ro phải nói trước

1. **Sheet đang là bản sao lưu sống.** Google giữ lịch sử phiên bản, ai lỡ tay còn
   khôi phục được. Bỏ Sheet là mất lưới đó ⇒ chặng A phải có **nhật ký sửa/xoá đơn**
   trước khi tắt, không làm sau.
2. **Sheet là chỗ làm việc quen tay.** Người nhập đơn hàng ngày sẽ so tốc độ với
   Excel. Màn nhập đơn **chậm hơn Sheet** là lý do thật khiến việc chuyển đổi chết
   giữa đường — không phải lỗi kỹ thuật.
3. **Trạng thái nửa vời nguy hơn cả hai đầu.** Mỗi chặng nên **ngắn và dứt khoát**.
   Chạy song song lâu là hai nguồn sự thật, và bài học 21–22/08 (SĐT mất số 0, khách
   trùng, mã khai tử âm thầm) đều sinh ra từ đúng chỗ đó.

## 9. Nhật ký quyết định

| Ngày | Quyết định |
|---|---|
| 22/08/2026 | CEO chốt: app Sales xong thì bỏ Apps Script/Sheet. Trong lúc build vẫn dùng song song. |
| 22/08/2026 | CEO chốt: chặn khách trùng theo hướng **đếm + cảnh báo** trên màn Sales, không chặn cứng ở DB (tránh gãy cả lô sync). |
