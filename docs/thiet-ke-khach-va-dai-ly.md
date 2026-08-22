# Thiết kế: Khách cuối ↔ Đại lý ↔ Đơn của đại lý

> Trạng thái: **CEO ĐÃ DUYỆT 22/08/2026 kèm 5 sửa đổi** (§0). Bản dưới đã cập nhật theo.
> Phần dựng bảng + màn quản lý thuộc **phiên Sales**; CS làm phần đọc/gắn.
> Viết 22/08/2026 theo yêu cầu của CEO: *"Chỗ này cần plan kĩ cùng sales ko sẽ loạn […]
> bạn hiểu ko viết lại thiết kế chỗ này rồi mới làm tiếp"*.
> Mọi con số dưới đây **đo từ prod `bwzmqfbcgouhvhoslmmm` ngày 22/08/2026**, không phải ước lượng.

## 0. CEO duyệt 22/08 — năm chỗ phải sửa so với bản đầu

1. **Bảng `doi_tac` dựng bên SALES, không phải bên CS.** CS **đọc + cập nhật** được, hai khu sửa
   đồng thời. CS báo Sales làm, không tự dựng.
2. **Nối đối tác với CHÍNH SÁCH GIÁ** — mỗi đối tác áp bậc giá nào. Xem §4.3.
3. 🔴 **KHÔNG gắn thẳng vào ĐƠN.** Nguyên văn CEO: *"Sẽ có trường hợp ko biết là thuộc về đơn nào
   đâu (đa phần POE sẽ biết vì cần bảo trì, nhưng POU ko biết khách có vấn đề hoặc mua lõi liên hệ,
   chỉ biết khách của bên đại lý do đại lý báo chứ ko biết khách mua đơn nào)."*
   ⇒ **Bản đầu của tôi SAI ở §4.2.** Xem §4.2 đã viết lại.
4. **KHÔNG ghép khách tự động** — CEO tự ghép. (Trùng với kết luận §3, giờ thành lệnh.)
5. **Khách có đơn ở nhiều kênh thì gửi CEO chỉnh tay**, không tự chọn kênh nào thắng — *"cái này
   có thể điền nhầm"*. Danh sách ở §5.

---

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
  bac             text                        -- BẬC GIÁ áp cho đối tác này (§4.3)
  cs_customer_id  uuid  → cs_customers(id)    -- hồ sơ CS của chính đại lý, nếu có
  sales_ma_kh     text                        -- mã khách bên Sales, nếu có
  ghi_chu         text
  ngung_hop_tac   bool  default false
