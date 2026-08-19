# GWT App — webapp nội bộ GWT (monorepo)

**Một** Next.js app phục vụ nhiều module nghiệp vụ, chung đăng nhập / UI / deploy,
chung 1 Postgres. Trước 19/08/2026 repo này tên `customer-support` và chỉ có CSKH.

## ⚠️ ĐỌC ĐẦU TIÊN — mỗi phiên Claude một worktree riêng

Repo này thường có **nhiều phiên Claude chạy song song**. Hai phiên cùng mở một thư
mục là giẫm chân nhau: phiên A `git checkout` sang nhánh khác trong lúc phiên B đang
sửa dở, commit của B rơi vào nhánh của A, `git add -A` quét luôn file dang dở của
nhau. **19/08/2026 đã suýt commit SĐT khách thật vì đúng chuyện này** (git hook chặn kịp).

**Luật:** thư mục gốc `GWT-App/` chỉ đứng ở `main` để đọc. Muốn sửa code → worktree riêng.

```bash
bash tools/wt.sh ds                  # xem phiên khác đang giữ worktree nào — CHẠY TRƯỚC KHI LÀM GÌ
bash tools/wt.sh moi feat/<viec>     # tạo chỗ làm riêng, in đường dẫn
cd <đường dẫn nó in> && npm --prefix apps/web install
bash tools/wt.sh xong feat/<viec>    # gỡ khi đã merge
```

Vẫn chung một kho git: nhánh, commit, remote dùng chung, chỉ tách thư mục làm việc.
Worktree đặt ở `~/gwt-worktrees/` — **ngoài iCloud**, vì iCloud sync sinh file trùng
kiểu `TopNav 2.tsx` và làm chậm build.

Nếu buộc phải làm ngay trong thư mục gốc: chạy `bash tools/wt.sh ds` trước, thấy có
worktree của người khác thì `git status` + `git branch --show-current` để biết mình
đang đứng ở đâu, và **chỉ `git add` đúng file của mình** — đừng `git add -A`.

## Cấu trúc

```
apps/web/            # Next.js 16 — app DUY NHẤT (host mọi module)
  app/               #   route-group theo module: cskh(gốc) · sales/ · work/
db/<module>/migrations/   # migration từng module (cs, work, …) — xem db/README.md
supabase/            # Supabase CLI cho DEV LOCAL (config.toml, baseline, seed)
docs/                # tài liệu chung (onboarding, local-dev, bảo mật, handoff)
  cs/ sales/ work/   #   tài liệu riêng từng module
tools/migrate/       # script Python di trú / đối chiếu data
tools/scripts/       # tiện ích repo (quét PII, cài git hook)
data/                # data thô + kết quả rà soát — CÓ PII, KHÔNG commit
```

Module mới = **thêm route-group trong `apps/web/app/`** + `db/<module>/migrations/`
+ `docs/<module>/`. Không dựng repo mới. Khuôn 7 bước: `../GWT-SHARED/2026-08-19-gwt-db-va-module-guide.md`.

## ⚠️ ĐỌC TRƯỚC khi đụng thứ dùng chung

Các module chạy trên **cùng 1 DB** và chia sẻ nhiều bảng. Trước khi đụng bảng dùng chung
(`staff`, `customers`, `dim_channel`, catalog), khoá nối (`customer_code`, `internal_code`),
hay tích hợp chéo module — đọc nguồn sự thật chung:

```
../GWT-SHARED/SYSTEM.md
```

- **Schema/dữ liệu = query DB Supabase `bwzmqfbcgouhvhoslmmm`** (Supabase MCP). ĐỪNG tin mô tả cột trong doc cũ.
- **Đổi bảng DÙNG CHUNG** → ghi 1 dòng Changelog trong `SYSTEM.md` + báo module kia TRƯỚC khi chạy migration.
- Không commit PII khách; git author = `ai@gwt.vn`.

## Toolchain Claude (bắt buộc)

Chuẩn chung mọi module: **Superpowers** (skill) + **CodeGraph** (index code) —
luật đầy đủ: `../GWT-SHARED/TOOLCHAIN-CLAUDE.md`.
- Repo này CÓ `.codegraph/` → hỏi code bằng `codegraph explore "<câu hỏi>"` (hoặc MCP `codegraph_explore`) **TRƯỚC** khi grep/đọc file.
- Việc nhiều bước → skill `writing-plans` → `executing-plans`; tính năng mới → `test-driven-development`;
  bug → `systematic-debugging`; trước khi báo xong → `verification-before-completion`.

## Chạy / kiểm tra

```bash
npm --prefix apps/web run dev      # http://localhost:3000
npm --prefix apps/web run test
npx --prefix apps/web tsc --noEmit
```

Dựng máy từ 0: `docs/ONBOARDING-DEV.md` · DB local: `docs/LOCAL-DEV.md`.
Backlog: `BACKLOG.md` (xem `../GWT-SHARED/HUONG-DAN-BACKLOG.md`).
