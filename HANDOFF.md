# HAND-OFF — GWT App (toàn bộ)

> **Ai đọc file này:** phiên Claude / dev mới nhận việc trên repo `GWT-App`, **dùng chung thư mục
> hiện tại** với phiên khác. Đọc hết trước khi gõ lệnh đầu tiên — đặc biệt §1 (trạng thái thư mục)
> và §9 (nhánh & worktree), vì đây là chỗ dễ làm hỏng việc của phiên khác nhất.
>
> Cập nhật: **21/08/2026** · Không chứa PII (an toàn commit).
> File này mô tả **cấu trúc + quy ước + trạng thái**. Sự thật SỐNG luôn ở nguồn:
> schema → query DB; tiến độ việc → `BACKLOG.md` + `backlog/<khu>.md`; lịch sử code → `git log`.

---

## 1. Trạng thái THƯ MỤC NÀY (đọc trước tiên)

| | |
|---|---|
| Đường dẫn | `…/GWT - Claude/GWT-App` (trong **iCloud Drive** — xem bẫy §11) |
| Nhánh đang đứng | **`main`** — và phải luôn là `main`. Thư mục này **chỉ để ĐỌC**, không code, không commit (dọn về `main` ngày 21/08) |
| Muốn sửa code | `bash tools/wt.sh ds` → `bash tools/wt.sh moi <nhánh>` → làm ở `~/gwt-worktrees/<tên>`. Luật đầy đủ ở `CLAUDE.md` §*Nhánh · cổng · sao lưu* |
| Chưa commit | không có — giữ nguyên như vậy |
| Cố ý KHÔNG vào git | `BACKLOG.md` + `backlog/` (4 khu) · `data/` · `docs/CHECKLIST.md` · `docs/superpowers/` · `node_modules/`. **21/08 vá `.gitignore`**: trước đó chỉ chặn `/BACKLOG.md`, còn `backlog/` và `node_modules/` gốc repo vẫn lọt ⇒ `git add -A` là dính |
| `main` local | đồng bộ với `origin/main` (dọn 21/08). Vẫn nên `git fetch` đầu phiên trước khi tin |

> 🚨 **Thư mục này đứng ở `main` nên nội dung KHỚP production** — nhưng chỉ khi vừa `git fetch`.
> Đầu phiên cứ `git fetch && git status` rồi mới tin. Muốn chắc chắn thì đọc thẳng `origin/main`:
> ```
> git ls-tree -r --name-only origin/main -- apps/web/app | grep page.tsx
> git show origin/main:<đường/dẫn/file>
> ```

⚠️ **Không `git checkout` ở thư mục này.** Nhánh đang bị worktree khác giữ thì git chặn; nhánh
rảnh thì checkout được nhưng làm hỏng luật *mỗi phiên một worktree* và phiên khác sẽ đọc nhầm (§9).

---

## 2. Hệ thống là gì

**Một** app Next.js 16 (`apps/web`) host **nhiều khu nghiệp vụ** của GWT (máy lọc nước, thương hiệu
GE), chung đăng nhập / nav / design / deploy / **một Postgres**.

| Khu | Route | DB | Trạng thái |
|---|---|---|---|
| **CSKH** | khu gốc (`/`, `/ticket`, `/khach-hang`, `/bao-tri`, `/ky-thuat`…) | schema `public` (`cs_*`, `tickets`, `installed_base`…) | **Production**, dùng thật hằng ngày |
| **Việc (Work)** | `/work`, `/work/team`, `/work/tu-sinh` | schema `work` | Production: schema + việc tự sinh (pg_cron 15′); GĐ1 còn nợ |
| **Sales** | `/sales` + đơn/khách CRUD | `customers`, `sales_orders`, `sales_order_items`, `sales_order_lines`, `customer_purchases` | **Production**: đọc (Lát 1+2) + **ghi bản nền** đã lên; đợt lọc/giá/thanh toán đang làm |
| Kho · Nhân sự · Kế toán · Marketing | chưa có | — | mới là ô xám trong app-launcher |

Trước 19/08/2026 repo tên `customer-support` và chỉ có CSKH → **mọi tài liệu ghi `app-cskh/`,
`supabase-cskh/` đều là đường dẫn CHẾT**. Sales gom vào app này 19–20/08.

**Nguồn sự thật liên đội** (ngoài git, dùng chung với repo `Sales Tracking`):
`../GWT-SHARED/SYSTEM.md` — sở hữu bảng, khoá nối, changelog. Đổi thứ dùng chung → **ghi 1 dòng §8 ở đó**.

### ⚠️ Hai chỗ dễ đọc nhầm về Sales

