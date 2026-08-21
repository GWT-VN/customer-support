# Onboarding Dev — dựng máy để code nền tảng GWT (từ số 0)

> Đưa file này cho **bất kỳ ai trong team** cần code. Làm tuần tự, ~30–45 phút.
> Xong sẽ có: app chạy trên máy + database local có data giả → **code/test thoải mái, KHÔNG chạm dữ liệu thật của công ty.**
> (Tài liệu tham chiếu ngắn gọn hơn: [`LOCAL-DEV.md`](LOCAL-DEV.md).)

## Vì sao phải làm local (giải thích cho người mới)
Công ty có **1 database thật** chứa khách/đơn/ticket. Nếu code trực tiếp trên đó, gõ sai 1 câu là hỏng dữ liệu thật. Nên mỗi dev chạy **1 bản sao database ngay trên máy mình** (miễn phí) — nghịch thoải mái, hỏng thì reset, không ai bị ảnh hưởng. Đây là cách làm chuẩn ở mọi công ty phần mềm.

---

## Bước 1 — Cài công cụ (một lần)
| Công cụ | Để làm gì | Cài |
|---|---|---|
| **Docker Desktop** | Chạy database local | https://www.docker.com/products/docker-desktop/ (mở app sau khi cài) |
| **Node.js 20+** | Chạy web app | https://nodejs.org (bản LTS) hoặc `brew install node` |
| **Supabase CLI** | Quản database local | `brew install supabase/tap/supabase` |
| **Git** | Tải/lưu code | có sẵn trên Mac (gõ `git --version`) |

Kiểm tra: mở Terminal, gõ từng dòng, ra số phiên bản là ok:
```bash
docker --version
node --version
supabase --version
```

## Bước 2 — Lấy code về
```bash
cd ~/  # hoặc thư mục bạn muốn
git clone <URL repo Customer Support>   # xin URL từ anh/chị/CTO
cd customer-support
```
> Nếu dùng thư mục iCloud sẵn có: `cd "GWT - Claude/Customer Support"`.

## Bước 3 — Tạo database local (một lần, cần mật khẩu DB — xin CTO)
Lấy cấu trúc database thật về máy (chỉ **cấu trúc bảng**, KHÔNG lấy data khách):
```bash
cd "Customer Support"                       # thư mục chứa apps/web + supabase/
supabase link --project-ref bwzmqfbcgouhvhoslmmm   # dán DB password khi được hỏi
supabase db pull                            # tạo file schema trong supabase/migrations/
```

## Bước 4 — Bật database local + nạp data giả
```bash
supabase start        # lần đầu tải Docker image ~vài phút. Xong nó in ra URL + KEY — GIỮ LẠI.
supabase db reset     # áp cấu trúc + data giả (supabase/seed.sql)
```
Mở **Studio** để xem database bằng mắt: http://localhost:54323

## Bước 5 — Trỏ web app vào database local
Vào `apps/web/`, tạo file `.env.local` (copy từ `.env.example`) và điền **KEY local** từ output Bước 4:
```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
ALLOWED_EMAIL_DOMAIN=gwt.vn
```
> 💡 Mẹo: giữ 2 file — `.env.local.prod` (trỏ thật) và `.env.local.dev` (trỏ local) — đổi qua lại khi cần. **Đừng bao giờ commit `.env.local`.**

## Bước 6 — Chạy app
```bash
cd apps/web
npm install     # một lần
npm run dev     # mở http://localhost:3000
```
Đăng nhập bằng **tài khoản dev cố định** (CEO chốt 21/08/2026 — đừng đổi mật khẩu, mọi
worktree dùng chung một Supabase local):

| Email | Mật khẩu | Thấy gì |
|---|---|---|
| `dev.admin@gwt.vn` | `gwtlocal123` | `admin` — mọi khu: Việc · CSKH · Sales |
| `dev.sales@gwt.vn` | `gwtlocal123` | `sales` — chỉ Sales (kèm khu Việc, mở cho mọi nhân viên) |

> ⚠️ **21/08: `dev.sales@gwt.vn` chưa đăng nhập được** (lỗi **27** ở `backlog/nen-tang.md`) — cửa đăng
> nhập đang xét bằng luật khu CSKH nên tài khoản Sales thuần bị chặn. Không phải sai mật khẩu.

Chưa có / sai mật khẩu → `bash supabase/seed-prod-masked.sh` đặt lại đúng bảng trên.
Chi tiết + cách thêm vai trò khác để thử phân quyền: [LOCAL-DEV.md](LOCAL-DEV.md).

---

## Dùng hằng ngày (sau khi đã cài xong)
```bash
supabase start          # bật database local (nếu chưa chạy)
cd apps/web && npm run dev
# ... code ...
supabase db reset       # muốn database sạch lại + data giả mới
```

## Sự cố thường gặp
| Triệu chứng | Cách xử |
|---|---|
| `supabase start` lỗi | Mở Docker Desktop trước; đợi Docker chạy hẳn |
| Trang trắng / lỗi key | Kiểm `.env.local` đã dán đúng KEY **local** (không phải prod) |
| Data không đổi | Chạy lại `supabase db reset` |
| Đổi cấu trúc DB | Tạo migration mới (xem `LOCAL-DEV.md`), `supabase db reset`, test, rồi mới lên prod |
| Cần dừng | `supabase stop` (giữ data) · `supabase stop --no-backup` (xoá sạch) |

## Nguyên tắc vàng cho cả team
- 🔒 **Không đổ dữ liệu khách thật (tên/SĐT/địa chỉ) vào máy local hay file seed.** Chỉ data giả.
- 🚫 **Không code trực tiếp trên database thật.** Mọi thứ làm ở local trước.
- 🔑 Không chia sẻ `service_role` key; không commit `.env.local`.
- 📝 Đổi cấu trúc DB = 1 file migration trong git → test local → mới áp prod.
