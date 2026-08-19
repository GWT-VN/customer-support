# Bàn giao CSKH cho team Sales — khoá nối

_Cập nhật 2026-08-12. Mục đích: để module Sales thiết kế khoá nối khớp vào CSKH._

## 1. Trạng thái: ĐÃ có repo + schema

- **Repo:** `AIGWTVN/customer-support` (GitHub). App tại `apps/web/` (Next.js 16), migration DB tại `db/cs/migrations/` (32 file), script ETL tại `migrate/`.
- **Schema:** đã dựng đầy đủ + đang chạy production (nhân viên CS dùng). Đã có ~336 khách, ~465 máy đã lắp, ~90 ticket, catalog gương đồng bộ hàng ngày từ GWT-Masterdata.

## 2. Điểm mấu chốt: CSKH & Sales CHUNG một Postgres

Cả 2 domain nằm trong **cùng project Supabase `GWT-SalesTracking`** (`bwzmqfbcgouhvhoslmmm`):

- **Sales** (team Sales quản): `customers`, `customer_purchases`, `dim_channel`, `products`…
- **CSKH** (đã dựng): `cs_customers`, `customer_contacts`, `installed_base`, `warranty`, `tickets`, `filter_replacement`, `maintenance_plan`, `maintenance_visit`, `serial_registry`, `serial_su_dung`, `issue_group`…
- **Dùng chung:** `dim_channel` (kênh/đại lý-KTS-KOL), catalog gương (`catalog_item`, `product_warranty`, `product_filter`, `product_bundle`).

→ **Join trực tiếp / FK được**, không cần đồng bộ chéo.

## 3. Các KHOÁ NỐI (Sales khớp vào đây)

| Khoá | CSKH | Sales | Ghi chú |
|---|---|---|---|
| **Mã nội bộ sản phẩm** | `catalog_item."Mã nội bộ"`, `installed_base.internal_code`, `serial_registry.internal_code` | product internal_code | Dùng chung mã nội bộ — map thẳng, không cần tầng chuyển đổi. |
| **Khách hàng** | `cs_customers.customer_code` | `customers.customer_code` | Đã map **120 khách** theo SĐT chuẩn hoá (1:1, 0 xung đột). Còn lại map dần / theo SĐT. |
| **SĐT chuẩn hoá** | `cs_customers.primary_phone` | `customers.phone_chuan` / `phone_no0` | Khoá phụ để đối chiếu khi chưa có customer_code. |
| **Kênh / đại lý** | `cs_customers.channel_id` → `dim_channel.id` | `dim_channel` (Sales quản taxonomy) | CSKH chỉ ĐỌC dim_channel + gắn khách. |
| **Serial máy** | `serial_registry.serial` (PK), `installed_base.serial` (PK) | — | Serial là khoá máy; `installed_base.internal_code` = mã sản phẩm. |
| **Đơn đã mua** | (đọc) `customer_purchases` | `customer_purchases` | CSKH có view `v_bh_cho_kich_hoat` đọc đơn Sales chưa gắn máy → nhắc kích hoạt BH. |

## 4. Điểm tích hợp Sales → CSKH (đề xuất, CHƯA làm)

Mục tiêu gốc: **Sales chốt đơn → CSKH tự có hồ sơ bảo hành + lịch thay lõi + gói bảo trì.**

- Đề xuất: RPC `activate_and_seed(p_order_id)` — Sales gọi khi chốt đơn (cùng DB, join trực tiếp) → upsert `cs_customers` (khoá SĐT/customer_code), `installed_base` (serial + internal_code từ đơn), `warranty` (gọi `activate_warranty`), `maintenance_plan` (nếu đơn có gói).
- Idempotent (`on conflict do update`) + trigger `AFTER INSERT` trên bảng order để atomic; kèm reconciliation job.
- **Cần Sales chốt:** tên bảng đơn hàng + cột chứa `internal_code`, khách (SĐT/tên), serial, ngày mua, gói bảo trì.

## 5. Quy ước quan trọng khi Sales ghi vào bảng CSKH

- **RLS bật + 0 policy** trên bảng CSKH (chỉ `service_role`). Sales ghi qua RPC `security definer` hoặc service_role.
- **Serial máy**: mọi FK trỏ `installed_base.serial` đều `ON UPDATE CASCADE`.
- **Kích hoạt BH**: dùng RPC `activate_warranty(serial, start_date)` — tự tính hạn theo `product_warranty.internal_code`.
- **Combo (lọc tổng WH15A/WH30A…)**: lắp qua RPC `lap_bo_combo` — mã bộ mẹ + con; BH ở từng thiết bị con. (Đang cân nhắc chuyển mã bộ sang trường `ma_bo`.)
- **Khách mới từ Sales**: `cs_customers.source` ghi nguồn; khách chưa duyệt để `trang_thai='cho_duyet'`.