1. **App Sales CŨ** `Sales Tracking/gwt-sales/` (repo riêng `GWT-VN/gwt-sales-app`, chạy ở
   `gwt-sales-app.vercel.app`) — **đã đóng băng 13/08, không chạy, không sửa, không deploy**.
   Giữ làm bản lưu. Code Sales đang dùng là `apps/web/app/sales/`.
2. **Repo `Sales Tracking`** giờ chỉ còn phần **ngoài app**: Google Sheet, `apps-script/`,
   nạp/đối soát data, Shopee, dashboard. 🚫 Không đụng `apps-script/`, Sheet nguồn, bảng Sales trên
   Supabase, `File gốc/`, `File md/`, `import-staging/`, `scripts/`, `tests/` — công CEO đã tự chỉnh.
   Tên file có "lần 2" ở đó là **hồ sơ khách thật**, không phải file rác iCloud.

---

## 3. Đọc gì, theo thứ tự

1. `CLAUDE.md` (gốc repo) — luật ngắn cho phiên Claude.
2. **File này**.
3. `BACKLOG.md` → `backlog/cskh.md` · `backlog/viec.md` · `backlog/sales.md` · `backlog/nen-tang.md`.
   (`backlog/sales.md` mở đầu bằng bảng phân biệt Sales mới / Sales cũ — đọc trước khi sửa gì về Sales.)
4. `../GWT-SHARED/SYSTEM.md` — nếu đụng bảng/khoá dùng chung.
5. `db/MIGRATIONS-CONVENTION.md` — nếu đụng DB.
6. `docs/LOCAL-DEV.md` + `docs/ONBOARDING-DEV.md` — nếu cần chạy máy.
7. `docs/HANDOFF.md` — bàn giao **riêng CSKH** bản 28/07 (số liệu cũ, gotchas vẫn giá trị).

Hỏi code: repo có `.codegraph/` → `codegraph explore "<câu hỏi>"` **trước** khi grep/đọc file.

---

## 4. Bản đồ thư mục

```
apps/web/               Next.js 16 — app DUY NHẤT
  app/                    route theo khu (thư mục thường, KHÔNG dùng route-group ngoặc)
    actions.ts            ~4k dòng server actions của CSKH  ← file to nhất repo
    sales/                khu Sales: actions.ts + _db/_calc/_types/_ui + OrderForm/CustomerForm
    work/actions.ts       server actions khu Việc
  components/             component CSKH (tên tiếng Việt) + work/ + TopNav*
  bang/                   bộ bảng dùng chung: tìm kiếm, lọc, sắp xếp, phân trang, chọn dòng
  lib/                    supabase.ts (client + gác cổng) · auth.ts · quyen.ts · logic thuần + test
  proxy.ts                chặn sớm chưa-đăng-nhập (KHÔNG phải rào bảo mật)
db/cs/migrations/       LỊCH SỬ migration CS (00 → 50 trên origin/main)
db/work/migrations/     LỊCH SỬ migration Work (work_00 → work_04b trên origin/main)
db/cs/tests/            test SQL (vd 46_gop_khach.test.sql)
supabase/               Supabase CLI cho dev local + **thư mục migration MỚI**
  migrations/19990101000000_extensions.sql · 20250101000000_baseline.sql (ảnh chụp schema prod 19/08)
  seed.sql · mask-pii.sql · seed-prod-masked.sh
docs/                   chung + cs/ sales/ work/ + plans/ specs/
tools/migrate/          ~27 script Python di trú/đối chiếu (đọc apps/web/.env.local)
tools/scripts/          scan_pii_secrets.py · setup-hooks.sh
data/                   data thô — CÓ PII, gitignore
backlog/                hàng đợi việc theo 4 khu (chưa commit)
```

---

## 5. Bản đồ ROUTE đầy đủ (theo `origin/main` = bản chạy production)

**Khu CSKH** — mọi đường không thuộc `/work`, `/sales`

| Route | Việc |
|---|---|
| `/` | Máy đã lắp (trang chủ CS) · `/may/[serial]` chi tiết máy + BH + lõi + ticket |
| `/tong-quan` | Trang tổng quan |
| `/tim` | Tìm nhanh |
| `/serial` | Kho serial xuất xưởng (`serial_registry`), nhập kho, duyệt serial chờ |
| `/khach-hang` · `/khach/[id]` | Danh sách khách · hồ sơ khách |
| `/khach` · `/khach/gop` | Khách cần dọn · **màn gộp khách trùng** |
| `/kenh` | Kênh / đối tác |
| `/ticket` · `/ticket/[code]` · `/tao-ticket` | Ticket lỗi: nhật ký, chi phí/vật tư, người phụ trách, export |
| `/nhom-loi` · `/nhom-loi/[code]` · `/nhom-loi/moi` | Gom ticket theo regex → báo cáo cụm lỗi |
| `/dang-ky-bh` · `/lap-bo` · `/bh-cho-kich-hoat` | Kích hoạt BH máy lẻ / bộ combo / hàng chờ |
| `/bao-tri` · `/bao-tri/map` · `/bao-tri/len-lich` | Lịch bảo trì · map khách cho plan · lên lịch & gói |
| `/loi` | Lịch thay lõi |
| `/ky-thuat` · `/ky-thuat/lich` · `/ky-thuat/nhan-su` · `/ky-thuat/cua-toi` | Gán lịch KT · xem lịch/điều phối · danh sách KT · **màn rút gọn cho KT hiện trường** |
| `/can-don` | Dữ liệu cần dọn |

