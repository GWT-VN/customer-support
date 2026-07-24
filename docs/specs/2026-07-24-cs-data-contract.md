# Data Contract: Sales Tracking → module Customer Support (CSKH)

> 📋 **Đây là CONTRACT giữa 2 module (interface), không phải plan thi công.** Trạng thái: **bản
> giao cho người xây CS thiết kế phía họ**. Phần Sales phải xây (bảng `customers`, `customer_purchases`)
> **chưa implement** — sẽ làm ở "Phase 5" khi CS chốt xong design. Xem [CHECKLIST.md](../../../CHECKLIST.md).

**Ngày:** 2026-07-24 · **Chủ sở hữu data gốc:** Sales Tracking (Google Sheet là nguồn chân lý).

---

## 1. Quyết định đã chốt (2026-07-24)

- **Cùng project Supabase** `GWT-SalesTracking` (`bwzmqfbcgouhvhoslmmm`). CS sẽ chuyển về đây (hiện
  tạm ở `GWT-Masterdata`) để tách CS khỏi masterdata.
- **CS chỉ ĐỌC data Sales** — 1 chiều. CS **không ghi ngược** vào bảng của Sales (Sheet là nguồn
  chân lý; mỗi lần sync Sales xoá sạch bảng mirror rồi ghi lại → ghi tay vào đó sẽ mất).
- **CS tự sở hữu bảng riêng** cho ticket lỗi, lịch bảo trì, ngày lắp đặt... — nằm cùng project
  nhưng là bảng của CS, Sales không đụng.
- **PII (SĐT/địa chỉ) đưa lên Supabase nhưng bảng RIÊNG khoá RLS** — chỉ role CS đọc được, KHÔNG
  policy cho `anon`. Bảng dashboard (`sales_order_lines`) giữ nguyên sạch PII.
- **Lịch thay lõi/bảo trì KHÔNG nằm trong contract này** — nó gắn với SẢN PHẨM (mã sản phẩm bán ra
  gồm bao nhiêu lõi, chu kỳ thay), lấy từ **masterdata** (`GWT-Masterdata`, tra theo `internal_code`).
- **Ngày lắp đặt do CS tự điền** trong module CS (mốc để đếm chu kỳ thay lõi/bảo trì). Sales KHÔNG
  cung cấp — vì trên Sheet cột này thường trống.

## 2. Ranh giới sở hữu (ai giữ gì)

| Dữ liệu | Chủ sở hữu | Ghi chú |
|---|---|---|
| Khách hàng, đơn hàng, sản phẩm đã bán, ngày mua | **Sales** | Sheet → sync xuống Supabase (đọc) |
| Lịch thay lõi, chu kỳ bảo trì theo sản phẩm | **Masterdata** | CS tra theo `internal_code` |
| Ngày lắp đặt, ticket lỗi, lịch sử bảo trì, trạng thái bảo hành | **CS** | CS tự tạo bảng, tự ghi |

## 3. Bảng CS sẽ ĐỌC (do Sales publish)

### 3.1. `customers` — master khách hàng  🔷 *chưa xây*

Nguồn: tab `DM_KHACH` trên Sheet (dedupe theo SĐT chuẩn hoá; mã KH ổn định qua các lần build).
**CÓ PII → RLS: chỉ role CS đọc, chặn `anon` hoàn toàn.**

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `customer_code` | text (PK) | `KH00001`... — **khoá nối chính** cho mọi bảng CS |
| `name` | text | tên khách |
| `phone` | text nullable | **PII.** 59/~230 khách chưa có SĐT (`note` gắn cờ) |
| `address` | text nullable | **PII** |
| `province` | text nullable | |
| `company_invoice` | text nullable | Công ty xuất HĐ (đơn ký với pháp nhân) — KHÔNG phải tên khách |
| `tax_code` | text nullable | MST |
| `total_orders` | int | số đơn mua (không tính đơn tặng) |
| `total_gift_orders` | int | số đơn tặng |
| `first_order_date` | date nullable | ngày mua sớm nhất |
| `last_order_date` | date nullable | ngày mua gần nhất |
| `note` | text nullable | cờ `⚠ Chưa có SĐT` = không dedupe được, có thể trùng khách |
| `synced_at` | timestamptz | |

