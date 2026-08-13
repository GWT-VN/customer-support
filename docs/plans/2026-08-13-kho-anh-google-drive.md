# Kế hoạch — Kho ảnh/video dùng chung (ticket + bảo trì) qua Google Drive

> **Spec bàn giao** cho người làm phần Media. Trạng thái: đã chốt hướng, **chưa code**.
> Các việc CS khác (dropdown tỉnh, siết SĐT, thu phí + ngày thu, gộp view/edit ticket,
> fix "Phân loại" dùng `<select>`) đã XONG + deploy — xem `docs/CHECKLIST.md`.

## Context

Cả **ticket** lẫn module **bảo trì** cần đính kèm ảnh/video (kỹ thuật/CS chụp hiện trường; kết quả đo nước khi bảo trì). User chốt: **một kho dùng chung**, lưu trên **Google Drive (Shared Drive)** để tận dụng dung lượng Google Workspace (chi phí ~0), metadata ở Supabase. Kèm yêu cầu: **nén** (giảm dung lượng) + **thu dọn định kỳ** (không để rác). Ảnh có thể chứa PII (nhà khách/khuôn mặt) → **không để lộ công khai**.

Đã khảo sát (greenfield): chưa có code media/storage nào; migration 41 đã ghi "Ảnh: làm sau (Storage)". Có sẵn: `dataClient()` service_role + `requireStaff()` (`lib/supabase.ts`), route handler mẫu (`app/auth/callback/route.ts`), pg_cron+http+Vault-secret (migration 13). Chưa có `googleapis`. Migration cao nhất hiện tại = **44** (44 = fix trang_thai) → dùng số tiếp theo còn trống (kiểm lại lúc làm; dự kiến **45**).

## Quyết định đã chốt
- Backend: **Google Drive (Shared Drive)** (user chọn, dù phức tạp hơn Supabase Storage).
- **1 bảng `media` đa hình** dùng chung ticket + bảo trì.
- Ảnh **riêng tư** — xem qua **proxy**, chỉ NV đăng nhập (bảo vệ PII), KHÔNG link công khai.

## Thiết lập phía Google (USER làm — kèm hướng dẫn)
1. Google Cloud: bật **Drive API**, tạo **service account**, tải JSON key.
2. Workspace: tạo **Shared Drive** "GWT CSKH Media", thêm email service account làm **Content manager**. (SA không có quota cá nhân → file BẮT BUỘC nằm trong Shared Drive, dùng dung lượng pool Workspace.)
3. Env (Vercel + `.env.local`): `GOOGLE_SERVICE_ACCOUNT_KEY` (JSON), `GDRIVE_SHARED_DRIVE_ID`, `GDRIVE_ROOT_FOLDER_ID`, `MEDIA_CLEANUP_SECRET`. Thêm (để trống) vào `app-cskh/.env.example`.
- Doc mới `docs/huong-dan-kho-anh-google-drive.md` (theo mẫu `docs/huong-dan-cau-hinh-google-vercel.md`).

## DB — `supabase-cskh/migrations/45_media.sql`
Bảng `public.media`: `id uuid pk default gen_random_uuid()`, `entity_type text check in ('ticket','bao_tri')`, `entity_id text not null` (=`ticket_code` hoặc `maintenance_visit.id`), `drive_file_id text not null`, `filename text`, `mime text`, `size_bytes bigint`, `uploaded_by text`, `created_at timestamptz default now()`, `deleted_at timestamptz`. Index `(entity_type, entity_id) where deleted_at is null`. RLS bật (app đọc bằng service_role như các bảng khác).

## Thư viện Drive — `app-cskh/lib/drive.ts` (server-only)
- Dùng `@googleapis/drive` (scoped, gọn hơn `googleapis`) + JWT từ SA key. Đọc env **lazily + throw rõ ràng** (theo mẫu `dataClient()` trong `lib/supabase.ts`). Route dùng `export const runtime = 'nodejs'`.
- Hàm: `taiLenDrive({buffer, mime, filename, entityType, entityId})` → tạo folder theo scope nếu chưa có (`/tickets/<code>/`, `/bao-tri/<visit>/`), `files.create` với `supportsAllDrives:true` trong Shared Drive → trả `fileId`; `taiVeDrive(fileId)` → stream; `xoaDrive(fileId)`.

