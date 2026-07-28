# GWT CSKH — app vận hành

App nội bộ để nhân viên CSKH tra máy đã lắp, kích hoạt bảo hành và quản lý đa-SĐT của khách.

## Chạy lần đầu

```bash
cd app-cskh
npm install
cp .env.example .env.local     # rồi ĐIỀN service_role key (xem dưới)
npm run dev                    # http://localhost:3000
```

### 1. Điền `SUPABASE_SERVICE_ROLE_KEY`

Supabase Dashboard → project **GWT-SalesTracking** → Project Settings → API →
mục **service_role** (secret) → copy → dán vào `.env.local`.

> 🔒 Key này **toàn quyền, bỏ qua RLS**. `.env.local` đã bị gitignore — đừng commit, đừng gửi qua chat/Slack.

### 2. Tắt đăng ký công khai (BẮT BUỘC)

Dashboard → Authentication → Providers → Email → **tắt "Allow new users to sign up"**.

Không tắt thì bất kỳ ai cũng tự tạo tài khoản và vào xem SĐT/địa chỉ khách.

### 3. Tạo tài khoản nhân viên

Dashboard → Authentication → Users → **Add user** → email + mật khẩu → gửi cho nhân viên.

## Ai được vào — bảng `cs_staff`

Có hai đường đăng nhập: **email + mật khẩu** và **Google**. Cả hai đều đi qua **cùng một** luật
vào cửa ở `requireStaff()`, vì chặn một đường mà để hở đường kia thì rào vô nghĩa.

Luật xét theo đúng thứ tự này:

| # | Tình huống | Kết quả |
|---|---|---|
| 1 | Có dòng trong `cs_staff`, `hoat_dong = false` | **Từ chối** — kể cả email `@gwt.vn` |
| 2 | Có dòng trong `cs_staff`, `hoat_dong = true` | Cho vào — kể cả email ngoài domain |
| 3 | Chưa có dòng, email kết thúc `@gwt.vn` | Cho vào + tự ghi một dòng mới |
| 4 | Còn lại | Từ chối |

Bảng vừa là **danh sách cho phép** vừa là **danh sách cấm**. Khoá người nghỉ việc:

```sql
update public.cs_staff set hoat_dong = false where email = 'nguoi-nghi@gwt.vn';
```

Có hiệu lực ngay lần truy cập kế tiếp. Luật 1 đứng trước luật 3 chính là để việc này chạy được
kể cả với email trong domain công ty.

Luật nằm ở `lib/auth.ts` dưới dạng **hàm thuần**, có 7 unit test (`npm test`). Cột `vai_tro`
hiện chỉ ghi chứ chưa ai đọc — chừa cho giai đoạn 2 (UI phân quyền).

Cấu hình Google OAuth và deploy: xem [../docs/huong-dan-cau-hinh-google-vercel.md](../docs/huong-dan-cau-hinh-google-vercel.md).

## Vì sao thiết kế như vậy

4 bảng CSKH (`customers`, `customer_contacts`, `installed_base`, `warranty`) bật RLS
**không có policy nào** → `anon` và `authenticated` **không đọc được gì cả**. Đây là chủ đích:
dữ liệu cá nhân của khách.

Nên app tách 2 client (`lib/supabase.ts`):

| Client | Key | Việc |
|---|---|---|
| `authClient()` | anon | Chỉ hỏi "ai đang đăng nhập?" — không đọc được bảng CSKH |
| `dataClient()` | **service_role** | Đọc/ghi dữ liệu, **chỉ chạy server-side**, luôn sau `requireStaff()` |

Supabase Auth chỉ làm **cổng vào**. Nếu mở RLS policy cho `authenticated` thì bất kỳ ai
tự đăng ký cũng đọc được toàn bộ khách — nên không làm vậy.

Hai lớp bảo vệ:
1. `proxy.ts` — chưa đăng nhập → đá về `/login`.
2. Mỗi Server Action tự gọi `requireStaff()` — proxy bị bypass thì vẫn chặn.

## Màn hình

| Đường dẫn | Việc |
|---|---|
| `/` | Tra máy theo **SĐT / serial / tên khách** (view `v_installed_base`, 50 dòng gần nhất) |
| `/may/[serial]` | Chi tiết máy + nút **Kích hoạt bảo hành** (RPC `activate_warranty`) |
| `/khach/[id]` | Sửa khách + thêm/xoá **SĐT phụ** (giúp việc, người nhà, quản lý) |
| `/khach` | Khách **thiếu/lỗi SĐT** cần dọn |

## Badge bảo hành

| Badge | Nghĩa |
|---|---|
| 🟢 Còn hạn máy | trong hạn bảo hành toàn máy |
| 🔵 Hết hạn máy · còn lõi | hết BH máy nhưng linh kiện cốt lõi còn (vd 1 năm máy / 5–10 năm lõi) |
| 🔴 Hết bảo hành | hết cả hai |
| 🟡 Không rõ hạn | máy **chưa có** trong `product_warranty` → không tính được ngày hết hạn |
| ⚪ Chưa kích hoạt | chưa bấm kích hoạt bao giờ |

## Deploy (Vercel)

Auto-deploy từ GitHub: nhánh `main` → production, các nhánh khác → preview (có Deployment
Protection). Không deploy tay bằng `npx vercel` nữa.

Cấu hình lần đầu — **Root Directory phải đặt là `app-cskh`**, xem
[../docs/huong-dan-cau-hinh-google-vercel.md](../docs/huong-dan-cau-hinh-google-vercel.md) bước 3.

## Ghi chú dữ liệu

- Khoá: khách = `primary_phone` · máy = `serial` · SP = `internal_code` → `catalog_item`.
- Sửa SĐT khách về đúng dạng `0xxxxxxxxx` rồi Lưu → cờ `needs_phone` tự gỡ, `notes` lỗi tự xoá.
- Số năm bảo hành nằm ở `product_warranty` (20 mã). Máy ngoài danh sách đó → badge 🟡.
