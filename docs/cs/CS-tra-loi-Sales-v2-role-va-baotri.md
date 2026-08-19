# CS trả lời Sales (lần 2) — Role đa-vai-trò + Bảo trì DVBT + Góp ý schema

_Phản hồi cho `Sales-tra-loi-CS.md`. Cập nhật 2026-08-12._
_Chốt 2 việc Sales đang chờ CS (role + mã bảo trì) + góp ý `sales_orders` + cột `v_customer_360` + cách viết `activate_and_seed`._

---

## 1. Role: thiết kế lại cho "1 người giữ NHIỀU vai trò"

**Bối cảnh (quyết định của sếp):** cty nhỏ → kiêm nhiệm. Cần: `cs` / `cs_manager`, `sales` / `sales_manager`,
và **1 người làm được ≥2 role** cùng lúc (vd chủ vừa quản CS vừa quản Sales; NV vừa CS vừa Sales).

**Vấn đề hiện tại:** `staff.vai_tro` đang là **1 chuỗi đơn** (`admin`|`cs`), và cả app CS gate quyền qua
`laAdmin()` = `vai_tro === 'admin'`. Mô hình 1-người-1-vai → không kiêm nhiệm được.

### 1.1. CHỐT: đổi `vai_tro` → **TẬP vai trò** (`text[]`)
Một người giữ một **mảng** role. Không dùng bảng nối `staff_roles` vì chỉ có 5 role cố định + team nhỏ →
`text[]` + `CHECK` gọn hơn, 1 dòng/người, không phải join. (Khi nào cần phân quyền theo từng đối tượng
mới nâng lên bảng nối.)

### 1.2. Danh mục role + bảng năng lực

| Role | Ý nghĩa | Quyền |
|---|---|---|
| `admin` | Quản trị hệ thống (chủ/CTO) | Toàn quyền: quản `staff`, cấu hình, duyệt, **cả 2 miền** |
| `cs_manager` | Trưởng CS | Mọi quyền CS + **duyệt việc CS** (duyệt serial, sửa/xoá khách CS, export) |
| `cs` | NV CSKH | Nghiệp vụ CS thường ngày (ticket, lắp máy, BH, bảo trì…) |
| `sales_manager` | Trưởng Sales | Mọi quyền Sales + duyệt việc Sales |
| `sales` | NV Sales | Nghiệp vụ Sales thường ngày |

**Kiêm nhiệm (ví dụ):**
- Chủ: `{admin}` (admin đã là superuser cả 2 miền — không cần thêm).
- Trưởng cả 2 nhưng không phải admin hệ thống: `{cs_manager, sales_manager}`.
- NV kiêm CS + Sales: `{cs, sales}`.

**Quy ước năng lực (suy ra từ mảng):**
- `is_admin` = mảng chứa `admin`.
- `is_cs_manager` = chứa `cs_manager`; `thuộc miền CS` = giao với `{cs, cs_manager}` khác rỗng.
- `is_sales_manager` = chứa `sales_manager`; `thuộc miền Sales` = giao với `{sales, sales_manager}`.
- Quyền duyệt (approve) = `admin` **hoặc** manager của miền tương ứng.

### 1.3. Migration `staff` (bảng DÙNG CHUNG → phải phối hợp, CHƯA chạy)
Đổi kiểu cột là **breaking** cho cả 2 app → quy trình: CS soạn migration → 2 bên review → **hẹn giờ chạy** →
**cả 2 app deploy code đọc `text[]` cùng lúc** (không để lệch pha schema/code trên production).

```sql
-- 1) text -> text[]; giá trị cũ gói vào mảng 1 phần tử (admin->{admin}, cs->{cs}) — không mất ai
alter table public.staff
  alter column vai_tro type text[]
  using case
    when vai_tro is null or vai_tro = '' then '{}'::text[]
    else array[vai_tro]
  end;

-- 2) default: KHÔNG tự cấp role. Người mới vào vẫn hoat_dong=false (chờ duyệt), admin gán role lúc kích hoạt
alter table public.staff alter column vai_tro set default '{}'::text[];

-- 3) chặn role rác
alter table public.staff add constraint chk_vai_tro
  check (vai_tro <@ '{admin,cs_manager,cs,sales_manager,sales}'::text[]);
```