## Route handlers (mẫu `app/auth/callback/route.ts`; lưu ý Next 16: `params` là Promise)
- `app/api/media/upload/route.ts` (POST, `requireStaff()`): nhận multipart (entity_type, entity_id, file) → validate mime + size (≤ ~4MB/file — hợp giới hạn body Vercel ~4.5MB; ảnh nén client thường <1MB) → `taiLenDrive` → insert `media` → trả metadata + ghi audit. Video >4MB: v1 chặn (nén/transcode video để sau).
- `app/api/media/[id]/route.ts` (GET, `requireStaff()`): **proxy** stream file từ Drive → ảnh riêng tư, chỉ NV đăng nhập xem. Hỗ trợ `?thumb` (Drive `?sz=` cho ảnh nhỏ).
- `app/api/media/cleanup/route.ts` (POST, xác thực bằng header `MEDIA_CLEANUP_SECRET`, KHÔNG dùng session).
- **`app-cskh/proxy.ts`**: loại `/api/media/cleanup` khỏi matcher (tự xác thực bằng secret); giữ upload/download qua proxy (bắt buộc đăng nhập — đúng ý bảo vệ PII).

## Server actions (`app/actions.ts`)
- `listMedia(entityType, entityId)` (requireStaff) → media chưa xoá.
- `xoaMedia(id)` (requireStaff) → set `deleted_at` + `xoaDrive(fileId)` + audit. UI hỏi confirm (quy ước: xoá cần confirm).

## UI — `app-cskh/components/DinhKemMedia.tsx` (client, dùng lại)
- Props: `entityType`, `entityId`, `items` (khởi tạo), `choSua`.
- Chọn ảnh/video → **nén ảnh tại trình duyệt** (canvas resize ~1600px, JPEG ~0.8) trước khi up → POST `/api/media/upload` (có progress) → lưới thumbnail (`<img src="/api/media/{id}?thumb">`, click mở full) → nút **Xoá** (confirm). Chỉ hiện thao tác khi `choSua`.
- Nhúng:
  - **Ticket**: thêm `<section>` "Ảnh / Video" ở `app/ticket/[code]/page.tsx` (sau "Nhật ký trao đổi"), truyền `entityType='ticket'`, `entityId=t.ticket_code`, `items={await listMedia('ticket', ma)}`, `choSua` = NV.
  - **Bảo trì**: trong `components/BaoTriDoneButton.tsx` (form kết quả `ghiKetQuaBaoTri`, key = `visitId` = `maintenance_visit.id`), `entityType='bao_tri'`, `entityId=visitId` — đúng chỗ migration 41 đã chừa.

## Nén + thu dọn (yêu cầu user)
- **Nén** = nén ảnh phía client lúc up (file lưu đã nhỏ). Video v1 giới hạn dung lượng.
- **Thu dọn** = `/api/media/cleanup` xoá media của ticket đã đóng (Done/Cancel) quá **12 tháng** (tham số hoá) + dọn row `deleted_at` cũ → xoá file Drive + cập nhật row → trả tóm tắt (số file, byte). Lên lịch bằng **pg_cron + http** (tái dùng mẫu migration 13: `cron.schedule` + `http` POST + secret trong Vault) → không thêm hạ tầng mới. **Log rõ, không xoá lén.**

## An toàn
`requireStaff()` mọi route/action; chặn mime/size/số-file; secret KHÔNG commit (`.env.example` để trống); audit up/xoá.

## Phân đợt
- **Đợt 1 (lõi, dùng được)**: hướng dẫn Google + env + migration + `lib/drive.ts` + upload/download route + `DinhKemMedia` + nhúng ticket & bảo trì + `listMedia`/`xoaMedia`.
- **Đợt 2 (dọn dẹp)**: cleanup route + pg_cron + báo cáo dung lượng.

## Kiểm thử
- Unit (vitest): hàm nén ảnh thuần + validate mime/size.
- `npm run lint` · `npx tsc --noEmit` · `npm run test` · `npm run build` sạch.
- E2E (sau khi user cấu hình Google): up 1 ảnh vào 1 ticket → thumbnail hiện (qua proxy, phải đăng nhập mới xem được) → file xuất hiện trong Shared Drive → xoá → mất ở cả app lẫn Drive. Lặp cho 1 visit bảo trì.
- Cleanup: gọi `/api/media/cleanup` với secret trên ticket cũ giả lập → xác nhận xoá + log.
- Thứ tự: áp migration → deploy code → user điền Google env trên Vercel → bật cron. Cập nhật `docs/CHECKLIST.md`.
