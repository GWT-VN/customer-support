# Thiết kế: Khách cuối ↔ Đại lý ↔ Đơn của đại lý

> Trạng thái: **BẢN THIẾT KẾ — chờ CEO + phiên Sales chốt.** Chưa build theo bản này.
> Viết 22/08/2026 theo yêu cầu của CEO: *"Chỗ này cần plan kĩ cùng sales ko sẽ loạn […]
> bạn hiểu ko viết lại thiết kế chỗ này rồi mới làm tiếp"*.
> Mọi con số dưới đây **đo từ prod `bwzmqfbcgouhvhoslmmm` ngày 22/08/2026**, không phải ước lượng.

## 1. Việc cần giải, bằng lời CEO

1. Khách hàng kích hoạt bảo hành trên CS — **không có bên Sales**, vì họ không mua máy của GWT.
2. Người mua máy là **một khách hàng đại lý**.
3. Cần gắn lại với nhau để biết **khách này của đại lý nào, theo đơn hàng nào của đại lý**.
4. "Đại lý" ở đây gồm cả **KTS** và **KOL** (Hannah). Danh sách quản lý đại lý nằm ở **mục Sales**,
   mỗi đại lý **ứng với một kênh**.
5. Khi đã biết khách nào là đại lý thì lúc **chọn kênh chỉ cần filter cấp 1**, phần chi tiết
   **chọn theo tên khách hàng** — không gõ tay tên đại lý nữa.
6. Cần gắn **cả khách hàng** với đại lý, không chỉ mỗi máy.

Điểm 5 là mấu chốt và nó **đúng** — phần 3 dưới đây là bằng chứng đo được vì sao gõ tay đang hỏng.

## 2. Prod đang có gì (đo 22/08/2026)

| Số đo | Giá trị |
|---|---|
| `dim_channel` | 26 dòng · 6 kênh cấp 1 |
| Đối tác = `channel_l2` thuộc Đại lý / KOL / KTS (bỏ "Khác") | **18** |
| Đơn của đối tác — khớp **chính xác** tên | 97 |
| Đơn của đối tác — khớp **không phân biệt hoa/thường** | **130** |
| Đơn màn "Gắn đơn đại lý" đang cho chọn (`channel = 'Đại lý'`) | **27** |
| Máy đã lắp | 502 (500 có `customer_id`) |
| Máy đã gắn đơn đại lý (`dai_ly_ten`) | **0** — tính năng vừa dựng, chưa ai dùng |
| Khách CS gắn kênh Đại lý/KOL/KTS | 28 / 427 |
| Khách CS có kênh bất kỳ | 74 / 427 |
| Khách Sales có `channel_id` | **0 / 424** |

Ba con số đáng chú ý:

- **130 vs 27.** Màn gắn đơn hiện lọc `channel = 'Đại lý'`, nên **bỏ sót toàn bộ KOL (100 đơn,
  riêng Hannah 65) và KTS (10 đơn)** — đúng thứ CEO vừa nói phải gộp vào. Đây là lỗi thật, sửa ở §6.
- **130 vs 97.** Chênh 33 đơn chỉ vì **hoa/thường**: `Dino` vs `DINO`, `Hannah` vs `HANNAH`.
- **0 / 424.** `customers.channel_id` **trống hoàn toàn**. Nên luật *"kênh lấy theo khách trước,
  không có mới lấy theo đơn"* hiện bên Sales **luôn rơi xuống nhánh đơn** — không phải vì thiết kế
  sai mà vì cột chưa ai đổ dữ liệu. Phải back-fill, xem §6.

## 3. Vì sao KHÔNG được tự động ghép tên (bằng chứng)

Thử ghép 18 tên đối tác với tên khách trong `customers` + `cs_customers`:

| Ca | Số | Ví dụ |
|---|---|---|
| **Không khớp ai cả** | 5 | XANHXANH · BETAHOUSE · KAP · MQD · TÔ HIỆP |
| **Khớp nhiều hồ sơ** | 5 | Hải Nam → 3 hồ sơ Sales + 3 hồ sơ CS · Thiên An → 2 + 3 · HANNAH → 3 + 2 |
| **Khớp nhầm sang khách CUỐI của đại lý** | 4 | `Khách Của Đại Lí Hải Nam` · `Khách Hải Nam` · `Khách CWS` · `Khách Thiên An Q6/T11` |
| **Một hồ sơ khớp HAI đối tác khác nhau** | 1 | `Anh Hiếu, Chị Hannah Olala` khớp cả *Anh Hiếu* (Đại lý) lẫn *HANNAH* (KOL) |
| **Tên đơn khác tên danh mục** | 1 | đơn ghi `Đại lý anh Hiếu`, danh mục ghi `Anh Hiếu` |
| **Đơn xếp nhầm kênh cấp 1** | 2 đơn | `channel = 'Trực tiếp'` nhưng chi tiết là `Bếp Lê Phan` / `HANNAH` |