**Lưu ý cho Sales:**
- App Sales cũng phải đọc `vai_tro` là **mảng**.
- Khi tạo NV mới, **set role rõ ràng** — đừng dựa vào default cũ (`'cs'`). Default DB giờ là `'{}'`.
- Việc "Sales thêm role sales" (mục 4.1 file Sales) **không còn là ALTER thêm giá trị nữa** — role đã nằm
  trong `CHECK` ở trên. Chỉ cần app Sales gán `{sales}` / `{sales_manager}` cho NV.

### 1.4. Code CS phải sửa cùng nhịp (CS đã rà, làm khi 2 bên chốt giờ chạy)
- `lib/quyen.ts`: `VAI_TRO` = full 5 role; `laQuyenAdmin(roles: string[])` → `roles?.includes('admin')`;
  thêm `laManagerCs`/`laManagerSales`/`thuocMienCs`/`thuocMienSales`; `NHAN_VAI_TRO` nhãn tiếng Việt;
  luật `kiemTraSuaNhanVien` (admin cuối cùng, tự-hạ-quyền) đổi sang **đếm/kiểm theo mảng**.
- Kiểu `Staff`/`NhanVien`: `vai_tro: string` → `vai_tro: string[]`.
- `lib/supabase.ts` `laAdmin()`: truyền mảng.
- Màn `/nhan-vien` (`BangNhanVien.tsx`): combobox 1-chọn → **multi-select (checkbox) role**.

---

## 2. Bảo trì: KHÔNG có "gói X tháng" — chỉ **1 mã `DVBT`**, đơn vị = **LẦN**

Trả lời mục 3.3 file Sales ("cần CS cấp danh sách mã gói bảo trì"):

- **Danh sách = đúng 1 mã: `DVBT`** (Dịch vụ bảo trì) — đã có sẵn trong `catalog_item`, nhóm **Services**
  (cạnh `DVSC` / `DVLD` / `DVVC`). Không có nhiều mã theo tháng.
- **Đơn vị tính = LẦN.** Khách mua **quy đổi ra số lần** = `quantity` trên dòng đơn. (Mua 4 lần → quantity = 4.)
- Vậy: `is_maintenance = (internal_code = 'DVBT')`. **Nguồn chân lý là `internal_code`** — cột
  `is_maintenance` chỉ là cache tiện lọc; không cần bảng map nhiều dòng (chỉ 1 mã).
- **Khớp sẵn schema CS, KHÔNG phải đổi gì:** `maintenance_plan` đã theo LẦN
  (`tong_lan` = tổng số lần, `maintenance_visit.lan_thu` = lần thứ mấy). `activate_and_seed` nhận
  `quantity` của dòng DVBT → ghi thẳng vào `maintenance_plan.tong_lan`.
- (Nếu sau này phát sinh mã bảo trì khác, CS sẽ cập nhật danh sách. Hiện tại: **chỉ `DVBT`**.)

---

## 3. Góp ý schema `sales_orders` / `sales_order_items` (mục 3.2 file Sales)

OK tổng thể. Vài chỉnh nhỏ để CS seed đọc thẳng, không phải tra vòng:

1. `sales_order_items.internal_code` → nên **`references catalog_item(...)`** (hoặc chí ít có index) để CS
   join chắc; cả máy lẫn `DVBT` đều tra qua đây.
2. **Phân loại máy vs dịch vụ:** CS cần biết dòng nào là máy (kích hoạt BH) — máy = `category_l2 ∈ (POU, POE)`.
   → hoặc thêm `category_l2` lên item, hoặc đảm bảo tra được `internal_code → catalog_item.category_l2`.
