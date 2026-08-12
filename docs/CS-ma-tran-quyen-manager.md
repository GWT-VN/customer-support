# Ma trận quyền — cấp Quản lý (cs_manager / sales_manager)

_Phase 2 phân quyền. Cập nhật 2026-08-12. Nền: role đa-vai-trò `text[]` (migration 33)._

## Nguyên tắc
- **3 cấp trong app CSKH:** Nhân viên → Trưởng miền (quản lý) → Quản trị (admin).
- Trước đây app chỉ gate 1 mức: `admin`. Giờ tách thêm mức **quản lý** = `admin` **hoặc** `cs_manager`
  (hàm thuần `coQuyenQuanLy`, async `laQuanLy()`).
- **`sales`/`sales_manager` KHÔNG có nghiệp vụ trong app CSKH** — app này là CS. (Sales dùng app/dashboard
  riêng của họ.)
- **Cộng dồn, không thu hồi:** `cs` giữ nguyên quyền cũ; `cs_manager` = `cs` + mức quản lý; `admin` bất biến.
  Chưa ai được gán `cs_manager` (6 NV hiện là cs/admin) → deploy **không đổi gì** cho tới khi bạn gán role.

## Ma trận

| Nhóm thao tác | NV (cs/sales) | Trưởng CSKH (cs_manager) | Quản trị (admin) |
|---|:---:|:---:|:---:|
| Xem + xử lý khách/máy/ticket/lịch (thường ngày) | ✅ | ✅ | ✅ |
| **Duyệt**: serial pending · yêu cầu sửa · export · khách chờ | — | ✅ | ✅ |
| Ghi chi phí/mục ticket · xuất báo cáo (CSV) | — | ✅ | ✅ |
| Lắp / thu hồi / đổi máy · kho serial · lắp bộ · trạng thái máy | — | ✅ | ✅ |
| Nhóm lỗi (tạo/sửa/xoá/gán) · cập nhật hàng loạt · lưu view chung | — | ✅ | ✅ |
| Áp trực tiếp thay đổi khách/máy (sửa) không cần chờ duyệt | — | ✅ | ✅ |
| **XOÁ thông tin khách** (xoá 1 khách · xoá hàng loạt · duyệt yêu cầu xoá khách) | — | — | ✅ |
| Quản lý nhân viên (gán role, bật/khoá) | — | — | ✅ |
| Đồng bộ catalog · Nhật ký thao tác (audit) · Doanh số | — | — | ✅ |

### Vì sao "xoá khách" chốt chặt ở admin
Bút sa gà chết với dữ liệu khách. Trưởng CSKH áp trực tiếp mọi **sửa**, nhưng mọi đường **xoá khách**
(nút xoá, xoá hàng loạt, *và* duyệt yêu cầu xoá của NV) đều dội về admin. Trưởng CSKH gửi yêu cầu xoá
khách → vào hàng chờ để admin duyệt (giống NV).

## Nơi thực thi (ranh giới bảo mật)
- **Server (thật):** 37 server action đổi từ `laAdmin()` → `laQuanLy()`; giữ `laAdmin()` cho:
  `xoaHangLoat`, quản lý nhân viên (`listAllStaff`/`suaNhanVien`/`doiTenNhanVien`), catalog sync, audit.
  `guiYeuCauThayDoi` + `duyetYeuCau`: nhánh riêng — xoá khách (`cs_customers`+`loai='xoa'`) buộc `laAdmin()`.
- **Trang:** `/duyet` `/lap-bo` `/nhom-loi/moi` → `chanNeuKhongPhaiQuanLy`; `/nhan-vien` `/audit`
  `/doanh-so` `/dong-bo-catalog` giữ `chanNeuKhongPhaiAdmin`.
- **UI:** nút nâng cao nhận `laQuanLy()`; nav tách nhóm **Quản lý** (Chờ duyệt, cho cs_manager) vs
  **Quản trị** (admin). Nút "Xoá hàng loạt" chỉ hiện với admin (`ThaoTacHangLoat choPhepXoa`).
  Ẩn nút chỉ là UX — chặn thật ở server.

## Chưa làm / để mở
- Chưa tách quyền theo **miền phụ trách** (ai thấy khách/ticket của ai) — hiện mọi NV thấy hết.
- `sales`/`sales_manager` nếu được kích hoạt trong app CS sẽ như NV (xem được, không nghiệp vụ CS nâng cao).
  Nếu muốn chặn Sales khỏi app CS hẳn thì siết ở `requireStaff` theo role — chờ bạn chốt.