**Khu Sales** — `apps/web/app/sales/` (18 file)

| Route | Việc |
|---|---|
| `/sales` | Danh sách đơn — **gộp 2 nguồn**: `sales_order_lines` (mirror từ Google Sheet) + `sales_orders` (đơn tạo trên app, gắn tag "App"); tab POE/POU/Khác/Tặng, tìm theo mã đơn / tên khách / sản phẩm |
| `/sales/don/[code]` · `/sales/don/[code]/sua` · `/sales/don/moi` | Chi tiết đơn (header + dòng SP + tổng) · sửa/xoá **chỉ đơn App** · tạo đơn, mã tự sinh `YYMMDD-{E\|U\|O}nnn`, DVBT = số lần bảo trì, dòng quà 0đ |
| `/sales/khach` · `/sales/khach/[code]` | Danh sách khách (`KH…` từ Sheet, `KA…` tạo trên app) · **hồ sơ khách 360**: đã mua + máy đã lắp/BH + gói bảo trì + ticket CS |
| `/sales/khach/moi` · `/sales/khach/[code]/sua` | Thêm/sửa khách `KA…`, cảnh báo trùng SĐT; khách `KH…` báo "sửa ở Sheet" |

Nav Sales còn 4 nhãn **"sắp có"**: Báo giá · Hợp đồng · Kênh/đối tác · Doanh số.
Gác cổng khu Sales: `chanSales()` = `requireNhanSu()` + `coTheVaoSales()`, thiếu quyền → `/?loi=khong_du_quyen`.

**Khu Việc** — `/work` (Việc của tôi) · `/work/team` (List + kanban) · `/work/tu-sinh` (luật sinh việc tự động, chỉ cấp quản lý).

**Nền tảng / quản trị** — `/login`, `/auth/callback`, `/auth/doi-mat-khau`, `/duyet` (hàng chờ duyệt),
`/nhan-vien` (admin), `/audit` (nhật ký thao tác, admin), `/dong-bo-catalog` (admin), `/doanh-so` (admin).

Menu ở `components/TopNav.tsx` + `TopNavClient.tsx` (thanh **ngang 2 tầng**: tầng 1 module, tầng 2
trang của module; ⚙️ gom quản trị; app-launcher lưới). Thêm module = thêm 1 phần tử vào mảng `MODULES`.
Spec chung: `../GWT-SHARED/2026-08-19-gwt-nav-shell-spec.md`.

---

## 6. Đăng nhập & phân quyền (chỗ dễ sai nhất)

- **2 client Supabase** (`apps/web/lib/supabase.ts`): `authClient()` = anon + cookie, CHỈ để biết ai
  đăng nhập; `dataClient()` = service_role, **bỏ qua RLS**, chỉ gọi sau khi đã gác cổng, **không bao
  giờ xuống browser**.
- **Luật thuần** (`lib/auth.ts`): `xetLuatVaoCua()` = **khu CS** (cần `admin|cs|cs_manager|ky_thuat`)
  · `xetLuatVaoNenTang()` = **khu nền tảng** (mọi `staff` đang hoạt động → Sales/Marketing vào được
  `/work`, `/sales`). `hoat_dong=false` bị chặn ở mọi khu. Email `@gwt.vn` chưa có hồ sơ → tạo hồ sơ
  **chờ duyệt**, không tự cấp quyền.
- **Vai trò** (`lib/quyen.ts`): `vai_tro` là **mảng** `text[]` — 1 người nhiều vai (admin ·
  cs_manager · cs · sales_manager · sales · ky_thuat). `coQuyenQuanLy()` = admin ‖ cs_manager ·
  `laChiKyThuat()` → ép giao diện rút gọn · `kiemTraSuaNhanVien()` chặn 3 bẫy khoá chết.
- **Gác cổng thực tế**: `requireStaff()` (khu CS) · `requireNhanSu()` (nền tảng) · `coTheVaoSales()`
  (khu Sales) · `chanNeuKhongPhaiAdmin()` / `chanNeuKhongPhaiQuanLy()`. Nhiều `page.tsx` **không tự
  gác** mà gác trong server action nó gọi → **đừng kết luận trang mở toang chỉ vì page.tsx trống**.
