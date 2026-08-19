#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# user-local.sh — tài khoản đăng nhập cho môi trường LOCAL (Supabase trong Docker)
#
# Vì sao cần: seed.sql chỉ tạo dòng trong bảng `staff`, KHÔNG tạo tài khoản đăng
# nhập. Không có tài khoản thì không bấm thử được luồng có phân quyền (CS thường,
# trưởng CSKH, kỹ thuật…), mọi thứ chỉ verify được tới tầng DB.
#
# KHÔNG DÙNG MẬT KHẨU. Đăng nhập bằng magic link sinh tại chỗ từ service_role key
# của Supabase LOCAL. Không có mật khẩu nào để lộ, để gõ nhầm, hay để quên xoá.
#
# CHỈ CHẠY ĐƯỢC VỚI LOCAL: script tự chặn nếu URL không phải 127.0.0.1/localhost.
#
#   ./tools/user-local.sh tao          # tạo tài khoản đăng nhập cho mọi dev.*@gwt.vn trong staff
#   ./tools/user-local.sh link <email> # in link đăng nhập 1 lần cho email đó
#   ./tools/user-local.sh xem          # liệt kê tài khoản local đang có
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="apps/web/.env.local.dev"
[ -f "$ENV_FILE" ] || { echo "✗ Không thấy $ENV_FILE"; exit 1; }
URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | cut -d= -f2-)
SRK=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$ENV_FILE" | cut -d= -f2-)

# Rào an toàn: tuyệt đối không để script này chạm production.
case "$URL" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "✗ CHẶN: $ENV_FILE đang trỏ '$URL', không phải local. Script này chỉ dành cho local."; exit 1 ;;
esac

api() { curl -s -X "$1" "$URL/auth/v1/admin/$2" -H "apikey: $SRK" -H "Authorization: Bearer $SRK" -H "Content-Type: application/json" ${3:+-d "$3"}; }

case "${1:-}" in
  tao)
    # Lấy đúng các email dev.* đã khai trong staff -> không tự bịa tài khoản lạ.
    EMAILS=$(docker exec supabase_db_gwt-platform psql -U postgres -d postgres -tAc \
      "select email from public.staff where email like 'dev.%@gwt.vn' order by email")
    [ -n "$EMAILS" ] || { echo "✗ Không thấy staff dev.* nào. Chạy 'supabase db reset' trước."; exit 1; }
    for e in $EMAILS; do
      OUT=$(api POST users "{\"email\":\"$e\",\"email_confirm\":true}")
      if echo "$OUT" | grep -q '"id"'; then echo "✓ tạo  $e"
      elif echo "$OUT" | grep -qi 'already been registered\|already exists'; then echo "· đã có $e"
      else echo "✗ lỗi  $e — $OUT"; fi
    done
    echo; echo "Xong. Lấy link đăng nhập:  ./tools/user-local.sh link dev.cs@gwt.vn"
    ;;
  link)
    E="${2:-}"; [ -n "$E" ] || { echo "Dùng: ./tools/user-local.sh link <email>"; exit 1; }
    api POST generate_link "{\"type\":\"magiclink\",\"email\":\"$E\"}" \
      | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('action_link') or d)"
    ;;
  xem)
    docker exec supabase_db_gwt-platform psql -U postgres -d postgres -c \
      "select u.email, s.vai_tro, s.hoat_dong from auth.users u left join public.staff s on s.email=u.email order by u.email;"
    ;;
  *) sed -n '2,20p' "$0"; exit 1 ;;
esac