```

**Ai dựng, ai ghi (CEO chốt 22/08):** bảng + màn quản lý **do phiên Sales dựng**, đặt ở
`/sales/doi-tac`. **CS đọc VÀ cập nhật được**, không phải chỉ đọc — CS là bên hay biết trước
"khách này của đại lý nào" (đại lý gọi báo khi khách có vấn đề), nên bắt CS phải nhờ Sales sửa
là mất thông tin ngay lúc nó tới. Hai khu ghi cùng một bảng, qua **một đường ghi dùng chung**
như đã làm với SĐT phụ — đừng để mỗi khu một câu `insert`.

**Vì sao là bảng riêng, không phải một cột cờ trên `customers` hay `cs_customers`:**

- `customers` bị **xoá-nạp-lại / upsert từ Google Sheet**. Cột thêm vào thì sống, nhưng **dòng**
  thì không do ta làm chủ — Hải Nam đang có **3 dòng**, cắm cờ vào dòng nào cũng sai hai dòng kia.
- 5/18 đối tác **không có hồ sơ khách nào cả** (XANHXANH, BETAHOUSE, KAP, MQD, TÔ HIỆP). Cắm cờ
  lên hồ sơ khách thì 5 đối tác này không tồn tại được.
- Một đối tác cần **một** danh tính, dù bên CS có hồ sơ, bên Sales có hồ sơ, hay không bên nào có.
- Đổi lại: bảng riêng thì `cs_customer_id` / `sales_ma_kh` là **tuỳ chọn**, điền dần được.

`dim_channel` **giữ nguyên**, không bỏ. Nó vẫn là danh mục kênh cho báo cáo. Cái thay đổi là
`channel_l2` **thôi làm nhãn gõ tay** và trở thành thứ **trỏ tới `doi_tac`** (§4.3).

### 4.2 Ba mối nối — VIẾT LẠI sau góp ý CEO 22/08

> 🔴 **Bản đầu của tôi sai.** Tôi viết *"khách ↔ đại lý là VIEW suy từ máy, không lưu cột riêng"*.
> CEO bác đúng chỗ nó gãy: với **POU** thì thường **không biết khách mua đơn nào, thậm chí máy nào**
> — chỉ biết *"đây là khách của đại lý X"* vì **đại lý gọi báo**, lúc khách có vấn đề hoặc mua lõi.
> Suy từ máy nghĩa là những khách đó **không bao giờ hiện ra**, mà đó lại là nhóm CS cần nhất.
>
> Chỗ tôi lập luận đúng nhưng áp nhầm: tôi sợ hai nguồn sự thật. Thực ra **đây là hai sự thật
> KHÁC NHAU**, không phải một sự thật lưu hai nơi:
> · **"Con máy này do ai bán"** — sự thật của một giao dịch. Biết chắc hoặc không biết.
> · **"Khách này là khách của đại lý nào"** — sự thật của một quan hệ. Đại lý báo là biết,
>   không cần đơn, không cần serial.
> Một người có thể là khách của đại lý A mà mua một máy lẻ ở kênh khác. Hai cột, hai câu hỏi.

| Nối | Ở đâu | Bắt buộc có gì |
|---|---|---|
| **Khách ↔ đối tác** | `cs_customers.doi_tac_id` → `doi_tac(id)` | **Chỉ cần biết đại lý.** Không cần đơn, không cần serial, không cần máy |
| **Máy ↔ đối tác** | `installed_base.doi_tac_id` (thay `dai_ly_ten` chép tay) | Chỉ cần biết đại lý |
| **Máy ↔ đơn của đối tác** | `installed_base.dai_ly_don` (ĐÃ CÓ) — **TUỲ CHỌN** | Chỉ điền khi biết chắc đơn nào. **Bỏ trống là trạng thái hợp lệ, không phải dữ liệu thiếu** |

**Ba mức chắc chắn, ghi rõ trên màn hình** — để CS không phải đoán và không bịa cho đủ ô:

```
① Chỉ biết đại lý          → gắn ở HỒ SƠ KHÁCH.  Ca POU thường gặp nhất.
② Biết đại lý + đúng máy   → gắn thêm ở MÁY.     Ca POE (có đi bảo trì nên biết máy).
③ Biết cả đơn của đại lý   → gắn thêm mã đơn.    Ca đối soát hoa hồng.
```

Đọc thì **máy trước, khách sau**: máy có `doi_tac_id` thì lấy của máy (chính xác hơn); không có
thì lấy của hồ sơ khách. Không cái nào có thì hiện *"chưa rõ"* — **đừng đoán**.

⚠️ **Đổi so với thứ CS đã dựng hôm 22/08:** màn `/may/<serial>` hiện đang **bắt chọn một đơn**
mới gắn được đại lý (`GanDonDaiLy`). Theo CEO thì đó là ca ③, hiếm nhất. Phải sửa thành: chọn
**đối tác** trước (bắt buộc), chọn **đơn** sau (tuỳ chọn, để trống được).

⚠️ **`installed_base.dai_ly_ten` (chép tên) chuyển thành `doi_tac_id`.** Lý do chép tên hồi 22/08
là `sales_order_lines` bị xoá-nạp-lại mỗi lần sync nên khoá ngoại sẽ treo — vẫn đúng, nhưng nay
`doi_tac` là **bảng của mình**, không bị sync đụng, nên khoá ngoại sống được. Giữ `dai_ly_ten`
làm cột ảnh-chụp cho dữ liệu cũ, ngừng ghi mới.

### 4.3 Nối đối tác với CHÍNH SÁCH GIÁ (CEO yêu cầu 22/08)

Prod đã có sẵn bộ khung, **cả ba bảng đang 0 dòng** (đo 22/08) — nên đây là lúc nối vào rẻ nhất:

| Bảng | Khoá | Nội dung |
|---|---|---|
| `sales_bac_khach` | `customer_code`, `bac`, `hieu_luc_tu/den` | bậc của **khách thường** |
| `sales_chinh_sach_gia` | `bac` + `internal_code` | `giam_pct` hoặc `gia_ban` theo bậc, có hiệu lực |
| `sales_ctkm*` | — | khuyến mãi, không đụng ở việc này |

**Đối tác lấy bậc qua `doi_tac.bac`, KHÔNG qua `sales_bac_khach`.** Hai lý do đo được:

1. `sales_bac_khach` khoá bằng `customer_code` — **đúng cái mã bị khai tử âm thầm** mỗi lần dựng
   lại `DM_KHACH` (đã ghi ở Changelog SYSTEM.md 22/08). Bậc giá của đại lý mà treo theo mã đó thì
   một lần dựng lại Sheet là **đại lý mất bậc, đơn kế tiếp tính sai tiền**.
2. **5/18 đối tác không có hồ sơ khách nào** ⇒ không có `customer_code` để mà gắn.

Tra giá: `doi_tac.bac` → `sales_chinh_sach_gia(bac, internal_code)` — **cùng đúng một bảng chính
sách** với khách thường, chỉ khác đường lấy bậc. Không đẻ bảng giá riêng cho đại lý.

⚠️ Ai dựng phần này là **Sales** (bảng giá là của Sales). CS chỉ cần **đọc** để hiển thị, chưa có
màn nào của CS phải tính giá đại lý.

### 4.4 Chọn kênh sau khi có sổ đăng ký — đúng ý CEO ở điểm 5

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

### 4.5 Ai là đại lý thì hồ sơ khách hiện gì

Hồ sơ khách của **chính đại lý** (nếu có `cs_customer_id`): thêm nhãn `ĐẠI LÝ` + link sang trang
đối tác, liệt kê **máy đã bán ra** và **khách cuối** của đại lý đó.

Hồ sơ **khách cuối**: khối "Mua qua đại lý" — suy từ máy, mỗi máy một dòng
`serial · đại lý · mã đơn · ngày`.

## 5. Khách có đơn ở NHIỀU KÊNH — CEO chỉnh tay

CEO chốt: *"Khách có nhiều đơn khác kênh báo tôi để chỉnh lại vì cái này có thể điền nhầm."*
⇒ **Không tự chọn kênh nào thắng.** Đo prod 22/08, chỉ **3 khách**:

| Khách | Đơn | Các kênh đang ghi |
|---|---|---|
| Minh Đông - đại lý | 3 | `Trực tiếp` · `Đại lý` (trống chi tiết) · `Đại lý › Minh Vương` |
| Anh Đông | 2 | `Trực tiếp` · `Đại lý › Minh Vương` |
| Trần Bích Ngọc | 2 | `KOL › Dino` · `Trực tiếp` |

Chi tiết từng đơn để CEO tìm trong Sheet:

```
Minh Đông - đại lý   260210-U001 10/02/2026 DON_POU  Trực tiếp
                     260709-U001 09/07/2026 DON_POU  Đại lý  ← thiếu chi tiết đại lý
                     260722-U001 22/07/2026 DON_POU  Đại lý › Minh Vương