- `proxy.ts` chỉ đá sớm người chưa đăng nhập — **không phải rào bảo mật**.
- **Bẫy đã dính:** `TopNav` + trang gốc từng gọi helper cổng-CS → **Sales/Marketing thuần đăng nhập
  xong không vào được trang nào**. Vá bằng `layNhanVienNenTang()`/`quyenNenTang()` (commit `f7a69f5`).
  Thêm helper cổng mới → nhớ tách rõ "cổng CS" vs "cổng nền tảng".
- ⚠️ Nhánh `feat/nen-tang-tai-khoan` đang **viết lại toàn bộ khối này** thành `lib/nen-tang/*`
  (`vai-tro` · `vao-cua` · `phien` · `gac-cong` · `nhat-ky` · `nhan-su` · `ma-tran`), giữ
  `lib/{supabase,auth,quyen}.ts` làm shim re-export. Sửa 3 file này ở nhánh khác = **chắc chắn xung đột**.

---

## 7. Database

- **Prod = Supabase `bwzmqfbcgouhvhoslmmm`** (GWT-SalesTracking, Singapore) — **dùng chung CS + Sales
  + Work**. Project cũ `qynpywysgltspmgnhhga` (Masterdata) chỉ còn là nguồn catalog gốc (giá niêm yết,
  bí danh, mã quốc tế — bảng gương `catalog_item` hiện còn thiếu).
- **Schema/cột: QUERY DB (Supabase MCP), đừng tin mô tả trong doc cũ.**
- **Sở hữu bảng** (chi tiết `SYSTEM.md` §2):

  | Nhóm bảng | Chủ (được GHI) | Bên kia |
  |---|---|---|
  | `customers`, `customer_purchases`, `sales_order*`, `dim_channel`, `company_customers`, catalog gương | **Sales** | CS chỉ ĐỌC |
  | `cs_customers`, `installed_base`, `serial_registry`, `warranty`, `tickets`, `maintenance_*`, `issue_*`, lịch kỹ thuật | **CS** | Sales không đụng |
  | `work.*` | **Work** | đọc chéo `staff`, gắn ERP bằng **soft ref** |
  | `staff` | **DÙNG CHUNG** | đổi phải báo cả hai |

- **Khoá nối:** khách = `customer_code` (canonical = mã CÓ ĐƠN trong `customer_purchases`) ·
  sản phẩm = `internal_code` · kênh = `dim_channel.id` · serial do CS gán lúc lắp (Sales không có serial) ·
  bảo trì = mã `DVBT`, đơn vị **LẦN** (`quantity` = số lần → `maintenance_plan.tong_lan`).
- **Hai nguồn cùng ghi khách:** khách `KH…` đến từ **Google Sheet sync**, khách `KA…` tạo trên app.
  Sửa khách `KH…` phải sửa ở Sheet. Luồng sync Sheet ⇄ app **chưa chốt ai thắng** — việc đang mở.
- **Quy ước migration — CHỐT 19/08** (`db/MIGRATIONS-CONVENTION.md`):
  1. File **MỚI** đặt ở **`supabase/migrations/`**, tên có tiền tố module: `<ts>_cs_…`, `<ts>_work_…`, `<ts>_sales_…`.
  2. `db/cs|work/migrations/` = **LỊCH SỬ**, đã gộp vào `20250101000000_baseline.sql`. **Không thêm file.**
  3. Vòng đời: `supabase migration new` → `supabase migration up` (local) → MCP `apply_migration` (prod).
     **Không áp baseline lên prod.**
  ⚠️ **Thực tế đang lệch:** `origin/main` vẫn có `db/cs/migrations/47–50`, nhánh `feat/gop-khach-man-rieng`
  thêm `51–53`, `feat/work-gd0` chỉ thêm **`work_05`** (`work_03`/`03b`/`04`/`04b` đã có sẵn trên `main`).
  Ai merge thì **dời sang `supabase/migrations/`**, không thì local ≠ prod.
- Đổi **chữ ký RPC** → phải `notify pgrst, 'reload schema';`, không thì PostgREST giữ cache cũ và app
  production gãy **im lặng** (PGRST202). Đã dính một lần với nút Thêm việc.

---

## 8. Chạy · test · deploy

```bash
npm --prefix apps/web run dev        # http://localhost:3000
npm --prefix apps/web run test       # vitest (test ở lib/, bang/, app/sales/_calc.test.ts)
npx --prefix apps/web tsc --noEmit
npm --prefix apps/web run env:local  # .env.local -> Supabase LOCAL
npm --prefix apps/web run env:prod   # .env.local -> PROD (cẩn thận data thật)
```