### 3.2. `customer_purchases` — sản phẩm đã bán theo khách  🔷 *chưa xây*

1 dòng = 1 dòng sản phẩm trong 1 đơn. **Gồm CẢ máy tặng (DON_TANG)** — máy tặng vẫn cần theo bảo
hành/thay lõi. Không có cột tiền (CS không cần doanh thu).

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | bigint (PK) | |
| `customer_code` | text (FK → customers) | nối về khách |
| `order_code` | text | mã đơn nội bộ (`260101-E001`...) |
| `order_date` | date nullable | **ngày mua.** Đơn lọc tổng lịch sử: mùng 1 là QUY ƯỚC (file gốc chỉ ghi "Tháng N") |
| `source_tab` | text | `DON_POE`/`DON_POU`/`DON_OTHERS`/`DON_TANG` |
| `is_gift` | boolean | true nếu `source_tab = DON_TANG` |
| `product_code` | text | mã bán ra (marketing) |
| `internal_code` | text | **mã chuẩn → khoá tra masterdata** (lịch thay lõi, chu kỳ bảo trì). Có thể mang cờ `⚠` nếu mã lạ |
| `product_name` | text | |
| `category_l1` | text nullable | `Machines/POE`, `Machines/POU`, `Filters/...` — CS lọc ra MÁY để theo bảo hành |
| `category_l2` | text nullable | |
| `quantity` | numeric | |
| `synced_at` | timestamptz | |

> **`install_date` KHÔNG có ở đây** — CS tự thêm cột này trong bảng CS của mình và điền tay. Đó là
> mốc để đếm chu kỳ thay lõi/bảo trì. `order_date` chỉ là ngày mua (có thể trước lắp đặt khá lâu).

### 3.3. `sales_order_lines` — ✅ *đã có (589 dòng), NHƯNG đừng dùng cho CS*

Bảng này là mirror doanh thu cho dashboard. **KHÔNG dùng cho CS vì:** (1) chỉ 3 tab bán, **loại máy
tặng**; (2) không có `customer_code` để nối khách; (3) không có PII. CS dùng `customer_purchases` +
`customers` ở trên.

## 4. Cách CS truy vấn (mẫu)

```sql
-- Máy 1 khách đã có, kèm khoá tra lịch thay lõi (masterdata) + ngày mua
select c.name, c.phone,
       p.product_name, p.internal_code, p.order_date, p.is_gift
from customers c
join customer_purchases p using (customer_code)
where c.customer_code = 'KH00042'
  and p.category_l1 like 'Machines%';   -- chỉ lấy MÁY (bỏ muối/lõi/dịch vụ)
```
CS lấy `internal_code` → tra `GWT-Masterdata` để biết máy dùng bao nhiêu lõi + chu kỳ thay, rồi
đếm từ `install_date` (CS tự điền).

## 5. Việc Sales phải xây (Phase 5 — chưa làm)

1. Sync `DM_KHACH` (Sheet) → bảng `customers` (thêm cột `customer_code` vào feed + RLS khoá).
2. Sync 4 tab đơn → `customer_purchases`, gồm DON_TANG, **gắn `customer_code`** — tra ngược từ
   `DM_KHACH."Mã đơn liên quan"` (mỗi khách ↔ danh sách mã đơn) để map `order_code → customer_code`.
3. RLS: `customers` chặn `anon`; tạo role/policy cho CS.
4. Nghiệm thu: mọi `order_code` trong `customer_purchases` phải map được về đúng 1 `customer_code`.
