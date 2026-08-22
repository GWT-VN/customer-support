# Sales — Chi tiết đơn · Chuẩn filter toàn app · Hồ sơ khách + schema khách chung

> **Ngày:** 2026-08-21 · **Khu:** Sales · **Nhánh:** `feat/sales-don-loc-khach` · **Cổng dev:** 3201
> **Trạng thái:** thiết kế đã được CEO duyệt 21/08, chưa viết code.
> Không chứa PII — an toàn commit.

---

## 1. Vì sao có việc này

CEO check xong 4 màn phần **Đọc** của khu Sales (danh sách đơn, chi tiết đơn, danh sách khách,
hồ sơ khách 360) và đưa 3 nhóm góp ý: chi tiết đơn thiếu tổng VAT và hình thức thanh toán;
cần chuẩn filter thời gian **dùng chung toàn app**; hồ sơ khách thiếu kênh, công ty, SĐT phụ,
tổng tiền, công nợ, sales chăm sóc.

Khi rà lại code + DB thật (`bwzmqfbcgouhvhoslmmm`) thì lộ thêm 4 chuyện làm đổi phạm vi:

| # | Phát hiện | Hệ quả |
|---|---|---|
| 1 | Chuẩn filter chung **đã có sẵn** ở `apps/web/bang/` — 9 trang CSKH dùng, **0 trang Sales** dùng | Không dựng mới, chỉ bổ sung + kéo Sales về chuẩn |
| 2 | `feat/sales-ghi` có 2 commit filter (20/08, chưa merge) **tự viết riêng**, param `tu`/`den` thay vì `ngtu`/`ngden` | Bỏ, dựng lại theo chuẩn |
| 3 | **Không bảng nào có cột khuyến mãi** | Hoãn cột KM (CEO chốt), làm cùng đợt bảng giá niêm yết |
| 4 | `vat_pct` lệch đơn vị: Sheet lưu `0.08`, form app ghi nhãn "VAT%" ⇒ người dùng gõ `8` | Phải chốt đơn vị trước khi hiện tổng VAT |

---

## 2. Quyết định đã chốt (CEO, 21/08)

| Quyết định | Chốt | Lý do |
|---|---|---|
| Filter tự viết ở `feat/sales-ghi` | **Bỏ, viết lại theo `bang/`** | Đúng mục tiêu "chuẩn chung toàn app" |
| Cột Khuyến mãi | **Hoãn** | KM chỉ có nghĩa khi so với giá niêm yết — đang chờ CEO nạp bảng giá |
| Hồ sơ khách | **Làm bản suy từ đơn + chốt luôn schema chung CS/Sales** | Không bỏ cột của bên nào; trùng thì dùng chung |
| Quy ước Tỉnh/TP | **Theo CS: `province` = tỉnh MỚI** | Cột tên trần phải là giá trị hiện hành |
| Cột cũ lệch tên | **Giữ nguyên + ghi ánh xạ; đổi tên dứt điểm lúc tắt Apps Script** | Apps Script sắp nghỉ ⇒ không dựng trigger/view chỉ sống được vài tuần |
| Đơn vị `vat_pct` | **Giữ phân số `0.08`**, form đổi thành dropdown 0/5/8/10% | Không phải đụng 810 dòng data lẫn Apps Script; dropdown chặn lỗi gõ tay |

---

## 3. Số liệu nền (đo trên production 21/08/2026)

| Chỉ số | Giá trị |
|---|---|
| `customers` (Sales chủ) | 411 khách |
| `cs_customers` (CS chủ) | 427 khách — chỉ **125** có `customer_code` nối được sang Sales |
| `sales_orders` / `sales_order_items` (đơn tạo trên app) | **0 dòng** |
| `sales_order_lines` (mirror từ Sheet) | 810 dòng · có `amount_net` 805 · có `vat_pct` 788 |
| `customer_purchases` | 822 dòng / 428 đơn — **418 đơn (97,7%)** khớp được sang `sales_order_lines` để lấy tiền |
| Kênh | 9 kênh cấp 1 · 22 kênh chi tiết · CS đã điền `channel_id` cho 77 khách |
| Khách có ghi chú | 164 |
| `customers` lệch tỉnh (`province` ≠ `province_moi`) | 46 |

`sales_orders` = 0 dòng là **cửa sổ vàng**: sửa đơn vị VAT bây giờ không phải sửa dữ liệu nào.