- **DB local**: `supabase start` + `supabase db reset` (Studio `localhost:54323`, API `:54321`).
  Baseline dựng đúng schema prod, seed là data giả (prod đã che PII) → an toàn.
  Tài khoản test: `dev.admin@gwt.vn`, `dev.sales@gwt.vn`. Chi tiết `docs/LOCAL-DEV.md`.
- **Deploy**: Vercel project `gwt-app`, **Root Directory `apps/web`**, region `sin1`.
  **Push `main` → tự deploy production.** Không có nút bấm tay. → **Không bao giờ commit thẳng `main`.**
  **Push nhánh thường KHÔNG còn đẻ preview** (từ 21/08): `apps/web/vercel.json` có `ignoreCommand`,
  chỉ `main` và nhánh đặt tên `preview/*` mới được dựng. Muốn có preview thật thì đặt tên nhánh
  `preview/<việc>`. (Quy ước Vercel ngược trực giác: thoát **1 = XÂY**, thoát **0 = BỎ QUA**.)
  **2 URL prod là CÙNG MỘT dự án Vercel** (`customer-support-three-puce.vercel.app` là alias cũ, giữ lại
  từ trước khi đổi tên dự án → không ai phải đổi bookmark). Vào cái nào cũng ra cùng một bản code.
  ⚠️ **Đăng nhập ở `gwt-app-ai-9764s-projects…` xong bị ném về `customer-support-three-puce…`** (CEO gặp
  21/08). **Không phải lỗi code** — `app/auth/callback/route.ts` và `app/login/page.tsx` đều dựng URL
  bằng `origin` động, không hard-code domain nào. Nguyên nhân nằm ở **cấu hình Supabase Auth**: domain
  `gwt-app-ai-9764s-projects.vercel.app` chưa có trong **Redirect URLs** allow-list, nên Supabase bỏ
  `redirectTo` và rơi về **Site URL** đang đặt là domain cũ.
  → Sửa ở Supabase Dashboard → Authentication → URL Configuration: đặt **Site URL** = domain chốt làm
  chính, và thêm **cả hai** domain (kèm `/auth/callback`, `/auth/doi-mat-khau`) vào Redirect URLs.
  Chốt xong thì sửa cho thống nhất ở `backlog/cskh.md` + `backlog/sales.md` (đang ghi 2 URL khác nhau).
- **CI** (`.github/workflows/ci.yml`): quét secret/PII trên file thay đổi mỗi PR/push `main`.
  Hook `pre-commit` cài bằng `tools/scripts/setup-hooks.sh`.
- **Sao lưu tự động 22:00** (`tools/saoluu_dem.py`, launchd, cài bằng `tools/cai-lich-saoluu.sh`):
  quét mọi worktree → cửa quét PII → commit `chore(saoluu)` → push. Không đụng `main`. File mới chỉ
  được tự thêm nếu là **file code** trong `apps/ db/ docs/ tools/ supabase/`; Excel/PDF/ảnh/csv thì
  bỏ qua và ghi vào `~/gwt-worktrees/_saoluu.log` cho người xem.
  ⚠️ **Commit không phải backup — chỉ push mới là backup.** 21/08 đo được 31 commit trên 5 nhánh
  chỉ tồn tại trên ổ máy CEO, nặng nhất là 20 commit làm lại phân quyền.
- **Git author bắt buộc `ai@gwt.vn`** — author lạ bị Vercel chặn deploy.
- Rollback: Vercel → Deployments → Promote bản cũ; code → `git revert`.

---

## 9. NHÁNH & WORKTREE (bản đồ đầy đủ)

`origin/main` = `fd20ece` (21/08). "trước/sau" tính so với `origin/main`.
**Mọi nhánh nay đều có bản trên GitHub** — 21/08 đẩy nốt 31 commit trước đó chỉ nằm trên ổ máy này.

### Đang sống — có worktree riêng, **KHÔNG checkout ở thư mục gốc**

| Nhánh | Worktree | trước/sau | Nội dung |
|---|---|---|---|
| `feat/nen-tang-tai-khoan` | `~/gwt-worktrees/nen-tang-tai-khoan` | +20 / −58 | Nền tảng tài khoản/phân quyền GĐ1 → `lib/nen-tang/*`, ma trận 50 quyền, 6 migration `supabase/migrations/2026082*`. Chưa merge, chưa lên prod |
| `feat/gop-khach-man-rieng` | `~/gwt-worktrees/gop-khach-man-rieng` | +3 / −2 | Trang tạo khách `/khach/moi`, chọn kênh 2 cấp, gộp khách; **mig CS 51–53** |
| `feat/work-gd0` | `/private/tmp/claude-501/…/wt-work-gd0` | +2 / −2 | Work GĐ0/GĐ1: bảng team, panel chi tiết, việc tự sinh, mig **`work_05`** |
| `feat/sales-ghi` | `~/gwt-sales-dev` | +2 / −47 | Sales: bộ lọc đơn (multi-chọn tình trạng/thanh toán, chế độ loại trừ, preset ngày) |
| `feat/gop-khach-khop-plan` | *(không còn worktree — mở lại bằng `wt.sh moi`)* | +2 / −40 | Khớp khách cho plan bảo trì từ `source_folder` — `apps/web/lib/khopPlanKhach.ts` + test |

