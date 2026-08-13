# Hướng dẫn cấu hình kho ảnh/video trên Google Drive

> Phần code đã xong (nhánh `feat/kho-anh-google-drive`). Các bước dưới đây thao tác trên
> giao diện web của Google Cloud, Google Workspace, Vercel và Supabase — làm theo thứ tự,
> mỗi bước có giá trị cụ thể cần lấy về. Ngày: 2026-08-13.
>
> Kho này chứa ảnh/video đính kèm **ticket** và **lượt bảo trì** (chụp hiện trường, kết quả
> đo nước). File nằm trong **Shared Drive** của Workspace (dùng dung lượng pool, chi phí ~0),
> app chỉ giữ metadata trong bảng `media`. Ảnh **riêng tư**: chỉ nhân viên đăng nhập xem được
> qua proxy của app, không có link công khai.

**Thông tin dùng chung:**

| Mục | Giá trị |
|---|---|
| Project Supabase | `GWT-SalesTracking` — `bwzmqfbcgouhvhoslmmm` |
| App | `app-cskh` trên Vercel |
| Env cần điền | `GOOGLE_SERVICE_ACCOUNT_KEY`, `GDRIVE_SHARED_DRIVE_ID`, `GDRIVE_ROOT_FOLDER_ID`, `MEDIA_CLEANUP_SECRET` |

---

## Bước 1 — Google Cloud: bật Drive API + tạo service account

1. Vào https://console.cloud.google.com → chọn project đã dùng cho đăng nhập (vd `GWT-CSKH`).
2. **APIs & Services → Library** → tìm **Google Drive API** → **Enable**.
3. **IAM & Admin → Service Accounts → Create Service Account**
   - Name: `cskh-media` (email sẽ có dạng `cskh-media@<project>.iam.gserviceaccount.com`)
   - Không cần cấp role nào ở màn "Grant access" → Done.
4. Bấm vào service account vừa tạo → tab **Keys → Add Key → Create new key → JSON** → tải file về.

   > 🔒 File JSON này là chìa khoá toàn quyền vào Shared Drive media. KHÔNG commit,
   > không gửi qua chat/email chung. Dùng xong bước 3 thì xoá bản tải về.

## Bước 2 — Google Workspace: tạo Shared Drive

1. Vào https://drive.google.com → **Shared drives → + New** → đặt tên **`GWT CSKH Media`**.

   > ⚠️ Bắt buộc là **Shared Drive** (mục "Shared drives" bên trái), KHÔNG phải thư mục
   > trong My Drive. Service account không có quota riêng — file phải nằm trong Shared
   > Drive mới dùng được dung lượng pool của Workspace.

2. Mở Shared Drive → **Manage members** → thêm email service account ở bước 1
   (`cskh-media@<project>.iam.gserviceaccount.com`) với quyền **Content manager**.
3. Lấy **ID của Shared Drive**: mở Shared Drive, nhìn URL
   `https://drive.google.com/drive/folders/<ID>` → chuỗi `<ID>` chính là `GDRIVE_SHARED_DRIVE_ID`.
4. Tạo một thư mục gốc bên trong Shared Drive, đặt tên `media` (app sẽ tự tạo cây
   `tickets/<mã ticket>/` và `bao-tri/<mã lượt>/` bên dưới). Mở thư mục đó, lấy ID trên URL
   → đó là `GDRIVE_ROOT_FOLDER_ID`.

## Bước 3 — Điền env (Vercel + máy local)

Trên **Vercel → Settings → Environment Variables** (tick cả Production lẫn Preview),
và trong `app-cskh/.env.local` khi chạy local:

| Tên | Giá trị |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | dán **nguyên nội dung file JSON** key (cả dấu `{}`, một dòng) |
| `GDRIVE_SHARED_DRIVE_ID` | ID Shared Drive (bước 2.3) |
| `GDRIVE_ROOT_FOLDER_ID` | ID thư mục `media` (bước 2.4) |
| `MEDIA_CLEANUP_SECRET` | chuỗi ngẫu nhiên dài (vd chạy `openssl rand -hex 24`) |

Điền xong **Redeploy** thì env mới có hiệu lực.

## Bước 4 — Kiểm tra đầu-cuối

| # | Thao tác | Kỳ vọng |
|---|---|---|
| 1 | Mở một ticket → mục **Ảnh / Video** → "+ Thêm ảnh / video" → chọn 1 ảnh chụp điện thoại | Ảnh hiện thumbnail sau vài giây; dung lượng đã nén (xem ở Drive, thường <1MB) |
| 2 | Mở Shared Drive | Thấy file trong `media/tickets/<mã ticket>/` |
| 3 | Copy URL ảnh (`/api/media/<id>`) mở ở **cửa sổ ẩn danh** | Bị đá về `/login` — ảnh không công khai |
| 4 | Bấm ✕ xoá ảnh → confirm | Mất ở app **và** mất trong Shared Drive |
| 5 | Vào lịch bảo trì → một lượt → "+ kết quả đo" → thêm ảnh | Như ca 1, file nằm trong `media/bao-tri/<id lượt>/` |

## Bước 5 — Bật thu dọn định kỳ (Đợt 2, làm sau cũng được)

Cleanup xoá media của ticket đã đóng (Done/Cancel) quá **12 tháng** + dọn row đã
soft-delete quá 90 ngày. Chạy bằng pg_cron trong Supabase, gọi
`POST /api/media/cleanup` với header `x-media-cleanup-secret`.

1. Supabase Dashboard → **SQL Editor**, lưu secret vào Vault (thay giá trị thật):

   ```sql
   select vault.create_secret('<MEDIA_CLEANUP_SECRET>', 'media_cleanup_secret');
   ```

2. Báo cho người làm code biết **domain production** của app → họ áp migration
   `45_media_cleanup_cron.sql` (file đã viết sẵn, đang chờ đúng hai giá trị này —
   xem ghi chú trong file). Migration này KHÔNG áp trước khi có secret + domain.
3. Kiểm tra tay một lần:

   ```bash
   curl -X POST "https://<domain>/api/media/cleanup" -H "x-media-cleanup-secret: <secret>"
   ```

   Kỳ vọng JSON tóm tắt: `{"thang":12,"ticket_dong":…,"file_xoa":…,"byte_xoa":…,"row_purge":…}`.
   Mỗi lần chạy đều ghi một dòng `media_cleanup` vào `audit_log` — không xoá lén.

## Vận hành thường ngày

- **Ảnh nặng?** Không cần lo — ảnh nén ngay trên trình duyệt trước khi up (cạnh dài
  ≤1600px, JPEG). Video thì v1 giới hạn 4MB/file; video dài hãy quay ngắn lại.
- **Ai xoá được?** Mọi nhân viên đăng nhập (mỗi lần xoá có confirm + ghi audit).
- **Hết dung lượng Workspace?** Xem tổng byte đã dọn trong `audit_log`
  (`hanh_dong = 'media_cleanup'`), hoặc mở Shared Drive xem trực tiếp.
