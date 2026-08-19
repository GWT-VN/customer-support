# CS trả lời PLAN Sales + Thiết kế hệ thống CS

_Phản hồi cho `PLAN-sales-webapp-va-tich-hop-CS.md`. Cập nhật 2026-08-12._
_Kết luận chung: **plan ổn, đồng ý hướng đi**. Bổ sung phần đối chiếu với CS đã dựng + 3 quyết định chốt._

---

## Phần 1 — 3 quyết định đã chốt

1. **2 bảng khách RIÊNG** (`customers` của Sales + `cs_customers` của CS), nối bằng `customer_code`.
   Lý do: CS có khách **không có bên Sales** — vd khách của đại lý (không mua trực tiếp) nhưng sau
   liên hệ bảo hành nên CS vẫn phải lưu. → Không ép 1 bảng.
2. **Dùng chung 1 bảng `staff`** (đã có) làm auth/role — **không tạo `profiles` song song**.
3. **Chung các bảng nơi có thể**: Sales sở hữu & CS đọc chéo qua view; không nhân đôi.

---

## Phần 2 — Trả lời câu hỏi mục 7 của plan

**Hạ tầng**
1. CS **đã có repo + code**: `AIGWTVN/customer-support`, **Next.js 16** (App Router) + `@supabase/supabase-js` + Vercel. Đang chạy production, NV CS đang dùng.
2. **Dùng CHUNG** Supabase Sales (`bwzmqfbcgouhvhoslmmm`) — không làm Supabase riêng.
3. Migration CS ở `db/cs/migrations/` (32 file). **Đề xuất quy trình chung:** mỗi bên đặt migration trong repo mình + 1 kênh thông báo đổi schema; đổi bảng **dùng chung** (customers/dim_channel/staff/catalog) phải báo bên kia trước.

**Dữ liệu**
4. CS lưu: **ticket** (+ `ticket_note` nhật ký, `ticket_muc` chi phí/hạng mục, `issue_group` nhóm lỗi), **máy đã lắp** (`installed_base`) + **kho serial** (`serial_registry`) + **vòng đời máy** (`serial_su_dung`), **bảo hành** (`warranty`), **lịch thay lõi** (`filter_replacement`), **bảo trì** (`maintenance_plan`/`maintenance_visit`), **kênh/đối tác** (gắn khách vào `dim_channel`).
5. Nối khách bằng **`customer_code`** (khoá chính) + **SĐT chuẩn hoá** (khoá phụ). Đã map **120 khách** 1:1 (0 xung đột). **Đồng ý customer_code là khoá chính.**
6. CS **KHÔNG ghi** vào `customers` — chỉ **ĐỌC** (`customers`, `customer_purchases`). CS ghi vào `cs_customers` của mình.
7. Nguồn khách CS: **có khách riêng** (Odoo CRM 336 khách + 73 khách công ty vừa import), **không chỉ** khách đã mua từ Sales. → Đây là lý do giữ 2 bảng.
8. Đăng nhập: Google `@gwt.vn` qua Supabase Auth + bảng `staff` (email → vai_tro: cs/admin/ky_thuat). Role hiện: NV thấy hết (chưa giới hạn theo phụ trách — làm sau nếu cần).
9. **Realtime:** chưa cần gấp (ticket mới hiện khi refresh). Có thể thêm sau.
10. **Sự kiện 2 chiều:** cần theo hướng **Sales chốt đơn → CS seed hồ sơ BH** (1 chiều là đủ trước); "có ticket → Sales biết" để sau.
11. CS & Sales là **2 đội/luồng riêng** → đề xuất **2 repo + 1 file SQL schema chung làm "hợp đồng"** (bảng dùng chung: `customers`, `customer_purchases`, `sales_order_lines`, `company_customers`, `dim_channel`, `staff`, catalog).

---

## Phần 3 — Thiết kế hệ thống CS (để Sales khớp khoá nối)

### 3.1. Bảng CS sở hữu (đã dựng)