### Nhánh đã xong / đã vào main

| Nhánh | trước/sau | Ghi chú |
|---|---|---|
| `chore/nen-tang-rao-pii` | 0 / 0 | **Đã vào main 21/08.** Rào PII cho `backlog/`, chặn Vercel dựng preview cho nhánh, job sao lưu 22h, luật nhánh/cổng/RAM trong `CLAUDE.md` |
| `docs/nen-tang-handoff` | — | Nhánh của chính lần cập nhật tài liệu này |
| `chore/worktree-per-phien` | 0 / −56 | **Đã vào main từ trước** — `tools/wt.sh` và luật *mỗi phiên một worktree* đã nằm trong `CLAUDE.md` trên `main`. ⚠️ Bản HANDOFF sáng 21/08 ghi "chưa merge" là **SAI**: nó đọc `CLAUDE.md` cũ ở thư mục đang đứng nhánh lệch 38 commit |
| `feat/sales-lat2` | 0 / −57 | Chi tiết đơn + khách 360 + vá nav cho non-CS — đã vào main |
| `feat/sales-module` | 0 / −61 | cũ |
| `feat/sales-only` | +4 / −68 | cũ; 21/08 đã đẩy lên GitHub để khỏi mất |
| `origin/worktree-bao-tri` | 0 / −75 | đã nuốt |
| `origin/dev/kho-anh-google-drive` | +1 / −78 | **Kho ảnh/video qua Google Drive (Đợt 1+2)** — treo, chờ CEO cấu hình Google service account |
| `origin/chore/quy-trinh-test-local` | 0 / −12 | doc: CEO duyệt trên local, không đẩy preview |

### Quy ước nhánh

Luật đầy đủ ở `CLAUDE.md`, mục **Nhánh · cổng · sao lưu**. Tóm tắt:

- `<feat|fix|chore|docs>/<khu>-<việc-ngắn>`, cắt từ `origin/main` mới nhất, **sống tối đa 3 ngày**, merge sớm.
- **Không có nhánh dài hạn per-module** — module tách nhau bằng thư mục + schema, không bằng nhánh.
- Mỗi phiên một worktree, một cổng: CSKH `3101–3103` · Sales `3201–3203` · Việc `3301–3303` · Nền tảng `3401`.
- Push nhánh mình **cuối mỗi buổi**; job `tools/saoluu_dem.py` chạy 22:00 làm lưới an toàn, không thay việc tự push.
- Sales/Việc **vẫn merge main liên tục** và CEO chốt **không khoá cửa** ⇒ merge xong nhân viên thấy ngay trên production.

### Va chạm đã biết
`lib/supabase.ts` · `components/TopNav*.tsx` · `app/actions.ts` là **file dùng chung mọi khu**.
`feat/nen-tang-tai-khoan` đụng cùng `lib/supabase.ts` với nhánh Sales — nhánh nào merge sau phải rebase.

---

## 10. Việc đang mở — đọc ở BACKLOG, đừng chép

`BACKLOG.md` là **chỉ mục 4 khu**; nội dung nằm ở file từng khu (trạng thái lúc viết file này):

| Khu | ⏳ chờ CEO check | 🐞 lỗi | 🔨 đang làm | 📥 ý tưởng | File |
|---|:--:|:--:|:--:|:--:|---|
| CSKH | 17 | 0 | 1 | 0 | `backlog/cskh.md` |
| Việc | 2 | 1 | 1 | 10 | `backlog/viec.md` |
| **Sales** | 11 | 0 | 1 | 8 | `backlog/sales.md` |
| Nền tảng | 5 | 1 | 0 | 6 | `backlog/nen-tang.md` |

**Ghi vào khu nào:** route CS + `db/cs/` → `cskh.md` · `/work*`, `db/work/`, `components/work/` →
`viec.md` · `/sales*`, đơn hàng, khách Sales → `sales.md` · `TopNav*`, `globals.css`,
`lib/supabase.ts`, `tools/`, quy trình, repo → `nen-tang.md`. Việc trải nhiều khu → ghi ở khu **khó
nhất**, khu kia để 1 dòng trỏ sang. Việc **ngoài app** của Sales (Sheet, Apps Script, Shopee,
dashboard) vẫn ở `Sales Tracking/BACKLOG.md`.