Kết luận: **ghép tự động theo tên sẽ tạo ra đúng cái "loạn" CEO lo.** Nhất là ca thứ ba — ghép
nhầm *khách của đại lý* thành *chính đại lý* thì mọi phép tính doanh số/hoa hồng sau đó sai mà
không có lỗi nào để lần ra.

Cách làm: máy **gợi ý**, người **xác nhận từng dòng**. Chỉ 18 dòng, làm một lần.

## 4. Thiết kế

### 4.1 Bảng `doi_tac` — sổ đăng ký đối tác (bảng MỚI, dùng chung)

Một dòng cho **một pháp nhân đối tác thật**, sống độc lập với mọi bảng bị sync ghi đè.

```
doi_tac
  id              uuid  pk
  ten             text  not null    -- tên hiển thị, do người đặt
  loai            text  not null    -- 'dai_ly' | 'kts' | 'kol'   (= channel_l1)
  channel_id      int   → dim_channel(id)     -- kênh đang ứng với đối tác này
  cs_customer_id  uuid  → cs_customers(id)    -- hồ sơ CS của chính đại lý, nếu có
  sales_ma_kh     text                        -- mã khách bên Sales, nếu có
  ghi_chu         text
  ngung_hop_tac   bool  default false
```

**Vì sao là bảng riêng, không phải một cột cờ trên `customers` hay `cs_customers`:**

- `customers` bị **xoá-nạp-lại / upsert từ Google Sheet**. Cột thêm vào thì sống, nhưng **dòng**
  thì không do ta làm chủ — Hải Nam đang có **3 dòng**, cắm cờ vào dòng nào cũng sai hai dòng kia.
- 5/18 đối tác **không có hồ sơ khách nào cả** (XANHXANH, BETAHOUSE, KAP, MQD, TÔ HIỆP). Cắm cờ
  lên hồ sơ khách thì 5 đối tác này không tồn tại được.
- Một đối tác cần **một** danh tính, dù bên CS có hồ sơ, bên Sales có hồ sơ, hay không bên nào có.
- Đổi lại: bảng riêng thì `cs_customer_id` / `sales_ma_kh` là **tuỳ chọn**, điền dần được.

`dim_channel` **giữ nguyên**, không bỏ. Nó vẫn là danh mục kênh cho báo cáo. Cái thay đổi là
`channel_l2` **thôi làm nhãn gõ tay** và trở thành thứ **trỏ tới `doi_tac`** (§4.3).

### 4.2 Ba mối nối, ba tầng khác nhau — đừng gộp

| Nối | Ở đâu | Vì sao ở đó |
|---|---|---|
| **Máy ↔ đơn đại lý** | `installed_base.dai_ly_ten / dai_ly_don` (ĐÃ CÓ) | "Đại lý nào bán" là sự thật của **từng con máy**. Một khách mua máy lọc tổng qua đại lý A rồi mua máy uống qua đại lý B — nhét vào hồ sơ khách là mất một nửa |
| **Khách ↔ đại lý** | **suy ra từ máy**, không lưu cột riêng | CEO muốn "gắn cả khách hàng". Nhưng khách có đại lý *vì máy của khách do đại lý bán*. Lưu thêm một cột trên khách = hai nguồn sự thật, và chúng sẽ lệch |
| **Đại lý ↔ kênh** | `doi_tac.channel_id` | Để báo cáo theo kênh vẫn chạy như cũ |

> **Chốt quan trọng:** "khách này của đại lý nào" là **view**, không phải cột. Khách có ≥1 máy gắn
> đại lý X ⇒ khách thuộc đại lý X. Khách có máy của 2 đại lý ⇒ hiện cả 2, đúng thực tế.
> Đây là chỗ dễ làm sai nhất: thêm `cs_customers.dai_ly_id` nghe tiện hơn nhiều, nhưng hôm nào
> đổi đại lý của một con máy mà quên sửa cột trên khách là số liệu lệch **im lặng**.

### 4.3 Chọn kênh sau khi có sổ đăng ký — đúng ý CEO ở điểm 5