---

## 4. Phần A — Schema khách chung CS ⇄ Sales

### 4.1 Cách làm: một bộ từ vựng cột, hai bảng cùng áp

Không gộp hai bảng làm một. Lý do: đổi chủ sở hữu bảng, phải viết lại RLS + mọi query CS, và
**302 khách CS chưa có `customer_code`** sẽ mồ côi. Thay vào đó chốt một danh sách cột chuẩn,
mỗi bên tự chạy migration thêm cột mình thiếu, **cột mới đặt tên giống hệt nhau ở cả hai bảng**.
Sau này muốn gộp một bảng thì hai bên đã đồng nhất sẵn.

### 4.2 Bộ cột chuẩn

⊕ = phải thêm · ✓ = đã có

| Ý nghĩa | Tên chuẩn | Kiểu | `customers` (Sales) | `cs_customers` (CS) |
|---|---|---|---|---|
| Mã khách | `customer_code` | text | ✓ | ✓ (125/427) |
| Kênh khách đến từ | `channel_id` → `dim_channel.id` | int | ⊕ | ✓ |
| SĐT phụ | `phone2` | text | ⊕ | ⊕ |
| Sales chăm sóc | `sales_owner` → `staff.id` | uuid | ⊕ | ⊕ |
| Email cá nhân | `email` | text | ⊕ | ⊕ |
| Ngày sinh | `ngay_sinh` | date | ⊕ | ⊕ |
| Địa chỉ công ty | `dia_chi_cty` | text | ⊕ | ✓ |
| SĐT công ty | `sdt_cty` | text | ⊕ | ✓ |
| Email công ty | `email_cty` | text | ⊕ | ✓ |
| Tên không dấu (tìm kiếm) | `ten_kd` | text | ⊕ | ✓ |
| Địa chỉ không dấu | `dia_chi_kd` | text | ⊕ | ✓ |
| Nguồn khách | `source` | text | ⊕ | ✓ |
| Tỉnh/TP **hiện hành** | `province` | text | ⊕ đổi nghĩa (§4.3) | ✓ |
| Tỉnh/TP trước sáp nhập | `province_truoc_sap_nhap` | text | ⊕ | ✓ |

**Cột cũ lệch tên — giữ nguyên, chỉ ghi ánh xạ:**

| Ý nghĩa | Sales | CS |
|---|---|---|
| Tên khách | `name` | `full_name` |
| SĐT chính | `phone` (+ `phone_chuan`, `phone_no0`) | `primary_phone` |
| Công ty xuất hoá đơn | `company_invoice` | `ten_cty` |
| Mã số thuế | `tax_code` | `mst` |
| Lưu ý | `note` | `notes` |

Đổi tên dứt điểm bằng `alter table … rename column` **vào lúc tắt Apps Script**, không sớm hơn.

### 4.3 Đổi quy ước Tỉnh/TP — thứ tự bắt buộc

Hai bên đang **ngược nhau** trên cùng một tên cột:

| | Sales `customers` hiện tại | CS `cs_customers` hiện tại | Chuẩn mới (theo CS) |
|---|---|---|---|
| `province` | tỉnh **CŨ** | tỉnh **MỚI** | tỉnh **MỚI** |
| tỉnh cũ để ở | `province_moi` là tỉnh mới | `province_truoc_sap_nhap` | `province_truoc_sap_nhap` |

**Thứ tự chạy — sai thứ tự là mất dữ liệu hoặc đứt sync:**

1. **Migration chỉ THÊM cột** `province_truoc_sap_nhap` vào `customers` và `sales_order_lines`.
   Chưa đổi giá trị nào. Phải làm trước, vì Apps Script ghi vào cột chưa tồn tại thì PostgREST
   trả lỗi và **đứt sync**.
2. **CEO sửa Apps Script** (§4.4).
3. **Chạy sync một lần** → toàn bộ khách `KH…` và 810 dòng đơn được ghi đè đúng quy ước mới.
4. **Backfill khách `KA…`** (tạo trên app, sync không đụng tới):
   `update customers set province_truoc_sap_nhap = province, province = province_moi
    where customer_code like 'KA%' and province_moi is not null;`
5. **Bỏ `province_moi`** ở đợt sau, khi đã chắc không còn code nào đọc.

