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

## Schema nền (baseline) — ĐÃ có sẵn trong repo
`supabase/migrations/` đã có sẵn:
- `19990101000000_extensions.sql` — extensions (`pg_trgm`, `unaccent` ở schema `public`) + role `fdw_masterdata` (baseline có GRANT tới nó).
- `20250101000000_baseline.sql` — **toàn bộ schema prod** (CS `public` + `work` + RPC), chụp bằng `supabase db dump`. **Chỉ schema, KHÔNG có data khách → an toàn PII.**

→ Dev mới **không cần** `db pull`/mật khẩu DB nữa. Chỉ cần `supabase start` (mục dưới) là có đủ schema.

> ⚠️ **zsh:** dán **từng lệnh một**, KHÔNG kèm ghi chú `#...` cùng dòng (zsh mặc định không coi `#` là comment). Bật 1 lần: `echo 'setopt interactive_comments' >> ~/.zshrc`. Luôn `cd` bằng **đường dẫn đầy đủ**.

### Nếu cần TẠO LẠI baseline (khi schema prod đổi nhiều)
`db pull` sẽ vướng vì lịch sử migration prod không khớp local → dùng `db dump`:
```bash
supabase link --project-ref bwzmqfbcgouhvhoslmmm
```
```bash
supabase db dump --schema public,work -f supabase/migrations/20250101000000_baseline.sql
```
> `db dump` chỉ chụp **cấu trúc**. Nếu prod thêm extension/role mới → bổ sung vào `19990101000000_extensions.sql`.

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
