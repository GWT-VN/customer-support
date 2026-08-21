#!/usr/bin/env python3
"""Sao lưu tự động mọi worktree lên GitHub — chạy 22:00 mỗi ngày.

VÌ SAO: máy CEO không tắt, nhiều phiên Claude làm song song, và người ta quên push.
Đo ngày 21/08/2026: 31 commit trên 5 nhánh chỉ tồn tại trên ổ máy này — nặng nhất là
20 commit làm lại phân quyền. **Commit không phải là backup; chỉ push mới là backup.**

LUẬT PII (quan trọng hơn cả việc backup):
  • KHÔNG BAO GIỜ `git add -A`. File đã theo dõi thì `git add -u`.
  • File MỚI chưa từng commit: chỉ tự thêm nếu nằm trong thư mục code cho phép VÀ có
    đuôi code cho phép. Excel/PDF/ảnh/csv và file lạ chỗ thì KHÔNG đụng — máy quét PII
    đọc được file chữ, không đọc được ruột file nhị phân. Chúng chỉ được ghi vào log
    để sáng hôm sau người xem.
  • Mọi thứ sắp commit đều phải qua tools/scripts/scan_pii_secrets.py. Dính là bỏ
    nguyên worktree đó, không commit.
  • Không bao giờ đụng nhánh `main`.

DÙNG:
    python3 tools/saoluu_dem.py          # chạy thật
    python3 tools/saoluu_dem.py --thu    # chạy thử: chỉ in ra, không commit/push

Lịch chạy: ~/Library/LaunchAgents/vn.gwt.saoluu.plist (cài bằng tools/cai-lich-saoluu.sh)
Nhật ký:   ~/gwt-worktrees/_saoluu.log
"""
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

GOC = Path(__file__).resolve().parent.parent
LOG = Path(os.environ.get("GWT_SAOLUU_LOG", Path.home() / "gwt-worktrees" / "_saoluu.log"))
QUET_PII = GOC / "tools" / "scripts" / "scan_pii_secrets.py"

# Thư mục được phép tự thêm file mới. Ngoài các thư mục này = không đụng.
THU_MUC_OK = re.compile(r"^(apps/|db/|docs/|tools/|supabase/|\.github/)")
# Đuôi file được phép tự thêm. Excel/PDF/ảnh/csv KHÔNG nằm ở đây là có chủ ý.
DUOI_OK = re.compile(r"\.(ts|tsx|js|jsx|mjs|cjs|sql|sh|py|md|css|jsonc?|ya?ml)$")
# File ở GỐC repo thì mặc định không tự thêm (gốc là chỗ data thô hay bị quăng vào).
# Chỉ trừ đúng mấy file dự án quen mặt này. BACKLOG.md/backlog/ đã bị .gitignore chặn.
GOC_OK = {"HANDOFF.md", "CLAUDE.md", "README.md", "AGENTS.md",
          ".gitignore", "vercel.json", "package.json"}


def duoc_tu_them(f):
    """File mới này có được job tự đưa vào commit không?"""
    if "/" not in f:
        return f in GOC_OK
    return bool(THU_MUC_OK.search(f) and DUOI_OK.search(f))

THU = "--thu" in sys.argv
_log_fh = None


def ghi(dong=""):
    print(dong, flush=True)
    if _log_fh:
        _log_fh.write(dong + "\n")
        _log_fh.flush()


def git(wt, *args, kiem=False):
    """Chạy git trong worktree wt. Trả về (ma_thoat, stdout đã strip)."""
    r = subprocess.run(["git", "-C", str(wt), *args],
                       capture_output=True, text=True)
    if kiem and r.returncode != 0:
        ghi(f"      git {' '.join(args)} lỗi: {r.stderr.strip()[:300]}")
    return r.returncode, r.stdout.strip()


def dong(s):
    return [x for x in s.splitlines() if x.strip()]


def worktrees():
    _, out = git(GOC, "worktree", "list", "--porcelain")
    return [l[len("worktree "):] for l in out.splitlines() if l.startswith("worktree ")]


def dang_do_dang(wt):
    """Đang dở merge/rebase/cherry-pick thì đừng chen vào."""
    _, gd = git(wt, "rev-parse", "--git-dir")
    if not gd:
        return True
    p = Path(gd) if Path(gd).is_absolute() else Path(wt) / gd
    return any((p / t).exists() for t in
               ("MERGE_HEAD", "rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD"))


