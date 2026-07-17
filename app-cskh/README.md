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

Supabase Dashboard → project **GWT-Masterdata** → Project Settings → API →
mục **service_role** (secret) → copy → dán vào `.env.local`.

> 🔒 Key này **toàn quyền, bỏ qua RLS**. `.env.local` đã bị gitignore — đừng commit, đừng gửi qua chat/Slack.

### 2. Tắt đăng ký công khai (BẮT BUỘC)

Dashboard → Authentication → Providers → Email → **tắt "Allow new users to sign up"**.

Không tắt thì bất kỳ ai cũng tự tạo tài khoản và vào xem SĐT/địa chỉ khách.

### 3. Tạo tài khoản nhân viên

Dashboard → Authentication → Users → **Add user** → email + mật khẩu → gửi cho nhân viên.

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

```bash
npx vercel                     # lần đầu: link project
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel --prod
```

## Ghi chú dữ liệu

- Khoá: khách = `primary_phone` · máy = `serial` · SP = `internal_code` → `catalog_item`.
- Sửa SĐT khách về đúng dạng `0xxxxxxxxx` rồi Lưu → cờ `needs_phone` tự gỡ, `notes` lỗi tự xoá.
- Số năm bảo hành nằm ở `product_warranty` (20 mã). Máy ngoài danh sách đó → badge 🟡.
