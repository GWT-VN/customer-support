# CS phản hồi Data Contract → gửi team Sales (chốt để implement Phase 5)

> Trả lời [2026-07-24-cs-data-contract.md](2026-07-24-cs-data-contract.md). **CS đã chốt design phía mình.**
> File này = phần Sales cần đảm bảo + việc CS tự làm. Ngày: 2026-07-24.

## 1. CS xác nhận interface — ĐỒNG Ý

CS đọc 2 bảng Sales publish: **`customers`** (khoá `customer_code`, có PII, RLS chặn anon) + **`customer_purchases`** (máy đã bán/tặng, có `internal_code`). Không dùng `sales_order_lines` cho CS. Ranh giới sở hữu như contract: **khách + PII = Sales**; ngày lắp/ticket/bảo trì/bảo hành = CS; lịch lõi tra masterdata theo `internal_code`.

## 2. Trạng thái CS hiện tại (đã di trú sang GWT-SalesTracking 2026-07-24)

CS đã chạy độc lập trong project này với **bảng riêng, tên có tiền tố tránh đụng Sales**:
- **`cs_customers`** — 293 khách lịch sử (từ Odoo), **284 có SĐT · 10 thiếu SĐT**. Có sẵn cột **`customer_code`** (đang null) để map sang `Sales.customers`.
- `installed_base` 465 máy (đã gắn đủ 293 khách) · `warranty` · `tickets` · `maintenance_plan/visit` · `filter_replacement` · `issue_*`.
- 6 bảng gương catalog (mirror từ Masterdata) — **bao phủ 100% mã máy CS đang có (0 máy mã lạ)**.

→ CS **không chiếm tên `customers`/`customer_purchases`** — Sales cứ tạo 2 bảng đó tự nhiên, không xung đột.

## 3. Việc Sales cần đảm bảo (nghiệm thu) — ⚠️ 3 điểm CS cần Sales trả lời

1. **`customer_code` ổn định qua mỗi lần build Sheet** (contract đã cam kết — xác nhận lại). Nếu mã đổi giữa các build, mọi liên kết CS gãy.

2. **Bao phủ khách LỊCH SỬ** ⚠️ *điểm quan trọng nhất.* CS có **293 khách + 465 máy đã lắp từ trước khi có Sales Tracking** (nguồn Odoo). Câu hỏi:
   - `DM_KHACH` (Sheet) + `customer_purchases` có bao gồm nhóm khách/đơn LỊCH SỬ này không, hay chỉ từ dữ liệu Sales gần đây?
   - Nếu **KHÔNG bao phủ** → CS giữ `cs_customers` cho phần lịch sử, chỉ map `customer_code` cho khách trùng (đối chiếu qua SĐT). Không sao, nhưng cần Sales biết để **không coi CS thiếu dữ liệu**.
   - Nếu **CÓ bao phủ** → CS map gần hết qua SĐT (284/293), 10 khách thiếu SĐT map tay.

3. **RLS role cho CS đọc.** Đề xuất đơn giản: **CS đọc bằng `service_role`** (app CS chạy server-side, đã bypass RLS) → Sales chỉ cần **chặn `anon`** trên `customers` là đủ, KHÔNG cần tạo role riêng phức tạp. Sales xác nhận hướng này ổn không.

## 4. Việc CS tự làm (không cần Sales) — khi 2 bảng Sales sẵn sàng

- **Đối chiếu khách**: script map `cs_customers` ↔ `Sales.customers` qua **SĐT chuẩn hoá + tên** (đã có sẵn logic ở `migrate/`), gán `cs_customers.customer_code`. Ca không chắc → để người quyết (bài học "2 khách tên Yến" — không map tên trần).
- **Đối chiếu máy**: `installed_base` ↔ `customer_purchases` qua `customer_code` + `internal_code` (chỉ dòng `category_l1 like 'Machines%'`) → phát hiện **máy đã bán mà CS chưa có hồ sơ** (giống 216 khách Pancake "đã mua" thiếu hệ thống trước đây) và **máy CS có mà không thấy đơn** (kiểm tra chéo).
- **Ngày lắp** CS tự điền (Sales không cung cấp — đúng contract).

## 5. Không đưa vào phạm vi (xác nhận)

- Lịch thay lõi/bảo trì: CS tra masterdata theo `internal_code`, **không cần Sales cung cấp**.
- CS **không ghi ngược** vào bảng Sales.

## 6. Tóm tắt điều Sales cần làm (Phase 5)

Đúng như mục 5 của contract (sync `DM_KHACH`→`customers` + 4 tab đơn→`customer_purchases` gắn `customer_code` + RLS chặn anon). **CS chỉ cần Sales trả lời 3 câu ở mục 3 trên** rồi bắt tay implement — CS đã sẵn sàng phía mình.
