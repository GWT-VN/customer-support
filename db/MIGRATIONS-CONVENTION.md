# Quy ước Migration — CHỐT 19/08/2026 (đọc trước khi đổi DB)

> Mục tiêu: **local (Supabase CLI) và prod KHÔNG BAO GIỜ lệch schema.**
> Vấn đề cũ: Supabase CLI chỉ đọc `supabase/migrations/`, nhưng migration lịch sử nằm ở
> `db/cs/migrations` (52) + `db/work/migrations` (3) → CLI không thấy → dễ lệch.

## Sự thật kỹ thuật (không cãi được)
- `supabase db reset` / `supabase start` **chỉ áp file trong `supabase/migrations/`**. Không có cách trỏ CLI sang nhiều thư mục (chỉ seed mới đa-đường-dẫn được).
- `supabase/migrations/20250101000000_baseline.sql` = **ảnh chụp TOÀN BỘ schema prod tính đến 19/08/2026** (đã gộp kết quả của cả 52 migration CS + 3 work). Đây là lý do db reset dựng ĐÚNG schema hiện tại.

## Quy ước (áp dụng từ nay)
1. **`supabase/migrations/` là thư mục DUY NHẤT cho migration MỚI.** Local + prod đều lấy từ đây.
2. **Đặt tên file có tiền tố module** để vẫn rõ chủ sở hữu: `20260820_work_them_cot_x.sql`, `20260820_cs_sua_ticket.sql`, `20260820_sales_don_hang.sql`.
3. **`20250101000000_baseline.sql`**: chỉ để dựng LOCAL. **KHÔNG áp lại lên prod** (prod đã có sẵn nội dung này).
4. **`db/cs/migrations/`, `db/work/migrations/`**: **LỊCH SỬ (đã gộp vào baseline)** — đọc tham khảo, **KHÔNG thêm file mới vào đây**. Xem `db/*/migrations/README` (đánh dấu archive).

## Vòng đời 1 migration mới (local → prod)
```bash
# 1. Tạo file trong supabase/migrations/
supabase migration new work_them_cot_ghi_chu     # -> supabase/migrations/<ts>_work_them_cot_ghi_chu.sql
#    (sửa file .sql)

# 2. Áp + test LOCAL (giữ data đang có)
supabase migration up          # KHÔNG dùng db reset nếu muốn giữ data đã nạp

# 3. Áp lên PROD: qua Supabase MCP apply_migration (cùng tên) — nhờ Claude áp.
#    KHÔNG áp baseline lên prod.
```
→ Cùng 1 FILE dùng cho cả local (bước 2) lẫn prod (bước 3) → không lệch.

## Định kỳ gộp baseline (tuỳ chọn, khi supabase/migrations/ nhiều file mới)
```bash
supabase db dump --schema public,work -f supabase/migrations/20250101000000_baseline.sql
# rồi xoá các file migration đã gộp vào baseline (giữ lịch sử ở db/cs, db/work).
```
Giữ local rebuild nhanh + baseline luôn bám prod.

## ⚠️ Lưu ý phối hợp
Layout `db/<module>/migrations/` do phiên restructure đặt. Quy ước này **đặt migration MỚI ở `supabase/migrations/`** (chỗ CLI đọc). Nếu đội muốn giữ nguồn theo module ở `db/<module>/`, cần thêm **script copy `db/*/migrations/*.sql` → `supabase/migrations/`** trước khi `db reset` — nhưng đơn giản nhất là dùng 1 thư mục `supabase/migrations/` + tiền tố tên như trên.
