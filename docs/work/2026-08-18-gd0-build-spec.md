# Spec thi công — GWT Work · GĐ0 (Khung + Việc của tôi)

**Ngày:** 18/08/2026 · **Trạng thái:** đang làm
**Tài liệu nền:** [../../Planning/2026-08-18-gwt-work-cto-plan.md](../../Planning/2026-08-18-gwt-work-cto-plan.md) (kế hoạch CTO)
**Migration:** [../supabase-work/migrations/work_00_init.sql](../supabase-work/migrations/work_00_init.sql)

---

## 1. Mục tiêu GĐ0

Có một app chạy được để **tạo / giao / xem việc** và màn **"Việc của tôi"** — đủ cho 2–3 nhân viên test thật. Chưa Discord, chưa auto-sinh, chưa Drive (các GĐ sau).

**Định nghĩa "xong GĐ0":**
1. Đăng nhập Google `@gwt.vn` (dùng lại luật `requireStaff()` như app-cskh).
2. Tạo việc: tiêu đề, mô tả, ưu tiên, hạn, team, gán ≥1 người (RACI), gắn ≤1 project.
3. Màn **Việc của tôi**: gộp Quá hạn / Hôm nay / Tuần này / Sắp tới; tick xong.
4. Màn **Bảng team** (List + Board) lọc theo team/assignee.
5. Panel chi tiết: đổi trạng thái, thêm assignee, comment, xem nhật ký.
6. Deploy Vercel; RLS bật; ghi/đọc qua `service_role` phía server.

Ngoài phạm vi GĐ0: Calendar/Timeline view, dependencies UI, merge, follow-up, auto-sinh, Discord, Drive, module Cá nhân CEO. (Schema đã chừa sẵn — xem §5.)

---

## 2. Tech stack (giống hệt gwt-sales / app-cskh)

- **Next.js 16** App Router + **React 19** + **Tailwind v4** + TypeScript.
- **Supabase** project `GWT-SalesTracking` (`bwzmqfbcgouhvhoslmmm`), **schema `work`**.
- Auth **Google `@gwt.vn`**; 2 client: `authClient()` (anon, chỉ hỏi "ai đăng nhập") + `dataClient()` (**service_role, chỉ server**, sau `requireStaff()`).
- Deploy **Vercel**, Root Directory = `apps/work-app`.

## 3. Cấu trúc repo

```
GWT Work/
├─ supabase-work/
│  └─ migrations/work_00_init.sql        # ✅ đã có (schema + RLS + helpers)
├─ apps/
│  └─ work-app/                          # Next.js (scaffold bằng create-next-app)
│     ├─ src/app/         # /login, /auth/*, / (Việc của tôi), /team, /task/[ref]
│     ├─ src/lib/         # supabase/{authClient,dataClient}, auth(requireStaff), data(queries), format
│     └─ src/components/  # TaskRow, TaskDrawer, Board, Sidebar, TopNav, ui
├─ docs/2026-08-18-gd0-build-spec.md     # file này
├─ .env.example
└─ README.md
```

> App chưa scaffold trên đĩa (chạy `npx create-next-app@latest apps/work-app` khi bắt đầu code)
> để không tạo `node_modules` thủ công. Copy `src/lib/supabase/*`, `src/lib/auth.ts`, `src/proxy.ts`
> từ **app-cskh** — luật đăng nhập giữ nguyên, chỉ đổi tên bảng.

## 4. Mô hình dữ liệu (đã tạo trong migration)

Bảng `work.*`: `team`, `team_member`, `project`, `task`, `task_project` (multi-home),
`task_assignee` (RACI), `task_dependency`, `task_link` (ERP soft ref), `comment`,
`attachment`, `activity`, `notification`, `recurring`, `staff_channel`.
Chi tiết + lý do trong file SQL. Điểm cần nhớ:

- **Khoá nối ERP = soft ref** (text/uuid), **không hard-FK** vào bảng mirror Sales/CS (bị wipe khi sync).
- **FK cứng** chỉ tới `public.staff(id uuid)` + trong nội bộ `work`.
- **Quyền xem** dùng 1 hàm duy nhất `work.visible_task_ids(staff_id)` — app luôn gọi lại, không viết tay điều kiện rải rác.

## 5. Trả lời yêu cầu mới (Asana) — chỗ nào trong schema

| Yêu cầu | Cách làm | GĐ |
|---|---|---|
| **Subtask (nhiều cấp)** | `task.parent_id` self-FK; tiến độ cha = % con done | 0 (tạo/hiện), sâu hơn ở 1 |
| **Dependencies** | `task_dependency(task_id, blocked_by_id)`; chặn đánh Done khi còn "blocked_by" chưa xong | 1 (data ở 0) |
| **Create follow-up task** | `task.follow_up_from` + RPC `create_follow_up` (copy link/assignee) | migration 03 |
| **Merge duplicate** | `task.duplicate_of` + `merged_at` + RPC `merge_tasks` (dời assignee/link/comment/subtask) | migration 02 |
| **1 task ∈ nhiều project** | `task_project` (nhiều-nhiều) — multi-home | 0 |
| **Bảng theo team** (MKT/Sales/CSKH/KT) | `team` + `team_member` (1 người nhiều team) | 0 |
| **Chia theo project** (build app, podcast nước…) | `project.kind='initiative'` | 0 |
| **List / Board / Calendar / Timeline** | 4 chế độ render trên cùng `work.task`; Calendar/Timeline đọc `start_at`/`due_at`, Timeline thêm `task_dependency` | List+Board ở 0, Calendar+Timeline ở GĐ1–2 |

## 6. Truy vấn chuẩn (mẫu app dùng)

```sql
-- Việc của tôi (staff hiện tại), kèm assignee + link + số subtask
select t.*, ta.role as my_role,
       (select count(*) from work.task c where c.parent_id=t.id and c.status<>'cancelled') as sub_n
from work.task t
join work.task_assignee ta on ta.task_id=t.id and ta.staff_id = :me
where t.id in (select task_id from work.visible_task_ids(:me))
  and t.status not in ('done','cancelled')
order by t.priority, t.due_at nulls last;
```

## 7. Bảo mật & test (theo 10 bài học chatbot)

- RLS bật hết; anon **không đọc được gì**; mọi truy vấn dữ liệu qua `dataClient()` server-side.
- Test từ ngày 1 (`vitest`): (a) `requireStaff()` — 4 luật vào cửa; (b) `visible_task_ids` — private không lộ ra ngoài creator/assignee; (c) format ngày/ưu tiên.
- **1 công thức trạng thái, 1 chỗ định nghĩa quyền xem** — không lặp điều kiện.

## 8. Việc cần con người (không code được)

1. **Apply migration** `work_00_init.sql` — CHỌN nơi apply: (a) Supabase **branch** của SalesTracking, hoặc (b) project **`gwt`** đang paused làm dev, **trước khi** đụng production. → cần CEO/dev bấm nút.
2. **Google OAuth**: dùng lại cấu hình `@gwt.vn` đã có (thêm redirect URL của work-app).
3. **Discord** (GĐ2): tạo Discord app + bot token + map `staff_channel.discord_id`.

## 9. Bước kế (sau khi migration chạy ở dev)

`create-next-app` → copy auth/supabase từ app-cskh → CRUD task + "Việc của tôi" → deploy preview Vercel → cho 2–3 người test.