**Luật backlog (bắt buộc):** CEO dump ý tưởng → chép nguyên văn vào `📥 Ý TƯỞNG`, không hỏi lại,
không tự làm · Làm xong → chuyển `⏳ CHỜ TÔI CHECK`, ghi rõ **xem ở đâu** + **check gì** ·
**Không bao giờ tự đánh ✅** · CEO báo lỗi → `🐞 LỖI CẦN SỬA` · cập nhật NGAY khi trạng thái đổi.

**Việc lớn đang treo, cần biết ngay:**
- **Sales đợt kế** (thứ tự CEO chốt): lọc đơn → khách mở rộng *(chờ CSKH chốt schema khách dùng chung,
  đã hỏi ở `SYSTEM.md` §8)* → giá niêm yết + KM/chiết khấu *(chờ CEO nạp bảng giá)* → thanh toán nhiều
  đợt → báo giá/hợp đồng/kênh/doanh số.
- **Sales ⇄ CS Phase 2**: CS giao RPC `activate_and_seed(p_order_id)` để Sales gọi khi chốt đơn.
- **Kho ảnh/video Google Drive** — chặn: CEO cấu hình Google.
- **Nền tảng phân quyền GĐ2/GĐ3** — chờ CEO check GĐ1.
- **Kéo thả kanban** khu Việc.

---

## 11. Bẫy đã trả giá (đọc trước khi sửa)

- **PII là luật số 1.** Không commit tên/SĐT/địa chỉ/khiếu nại khách. Không `git add -A`/`git add .`
  mù. Trước commit: `git diff --cached --name-only` + soi `git diff --cached | grep -E "0[35789][0-9]{8}"`.
  `docs/CHECKLIST.md`, `docs/superpowers/`, `data/`, `BACKLOG.md` + `backlog/` **cố ý không commit**
  (đã có trong `.gitignore` — vá 21/08, trước đó `backlog/` vẫn lọt). Commit chỉ khi CEO yêu cầu.
- **Khớp khách TUYỆT ĐỐI không dùng tên trần** — nhiều khách trùng tên, chỉ phân biệt bằng địa điểm.
  Khoá đúng là SĐT (bài học "2 khách tên Yến"). SĐT quá ngắn không tính là bằng chứng.
- **Mã khách trùng**: đã từng có 232 mã chết + 120 mã phải remap về canonical. Trước khi thêm luồng
  tạo khách mới, kiểm trùng SĐT trước.
- **`CREATE OR REPLACE VIEW`** không cho chèn/đổi tên cột giữa chừng → cột mới thêm **ở CUỐI** SELECT.
- **Serial mẹ/con**: bộ lọc tổng (WH15A/WH30A) có serial mẹ tự sinh, serial con thừa hưởng BH
  (`installed_base.parent_serial`).
- **Giao việc cho CEO duyệt = chạy LOCAL, KHÔNG đẩy preview.** Preview Vercel **cắm thẳng DB
  production** → mời CEO vào preview "check thử" là mời CEO bấm nút trên dữ liệu khách thật, mà vòng
  sửa lỗi còn phải commit→push→chờ build. Đúng thứ tự: tsc/test/build sạch → `npm run env:local` →
  `npx next dev -p 31xx` **từ worktree, mỗi phiên một cổng** → đưa CEO **đúng đường dẫn màn cần xem**.
  Chỉ dùng preview khi có lý do rõ (người khác cần xem · xem trên điện thoại · đụng Google OAuth /
  cron / webhook · cần đúng data prod) và **phải nói trước là nó cắm DB thật**.
- **TUYỆT ĐỐI KHÔNG `pkill -f "next dev"` / `killall node`.** Lệnh đó giết dev server của **mọi phiên
  Claude đang chạy**, kể cả server mà phiên khác vừa đưa CEO vào bấm — CEO đang xem thì trang chết,
  không ai biết vì sao. **Đã xảy ra thật 20/08.** Tắt đúng cổng của mình: `lsof -ti :3200 | xargs kill`.
- **Local xanh KHÔNG có nghĩa prod chạy được.** Có đụng migration thì trước khi merge phải kiểm
  hàm/bảng mới **đã có trên prod chưa** (Supabase MCP, `bwzmqfbcgouhvhoslmmm`), thiếu thì áp trước rồi
  mới merge. Bẫy 20/08: migration 46 `gop_khach` xanh ở local, prod chưa có hàm — suýt đẩy một nút
  hỏng cho nhân viên dùng.
- **`revalidatePath('/')`** sau thao tác nặng bắt server dựng lại cả bảng vài nghìn máy → UI treo
  "Đang xử lý…" dù DB đã xong. Revalidate đúng đường dẫn hẹp.
