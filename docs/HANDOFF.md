# HANDOFF — GWT Customer Care (CSKH)

> Tài liệu bàn giao. Cập nhật: 2026-07-28. **Không chứa PII** (an toàn commit).
> Nguồn chi tiết tiến độ: [CHECKLIST.md](CHECKLIST.md) — ⚠️ file đó CÓ tên khách (PII), **không commit**.

## 1. Hệ thống là gì

App nội bộ chăm sóc khách hàng cho máy lọc nước GWT (thương hiệu GE): quản lý khách, máy đã lắp,
bảo hành, lịch thay lõi, ticket lỗi, gói bảo trì. Dùng cho nhân viên CS + kỹ thuật.

- **Frontend/Backend**: `apps/web/` — Next.js 16 (App Router, Server Actions), Tailwind.
- **DB**: Supabase (PostgreSQL). App dùng 2 client (`apps/web/lib/supabase.ts`):
  - `authClient()` — anon key + cookie, CHỈ để biết ai đăng nhập (Supabase Auth).
  - `dataClient()` — service_role, bỏ qua RLS, gọi sau `requireStaff()`. **Không xuống browser.**
- **Scripts di trú/ETL**: `migrate/*.py` (Python, đọc `apps/web/.env.local`).

## 2. Hai project Supabase (QUAN TRỌNG)

| Project | Ref | Vai trò |
|---|---|---|
| **GWT-SalesTracking** | `bwzmqfbcgouhvhoslmmm` | **LIVE hiện tại** — CSKH đã cutover về đây (2026-07-27). Dùng chung Postgres với module Sales (team khác). |
| GWT-Masterdata | `qynpywysgltspmgnhhga` | Nguồn catalog gốc. CSKH **đã rời khỏi đây** (bảng cũ còn để đối chiếu, chưa xoá — Phase 4). |

- Vì sao tách: dữ liệu khách nhạy cảm, không để chung project catalog mà nhiều tool khác đọc.
- 6 bảng catalog ở project mới là **bảng gương** (mirror) copy từ Masterdata. Hiện mirror **thủ công**
  bằng script; **chưa có cron tự động** (việc còn treo).

## 3. Chạy & deploy

**Local dev:**
```bash
cd apps/web && npm install && npm run dev   # http://localhost:3000
```
⚠️ Repo nằm trong **iCloud Drive** → dev server có thể lỗi `npm EPERM: uv_cwd`. Khắc phục bền:
copy repo ra ngoài iCloud (vd `~/code/customer-support`). Vì lý do này, verify trong phiên Claude
làm bằng `npx tsc --noEmit` + truy vấn SQL, **không chạy được preview UI**.

**Vercel (production):**
1. **Root Directory** = `apps/web`.
2. **Environment Variables** (lấy từ Supabase project MỚI):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://bwzmqfbcgouhvhoslmmm.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key (public, xem Dashboard > API)
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role (🔒 Secret)
3. **Tài khoản đăng nhập**: project mới có **0 user Auth ban đầu**. Phải tạo NV ở
   Dashboard > Authentication > Users (bella@/ai@/marketing@/tk@/admin@gwt.vn). Không có tài khoản
   thì đăng nhập fail dù deploy OK.

**Secrets (đều gitignored, KHÔNG commit):**
- `apps/web/.env.local` — cấu hình app (đang trỏ project mới). Backup project cũ: `.env.local.bak-masterdata`.
- `migrate/.env.migrate` — `DEST_URL` + `DEST_SERVICE_KEY` cho script di trú.

## 4. Cấu trúc DB (project mới)

**Bảng CSKH** (đã di trú từ Masterdata):
`cs_customers` (đổi tên từ `customers` để tránh đụng bảng `customers` Sales sắp publish; có thêm cột
`customer_code` để map sang Sales) · `customer_contacts` · `installed_base` (máy đã lắp, self-FK
`parent_serial` cho bộ lọc tổng mẹ/con) · `warranty` · `tickets` · `filter_replacement` ·
`maintenance_plan` · `maintenance_visit` · `issue_group` · `issue_override`.

