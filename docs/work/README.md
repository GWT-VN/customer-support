# Module Work — quản lý công việc cá nhân + team

Việc/dự án của nhân sự GWT, gắn thẳng vào khách / đơn / ticket bằng khoá nối trong
**cùng 1 Postgres** — không phải tích hợp API như Asana.

| | |
|---|---|
| Code | `apps/web/app/work/` (route-group trong app chung) |
| DB | schema `work` trên `bwzmqfbcgouhvhoslmmm`; migration ở `db/work/migrations/` |
| Kế hoạch CTO | [2026-08-18-gwt-work-cto-plan.md](2026-08-18-gwt-work-cto-plan.md) |
| Spec GĐ0 | [2026-08-18-gd0-build-spec.md](2026-08-18-gd0-build-spec.md) (xem §2b: khác spec gốc chỗ nào) |
| RPC | `db/work/migrations/work_01_rpc_gd0.sql` + `work_02_rpc_gd0_day_du.sql` |
| Logic thuần + test | `apps/web/lib/work.ts` · `lib/work.test.ts` |

## Trạng thái

| GĐ | Nội dung | Trạng thái |
|---|---|---|
| Kế hoạch CTO | Định hướng, kiến trúc, lộ trình | ✅ |
| Mockup | Việc của tôi + Bảng team | ✅ artifact |
| **GĐ0** | Schema + RLS + Việc của tôi + Bảng team + panel chi tiết | ✅ code xong 19/08 — chờ người dùng thật kiểm |

## Luật riêng của module (BẮT BUỘC)

- **`work` chỉ ĐỌC bảng Sales/CS.** Gắn ERP là **soft ref** (`customer_code`, `ticket_code`,
  `order_code`…), **không hard-FK** vào bảng mirror (bị wipe khi sync từ Sheet).
  Ghi ngược (tạo ticket, kích hoạt BH) chỉ qua RPC `security definer` của module gốc.
- **RLS bật hết**; đọc/ghi qua `service_role` phía server sau `requireStaff()`.
  Quyền xem gom vào **một** hàm `work.visible_task_ids()`.
- Gác cổng: Work mở cho **mọi `staff`** (khác CS — chỉ role CS). Xem `apps/web/lib/quyen.ts`.
- Test từ ngày 1. 1 công thức trạng thái, 1 chỗ định nghĩa quyền.