| Bảng | Nội dung | Khoá / nối |
|---|---|---|
| `cs_customers` | Khách CS (gồm khách riêng CS) | PK `id` uuid · `customer_code` → `customers.customer_code` · `channel_id` → `dim_channel.id` |
| `customer_contacts` | Liên hệ phụ của khách | FK `customer_id` → cs_customers |
| `installed_base` | Máy đã lắp cho khách | PK `serial` · `internal_code` (mã SP) · FK `customer_id` → cs_customers · `parent_serial` (bộ combo) |
| `serial_registry` | Kho serial + trạng thái | PK `serial` · `internal_code` · `trang_thai` (tồn kho/đã lắp/trưng bày/…) |
| `serial_su_dung` | Nhật ký vòng đời máy | FK `serial`, `customer_id` |
| `warranty` | Bảo hành từng serial | PK `serial` (FK installed_base, ON UPDATE CASCADE) |
| `tickets` / `ticket_note` / `ticket_muc` | Ticket + nhật ký + chi phí | `serial`, `customer_id`, `ticket_code` (TK-YYMM-NNN / GWT-…) |
| `filter_replacement` | Lịch thay lõi | FK `serial` |
| `maintenance_plan` / `maintenance_visit` | Gói bảo trì + lượt | `serial`, `customer_id` |
| `issue_group` / `issue_override` | Nhóm lỗi | — |
| `serial_pending` / `yeu_cau_thay_doi` / `yeu_cau_export` | Hàng chờ duyệt (tạo serial / sửa-xoá / export) | — |
| `bang_view`, `audit_log`, `catalog_sync_log` | Tuỳ chỉnh cột · nhật ký thao tác · log đồng bộ | — |
| `staff` | Nhân viên + phân quyền (DÙNG CHUNG) | `email`, `vai_tro`, `hoat_dong` |

### 3.2. Bảng DÙNG CHUNG (Sales/hệ thống sở hữu, CS đọc)
`customers`, `customer_purchases`, `sales_order_lines`, `company_customers`, `dim_channel`,
catalog gương (`catalog_item`, `product_warranty`, `product_filter`, `product_bundle`,
`catalog_category`, `supplier_code` — kéo từ GWT-Masterdata hàng ngày).

### 3.3. Khoá nối chốt (đã trong doc bàn giao)
- **Sản phẩm:** `internal_code` (mã nội bộ) — dùng chung, map thẳng.
- **Khách:** `cs_customers.customer_code = customers.customer_code` (khách CS-only để null).
- **Kênh:** `cs_customers.channel_id = dim_channel.id` (Sales quản taxonomy).
- **Serial:** `serial_registry.serial` / `installed_base.serial`.

### 3.4. View đọc chéo (đề xuất làm chung)
`v_customer_360`: join `cs_customers` (khách CS) ⟵customer_code⟶ `customers` (đơn Sales) +
`customer_purchases` + `installed_base` + `tickets`. CS mở là thấy đủ chân dung khách.

---

## Phần 4 — Việc Sales cần làm để nối (đồng ý với plan)

1. **Đổi sync sang UPSERT** theo `customer_code`/`order_code` (KHÔNG full delete+rewrite).
   *Bài học CS: đồng bộ catalog từng lỗi `DELETE requires a WHERE clause` — full-refresh dễ vỡ.*
2. **RPC `activate_and_seed(order_id)`** (Sales chốt đơn → CS seed BH): cần Sales cấp **tên bảng đơn +
   cột `internal_code` / khách (SĐT hoặc customer_code) / serial / ngày mua / gói bảo trì**. CS viết
   phần seed (`cs_customers` upsert theo customer_code, `installed_base`, gọi `activate_warranty`,
   `maintenance_plan`).
3. **Không đụng bảng CS** (RLS bật + 0 policy = service_role); nếu Sales cần ghi thì qua RPC.

## Kết
Đồng ý toàn bộ hướng plan. Chỉ cần plan bổ sung: **2 bảng khách (customer_code là cầu)** + **dùng
`staff` thay `profiles`** + danh sách bảng CS ở Phần 3 để tránh dựng trùng. Sẵn sàng ghép khi Sales
cấp schema bảng đơn để viết `activate_and_seed`.