**Bảng mới thêm trong quá trình làm:**
- `serial_registry` — kho serial xuất xưởng (1.891 serial gộp từ 8 file PO nhà máy), có `internal_code`
  + `ten_noi_bo` map từ catalog. Để quản lý tồn kho / đối chiếu máy đã lắp.
- `staff` — nhân viên (email, ten, vai_tro cs/ky_thuat/quan_ly/admin). Seed 5 người.
- `ticket_note` — nhật ký trao đổi ticket theo thời gian.
- `ticket_muc` — chi phí/vật tư/đổi máy của ticket (loai, so_tien, tinh_phi, serial_cu/moi).

**6 bảng gương catalog** (read-only, mirror): `catalog_item` (khoá "Mã nội bộ", tên "Tên ngắn gọn
(đề xuất)") · `supplier_code` ("Mã đối tác"→"Mã nội bộ") · `catalog_category` · `product_bundle` ·
`product_filter` · `product_warranty`.

**Views app dùng** (đọc qua service_role): `v_installed_base` · `v_tickets` · `v_machine_filter` ·
`v_core_forecast` (lịch thay lõi) · `v_maintenance_due` · `v_issue_report` · `v_ticket_issue` ·
`v_ticket_chua_phan_nhom`. **RPC**: `activate_warranty(p_serial, p_start)`.

**Migrations** (nguồn tái lập ở `db/cs/migrations/`, đã apply qua Supabase MCP):
- `00_init_cskh_project_moi.sql` — schema gốc.
- `01_add_missing_issue_views.sql` — 3 view nhóm lỗi (thiếu lúc di trú).
- `02_ticket_khan_note.sql` — cờ Khẩn + ticket_note.
- `03_ticket_staff_muc.sql` — staff + ticket_muc + người phụ trách.

## 5. Tính năng đã có (app)

- Tra máy đã lắp (`/`), trang máy (`/may/[serial]`): thông tin + bảo hành + lịch thay lõi + ticket của máy + kích hoạt BH.
- Trang khách (`/khach/[id]`): sửa thông tin + liên hệ + **máy đã mua** + ticket của khách.
- Ticket (`/ticket`, `/ticket/[code]`): tìm/lọc (Đang mở/Xong/Huỷ/**Khẩn**/**Việc của tôi**), cờ Khẩn,
  **nhật ký trao đổi** theo thời gian, **chi phí/vật tư/đổi serial**, **người phụ trách CS+KT**, **export CSV**.
- Nhóm lỗi (`/nhom-loi`): gom ticket theo regex mô tả → báo cáo cụm lỗi.
- Lịch thay lõi (`/loi`).

## 6. Gotchas / bài học (đọc trước khi sửa)

- **`CREATE OR REPLACE VIEW`** không cho chèn/đổi tên cột giữa chừng → cột mới phải thêm **ở CUỐI**
  SELECT (xem cách `khan`, `cs_phu_trach`... nằm cuối `v_tickets`).
- **Khớp khách TUYỆT ĐỐI không dùng tên trần** — nhiều khách trùng tên, chỉ phân biệt bằng địa điểm.
  Khoá đúng là **SĐT** (`primary_phone`). (Bài học "2 khách tên Yến".)
- **Serial mẹ/con**: bộ lọc tổng (WH15A/WH30A) có serial mẹ tự sinh + serial con thừa hưởng BH
  (`installed_base.parent_serial`, cột `bh_theo_me` ở view).
- **Serial gõ nhầm `V9l` (l thường) vs `V9I` (I hoa)** trong lô CTD50 — còn vài ca chưa chuẩn hoá.
- **F00000212 = GTEF-30A01-G (Filtration), F00000214 = GTEC-30A01-G (Conditioner)** — nhà máy đã chốt;
  header cột file PO003/PO004 bị dán ngược, Odoo/installed_base đúng. Còn ~20 serial tồn kho 212/214
  trong `serial_registry` chưa điền mã nội bộ (chờ) + 1 serial `GTCN-00X10` chưa có trong catalog.
- **Tên file macOS lưu NFD**; ký tự "đ" (U+0111) KHÔNG tách bằng NFD → phải `.replace("đ","d")` khi so tên.
- **openpyxl**: `ws.cell(r,c,value=None)` KHÔNG xoá ô — phải set `cell.value = None`.
- Script `migrate/di_tru_sang_project_moi.py` có chốt chặn: SOURCE phải là Masterdata (tránh chạy nhầm chiều sau cutover).

## 7. 🔒 BẢO MẬT — quy tắc PII (bắt buộc)

**KHÔNG BAO GIỜ commit PII/thông tin khách** (tên/SĐT/địa chỉ/khiếu nại/hợp đồng/báo cáo CEO).
- Đã gitignore: `/File gốc/`, `/File md/`, `/Hệ thống CRM/`, `/Báo cáo ceo/`, `/GWT_*.xlsx`, `/GWT_*.md`,
  `.env*`, `Phiếu theo dõi/...`.
- **`docs/CHECKLIST.md` CHỨA tên khách → cố ý KHÔNG commit** (chỉ giữ local).
- Trước mỗi commit: `git status` + `git diff --cached --name-only`, **soi** `git diff --cached | grep -E "0[35789][0-9]{8}"`,
  **không bao giờ** `git add -A` / `git add .` mù. Chỉ add đúng thư mục code (`apps/web`, `db/cs`).
- Commit chỉ khi user yêu cầu.

## 8. Việc còn treo (ưu tiên từ trên xuống)

**Cutover & hạ tầng:**
- [ ] Tạo tài khoản Auth cho NV ở project mới (chặn đăng nhập nếu chưa).
- [ ] Edge Function + cron đồng bộ 6 bảng gương catalog (hiện mirror thủ công) + health-check tỉ lệ khớp `v_machine_filter`.
- [ ] Phase 4: buffer read-only 10 bảng CSKH cũ ở Masterdata, theo dõi log ~1-2 tuần, `pg_dump`, rồi mới DROP.

**Tính năng ticket/khách:**
- [ ] Đợt 3: phân quyền thô theo `staff.vai_tro` (xem vs sửa) — cột đã có sẵn, chưa gate ở app.
- [ ] Đợt 3: sửa hàng loạt trạng thái/người phụ trách.
- [ ] Màn hình quản lý `staff` (thêm/sửa NV, thêm kỹ thuật viên — hiện chỉ seed 5, chưa có UI).
- [ ] Đổi máy: hiện chỉ ghi log serial cũ/mới trong `ticket_muc`; chưa tự chuyển hồ sơ+BH sang máy mới.

**Dữ liệu:**
- [ ] 3 máy tồn kho khách không SĐT cần gán tay.
- [ ] Điền mã nội bộ cho ~20 serial tồn kho 212/214 + `GTCN-00X10` trong `serial_registry` (chờ nhà máy/catalog).
- [ ] Sửa tay khách thiếu địa chỉ/SĐT qua `/khach`.

**Tích hợp Sales (Phase 5 — chờ team Sales):**
- [ ] Sales publish 2 bảng `customers` (PII, RLS chặn anon, khoá `customer_code`) + `customer_purchases`.
- [ ] CS chạy script đối chiếu `cs_customers` ↔ `Sales.customers` qua SĐT (gán `customer_code`), đối chiếu máy đã bán.
- Data-contract: `docs/specs/2026-07-24-cs-data-contract.md` + `...-cs-phan-hoi-data-contract.md`.

## 9. Con số nền (2026-07-28, project mới)

cs_customers 299 · installed_base 472 (99 serial con) · warranty 372 · tickets 83 · maintenance_plan 78 ·
maintenance_visit 467 · issue_group 13 · serial_registry 1.891 (1.870 có mã nội bộ) · staff 5.

## 10. Điểm vào nhanh cho dev mới

- Kết nối DB: `apps/web/lib/supabase.ts`. Mọi query qua Server Actions ở `apps/web/app/actions.ts`.
- Trang: `apps/web/app/**/page.tsx`. Component: `apps/web/components/`.
- `apps/web/AGENTS.md`: Next.js bản này khác — bám pattern code sẵn có (async `params`/`searchParams` là Promise).
- Thay đổi schema: viết migration mới ở `db/cs/migrations/NN_*.sql` + apply (Supabase MCP hoặc dashboard).
- Toàn bộ tiến trình & quyết định: `docs/CHECKLIST.md` (local, có PII).