3. `is_maintenance` giữ, `= (internal_code = 'DVBT')` (xem mục 2) — cache thôi, chân lý ở `internal_code`.
4. `sales_orders.order_code UNIQUE` = khoá nghiệp vụ để `activate_and_seed` **idempotent** (`on conflict`).
5. `serial` **đúng là không nằm ở Sales** (CS gán lúc lắp) — giữ nguyên.
6. `updated_at` nên có trigger tự cập nhật (đã thấy cột — thêm trigger như bên CS).

Đồng ý `on delete cascade` cho item theo order.

---

## 4. `v_customer_360` — cột CS đề xuất (CS sở hữu view, chỉ SELECT)

Đặt trong migration của CS. Join `cs_customers` ⟵`customer_code`⟶ `customers` + gộp số liệu:

| Cột | Nguồn |
|---|---|
| `customer_code`, `ten`, `phone_chuan`, `province`, `channel_id` | `cs_customers` (+ `dim_channel`) |
| `sales_name`, `sales_phone` | `customers` (đơn Sales) |
| `so_don`, `tong_chi_vat` | gộp `customer_purchases` |
| `so_may_da_lap`, `ds_serial` | gộp `installed_base` |
| `so_may_con_bh` | `warranty` (còn hạn) |
| `so_ticket_mo`, `so_ticket_tong` | gộp `tickets` |
| `bao_tri_con_lai` | `maintenance_plan.tong_lan` − số visit đã xong |

Chờ Sales duyệt danh sách cột (thêm/bớt gì báo trước khi migrate).

---

## 5. `activate_and_seed` — CS viết, cách làm

- **Phase 1 (chạy NGAY, đọc `customers` + `customer_purchases`):** với mỗi `customer_code`:
  1. UPSERT `cs_customers` theo `customer_code`.
  2. Mỗi dòng mua `category_l2 ∈ (POU, POE)` → tạo `installed_base` (`internal_code` + khách, `serial`
     để null — điền lúc lắp) → gọi `activate_warranty`.
  3. Mỗi dòng `internal_code = 'DVBT'` → `maintenance_plan(loai_goi='hop_dong', tong_lan = quantity)`.
  - **Idempotent** theo `(customer_code, order_code, internal_code)`.
- **Phase 2:** đọc `sales_orders` / `sales_order_items` thay `customer_purchases`; Sales gọi RPC khi chốt đơn.
- **Cần Sales xác nhận:** `order_code` có ổn định không? 1 đơn đã seed rồi có thể sửa/thêm dòng sau không?
  (để CS chọn đúng `on conflict do update` cho phần bổ sung.)

---

## 6. Chốt các việc treo (đối chiếu mục 4 file Sales)

| Việc | Trạng thái |
|---|---|
| Role `sales`/`sales_manager` | **Nâng thành mô hình đa-role** (mục 1). CS soạn migration `staff`; 2 bên hẹn giờ chạy + deploy đồng thời |
| Danh sách mã gói bảo trì | ✅ **Xong: chỉ `DVBT`, đơn vị = lần** (mục 2) |
| `v_customer_360` | CS đề xuất cột (mục 4) — chờ Sales duyệt |
| RPC `activate_and_seed` | CS viết (mục 5) — Phase 1 chạy được ngay khi cần |

---

## Kết
Bóng ở Sales: **(1)** duyệt mô hình role đa-vai-trò + hẹn giờ chạy migration `staff` (deploy 2 app đồng thời);
**(2)** chốt schema `sales_orders` theo góp ý mục 3; **(3)** duyệt cột `v_customer_360`.
CS sẵn sàng viết migration role + `activate_and_seed` ngay khi Sales OK.

*Người soạn: CS. Mã bảo trì = `DVBT` (đơn vị lần). Role: `text[]` gồm {admin, cs_manager, cs, sales_manager, sales}.*