> ⚠️ **Bẫy:** backfill *trước* khi sửa Apps Script thì lần sync kế tiếp ghi đè `province` về tỉnh
> cũ — lặng lẽ, không báo lỗi, không ai biết. Bước 2 phải xong trước bước 3.

> `sales_order_lines` được **xoá sạch rồi nạp lại** mỗi lần sync (`delete ?id=gt.0` rồi POST),
> nên với bảng đó bước 3 là đủ, không cần backfill.

### 4.4 Hướng dẫn CEO sửa Apps Script — đúng 2 chỗ

File: `Sales Tracking/apps-script/Code.gs`. **Sửa xong nhớ Deploy lại.**

**Chỗ 1 — đồng bộ KHÁCH, khoảng dòng 2691.** Tìm:

```js
      province: csTextOrNull_(r[KH.TINH - 1]),
      province_moi: csTextOrNull_(tinhMoi_(r[KH.TINH - 1])),
```

Đổi thành:

```js
      province: csTextOrNull_(tinhMoi_(r[KH.TINH - 1])),
      province_truoc_sap_nhap: csTextOrNull_(r[KH.TINH - 1]),
```

**Chỗ 2 — đồng bộ ĐƠN, khoảng dòng 1686.** Tìm:

```js
    // Tỉnh sau sáp nhập (suy từ tỉnh nhập) — đẩy CẢ 2: province (nguyên gốc) + province_moi (34 tỉnh).
    obj.province_moi = obj.province ? tinhMoi_(obj.province) : null;
```

Đổi thành:

```js
    // Tỉnh: `province` = tỉnh MỚI (34 tỉnh) — quy ước chung CS/Sales chốt 21/08/2026.
    // Tỉnh nguyên gốc từ Sheet chuyển sang province_truoc_sap_nhap.
    obj.province_truoc_sap_nhap = obj.province;
    obj.province = obj.province ? tinhMoi_(obj.province) : null;
```

> **Hai dòng này PHẢI đúng thứ tự.** `obj.province` bị ghi đè ở dòng dưới, nên phải cất giá trị
> gốc sang `province_truoc_sap_nhap` **trước**. Đảo thứ tự là mất sạch tỉnh cũ.

Không đụng gì khác trong `Code.gs`. Hàm `tinhMoi_()` giữ nguyên.

**Cách kiểm sau khi sync:** đếm trên Supabase, số khách có `province` nằm trong danh sách 34 tỉnh
mới phải tăng lên, và `province_truoc_sap_nhap` phải có giá trị ở đúng 46 khách từng lệch.

### 4.5 Nghĩa vụ phối hợp

`customers` là **bảng dùng chung** ⇒ theo `GWT-SHARED/SYSTEM.md` §7.1 phải:
1. Ghi 1 dòng Changelog vào `SYSTEM.md` §8,
2. **Báo CS TRƯỚC khi chạy migration** (soạn sẵn nội dung để CEO duyệt rồi gửi),
3. CS tự chạy phần `cs_customers` của bộ cột chuẩn.

Migration đặt ở `supabase/migrations/<ts>_sales_khach_schema_chung.sql` theo `db/MIGRATIONS-CONVENTION.md`.

---

## 5. Phần B — Chuẩn filter chung toàn app

### 5.1 Chuẩn đã có, chỉ thiếu tài liệu + preset

`apps/web/bang/` đã có `LocNgay` (4 chế độ: đúng ngày · trong khoảng · trước ngày · từ ngày,
điều khiển `ngtu`/`ngden`), `BoLocChon`, `ThanhDangLoc`, `PhanTrang`, `ChonDong`, tìm kiếm
tiếng Việt không dấu. Gói này **cố ý không import gì ngoài `react` + `next/navigation`**.

### 5.2 Việc

1. **Thêm preset vào `bang/LocNgay.tsx`**: *Hôm nay · Tuần này · Tháng này · 30 ngày*.
   Preset chỉ set `ngtu`/`ngden` rồi đi tiếp — không đẻ param mới, để trang nào cũng dùng được.
   Tuần bắt đầu **Thứ 2**. Mốc thời gian tính theo giờ VN, không dùng UTC.
