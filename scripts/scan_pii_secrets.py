#!/usr/bin/env python3
"""Quét secret + PII trước khi lọt vào Git — dùng chung cho pre-commit hook và CI.

Không phụ thuộc gói ngoài (chỉ stdlib). Thoát != 0 nếu có phát hiện.

Chế độ:
  scan_pii_secrets.py --staged            quét file đang staged (pre-commit)
  scan_pii_secrets.py --range A B         quét file thay đổi giữa 2 commit (CI: A...B)
  scan_pii_secrets.py <file...>           quét đúng các file chỉ định

Bắt:
  • BLOCKED PATH  : docs/CHECKLIST.md, mọi .env* (trừ .env.example), migrate/.env.migrate
  • SECRET        : Supabase service_role JWT (giải mã payload, chỉ chặn role=service_role — KHÔNG chặn anon),
                    SUPABASE_SERVICE_ROLE_KEY=<có giá trị>, sb_secret_*, PRIVATE KEY block
  • PII           : số điện thoại VN (0[35789]xxxxxxxx)

Bỏ qua false-positive:
  • ext nhị phân/lockfile/svg/map, thư mục node_modules/.next/.git/.venv
  • dòng có chú thích 'pii-ok' hoặc 'allowlist-secret'
  • số giả '0900000000'
Bỏ qua toàn bộ kiểm tra 1 lần: git commit --no-verify
"""
import base64
import json
import re
import subprocess
import sys

SKIP_EXT = {".svg", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".woff",
            ".woff2", ".ttf", ".eot", ".map", ".lock", ".pdf", ".zip", ".gz",
            ".mp4", ".mov", ".xlsx", ".xls"}
SKIP_NAME = {"package-lock.json", "pnpm-lock.yaml", "yarn.lock"}
SKIP_DIR = ("node_modules/", ".next/", ".git/", ".venv/", "dist/", "build/", "out/")

PHONE = re.compile(r"(?<!\d)0[35789]\d{8}(?!\d)")
JWT = re.compile(r"eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{0,}")
ENV_SR = re.compile(r"SUPABASE_SERVICE_ROLE_KEY\s*=\s*(\S+)")
SB_SECRET = re.compile(r"\bsb_secret_[A-Za-z0-9_-]{5,}")
PRIVKEY = re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")
ALLOW_LINE = ("pii-ok", "allowlist-secret")
# Dải số giả dành riêng cho test/tài liệu (không phải PII): 0900000000–0900000999.
FAKE_PHONE = re.compile(r"^0900000\d{3}$")


def looks_like_key(val: str) -> bool:
    """True nếu VALUE của biến env giống key thật (không phải placeholder <...>)."""
    if not val:
        return False
    if val.startswith(("eyJ", "sb_secret_", "sb_")):
        return True
    # base64/hex dài, không chứa ký tự placeholder
    return len(val) >= 20 and re.fullmatch(r"[A-Za-z0-9_\-.=]+", val) is not None


def jwt_role(tok: str):
    """Giải mã payload JWT lấy 'role' (None nếu không giải mã được)."""
    try:
        payload = tok.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(payload))
        return data.get("role")
    except Exception:
        return None


def skip_file(path: str) -> bool:
    p = path.replace("\\", "/")
    if any(d in p for d in SKIP_DIR):
        return True
    name = p.rsplit("/", 1)[-1]
    if name in SKIP_NAME:
        return True
    dot = name.rfind(".")
    if dot != -1 and name[dot:].lower() in SKIP_EXT:
        return True
    return False


def blocked_path(path: str):
    p = path.replace("\\", "/")
    name = p.rsplit("/", 1)[-1]
    if p.endswith("docs/CHECKLIST.md"):
        return "docs/CHECKLIST.md chứa PII khách — KHÔNG được commit"
    if name == ".env.example":
        return None
    if name == ".env" or name.startswith(".env.") or name.endswith(".env.migrate"):
        return f"{name} có thể chứa secret — KHÔNG được commit (chỉ .env.example)"
    return None


def scan_content(path: str):
    out = []
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
    except (IsADirectoryError, FileNotFoundError):
        return out
    for i, line in enumerate(lines, 1):
        low = line.lower()
        if any(m in low for m in ALLOW_LINE):
            continue
        for tok in JWT.findall(line):
            if jwt_role(tok) == "service_role":
                out.append((i, "SECRET", "service_role JWT"))
        m = ENV_SR.search(line)
        if m and looks_like_key(m.group(1)):
            out.append((i, "SECRET", "SUPABASE_SERVICE_ROLE_KEY có giá trị (giống key thật)"))
        if SB_SECRET.search(line):
            out.append((i, "SECRET", "sb_secret_* key"))
        if PRIVKEY.search(line):
            out.append((i, "SECRET", "PRIVATE KEY block"))
        for ph in PHONE.findall(line):
            if not FAKE_PHONE.match(ph):
                out.append((i, "PII", f"SĐT VN {ph[:4]}****{ph[-2:]}"))
    return out


def candidate_files(argv):
    if "--staged" in argv:
        r = subprocess.run(["git", "diff", "--cached", "--name-only",
                            "--diff-filter=ACM"], capture_output=True, text=True)
        return [x for x in r.stdout.splitlines() if x.strip()]
    if "--range" in argv:
        i = argv.index("--range")
        base, head = argv[i + 1], argv[i + 2]
        r = subprocess.run(["git", "diff", "--name-only", "--diff-filter=ACM",
                            f"{base}...{head}"], capture_output=True, text=True)
        return [x for x in r.stdout.splitlines() if x.strip()]
    return [a for a in argv[1:] if not a.startswith("--")]


def main():
    files = candidate_files(sys.argv)
    findings = []
    for path in files:
        bp = blocked_path(path)
        if bp:
            findings.append((path, 0, "BLOCKED", bp))
        if skip_file(path):
            continue
        for ln, kind, msg in scan_content(path):
            findings.append((path, ln, kind, msg))
    if findings:
        print("\n🚫 QUÉT SECRET/PII — PHÁT HIỆN VẤN ĐỀ:\n")
        for path, ln, kind, msg in findings:
            loc = f"{path}:{ln}" if ln else path
            print(f"  [{kind}] {loc} — {msg}")
        print("\nSửa/loại nội dung trên. Nếu chắc chắn false-positive:")
        print("  • thêm chú thích 'pii-ok' hoặc 'allowlist-secret' vào cuối dòng, hoặc")
        print("  • bỏ qua 1 lần: git commit --no-verify\n")
        return 1
    print("✅ Quét secret/PII: sạch (%d file)." % len(files))
    return 0


if __name__ == "__main__":
    sys.exit(main())
