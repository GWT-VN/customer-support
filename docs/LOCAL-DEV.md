# Môi trường LOCAL — code & test KHÔNG chạm production

> Mục tiêu: chạy Postgres + Auth + Studio **ngay trên máy**, nạp toàn bộ schema (CS + Work
> + module sau) + data giả, để code thoải mái. **Prod (`GWT-SalesTracking`) không bao giờ bị đụng.**
> Áp dụng cho **mọi module/route** trong app này (dùng chung 1 Postgres local).

## Vì sao local thay vì Supabase branch
Branch Supabase dựng schema từ migration đi qua GitHub, **KHÔNG có data prod tự mirror** (hiểu nhầm phổ biến) và tốn ~$10/tháng nếu chạy thường trực. Local: **miễn phí, offline, nhanh, cách ly tuyệt đối** — chuẩn cho đội nhỏ.

## Cài một lần
```bash
# 1. Docker Desktop (bắt buộc — Supabase local chạy trong Docker)
#    tải ở https://www.docker.com/products/docker-desktop/
# 2. Supabase CLI
brew install supabase/tap/supabase
```

## Lấy schema prod về làm nền (một lần, cần mật khẩu DB prod)
Schema CS được áp dần qua MCP nên chưa nằm trong `supabase/migrations/`. Baseline một phát:
```bash
cd "Customer Support"
supabase link --project-ref bwzmqfbcgouhvhoslmmm      # hỏi DB password (Dashboard → Settings → Database)
supabase db pull                                       # tạo supabase/migrations/<ts>_remote_schema.sql = toàn bộ schema prod (CS+Work+RPC)
```
> `db pull` chỉ kéo **cấu trúc** (schema), KHÔNG kéo data khách. An toàn.

## Chạy hằng ngày
```bash
supabase start                 # bật Postgres+Auth+Studio local (lần đầu tải image, hơi lâu)
supabase db reset              # áp migration + seed.sql (data giả) — chạy lại mỗi khi muốn DB sạch
```
- **Studio local:** http://localhost:54323 (xem/sửa data, tạo user test)
- **API local:** http://localhost:54321

Trỏ app vào local — sửa `app-cskh/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key in `supabase start` output>
SUPABASE_SERVICE_ROLE_KEY=<service_role key in `supabase start` output>
ALLOWED_EMAIL_DOMAIN=gwt.vn
```
> Giữ 1 file `.env.local.prod` (trỏ prod) và 1 `.env.local.local` (trỏ local), đổi qua lại. **Đừng commit .env.local.**

Tạo user test: Studio local → Authentication → Add user → email khớp `staff` giả trong `seed.sql` (vd `dev.admin@gwt.vn`) → đăng nhập thử phân quyền.

## Vòng đời một thay đổi DB (local → prod)
1. Viết migration mới: `supabase migration new ten_viec` → sửa file trong `supabase/migrations/`.
2. Test local: `supabase db reset` (áp lại tất cả + seed).
3. Code/UI chạy với DB local đến khi ổn.
4. **Lên prod:** áp file migration đó vào `GWT-SalesTracking` (qua Supabase MCP `apply_migration`, hoặc `supabase db push` nếu đã link). **Không sửa tay schema prod.**

## Nguyên tắc an toàn
- ❌ **Không đổ PII khách thật vào local/seed.** `seed.sql` chỉ data giả.
- ❌ Không commit `.env.local`, không để lộ `service_role`.
- ✅ Mọi thay đổi schema = 1 file migration trong git; test local trước, prod sau.
- ✅ Bật **backup/PITR** cho prod (Dashboard → Database → Backups).
