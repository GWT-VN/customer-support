# Đăng nhập Google + deploy Vercel — thiết kế

> Giai đoạn 1 của việc mở app CSKH cho nhiều người dùng. Ngày: 2026-07-28.
> Trạng thái: đã brainstorm với user, chờ duyệt trước khi viết plan.

## 1. Bối cảnh & vấn đề

App `app-cskh` hiện chỉ đăng nhập bằng email + mật khẩu, tài khoản do quản trị tạo tay trên
Supabase Dashboard. Thực tế có **2 tài khoản, đều `@gwt.vn`**: `bella@gwt.vn` (đang dùng) và
`ai@gwt.vn` (đã tạo, chưa đăng nhập lần nào — người mới nhận việc chỉ cần đặt lại mật khẩu).
App cũng chưa deploy ở đâu — chỉ chạy `localhost`.

Cần: (a) thêm đăng nhập Google để nhân viên dùng luôn tài khoản công ty, (b) auto-deploy lên
Vercel từ GitHub để mọi người truy cập được mà không phải dựng máy.

### Vì sao không thể bật Google OAuth trần

Mô hình bảo mật hiện tại chỉ an toàn nhờ **tắt đăng ký công khai**. `requireStaff()`
(`lib/supabase.ts:47`) chỉ kiểm tra *"có ai đó đang đăng nhập không"*, không kiểm tra người đó
**là ai**; qua được cửa là app dùng `service_role` đọc sạch dữ liệu, bỏ qua RLS.

Bật Google OAuth mà không thêm rào ⇒ **bất kỳ tài khoản Google nào trên đời** cũng vào được và
đọc được SĐT/địa chỉ của 293 khách. Nên việc thêm luật vào cửa là **điều kiện bắt buộc** đi kèm,
không phải tính năng tuỳ chọn.

## 2. Quyết định đã chốt với user

| Trục | Quyết định |
|---|---|
| Ai được vào | **`@gwt.vn` HOẶC có tên trong `cs_staff`** |
| Đăng nhập mật khẩu | **Giữ nguyên** — chị Trang đang làm dở tính năng, cần đường vào sẵn có |
| Tầng chặn | **Tầng ứng dụng** (phương án A) — sửa `requireStaff()`. RLS (phương án B) làm ngay sau, phase riêng |
| Phân quyền chi tiết | **Giai đoạn 2**, spec riêng. Giai đoạn 1 chỉ chừa cột `vai_tro` |
| Môi trường Vercel | Production (`main`) + Preview có Deployment Protection |

**Nguyên tắc:** luật vào cửa áp cho **cả hai** đường đăng nhập. Chỉ chặn đường Google thì người ta
vòng qua đường mật khẩu là vào được, rào thành vô nghĩa.

## 3. Luồng đăng nhập

```
/login ──signInWithOAuth('google')──▶ Google chọn tài khoản
                                              │
              /auth/callback?code=… ◀──────────┘
                        │
          exchangeCodeForSession(code) → có session
                        │
                  duocPhepVao(email)?
                    ├─ đạt   → upsert cs_staff → chuyển về /
                    └─ trượt → signOut() → /login?loi=khong-co-quyen
```

Đường mật khẩu giữ nguyên `signInWithPassword`, không đổi.

### ⚠️ Bẫy phải sửa cùng lúc: `proxy.ts`

Matcher hiện chặn **mọi** đường dẫn trừ `/login`, luật là *"chưa có user → đá về /login"*.
Lúc Google gọi ngược về `/auth/callback` thì **session chưa tồn tại** ⇒ nếu không mở ngoại lệ cho
`/auth`, proxy đá thẳng về `/login` và vòng đăng nhập **không bao giờ khép được**.

### Điểm chặn thật sự

`requireStaff()` là **nơi duy nhất** thực thi luật — mọi Server Action đều đi qua, không phụ thuộc
người dùng vào bằng đường nào. Kiểm tra ở `/auth/callback` chỉ để báo lỗi tử tế và dọn session,
**không phải** hàng rào chính.

## 4. Bảng `cs_staff`

```
cs_staff
  id          uuid   pk, default gen_random_uuid()
  email       text   unique, not null, luôn lưu chữ thường
  ho_ten      text
  vai_tro     text   not null, default 'nhan_vien'   ← giai đoạn 1 CHỈ GHI, không đọc
  hoat_dong   bool   not null, default true
  ghi_chu     text
  created_at  timestamptz default now()
  updated_at  timestamptz default now()   ← trigger tự cập nhật
```

Trigger dùng lại hàm sẵn có `public.set_updated_at()`, đặt tên theo quy ước đang dùng trong
`00_init_cskh_project_moi.sql`: `trg_cs_staff_updated_at`.

RLS **bật, 0 policy** — giống 4 bảng CSKH kia, chỉ `service_role` đọc/ghi được.
Tên có tiền tố `cs_` theo quy ước đã chốt 2026-07-24 (tránh đụng bảng team Sales publish sau này).

### Luật vào cửa — xét đúng thứ tự

| # | Tình huống | Kết quả |
|---|---|---|
| 1 | Có dòng trong `cs_staff`, `hoat_dong = false` | **Từ chối** — kể cả email `@gwt.vn` |
| 2 | Có dòng trong `cs_staff`, `hoat_dong = true` | Cho vào — kể cả email ngoài domain |
| 3 | Không có dòng, email kết thúc `@gwt.vn` | Cho vào + **tự ghi dòng mới** (`vai_tro='nhan_vien'`) |
| 4 | Còn lại | Từ chối |

Email luôn chuẩn hoá về chữ thường trước khi so sánh.

**Thứ tự quan trọng:** dòng 1 đứng trước dòng 3 để `hoat_dong=false` thắng luật domain — đó là cơ
chế khoá người nghỉ việc ngay lập tức, không cần chờ IT xoá tài khoản Google.

