#!/usr/bin/env bash
# Bật git hooks của repo (chạy 1 lần sau khi clone).
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
git config core.hooksPath .githooks
chmod +x .githooks/* 2>/dev/null || true
chmod +x scripts/*.py scripts/*.sh 2>/dev/null || true
echo "✅ Đã bật hooks (core.hooksPath=.githooks). Pre-commit sẽ quét secret/PII trên file staged."
