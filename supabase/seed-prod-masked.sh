#!/usr/bin/env bash
# ============================================================================
# Nạp DATA THẬT từ production vào DB LOCAL, CHE SĐT (giữ tên/địa chỉ).
# Dùng để có data khối lượng thật cho test. Chạy sau `supabase db reset` (hoặc
# bất cứ lúc nào muốn làm mới data). File dump tạm bị XOÁ ngay (không lưu PII ra đĩa).
#
# CHỈ chạy trên máy dev, chỉ vào LOCAL. Không đụng production (chỉ ĐỌC để dump).
#
# Dùng:  npm run seed:prod        (từ apps/web/)
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

echo "▶ 4/4  Tạo/đặt lại 2 tài khoản dev local (mật khẩu CỐ ĐỊNH  gwtlocal123)…"
# CEO chốt 21/08: hai tài khoản này là QUY ƯỚC, không phiên nào được đổi mật khẩu.
# Trước đây chỉ POST tạo mới: user đã tồn tại thì trả 422 và mật khẩu cũ (có thể do
# phiên khác đặt) GIỮ NGUYÊN — CEO gõ đúng mật khẩu trong tài liệu vẫn không vào được.
# Nay: có rồi thì PUT đặt lại, chưa có thì POST tạo. Chạy bao nhiêu lần cũng ra một kết quả.
for EMAIL in dev.admin@gwt.vn dev.sales@gwt.vn; do
  UID_DEV=$(curl -s "http://127.0.0.1:54321/auth/v1/admin/users?per_page=100" \
    -H "apikey: $SVC" -H "Authorization: Bearer $SVC" \
    | python3 -c "import sys,json;d=json.load(sys.stdin);us=d.get('users',d);m=[u['id'] for u in us if u.get('email')=='$EMAIL'];print(m[0] if m else '')")
  if [ -n "$UID_DEV" ]; then
    curl -s -X PUT "http://127.0.0.1:54321/auth/v1/admin/users/$UID_DEV" \
      -H "apikey: $SVC" -H "Authorization: Bearer $SVC" -H "Content-Type: application/json" \
      -d '{"password":"gwtlocal123","email_confirm":true}' \
      -o /dev/null -w "        $EMAIL — đặt lại mật khẩu (HTTP %{http_code})\n"
  else
    curl -s "http://127.0.0.1:54321/auth/v1/admin/users" \
      -H "apikey: $SVC" -H "Authorization: Bearer $SVC" -H "Content-Type: application/json" \
      -d "{\"email\":\"$EMAIL\",\"password\":\"gwtlocal123\",\"email_confirm\":true}" \
      -o /dev/null -w "        $EMAIL — tạo mới (HTTP %{http_code})\n"
  fi
done

docker exec "$DB" psql -U postgres -d postgres -tc \
  "select '✅ Xong — khách='||count(*)||' | có SĐT (đã che)='||count(*) filter(where phone is not null) from public.customers;"
echo "   ⚠️  Tên/địa chỉ vẫn THẬT (chỉ SĐT che) → giữ LOCAL, đừng share/commit. Dump tạm đã xoá."
