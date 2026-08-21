# GWT App — webapp nội bộ GWT (monorepo)

**Một** Next.js app phục vụ nhiều module nghiệp vụ, chung đăng nhập / UI / deploy,
chung 1 Postgres. Trước 19/08/2026 repo này tên `customer-support` và chỉ có CSKH.

> 📄 **Phiên/dev mới: đọc [`HANDOFF.md`](HANDOFF.md) trước** — bàn giao toàn app: module, route,
> phân quyền, DB, **bản đồ nhánh + worktree**, việc đang mở, bẫy đã trả giá.

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

## Nhánh · cổng · sao lưu (CEO chốt 21/08/2026)

**Một phiên = một worktree = một nhánh = một cổng.** CEO mở phiên chỉ nói *khu + việc*
(vd: *"phiên này làm khu Sales, việc lọc đơn theo ngày"*); phần còn lại là luật dưới đây.

| | |
|---|---|
| Tên nhánh | `<feat\|fix\|chore\|docs>/<khu>-<việc-ngắn>`, cắt từ `origin/main` mới nhất |
| Tuổi thọ nhánh | **tối đa 3 ngày làm việc.** Quá hạn chưa merge → kéo `main` về, và nói rõ vì sao còn treo |
| Cổng dev theo khu | CSKH `3101–3103` · Sales `3201–3203` · Việc `3301–3303` · Nền tảng `3401` |
| File dùng chung mọi khu | `lib/supabase.ts` · `components/TopNav*.tsx` · `app/actions.ts` · `app/globals.css` — **không hai phiên cùng sửa**. Định đụng thì `wt.sh ds` rồi hỏi trước |

**Không có nhánh dài hạn per-module.** Sales và Việc vẫn merge vào `main` liên tục để khỏi
phân kỳ (đã có lúc lệch 45–56 commit, rất khổ khi gỡ). CEO chốt 21/08 là **không khoá cửa
khu chưa xong** — nên merge xong là **nhân viên nhìn thấy ngay trên production**, kể cả màn
còn dở. Cân nhắc điều đó trước khi merge một khu chưa dùng được.

### Sao lưu: commit là chưa đủ, phải push

Đo ngày 21/08/2026: **31 commit trên 5 nhánh chỉ tồn tại trên ổ máy CEO** — nặng nhất là 20
commit làm lại phân quyền. Commit chỉ lưu vào máy; **chỉ push mới là backup**.

- Push nhánh của mình **cuối mỗi buổi làm**: `git push -u origin <nhánh>`.
- Lưới an toàn tự động: `tools/saoluu_dem.py` chạy **22:00 hằng ngày** (launchd, cài bằng
  `bash tools/cai-lich-saoluu.sh`). Nó quét mọi worktree → qua cửa quét PII → commit → push.
  Nhật ký `~/gwt-worktrees/_saoluu.log`. Nó **không thay** việc tự push: commit nó tạo mang
  nhãn `chore(saoluu)`, là bản sao lưu chứ không phải mốc việc đã xong.
- File mới chưa từng commit: job **chỉ tự thêm file code** trong `apps/ db/ docs/ tools/
  supabase/`. Excel/PDF/ảnh/csv và file lạ chỗ thì nó **không đụng**, chỉ ghi vào log để
  người xem — vì máy quét PII đọc được file chữ, không đọc được ruột file nhị phân.
- Push nhánh **không đẻ bản preview nữa**: `apps/web/vercel.json` có `ignoreCommand`, chỉ
  `main` và nhánh đặt tên `preview/*` mới được Vercel dựng. (Quy ước Vercel ngược trực giác:
  thoát 1 = XÂY, thoát 0 = BỎ QUA.)

### RAM — máy 32 GB và thường xuyên đầy

Đo 21/08: máy đang dùng 31/32 GB. Phiên Claude **rẻ** (~0,25 GB); thứ đắt là mỗi phiên bật
một bản chạy thử riêng (~0,8–1,5 GB lúc biên dịch).

- **Mặc định không phiên nào bật bản chạy thử.** Chỉ bật khi tới lượt mời CEO xem; CEO xem
  xong thì **tắt ngay cổng của mình**. Tối đa **2** bản sống cùng lúc trên cả máy.
- `supabase stop` khi không cần test DB (VM + 12 container, ~1–2 GB, hay bị bỏ chạy cả ngày).
- Worktree đã merge → `bash tools/wt.sh xong <nhánh>` và xoá `.next` + `node_modules`
  (~1 GB mỗi worktree).

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

   **Tài khoản đăng nhập local là QUY ƯỚC CỐ ĐỊNH — CEO chốt 21/08/2026, không phiên nào đổi:**

   | Email | Mật khẩu | Thấy gì |
   |---|---|---|
   | `dev.admin@gwt.vn` | `gwtlocal123` | `admin` — mọi khu: Việc · CSKH · Sales |
   | `dev.sales@gwt.vn` | `gwtlocal123` | `sales` — chỉ Sales (kèm khu Việc, mở cho mọi nhân viên) |

   Mọi worktree cắm **chung một Supabase local**, nên mật khẩu cũng chung. Phiên nào tự đặt
   mật khẩu riêng rồi ghi vào tài liệu của mình là **phiên khác gãy**: đã có lúc cùng một email
   mang 3 mật khẩu, CEO gõ đúng tài liệu vẫn bị chặn. Lệch thì chạy lại
   `bash supabase/seed-prod-masked.sh` (bước 4/4 đặt lại đúng bảng trên).
   Cần vai trò khác để thử phân quyền → tạo email KHÁC trong Studio local, đừng đụng 2 dòng này.
3. **Bật server local từ worktree, cổng riêng** — mỗi phiên một cổng để không đụng nhau:
   ```bash
   cd <worktree>/apps/web && npx next dev -p 3101   # dải cổng theo khu, xem mục 'Nhánh · cổng · sao lưu'
   ```
   Chạy nền, chờ dòng `Ready in`, rồi **đưa CEO đúng đường dẫn `http://localhost:31xx/...`**
   của màn cần xem — đừng bắt CEO tự mò.
   > Khung xem trước tích hợp (`preview_start`) **không mở được worktree ở `~/gwt-worktrees`**
   > (sandbox chặn, `EPERM: uv_cwd`). Dùng lệnh trên. Gặp lỗi này thì đừng bỏ bước local.

   🚫 **TUYỆT ĐỐI KHÔNG `pkill -f "next dev"`** (hay `killall node`). Lệnh đó giết dev server
   của **mọi phiên Claude đang chạy** — kể cả server mà phiên khác vừa đưa CEO vào xem: CEO
   đang bấm thì trang chết, không ai biết vì sao. **Đã xảy ra thật 20/08/2026.**
   Tắt server của mình thì tắt **đúng tiến trình mình tạo** (dừng task nền đã khởi chạy nó),
   hoặc giết **đúng cổng của mình**: `lsof -ti :3200 | xargs kill`.
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
