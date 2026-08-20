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

## ⚠️ Quy trình giao việc: LOCAL trước, KHÔNG đẩy CEO sang preview

**CEO duyệt trên máy mình, không duyệt trên preview.** Chốt 20/08/2026.
Preview Vercel build chậm, và nó cắm vào **DB production** — CEO bấm thử là sửa data thật.

Xong một việc thì làm ĐÚNG thứ tự này:

1. **Tự kiểm trước khi gọi.** `npx tsc --noEmit` + `npm run test` + `npm run build` phải sạch.
   Chưa xanh thì chưa được gọi CEO.
2. **Trỏ DB local** — `npm run env:local` (Supabase local 127.0.0.1, có ~425 khách data
   thật đã che PII từ `supabase/seed-prod-masked.sh`). **Tuyệt đối không** đưa CEO xem bản
   đang cắm `.env.local.prod`.
3. **Bật server local từ worktree, cổng riêng** — mỗi phiên một cổng để không đụng nhau:
   ```bash
   cd <worktree>/apps/web && npx next dev -p 3100    # 3200, 3300… cho phiên sau
   ```
   Chạy nền, chờ dòng `Ready in`, rồi **đưa CEO đúng đường dẫn `http://localhost:31xx/...`**
   của màn cần xem — đừng bắt CEO tự mò.
   > Khung xem trước tích hợp (`preview_start`) **không mở được worktree ở `~/gwt-worktrees`**
   > (sandbox chặn, `EPERM: uv_cwd`). Dùng lệnh trên. Gặp lỗi này thì đừng bỏ bước local.
4. **CEO xem, báo lỗi → sửa → CEO F5.** Không rebuild, không chờ deploy.
5. **CEO OK → đối chiếu migration local vs prod** (xem dưới) → merge `main` → production.

### Trước khi merge: đối chiếu migration local vs production

Bẫy đã dính 20/08/2026: migration 46 (`gop_khach`) chạy ngon ở local, prod **chưa có hàm**
— suýt đẩy một nút hỏng lên cho nhân viên. Local xanh **không** có nghĩa prod chạy được.

Việc có đụng `db/*/migrations/` thì trước khi merge phải kiểm hàm/bảng mới đã có trên
prod chưa (Supabase MCP, project `bwzmqfbcgouhvhoslmmm`), thiếu thì áp trước rồi mới merge.

### Khi nào mới dùng preview Vercel

Mặc định **KHÔNG**. Chỉ đề nghị khi có một trong bốn lý do, và **phải nói rõ lý do**:

1. Cần người khác xem (nhân viên, kỹ thuật) — họ không mở được localhost của CEO.
2. Cần xem trên điện thoại.
3. Việc đụng đăng nhập Google / cron / webhook — local không tái hiện được.
4. Cần đúng data production mà bản che PII không tái hiện được.

Dùng preview thì **nói trước cho CEO là nó cắm DB thật**, và nhắc chỗ nào không nên bấm.
