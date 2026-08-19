#!/usr/bin/env bash
# ============================================================================
# wt.sh — mỗi phiên Claude một worktree riêng.
#
# VÌ SAO: nhiều phiên Claude cùng mở một thư mục repo thì chúng giẫm chân nhau —
# phiên A `git checkout` sang nhánh khác trong lúc phiên B đang sửa file, commit
# của B rơi vào nhánh của A, `git add -A` quét luôn file dở dang của nhau (19/08
# đã suýt commit SĐT khách thật vì chuyện này). Worktree cho mỗi phiên một thư
# mục làm việc riêng nhưng vẫn CHUNG một kho git — nhánh, commit, remote dùng chung.
#
# DÙNG:
#   bash tools/wt.sh ds                 # xem phiên nào đang giữ worktree nào
#   bash tools/wt.sh moi <ten-nhanh>    # tạo worktree + nhánh mới, in đường dẫn
#   bash tools/wt.sh xong <ten-nhanh>   # gỡ worktree khi đã merge xong
# ============================================================================
set -euo pipefail

GOC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Worktree để NGOÀI iCloud: iCloud sync sinh file trùng "… 2.tsx" và làm chậm build.
KHO="${GWT_WORKTREE_DIR:-$HOME/gwt-worktrees}"

case "${1:-ds}" in
  ds)
    echo "Worktree đang mở (mỗi dòng = 1 chỗ làm việc):"
    git -C "$GOC" worktree list
    echo
    echo "Thư mục gốc chỉ nên đứng ở 'main'. Muốn code → 'bash tools/wt.sh moi <ten-nhanh>'."
    ;;
  moi)
    NHANH="${2:?Thiếu tên nhánh. Ví dụ: bash tools/wt.sh moi feat/work-gd1}"
    TEN="$(echo "$NHANH" | tr '/' '-')"
    DICH="$KHO/$TEN"
    mkdir -p "$KHO"
    if [ -d "$DICH" ]; then echo "Đã có sẵn: $DICH"; exit 0; fi
    git -C "$GOC" fetch -q origin || true
    if git -C "$GOC" show-ref --verify -q "refs/heads/$NHANH"; then
      git -C "$GOC" worktree add "$DICH" "$NHANH"
    else
      git -C "$GOC" worktree add -b "$NHANH" "$DICH" origin/main
    fi
    # node_modules không nằm trong git -> worktree mới chưa có, phải cài.
    echo
    echo "✅ Worktree: $DICH   (nhánh $NHANH)"
    echo "   cd \"$DICH\" && npm --prefix apps/web install"
    ;;
  xong)
    NHANH="${2:?Thiếu tên nhánh}"
    TEN="$(echo "$NHANH" | tr '/' '-')"
    git -C "$GOC" worktree remove "$KHO/$TEN" && echo "Đã gỡ $KHO/$TEN"
    ;;
  *)
    sed -n '2,20p' "${BASH_SOURCE[0]}"; exit 1 ;;
esac
