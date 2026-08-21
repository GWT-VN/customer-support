#!/usr/bin/env bash
# ============================================================================
# cai-lich-saoluu.sh — đặt lịch chạy tools/saoluu_dem.py mỗi tối.
#
# CEO không tắt máy, thường làm tới 21h → sao lưu lúc 22:00.
# Dùng launchd (không phải cron) vì launchd CHẠY BÙ khi máy vừa thức dậy nếu
# lỡ giờ hẹn — cron thì bỏ luôn lượt đó.
#
# DÙNG:
#   bash tools/cai-lich-saoluu.sh          # cài, chạy 22:00 hằng ngày
#   bash tools/cai-lich-saoluu.sh 21       # đổi sang 21:00
#   bash tools/cai-lich-saoluu.sh --go     # gỡ lịch
#   bash tools/cai-lich-saoluu.sh --chay   # chạy ngay một lượt (kiểm tra)
#
# Nhật ký: ~/gwt-worktrees/_saoluu.log
# ============================================================================
set -uo pipefail

NHAN="vn.gwt.saoluu"
PLIST="$HOME/Library/LaunchAgents/$NHAN.plist"
# Kho git chính (không phải worktree) — script cần đứng ở đó để liệt kê worktree.
CHUNG="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && git rev-parse --git-common-dir)"
GOC="$(cd "$(dirname "$CHUNG")" && pwd)"
SCRIPT="$GOC/tools/saoluu_dem.py"
PY=/usr/bin/python3            # python hệ thống: ổn định nhất cho job nền
LOG="$HOME/gwt-worktrees/_saoluu.log"

case "${1:-}" in
  --go)
    launchctl bootout "gui/$UID/$NHAN" 2>/dev/null
    rm -f "$PLIST"
    echo "✅ Đã gỡ lịch sao lưu."
    exit 0 ;;
  --chay)
    echo "Chạy một lượt ngay bây giờ…"
    exec "$PY" "$SCRIPT" ;;
esac

GIO="${1:-22}"
if ! [ "$GIO" -ge 0 ] 2>/dev/null || [ "$GIO" -gt 23 ]; then
  echo "Giờ không hợp lệ: $GIO (phải 0–23)"; exit 1
fi
[ -f "$SCRIPT" ] || { echo "Không thấy $SCRIPT"; exit 1; }

mkdir -p "$HOME/Library/LaunchAgents" "$(dirname "$LOG")"

cat > "$PLIST" <<PLIST_HET
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$NHAN</string>
  <key>ProgramArguments</key>
  <array>
    <string>$PY</string>
    <string>$SCRIPT</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>$GIO</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST_HET

launchctl bootout "gui/$UID/$NHAN" 2>/dev/null
if launchctl bootstrap "gui/$UID" "$PLIST" 2>/dev/null; then
  echo "✅ Đã đặt lịch sao lưu $GIO:00 hằng ngày."
else
  echo "⛔ launchctl bootstrap thất bại. Thử: launchctl load -w \"$PLIST\""
  exit 1
fi
echo "   Kho git   : $GOC"
echo "   Chạy      : $PY $SCRIPT"
echo "   Nhật ký   : $LOG"
echo "   Gỡ lịch   : bash tools/cai-lich-saoluu.sh --go"
echo "   Chạy thử  : bash tools/cai-lich-saoluu.sh --chay"
launchctl print "gui/$UID/$NHAN" 2>/dev/null | grep -E "state|program" | head -3