2. **Viết `docs/CHUAN-FILTER.md`** — tài liệu CEO yêu cầu, nội dung:
   - bảng tên param chuẩn (`q`, `ngtu`, `ngden`, `trang`, `cot`, `chieu`, param lọc chọn),
   - dùng component nào cho loại lọc nào,
   - luật *đổi lọc thì xoá `trang`* (về trang 1),
   - **luật bắt buộc: viết filter mới ở bất kỳ khu nào phải đọc file này trước, và bổ sung vào đây nếu thêm chuẩn mới.**
3. **`/sales`** — bỏ filter tự viết, dựng lại bằng `bang/`, thêm lọc **Kênh** + **Sản phẩm**
   (ngoài Tình trạng hàng / Tình trạng thanh toán đã có).
4. **`/sales/khach`** — thêm lọc **Kênh** + **Tỉnh/TP**.

### 5.3 Xử lý nhánh cũ

`feat/sales-ghi` còn 2 commit chưa merge (`2c9347e`, `a3e02f9`) là bản filter tự viết. Sau khi
bản theo chuẩn lên `main` và CEO xác nhận, **xoá nhánh + gỡ worktree `~/gwt-sales-dev`**.
Hai commit khác trên nhánh đó (`3ba3062`, `7b0ec10`) **đã có trong `main`**, không mất gì.

---

## 6. Phần C — Chi tiết đơn (`/sales/don/[code]`)

1. **Ba dòng tổng** ở `tfoot`: Tổng trước VAT · Tiền VAT · **Tổng sau VAT** (in đậm).
   - Đơn Sheet: cộng thẳng `amount_net` và `amount_vat` — có sẵn, không cần migration.
   - Đơn app: `sales_order_items` không có `amount_net` ⇒ suy `net = amount_vat / (1 + vat_pct)`.
   - Dòng thiếu `vat_pct` (22 dòng): coi VAT = 0, `net = vat`. Không đoán.
2. **Cột dòng sản phẩm**: Sản phẩm · Mã nội bộ · Danh mục · SL · **Đơn giá** · **Thành tiền**.
   Dòng quà gắn badge **Tặng**, thành tiền = 0 — **nhưng chỉ với đơn tạo trên app**.

   ⚠️ **Đo lại 21/08, khác với giả định ban đầu:** `sales_order_lines` chỉ có 3 tab
   (`DON_POE`, `DON_POU`, `DON_OTHERS`) — **không có `DON_TANG`**. Toàn bộ **23 dòng quà** nằm ở
   `customer_purchases` với `source_tab='DON_TANG'`, **0 dòng quà nằm ngoài tab đó**. Tức là với
   đơn bán từ Sheet, "dòng quà" **không tồn tại trong dữ liệu**: quà là **cả một đơn riêng**, không
   phải một dòng nằm trong đơn bán.

   | Loại đơn | Cờ quà | Cách hiện |
   |---|---|---|
   | Đơn tạo trên app | `sales_order_items.is_gift` ✓ | badge **Tặng** trên dòng |
   | Đơn tặng (tab Tặng) | `customer_purchases.is_gift` ✓ | cả đơn là quà |
   | Đơn bán từ Sheet | **không có** | không hiện badge |

   Ý định ban đầu — suy cờ quà bằng cách nối `customer_purchases` theo `order_code` + `internal_code`
   — **không dùng được**: nối ra **0/22** cặp quà khớp, và bản thân khoá đó trùng lặp (35 cặp bên
   `customer_purchases`, 34 cặp bên `sales_order_lines`) nên không phải khoá duy nhất.

   Muốn đơn Sheet có dòng quà thì phải thêm cột ở Google Sheet + Apps Script — **ghi vào backlog,
   không làm ở đợt này**. Có 35 dòng `amount_vat = 0` trong `sales_order_lines`, nhưng đó có thể là
   quà, có thể là dòng lỗi hoặc khuyến mãi — **không đoán**, để CEO chốt sau.
3. **Hình thức thanh toán** đưa lên khối header (hiện nằm trong khối phụ, chỉ hiện với đơn app).
   Đơn Sheet không có cột này ⇒ hiển thị "—".
4. **Cột Khuyến mãi**: hoãn (§2).
5. **Sửa bẫy VAT**: ô "VAT%" trong `OrderForm.tsx` đổi thành **dropdown 0% / 5% / 8% / 10%**,
   lưu phân số (`0`, `0.05`, `0.08`, `0.1`) đúng như Sheet. Thêm test đơn vị cho hàm quy đổi.

---