- **iCloud**: repo nằm trong iCloud Drive → đẻ file nhân bản `* 2.*` và có thể gây `npm EPERM: uv_cwd`.
  Worktree để **ngoài** iCloud (`~/gwt-worktrees/`). Chuyển hẳn repo ra ngoài iCloud đang chờ CEO quyết.
  🚨 **ĐỪNG xoá hàng loạt theo tên `* 2.*` — phần lớn KHÔNG phải rác.** Đo 21/08: repo có **17** file
  tên `* 2.*`, **chỉ 4 là rác thật** (`.codegraph/codegraph 2.db`, `.db-wal`, `.db-shm`, `daemon 2.pid`
  — di sản daemon v1.4.1 chết từ 29/07; **đã dọn 21/08**, CodeGraph vẫn chạy bình thường sau khi dọn).
  **13 file còn lại nằm ở `data/File md/` và là HỒ SƠ KHÁCH THẬT** có chữ "lần 2"
  trong tên (ĐNTT/thanh toán/bàn giao **lần 2**, ảnh OCR thứ 2…). Repo `Sales Tracking` cũng vậy.
  **Phép thử đúng** (iCloud chỉ đẻ `X 2.md` khi `X.md` ĐÃ tồn tại) — CEO đã xác nhận kết quả 21/08:
  ```bash
  # với mỗi 'X 2.ext': bản gốc 'X.ext' có tồn tại không? KHÔNG ⇒ tên thật, ĐỪNG xoá
  find "data/File md" -name "* 2.*" -exec sh -c 'b="${1% 2.md}.md"; [ -e "$b" ] && echo "NGHI: $1" || echo "THẬT: $1"' _ {} \;
  ```
  Đo 21/08: **12/13 file không hề có bản gốc**; file thứ 13 có bản gốc nhưng **nội dung khác hẳn**
  (2 lần OCR từ 2 ảnh) ⇒ **0 file nào trong `data/` là rác**. Chỉ xoá khi chứng minh được: thư mục
  RỖNG, hoặc file trùng **byte** với bản gốc.
  *(Con số "138 file" trong tài liệu cũ là số **lịch sử** hôm đổi tên thư mục 19/08 — không phải hiện
  trạng. Đợt dọn 20/08 đã xoá 24 mục, gồm cả `apps/web/app/tim/page 2.tsx` nên ví dụ đó nay đã chết.)*
- **Tên file macOS lưu NFD**; "đ" (U+0111) KHÔNG tách bằng NFD → phải `.replace("đ","d")` khi so tên.
- **Next.js 16 khác bản trong trí nhớ** (`apps/web/AGENTS.md`): `params`/`searchParams` là `Promise`.
  Bám pattern code sẵn có, đọc `node_modules/next/dist/docs/` trước khi sáng tác.

---

## 12. Checklist mở đầu một phiên mới

CEO mở phiên thường chỉ nói **khu + việc** (vd *"khu Sales, việc lọc đơn theo ngày"*).
Phần còn lại là việc của phiên:

1. `git fetch` → `git status` + `bash tools/wt.sh ds` → đối chiếu §9 xem phiên khác đang giữ gì.
2. **Mở worktree riêng cho việc của mình**: `bash tools/wt.sh moi <feat|fix>/<khu>-<việc>` rồi
   `cd` sang đó + `npm --prefix apps/web install`. **Không code ở thư mục gốc.**
3. Đọc `BACKLOG.md` + file khu liên quan → báo CEO 1 dòng: `⏳ N · 🐞 M · 📥 K`.
4. Định sửa file dùng chung (`lib/supabase.ts`, `TopNav*`, `app/actions.ts`, `globals.css`, `staff`,
   catalog) → kiểm nhánh khác có đang sửa không (§9) + đọc `SYSTEM.md`.
5. Đổi DB → migration mới ở `supabase/migrations/`, test **local** trước; trước khi merge phải
   đối chiếu hàm/bảng đã có trên prod chưa.
6. Mời CEO xem → `npm run env:local` + `npx next dev -p <cổng của khu>` (CSKH 31xx · Sales 32xx ·
   Việc 33xx · Nền tảng 34xx). CEO xem xong → **tắt đúng cổng của mình**: `lsof -ti :32xx | xargs kill`.
   🚫 không bao giờ `pkill -f "next dev"`.
7. Xong việc → cập nhật `backlog/<khu>.md` (⏳ CHỜ TÔI CHECK, ghi **xem ở đâu** + **check gì**),
   **không tự đánh ✅**.
8. Đổi thứ dùng chung → thêm 1 dòng `../GWT-SHARED/SYSTEM.md` §8.
9. **Cuối buổi: `git push -u origin <nhánh>`.** Job 22:00 chỉ là lưới an toàn, đừng ỷ vào nó.
10. Nhánh đã merge → `bash tools/wt.sh xong <nhánh>` + xoá `.next`/`node_modules` cho nhẹ máy.
