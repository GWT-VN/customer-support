#!/usr/bin/env bash
# ============================================================================
# Nạp DATA THẬT từ production vào DB LOCAL, CHE SĐT (giữ tên/địa chỉ).
# Dùng để có data khối lượng thật cho test. Chạy sau `supabase db reset` (hoặc
# bất cứ lúc nào muốn làm mới data). File dump tạm bị XOÁ ngay (không lưu PII ra đĩa).
#
# CHỈ chạy trên máy dev, chỉ vào LOCAL. Không đụng production (chỉ ĐỌC để dump).
#
# Dùng:  npm run seed:prod        (từ app-cskh/)
#   hoặc: bash supabase/seed-prod-masked.sh   (từ repo root)
#
# Yêu cầu: đã `supabase start` + `supabase link --project-ref bwzmqfbcgouhvhoslmmm`.
# ============================================================================
set -uo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"; cd "$HERE"
DB="supabase_db_gwt-platform"
TMP="supabase/.tmp-prod-data.sql"
# service_role key MẶC ĐỊNH của Supabase local (công khai, giống mọi máy — KHÔNG phải secret prod)
SVC="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"  # allowlist-secret: key demo công khai của Supabase local, giống hệt trên mọi máy

trap 'rm -f "$TMP"' EXIT   # luôn xoá file dump PII, kể cả khi lỗi

docker ps --format '{{.Names}}' | grep -q "$DB" \
  || { echo "❌ Local stack chưa chạy. Chạy trước:  supabase start"; exit 1; }

echo "▶ 1/4  Dump data thật từ prod (schema public)…"
rm -f "$TMP"
supabase db dump --data-only --schema public -f "$TMP" >/dev/null 2>&1
[ -s "$TMP" ] || { echo "❌ Dump thất bại. Đã link chưa?  supabase link --project-ref bwzmqfbcgouhvhoslmmm"; exit 1; }

echo "▶ 2/4  Nạp vào local (tắt FK trigger do circular)…"
{ echo "set session_replication_role=replica;"; cat "$TMP"; } \
  | docker exec -i "$DB" psql -U postgres -d postgres -q -v ON_ERROR_STOP=0 >/dev/null 2>&1

echo "▶ 3/4  Che SĐT (giữ tên)…"
docker exec -i "$DB" psql -U postgres -d postgres -q -v ON_ERROR_STOP=0 < supabase/mask-pii.sql >/dev/null 2>&1

echo "▶ 4/4  Tạo user login local  dev.admin@gwt.vn / local12345 …"
curl -s "http://127.0.0.1:54321/auth/v1/admin/users" \
  -H "apikey: $SVC" -H "Authorization: Bearer $SVC" -H "Content-Type: application/json" \
  -d '{"email":"dev.admin@gwt.vn","password":"local12345","email_confirm":true}' \
  -o /dev/null -w "        (HTTP %{http_code} — 200/422 đều OK, 422 = user đã có)\n"

docker exec "$DB" psql -U postgres -d postgres -tc \
  "select '✅ Xong — khách='||count(*)||' | có SĐT (đã che)='||count(*) filter(where phone is not null) from public.customers;"
echo "   ⚠️  Tên/địa chỉ vẫn THẬT (chỉ SĐT che) → giữ LOCAL, đừng share/commit. Dump tạm đã xoá."