## 7. Phần D — Hồ sơ khách (`/sales/khach/[code]`)

**Lấy được ngay, không chờ ai:**

| Thông tin | Nguồn |
|---|---|
| Kênh khách đến từ | `customers.channel_id` → `dim_channel` (sau §4); trước đó suy từ kênh các đơn của khách |
| Tổng tiền đã mua | `customer_purchases` → `sales_order_lines` theo `order_code`, cộng `amount_vat` |
| Nợ đơn nào | cùng phép nối, lọc `payment_status` ∈ {Chờ cọc, Chờ đối soát, Còn nợ} — liệt kê **từng mã đơn** kèm số tiền |
| Công ty / MST / địa chỉ / SĐT / email công ty | `customers` sau khi thêm cột (§4.2) |
| Lưu ý | `customers.note` — 164 khách đã có |

**Có sau migration §4, chưa có dữ liệu ⇒ hiện "—" + cho gán:** `phone2` (SĐT phụ),
`sales_owner` (sales chăm sóc, dropdown từ `staff` có vai trò `sales`/`sales_manager`).

⚠️ Hiện chỉ có **2 nhân sự** mang vai trò `sales`/`sales_manager` (trên tổng 5 người đang hoạt động)
⇒ dropdown sẽ rất ngắn. Nếu CEO muốn gán cho người chưa có vai trò Sales thì phải gán vai trò trước
(việc này đã nằm sẵn ở `SYSTEM.md` §6 — "Gán role `sales`/`sales_manager` cho NV Sales").

⚠️ **10/428 đơn không khớp được sang `sales_order_lines`** ⇒ tổng tiền của vài khách sẽ thiếu.
Không giấu: chỗ nào thiếu thì ghi rõ *"n đơn chưa có dữ liệu tiền"* cạnh con số, đừng để CEO
tưởng tổng đã đủ.

---

## 8. Thứ tự làm & cách CEO check

| Đợt | Nội dung | CEO check gì |
|---|---|---|
| 1 | **Phần C** — chi tiết đơn | Mở một mã đơn: đủ 3 dòng tổng, cột Đơn giá/Thành tiền, badge Tặng, hình thức TT |
| 2 | **Phần B** — chuẩn filter + tài liệu | `/sales` và `/sales/khach`: lọc trước ngày / sau ngày / khoảng / hôm nay / tuần này / tháng này; lọc Kênh, Sản phẩm, Tỉnh |
| 3 | **Phần A** — migration + CEO sửa Apps Script | Sau sync: tỉnh hiển thị đúng tỉnh mới, `province_truoc_sap_nhap` có giá trị ở 46 khách từng lệch |
| 4 | **Phần D** — hồ sơ khách | Mở một mã khách: kênh, công ty, tổng tiền, danh sách đơn còn nợ, ô gán SĐT phụ + sales chăm sóc |

Mỗi đợt theo quy trình `CLAUDE.md`: `tsc` + `test` + `build` sạch → `npm run env:local` →
`npx next dev -p 3201` trong worktree → đưa CEO đúng đường dẫn `http://localhost:3201/...`.
**Đợt 3 phải đối chiếu migration local vs prod trước khi merge.**

---

## 9. Bẫy đã biết — đừng dẫm lại

1. **Backfill tỉnh trước khi sửa Apps Script** ⇒ sync kế tiếp âm thầm ghi đè ngược (§4.3).
2. **Đảo thứ tự 2 dòng ở chỗ 2 của Apps Script** ⇒ mất sạch tỉnh cũ (§4.4).
3. **Đổi tên cột `company_invoice`/`tax_code` bây giờ** ⇒ đứt sync Apps Script (§2).
4. **Coi `vat_pct` là phần trăm** ⇒ tổng VAT sai 100 lần (§6.5).
5. **Tự dựng filter riêng cho khu mới** thay vì dùng `bang/` ⇒ đúng thứ tài liệu §5.2 sinh ra để chặn.
6. **Chạy migration `customers` mà chưa báo CS** ⇒ vi phạm `SYSTEM.md` §7.1.
7. **Tưởng đơn bán từ Sheet có dòng quà** ⇒ không có; quà từ Sheet là cả một đơn `DON_TANG` riêng (§6.2).
8. **Dùng `(order_code, internal_code)` làm khoá nối** ⇒ không duy nhất, trùng lặp ở cả hai bảng (§6.2).
