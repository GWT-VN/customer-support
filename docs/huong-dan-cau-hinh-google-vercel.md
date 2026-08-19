# Hướng dẫn cấu hình đăng nhập Google + deploy Vercel

> Phần code đã xong. Ba việc dưới đây phải thao tác trên giao diện web của Google,
> Supabase và Vercel — làm theo đúng thứ tự, mỗi bước có giá trị cụ thể cần điền.
> Ngày: 2026-07-28.

**Thông tin dùng chung:**

| Mục | Giá trị |
|---|---|
| Project Supabase | `GWT-SalesTracking` — `bwzmqfbcgouhvhoslmmm` |
| URL project | `https://bwzmqfbcgouhvhoslmmm.supabase.co` |
| Repo GitHub | `AIGWTVN/customer-support` (private) |
| Thư mục app trong repo | `apps/web` |

---

## Bước 1 — Google Cloud Console

1. Vào https://console.cloud.google.com → chọn hoặc tạo project (vd `GWT-CSKH`)
2. **APIs & Services → OAuth consent screen**
   - User type: **Internal** nếu Google Workspace của `gwt.vn` cho phép (an toàn hơn hẳn: chỉ người trong tổ chức mới thấy). Không có thì chọn External.
   - Điền tên ứng dụng, email hỗ trợ, email liên hệ → Save
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `apps/web`
   - **Authorized redirect URIs** — điền đúng URL của **Supabase**, không phải của app:

     ```
     https://bwzmqfbcgouhvhoslmmm.supabase.co/auth/v1/callback
     ```

     > ⚠️ Đây là chỗ hay nhầm nhất. Google trả kết quả về **Supabase** trước, Supabase mới
     > chuyển tiếp về app. Điền URL của app vào đây là đăng nhập lỗi.
4. Bấm Create → copy **Client ID** và **Client Secret**

## Bước 2 — Supabase

### 2.1 Bật provider Google

Dashboard → project **GWT-SalesTracking** → **Authentication → Providers → Google**

- Bật **Enable Sign in with Google**
- Dán **Client ID** và **Client Secret** vừa lấy ở bước 1 → Save

### 2.2 Khai báo Redirect URLs

**Authentication → URL Configuration**

- **Site URL:** `http://localhost:3000` lúc đang phát triển; đổi thành domain production sau khi có.
- **Redirect URLs** — thêm cả ba dòng, thiếu dòng nào là môi trường đó đăng nhập lỗi:

  ```
  http://localhost:3000/auth/callback
  https://<domain-production>/auth/callback
  https://*-<team>.vercel.app/auth/callback
  ```

  `<domain-production>` và `<team>` lấy được sau khi tạo project ở bước 3 — quay lại điền nốt.

### 2.3 Tắt đăng ký công khai

**Authentication → Providers → Email → tắt "Allow new users to sign up"**

Không tắt thì bất kỳ ai cũng tự tạo tài khoản email/mật khẩu. Luật vào cửa vẫn chặn được họ,
nhưng đóng luôn cửa này thì tốt hơn — bớt một bề mặt phải lo.

## Bước 3 — Vercel

1. https://vercel.com/new → **Import** repo `AIGWTVN/customer-support`
2. **Root Directory: `apps/web`**

   > ⚠️ Bắt buộc. Repo có nhiều thư mục (`apps/web`, `docs`, `migrate`, `db/cs`);
   > để mặc định gốc repo là build hỏng ngay.

3. **Environment Variables** — thêm cả ba, tick cho **cả Production lẫn Preview**:

   | Tên | Giá trị |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://bwzmqfbcgouhvhoslmmm.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | lấy ở `apps/web/.env.example` |
   | `SUPABASE_SERVICE_ROLE_KEY` | Dashboard → Project Settings → API → `service_role` |

4. Deploy → lấy domain production → **quay lại bước 2.2** điền nốt Redirect URLs
5. **Settings → Deployment Protection** → bật cho **Preview**

   > Mỗi bản preview đều cầm `service_role`, tức là một cửa vào đầy đủ dữ liệu khách.
   > Bật xong phải **mở thử URL preview ở cửa sổ ẩn danh** để xác nhận nó thật sự đòi đăng nhập —
   > đừng tin là đã bật.

---

## Sau khi xong — kiểm 6 ca

| # | Thao tác | Kỳ vọng |
|---|---|---|
| 1 | Đăng nhập Google bằng `ai@gwt.vn` | Vào được trang chủ |
| 2 | Đăng nhập Google bằng Gmail cá nhân | Về `/login`, hiện "chưa được cấp quyền" |
| 3 | Đăng nhập mật khẩu bằng `bella@gwt.vn` | Vào được như cũ |
| 4 | Khoá rồi đăng nhập lại (xem SQL dưới) | Bị từ chối, hiện "đã bị khoá" |
| 5 | Mở khoá, đăng nhập lại | Vào được |
| 6 | Google bằng email `@gwt.vn` chưa có trong bảng | Vào được VÀ `cs_staff` tự có dòng mới |

Ca 2 và ca 4 quan trọng nhất — chúng là thứ duy nhất chặn người ngoài đọc dữ liệu khách.

```sql
-- Khoá một người (ca 4)
update public.cs_staff set hoat_dong = false where email = 'ai@gwt.vn';

-- Mở lại (ca 5)
update public.cs_staff set hoat_dong = true where email = 'ai@gwt.vn';

-- Xem ai đang được vào
select email, vai_tro, hoat_dong, created_at from public.cs_staff order by created_at;
```

## Vận hành thường ngày

**Người mới vào công ty** có email `@gwt.vn`: không cần làm gì, đăng nhập Google là vào được,
hệ thống tự ghi tên vào `cs_staff`.

**Người ngoài domain** (freelancer, đối tác): thêm tay một dòng —

```sql
insert into public.cs_staff (email, ho_ten, ghi_chu)
values ('nguoi-ngoai@gmail.com', 'Tên người', 'Lý do được cấp quyền');
```

**Người nghỉ việc:** `update public.cs_staff set hoat_dong = false where email = '...';`
Có hiệu lực ngay lần truy cập kế tiếp, không cần chờ IT xoá tài khoản Google.
