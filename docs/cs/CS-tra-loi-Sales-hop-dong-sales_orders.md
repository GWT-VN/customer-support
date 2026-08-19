# [CS → Sales] Trả lời hợp đồng `sales_orders` + cảnh báo mã chết

_Phản hồi `Sales-CS-hop-dong-sales_orders.md`. Cập nhật 2026-08-12._
_Đồng ý hướng. Có 1 điểm CHẶN kỹ thuật (serial PK) + 1 phát hiện gấp (120 mã CS map đều CHẾT)._

## 0. GẤP — 120 mã CS đã map đều là mã CHẾT (0 đơn)
Soi DB thật (2026-08-12):
- CS map 120 khách; **120/120 tồn tại trong `customers` NHƯNG 0/120 có đơn** (`customer_purchases`).
- Đúng bug §5: CS map nhầm vào **mã cũ (KH01xxx) không có đơn**; đơn nằm ở **mã sống (KH02xxx)**.
  Ví dụ (SĐT che): một khách có `KH013xx` (0 đơn) vs `KH021xx` (9 đơn) — CS đang trỏ mã 0 đơn.
- Hệ quả: `v_customer_360` hiện **0 đơn** cho mọi khách đã map (join trượt sang mã chết).
- **Tin tốt:** 120/120 đều có mã sống cùng SĐT → sửa được hết.

**Đề xuất:** CS **remap ngay theo SĐT → mã CÓ ĐƠN** (đúng lời khuyên "ưu tiên mã sống" của Sales),
KHÔNG chờ. Khi Sales gửi bảng `mã_cũ → mã_canonical`, CS đối chiếu lại (kỳ vọng trùng phần lớn).
→ **Sales xác nhận:** canonical = mã có đơn đúng không? Bao giờ có bảng map?

## 1. Góp ý schema §1 — OK, 3 chỉnh

**a) ⚠️ CHẶN: `activate_and_seed` KHÔNG tạo được `installed_base` khi seed.**
`installed_base.serial` là **PRIMARY KEY + NOT NULL** (đã verify). Không thể chèn dòng máy với serial null,
và 2 máy cùng mã cho 1 khách sẽ đụng PK. → Dòng 50 doc Sales ("tạo installed_base... serial điền sau")
**không chạy được** với schema hiện tại.
→ **Chốt lại phạm vi `activate_and_seed`:** khi Sales chốt đơn, RPC seed:
  - `cs_customers` (upsert theo `customer_code`),
  - `maintenance_plan` (từ dòng DVBT),
  - **KHÔNG** đụng `installed_base`. Máy đã bán nhưng chưa có serial nằm ở **view "chờ kích hoạt BH"**
    (`v_bh_cho_kich_hoat`, CS sẽ trỏ sang đọc `sales_order_items`). CS gắn serial lúc lắp → `activate_warranty`.
  (Nếu sau này muốn seed thẳng máy thì phải đổi `installed_base` sang khoá thay thế `id` + serial nullable —
  đổi lớn, đụng FK warranty/tickets/maintenance_plan/parent_serial → để riêng, KHÔNG làm ở Phase 2 này.)

**b) `sales_order_items`: nên thêm lại `category_l2`** (POU/POE) như bản v2 — để CS lọc máy khỏi phải join
vòng. Nếu Sales không thêm: OK, **CS tự join `internal_code → catalog_item.category_l2`** (CS có catalog gương).
Cần: **index `internal_code`** trên item để join chắc.

**c) `is_maintenance`** giữ là **cache** — nguồn chân lý CS dùng là `internal_code = 'DVBT'` (phòng cột cache lệch).

## 2. §3 DVBT — CHỐT: giữ 1 mã, KHÔNG tách theo thời hạn
- **Không cần `DVBT-1Y`/`DVBT-2Y`.** Giữ đúng 1 mã `DVBT`.
- **Đơn vị DVBT = LẦN.** → **Sales ghi `quantity` = SỐ LẦN bảo trì** (không phải số năm / số gói).
  CS map thẳng `quantity → maintenance_plan.tong_lan`. CS KHÔNG cần `so_nam`/`chu_ky_thang` từ Sales
  (bảng `maintenance_plan` của CS đã theo LẦN).
- ⚠️ Đây là điểm dễ lệch: nếu Sales đang định ghi `quantity=1` (1 dịch vụ) thì SAI — phải là số lần.

## 3. §4.3 `staff.vai_tro` — KHÔNG cần migration
- CS **đã** đổi `staff.vai_tro` sang `text[]` + CHECK gồm sẵn `{admin, cs_manager, cs, sales_manager, sales}`
  (migration 33, đã chạy). → Sales **không phải ALTER gì**, chỉ **gán role** `sales`/`sales_manager` cho NV
  Sales khi app Sales đọc `staff`.
- Lưu ý: CS **vừa chặn người chỉ có role Sales khỏi app CSKH** (cổng `xetLuatVaoCua` đòi vai trò CS). Nên NV
  Sales sẽ KHÔNG vào nhầm app CS — cứ gán role thoải mái.

## 4. §4.4 `v_customer_360` — XONG
- View đã dựng + áp (migration 34), 17 cột đúng bản Sales duyệt. `tong_chi_vat` đang **null** ở Phase 1
  (chưa có cột tiền); sẽ lấy `sales_orders.total_vat` khi bảng có.
- (Hiện hiển thị 0 đơn vì lỗi mã chết mục 0 — sửa mapping xong là đúng.)

## 5. `activate_and_seed(p_order_id)` — CS viết khi có `sales_orders`
- Phase 1 RPC đã có (`activate_and_seed(p_customer_code, p_dry_run)`, đọc `customer_purchases`, mặc định dry-run).
- Phase 2: CS thêm bản đọc theo `p_order_id` từ `sales_orders`/`sales_order_items`; idempotent theo
  `(order_code, internal_code)`; phạm vi seed = mục 1a. Sales gọi khi chốt đơn.

## Kết — việc của mỗi bên
**Sales:** (1) xác nhận canonical = mã có đơn + gửi bảng `mã_cũ→mã_canonical` (mục 0); (2) chốt `quantity` DVBT
= số lần (mục 2); (3) migrate `sales_orders` theo §1 (cân nhắc thêm `category_l2` + index `internal_code`);
(4) gán role Sales (không cần migrate).
**CS:** (A) **remap 120 khách sang mã sống ngay** (chờ Sales OK cách hiểu canonical); (B) viết
`activate_and_seed(p_order_id)` + trỏ `v_bh_cho_kich_hoat` sang `sales_order_items` khi bảng có.

*Người soạn: CS. Điểm chặn: installed_base.serial là PK. Điểm gấp: 120 mã map chết.*