**Bảng vừa là danh sách cho phép, vừa là danh sách cấm.** Dòng tự ghi ở luật 3 khiến bảng tự đầy
lên theo thực tế dùng ⇒ tới giai đoạn 2 mở UI phân quyền đã có sẵn danh sách người thật để gán
vai trò, không phải nhập tay lại.

## 5. Thay đổi trong repo

| File | Việc |
|---|---|
| `supabase-cskh/migrations/02_cs_staff.sql` (mới) | Tạo `cs_staff` + RLS + trigger `updated_at` |
| `lib/auth.ts` (mới) | `duocPhepVao(email)` — luật 4 dòng ở mục 4, một chỗ duy nhất |
| `lib/supabase.ts` | `requireStaff()` gọi `duocPhepVao()`, trượt thì ném `FORBIDDEN` |
| `app/auth/callback/route.ts` (mới) | Đổi code lấy session, kiểm tra luật, upsert `cs_staff`, xử lý lỗi |
| `app/login/page.tsx` | Thêm nút "Đăng nhập bằng Google"; giữ nguyên ô email/mật khẩu; hiện lỗi từ query `?loi=` |
| `proxy.ts` | Mở ngoại lệ cho `/auth` (xem mục 3) |
| `.env.example` | **Sửa: đang trỏ nhầm project cũ GWT-Masterdata** (`qynpywysgltspmgnhhga`) trong khi code đã cutover sang `cs_customers` ⇒ phải là GWT-SalesTracking (`bwzmqfbcgouhvhoslmmm`) |
| `README.md` | Cập nhật phần đăng nhập + deploy |
| `docs/CHECKLIST.md` | Tick mục Phase 3 cutover (đã làm ở commit `619e975` nhưng chưa tick) + thêm các mục giai đoạn 2 |

## 6. Cấu hình ngoài repo — **user tự làm**

Ba việc này đòi nhập khoá bí mật và cấp quyền OAuth, Claude không được phép thao tác thay.
Plan sẽ kèm hướng dẫn từng bước với đúng giá trị cần điền.

1. **Google Cloud Console** — tạo OAuth client (Web application), lấy Client ID + Client Secret
2. **Supabase → Authentication → Providers → Google** — dán Client ID/Secret, bật provider
3. **Vercel** — nối repo GitHub, **Root Directory = `app-cskh`** (repo nhiều thư mục, không đặt là build hỏng), nhập 3 biến môi trường cho cả Production lẫn Preview:
   `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY`

### Redirect URL — phải phủ đủ 3 môi trường

Khai báo ở **cả** Google Cloud lẫn Supabase (Authentication → URL Configuration). Thiếu một cái thì
môi trường đó đăng nhập lỗi mà không rõ nguyên nhân:

- `http://localhost:3000/auth/callback` — máy lập trình
- `https://<domain-production>/auth/callback` — domain Vercel cấp khi tạo project
- wildcard cho preview, dạng `https://*-<team>.vercel.app/auth/callback`

## 7. Xử lý lỗi

| Tình huống | Người dùng thấy |
|---|---|
| Email không đạt luật vào cửa | "Tài khoản `x@y.com` chưa được cấp quyền vào hệ thống CSKH. Liên hệ quản trị." + tự đăng xuất |
| Google trả lỗi / user bấm huỷ | Quay lại `/login` kèm lý do, không treo trang trắng |
| Thiếu `SUPABASE_SERVICE_ROLE_KEY` | Giữ nguyên thông báo rõ ràng sẵn có ở `lib/supabase.ts:38` |

## 8. Điều kiện nghiệm thu

- [ ] Đăng nhập Google bằng email `@gwt.vn` → vào được, `cs_staff` tự có dòng mới
- [ ] Đăng nhập Google bằng Gmail cá nhân → bị từ chối kèm thông báo, không tạo session
- [ ] Đăng nhập mật khẩu bằng tài khoản có trong `cs_staff` → vào được như cũ
- [ ] Đặt `hoat_dong = false` cho một email `@gwt.vn` → email đó bị từ chối (luật 1 thắng luật 3)
- [ ] Deploy Vercel: production chạy, preview có Deployment Protection, cả hai đăng nhập Google được

## 9. Rủi ro

**Khoá nhầm người đang làm việc** — ✅ **đã gỡ (2026-07-28).** Kiểm tra Dashboard → Authentication
→ Users: chỉ có **2 tài khoản, cả hai đều `@gwt.vn`** — `ai@gwt.vn` (chưa đăng nhập lần nào) và
`bella@gwt.vn` (đã đăng nhập, tài khoản đang dùng). Luật 3 phủ hết cả hai ⇒ **không ai mất đường
vào khi bật rào**, không còn việc chặn deploy production.

Vẫn nạp sẵn 2 email vào `cs_staff` (`hoat_dong = true`) như bước dọn đường cho giai đoạn 2 — nhưng
là việc *nên làm*, không phải việc *chặn*.

**Preview deployment cầm `service_role`** — mỗi URL preview là một cửa vào đầy đủ dữ liệu khách.
Đã xử lý bằng Deployment Protection, nhưng phải verify bật thật sau khi tạo project.

## 10. Ngoài phạm vi giai đoạn này

Ghi vào `docs/CHECKLIST.md` để không rơi:

- **Giai đoạn 2 — UI phân quyền**: đọc `vai_tro`, màn hình quản lý nhân viên, luật ai xem được gì
- **Phương án B — RLS + role least-privilege** thay `service_role` (user đã chốt "làm ngay sau")
- **Tính năng phụ**: xem nhiều dữ liệu hơn, bộ lọc — user nêu 2026-07-28, chưa bàn chi tiết