Anh Đông             260415-U002 15/04/2026 DON_POU  Trực tiếp
                     260820-U001 20/08/2026 DON_POU  Đại lý › Minh Vương
Trần Bích Ngọc       250610-E002 10/06/2025 DON_POE  KOL › Dino
                     260707-O002 07/07/2026 DON_OTHERS  Trực tiếp
```

### 5.1 🔴 Phát hiện thêm khi rà: MỘT mã đơn dùng cho 10 khách khác nhau

`260731-O002` (tab `DON_OTHERS`) mang **10 khách khác nhau, 10 ngày khác nhau** (07/07 → 28/07):
*Bếp Lê Phan · BÙI THU HÀ · Chị Dương · Nguyễn Ngọc Khanh · Nguyễn Quang Anh · Nguyễn Văn Long
(2 ngày) · Phạm An · Phạm Huy Cận · TÔ LAN HƯƠNG*.

Trông như ai đó gõ lại **một mã đơn cho cả tháng** ở tab `DON_OTHERS`. Đây là **mã duy nhất** bị
vậy trong toàn bộ `sales_order_lines`, nên là lỗi gõ chứ không phải quy ước.

**Ảnh hưởng thật, không phải chuyện thẩm mỹ:** mọi phép đếm theo `order_code` gộp 10 khách thành
một đơn; và chính nó làm bảng ở trên **ban đầu ra 6 khách thay vì 3** — 3 khách kia "nhiều kênh"
chỉ vì bị dính mã đơn dùng chung này. Nếu về sau gắn máy vào **đơn của đại lý** (ca ③ §4.2) mà
trúng mã này thì gắn nhầm sang khách khác.

⇒ **Cần CEO tách mã này trong Sheet.** CS/Sales không sửa hộ được: phải biết đơn nào là đơn nào.

### 5.2 Việc chia cho Sales

1. Dựng bảng `doi_tac` + màn `/sales/doi-tac` (CEO chốt đặt bên Sales), **CS ghi được**.
2. Nối `doi_tac.bac` → `sales_chinh_sach_gia` (§4.3).
3. Back-fill `customers.channel_id` (đang **0/424**) — **sau khi** CEO chỉnh 3 khách ở §5.
   Khách chỉ có một kênh thì lấy kênh đó; đây là 421/424 trường hợp.

## 6. Thứ tự làm

| # | Việc | Ai | Trạng thái |
|---|---|---|---|
| 0 | Ô chọn đơn đại lý bỏ sót KOL + KTS (27→130 đơn) | CS | ✅ xong, commit `597658f` |
| 1 | Bảng `doi_tac` + màn `/sales/doi-tac`, CS ghi được | **Sales** | chờ Sales |
| 2 | `doi_tac.bac` → `sales_chinh_sach_gia` | **Sales** | chờ Sales |
| 3 | `cs_customers.doi_tac_id` + `installed_base.doi_tac_id` | CS | chờ bảng `doi_tac` |
| 4 | Sửa màn `/may/<serial>`: chọn **đối tác** bắt buộc, **đơn** tuỳ chọn | CS | chờ mục 3 |
| 5 | Khối "Khách của đại lý nào" trên hồ sơ khách + gắn ngay tại đó | CS | chờ mục 3 |
| 6 | Ghép 18 đối tác với hồ sơ khách | **CEO tự ghép** | máy chỉ hiện gợi ý, không tự gắn |
| 7 | CEO tách mã đơn `260731-O002` trong Sheet (§5.1) | **CEO** | chờ CEO |
| 8 | CEO chỉnh kênh 3 khách ở §5 | **CEO** | chờ CEO |
| 9 | Back-fill `customers.channel_id` | **Sales** | sau mục 8 |
| 10 | Nắn 33 đơn lệch hoa/thường · 1 đơn `Đại lý anh Hiếu` · 2 đơn xếp nhầm `Trực tiếp` | CS | **gửi CEO duyệt danh sách trước** |

## 7. Chỗ đã cân nhắc và loại

- **Cắm cờ `la_dai_ly` lên `cs_customers`** — hỏng ở 5 đối tác không có hồ sơ CS, và ở đối tác có
  nhiều hồ sơ trùng.
- **Bỏ `dim_channel`, chỉ dùng `doi_tac`** — gãy hết báo cáo đang chạy theo `channel_id`, đổi lấy
  gọn gàng trên giấy. Không đáng.
- ~~**Thêm `cs_customers.dai_ly_id`**~~ — tôi từng loại vì sợ hai nguồn sự thật. **CEO bác đúng**:
  ca POU chỉ biết đại lý chứ không biết đơn/máy, suy từ máy là mất hẳn nhóm đó. Nay đã đưa vào
  thiết kế (§4.2) dưới tên `doi_tac_id`. Ghi lại chỗ mình sai để lần sau đừng lấy "một nguồn sự
  thật" làm lý do bỏ một sự thật khác.
- **Tự ghép tên rồi cho người sửa sau** — §3 cho thấy 4 ca ghép nhầm *khách của đại lý* thành
  *đại lý*; sai kiểu đó không ai phát hiện ra khi rà lại. **CEO chốt 22/08: tự ghép luôn** —
  máy chỉ được hiện gợi ý, CEO bấm.