def xu_ly(wt):
    """Trả về (so_commit, so_push, so_can_xem)."""
    ten = Path(wt).name
    if not Path(wt).is_dir():
        ghi(f"⚠️  {wt} — thư mục không còn, bỏ qua")
        return 0, 0, 1

    _, nhanh = git(wt, "rev-parse", "--abbrev-ref", "HEAD")
    if nhanh in ("main", "HEAD", ""):
        ghi(f"·  {ten} [{nhanh or '?'}] — bỏ qua (main hoặc không đứng ở nhánh nào)")
        return 0, 0, 0

    if dang_do_dang(wt):
        ghi(f"⚠️  {ten} [{nhanh}] — đang dở merge/rebase, KHÔNG đụng vào")
        return 0, 0, 1

    ghi("")
    ghi(f"── {ten}  [{nhanh}]")
    commit = push = can_xem = 0

    # 1. File đã theo dõi có thay đổi
    _, a = git(wt, "diff", "--name-only")
    _, b = git(wt, "diff", "--cached", "--name-only")
    da_theo_doi = sorted(set(dong(a)) | set(dong(b)))

    # 2. File mới chưa từng commit — lọc theo thư mục + đuôi
    _, c = git(wt, "ls-files", "--others", "--exclude-standard")
    moi_nhan, moi_bo = [], []
    for f in dong(c):
        (moi_nhan if duoc_tu_them(f) else moi_bo).append(f)

    if moi_bo:
        ghi(f"   ⚠️  {len(moi_bo)} file mới KHÔNG tự thêm "
            f"(sai thư mục hoặc không phải file code) — cần người xem:")
        for f in moi_bo:
            ghi(f"        · {f}")
        can_xem += 1

    if da_theo_doi or moi_nhan:
        if THU:
            ghi(f"   [thử] sẽ commit {len(da_theo_doi)} file đã theo dõi "
                f"+ {len(moi_nhan)} file mới")
        else:
            git(wt, "add", "-u", kiem=True)
            for f in moi_nhan:
                git(wt, "add", "--", f, kiem=True)

            # Cửa PII — dính là bỏ nguyên worktree này
            r = subprocess.run([sys.executable, str(QUET_PII), "--staged"],
                               cwd=wt, capture_output=True, text=True)
            if r.returncode != 0:
                ghi("   ⛔ QUÉT PII PHÁT HIỆN — bỏ staged, KHÔNG commit worktree này:")
                for l in (r.stdout + r.stderr).splitlines()[:20]:
                    ghi(f"        {l}")
                git(wt, "reset", "-q")
                return commit, push, can_xem + 1

            if git(wt, "diff", "--cached", "--quiet")[0] == 0:
                ghi("   ·  không có gì để commit")
            else:
                _, ds = git(wt, "diff", "--cached", "--name-only")
                n = len(dong(ds))
                msg = (f"chore(saoluu): sao lưu tự động "
                       f"{datetime.now():%d/%m/%Y %H:%M}\n\n"
                       f"Commit do job sao lưu 22h tạo, KHÔNG phải mốc việc đã xong.\n"
                       f"Gộp/sửa lại thoải mái ở phiên sau. {n} file.")
                if git(wt, "commit", "-q", "--no-verify", "-m", msg, kiem=True)[0] == 0:
                    ghi(f"   ✅ đã commit {n} file")
                    commit += 1
                else:
                    can_xem += 1
    else:
        ghi("   ·  không có thay đổi")

    # 3. Push
    rc, up = git(wt, "rev-parse", "--abbrev-ref", "@{upstream}")
    if rc != 0 or not up or up == "origin/main":
        can_push = True          # nhánh chưa từng có bản riêng trên GitHub
    else:
        _, n = git(wt, "rev-list", "--count", f"{up}..HEAD")
        can_push = n not in ("0", "")

    if not can_push:
        ghi("   ·  GitHub đã có đủ, không cần push")
    elif THU:
        ghi(f"   [thử] sẽ push {nhanh} lên origin")
    elif git(wt, "push", "-q", "-u", "origin", nhanh, kiem=True)[0] == 0:
        ghi(f"   ✅ đã push {nhanh} lên GitHub")
        push += 1
    else:
        ghi(f"   ⛔ push {nhanh} THẤT BẠI — xem log")
        can_xem += 1

    return commit, push, can_xem


def main():
    global _log_fh
    LOG.parent.mkdir(parents=True, exist_ok=True)
    _log_fh = LOG.open("a", encoding="utf-8")

    ghi("")
    ghi("═" * 63)
    ghi(f"SAO LƯU ĐÊM · {datetime.now():%Y-%m-%d %H:%M:%S}"
        + ("   [CHẠY THỬ]" if THU else ""))
    ghi("═" * 63)

    tc = tp = tx = 0
    for wt in worktrees():
        c, p, x = xu_ly(wt)
        tc, tp, tx = tc + c, tp + p, tx + x

    ghi("")
    ghi("─" * 63)
    ghi(f"XONG {datetime.now():%H:%M:%S} — commit: {tc} · push: {tp} · cần người xem: {tx}")
    ghi("─" * 63)
    _log_fh.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