Hôm nay: người dùng chọn `channel_l1` rồi chọn `channel_l2` từ danh sách **chữ tự do** — chính
chỗ đẻ ra `Dino`/`DINO`, `Đại lý anh Hiếu`/`Anh Hiếu`.

Sau khi có `doi_tac`:

```
Cấp 1  [ Đại lý ▾ ]        ← 6 lựa chọn, select thường
Cấp 2  [ gõ tên đại lý… ]  ← ô gõ-tìm, dữ liệu = doi_tac lọc theo loai
```

- Cấp 1 là `Trực tiếp / Ecom / Giới thiệu` ⇒ **không có cấp 2** (Ecom thì cấp 2 vẫn là
  Shopee/Tiktok — sàn, không phải đối tác; giữ nguyên danh mục).
- Cấp 1 là `Đại lý / KTS / KOL` ⇒ cấp 2 = **chọn đối tác**, gõ-tìm theo tên
  (18 mục > 10 ⇒ bắt buộc gõ-tìm theo luật CEO chốt 22/08).
- Lưu xuống DB vẫn là `channel_id` như cũ ⇒ **báo cáo cũ không phải sửa gì**.

### 4.4 Ai là đại lý thì hồ sơ khách hiện gì

Hồ sơ khách của **chính đại lý** (nếu có `cs_customer_id`): thêm nhãn `ĐẠI LÝ` + link sang trang
đối tác, liệt kê **máy đã bán ra** và **khách cuối** của đại lý đó.

Hồ sơ **khách cuối**: khối "Mua qua đại lý" — suy từ máy, mỗi máy một dòng
`serial · đại lý · mã đơn · ngày`.

## 5. Việc cần Sales chốt (2 câu, chặn phần còn lại)

1. **Màn quản lý đối tác đặt ở Sales** (CEO đã nói) — phiên Sales dựng `/sales/doi-tac`, CS chỉ
   **đọc** để đổ vào ô chọn. CS không tự dựng màn quản lý. Sales xác nhận nhận phần này?
2. **Ai back-fill `customers.channel_id`** (0/424) — nó là bảng của Sales, và phải quyết:
   khách có nhiều đơn khác kênh thì lấy **đơn mới nhất** hay **kênh nhiều đơn nhất**?
   Đề xuất: **đơn mới nhất**, vì kênh là để biết "giờ liên hệ khách này qua ai".

## 6. Thứ tự làm (sau khi chốt)

| # | Việc | Ai | Ghi chú |
|---|---|---|---|
| 0 | **Sửa ngay:** ô chọn đơn đại lý đang bỏ sót KOL + KTS (27→130 đơn), so tên bỏ hoa/thường | CS | Lỗi độc lập, không chờ chốt thiết kế |
| 1 | Migration tạo `doi_tac` + seed 18 dòng từ `dim_channel` | CS | Chỉ tạo dòng, **chưa** nối hồ sơ khách |
| 2 | Màn `/sales/doi-tac`: xác nhận từng dòng nối với hồ sơ khách nào | Sales | 18 dòng, máy gợi ý – người bấm |
| 3 | Ô chọn kênh 2 cấp đọc `doi_tac` ở cấp 2 | CS + Sales | Dùng chung `ChonKenh`, sửa một chỗ ăn cả hai |
| 4 | Nắn dữ liệu: 33 đơn lệch hoa/thường · 1 đơn `Đại lý anh Hiếu` · 2 đơn xếp nhầm `Trực tiếp` | CS | **Gửi CEO duyệt danh sách trước khi sửa** |
| 5 | Back-fill `customers.channel_id` | Sales | Theo luật chốt ở §5.2 |
| 6 | Khối "Mua qua đại lý" trên hồ sơ khách + "Khách cuối" trên trang đối tác | CS | Suy từ máy, không thêm cột |

## 7. Chỗ đã cân nhắc và loại

- **Cắm cờ `la_dai_ly` lên `cs_customers`** — hỏng ở 5 đối tác không có hồ sơ CS, và ở đối tác có
  nhiều hồ sơ trùng.
- **Bỏ `dim_channel`, chỉ dùng `doi_tac`** — gãy hết báo cáo đang chạy theo `channel_id`, đổi lấy
  gọn gàng trên giấy. Không đáng.
- **Thêm `cs_customers.dai_ly_id`** — xem cảnh báo ở §4.2.
- **Tự ghép tên rồi cho người sửa sau** — §3 cho thấy 4 ca ghép nhầm *khách của đại lý* thành
  *đại lý*; sai kiểu đó không ai phát hiện ra khi rà lại.
