# Nền tảng tài khoản & phân quyền dùng chung — thiết kế

- **Ngày:** 2026-08-20
- **Nhánh:** `feat/nen-tang-tai-khoan` (cắt từ `main` @543b353), worktree `~/gwt-worktrees/nen-tang-tai-khoan`
- **Trạng thái:** đã chốt với CEO qua brainstorming, chờ duyệt spec trước khi lập kế hoạch thực thi

## 0. Ràng buộc bao trùm

**KHÔNG đụng production.** Mọi migration chỉ áp DB **local**; nhánh chỉ deploy **preview**;
ma trận quyền KHÔNG bật trên prod cho tới khi CEO chốt riêng ở GD3. Không chạy bất kỳ
lệnh ghi nào lên project Supabase `bwzmqfbcgouhvhoslmmm`.

## 1. Vấn đề

Đăng nhập, tài khoản, phân quyền và quản lý nhân viên hiện nằm rải trong code **của module CS**,
nên module khác (Sales, Work, và module sau này) phải phụ thuộc ngược vào CS:

| Chỗ | Nội dung | Vấn đề |
|---|---|---|
| `apps/web/lib/auth.ts` | `xetLuatVaoCua` (CS) + `xetLuatVaoNenTang` (mọi nhân sự) | hai luật vào cửa song song; mỗi khu mới đẻ thêm một hàm |
| `apps/web/lib/quyen.ts` | 6 vai trò phẳng, `coQuyenQuanLy` chỉ hiểu CS | không có khái niệm bộ phận/khu; comment tự thừa nhận "app này là nghiệp vụ CS" |
| `apps/web/lib/supabase.ts` | trộn client Supabase với `requireStaff`/`laAdmin`/`laQuanLy`/`coTheVaoCS`/`coTheVaoSales` | file hạ tầng DB lại là nơi chứa phân quyền |
| `apps/web/app/actions.ts:3093-3202` | quản lý nhân viên nằm trong file CS 4157 dòng | Work/Sales muốn dùng phải import "actions của CS" |

Khối lượng gác quyền hiện tại (đo bằng grep trên `apps/web`):

| Thứ | Số |
|---|---|
| Server action cần gác | 167 |
| Chỗ gọi `laAdmin()` / `laQuanLy()` | 83 |
| Trang gác bằng `chanNeuKhongPhai…` | 24 |
| Chỗ gọi `requireStaff()` | 172 |

## 2. Yêu cầu từ CEO

1. Danh sách vai trò thật của công ty (12 role, xem §3), thay 6 role hiện có.
2. **Một người kiêm nhiều role** — đúng với DB hiện tại (`staff.vai_tro` là `text[]`).
3. **Trong cùng bộ phận, cấp bậc loại trừ nhau** — không thể vừa `cs_manager` vừa `cs`.
4. **Ma trận phân quyền tick được**: gán từng quyền cho từng role qua giao diện.
5. Quyền theo **role**, không có ngoại lệ cho từng người. Cần ngoại lệ thì gán thêm role.
6. Chia **3 giai đoạn**, merge dần, CEO check giữa các giai đoạn.

## 3. Danh sách vai trò

| Bộ phận | Role | Loại trừ nhau |
|---|---|---|
| Điều hành | `ceo` | — |
| Hệ thống | `admin` | — |
| Kỹ thuật | `kt_giam_doc` · `ky_thuat` · `ctv_lap_dat` | có |
| CS | `cs_manager` · `cs` | có |
| Sales | `sales_manager` · `sales` | có |
| Marketing | `marketing` | — |
| Kho | `kho` | — |
| Kế toán / Tài chính | `ke_toan` | — |

6 role mới: `ceo`, `kt_giam_doc`, `ctv_lap_dat`, `marketing`, `kho`, `ke_toan`.
GD1 chỉ **thêm vào danh sách** — chưa ai được gán, nên không ai đổi quyền cho tới khi
admin tự tick ở `/nhan-vien`.

**Quyền của `ceo`:** mặc định tick sẵn MỌI quyền `*.xem` ở mọi khu; quyền ghi/xoá phải
tick thủ công. CEO thấy toàn bộ công ty nhưng không lỡ tay xoá dữ liệu.

**`ctv_lap_dat`:** admin mời từng người bằng email cá nhân (gmail…) ở `/nhan-vien`.
Có tên trong bảng `staff` thì đăng nhập Google được, không có thì vẫn chặn — đúng luật
hiện tại, KHÔNG nới `DOMAIN_CONG_TY`.

## 4. Dữ liệu thật hiện tại (đọc prod ngày 2026-08-20)

Ràng buộc: `CHECK (vai_tro <@ '{admin,cs_manager,cs,sales_manager,sales,ky_thuat}'::text[])`
→ **bắt buộc có migration** nới danh sách, nếu không insert role mới sẽ lỗi.

10 nhân sự đang hoạt động. **Hai người đang vi phạm luật loại trừ cấp bậc:**
một người `[cs, cs_manager]`, một người `[cs, sales_manager, cs_manager, admin]`.

**Cách xử lý:** chuẩn hoá **khi admin bấm lưu**, KHÔNG migration hàng loạt.
Bỏ role cấp dưới khi đã có role cấp trên trong cùng bộ phận là **không mất quyền nào**
(`cs_manager` bao trùm `cs`: cả `coQuyenQuanLy` lẫn `VAI_TRO_VAO_APP` đều đã cho qua).
Dữ liệu cũ vẫn đọc được bình thường; `chuanHoaVaiTro()` chịu trách nhiệm làm sạch lúc đọc.

## 5. Giai đoạn 1 — gom khu nền tảng dùng chung

Tạo `apps/web/lib/nen-tang/`:

| File | Chứa gì | Lấy từ |
|---|---|---|
| `vai-tro.ts` | 12 role, bộ phận, cấp bậc, luật loại trừ, `chuanHoaVaiTro` | `lib/quyen.ts` (mở rộng) |
| `vao-cua.ts` | luật đăng nhập thuần — **một** hàm thay `xetLuatVaoCua`/`xetLuatVaoNenTang`, nhận tham số "khu" | `lib/auth.ts` |
| `phien.ts` | `requireStaff` / `requireNhanSu` / `layNhanVien` | tách khỏi `lib/supabase.ts` |
| `gac-cong.ts` | `chanNeuKhong…` cho trang, `doiQuyen()` cho action | rải rác |
| `nhan-su.ts` | `listStaff`/`listAllStaff`/`suaNhanVien`/`doiTenNhanVien`/`moiNguoiNgoai` | `app/actions.ts:3093-3202` |

`lib/supabase.ts` chỉ còn `authClient()` + `dataClient()`.

**Chống sót chỗ gác:** `requireStaff()` xuất hiện 172 lần. GD1 **giữ nguyên tên hàm cũ và
re-export** từ `lib/supabase.ts`; đổi đường import dần theo module, KHÔNG sửa 172 chỗ trong
một commit. Một chỗ sót = một trang không gác cổng.

**Hai thay đổi hành vi có chủ đích** (ngoài ra không đổi gì):
1. Tick `cs_manager` thì tự bỏ tick `cs` ở `/nhan-vien` (luật §3).
2. Thêm ô "mời người ngoài domain" ở `/nhan-vien` cho CTV lắp đặt.

**Migration (chỉ local):** `db/cs/migrations/48_vai_tro_toan_cong_ty.sql` — nới `chk_vai_tro`
lên 12 role. Không đụng dữ liệu dòng nào.

**Kiểm thử:** `lib/quyen.test.ts`, `lib/auth.test.ts`, `lib/auth-nentang.test.ts`,
`lib/actions-guard.test.ts` giữ nguyên và **phải xanh y nguyên** — đây là refactor, không
sửa test để chiều code. Thêm test cho: luật loại trừ cấp bậc; mời người ngoài domain;
6 role mới không tự nhiên có quyền gì.

## 6. Giai đoạn 2 — dựng ma trận, chạy song song

**GD2 không thay đổi quyền của bất kỳ ai.** Ma trận được dựng, tick, và *hỏi ý kiến*, nhưng
luật quyết định vẫn là `laAdmin()`/`laQuanLy()` cũ. Đây là cách duy nhất dò ô tick sai mà
không khoá nhầm người đang làm việc thật.

**Tên quyền — nguồn sự thật ở CODE**, dạng `khu.đối_tượng.hành_động`:
`cs.khach.xem` · `cs.khach.sua` · `cs.khach.xoa` · `cs.khach.gop` · `cs.ticket.ghi_chi_phi` ·
`cs.serial.duyet` · `work.viec.giao` · `work.luat_tu_sinh.sua` · `nhan_su.xem` ·
`nhan_su.sua_vai_tro` · `he_thong.nhat_ky` · `he_thong.phan_quyen` …

Không cho admin tự thêm mã quyền trong DB: một mã quyền chỉ có nghĩa khi **có chỗ trong code
kiểm tra nó**. Cho gõ tự do là đẻ ra quyền ma — tick vào thấy yên tâm nhưng không gác gì cả.

**DB (chỉ local):**
```sql
create table quyen_vai_tro (
  vai_tro  text not null,
  ma_quyen text not null,
  primary key (vai_tro, ma_quyen)
);
create table nhat_ky_lech_quyen (
  id bigserial primary key, luc timestamptz default now(),
  staff_id uuid, ma_quyen text, luat_cu boolean, ma_tran boolean
);
```

**Giá trị khởi tạo sinh từ luật cũ:** script đọc 83 chỗ gọi `laAdmin()`/`laQuanLy()` và sinh
bảng tick tương đương. Ngày đầu ma trận khớp 100% hành vi hiện tại, số lệch = 0. CEO chỉnh
từ đó — mỗi tick là một khác biệt có chủ đích, không phải dựng lại từ số không.

**Cơ chế dò lệch:** `doiQuyen('cs.khach.xoa')` hỏi cả hai bên, **trả kết quả luật cũ**, ghi
`nhat_ky_lech_quyen` khi ma trận nói khác.

**Màn hình `/nhan-vien/phan-quyen`:** bảng role × quyền có tick, nhóm theo khu, chỉ mở được
với quyền `he_thong.phan_quyen` (mặc định: `admin`). Tab "Lệch" liệt kê: ai · thao tác gì ·
luật cũ cho hay chặn · ma trận nói ngược lại.

## 7. Giai đoạn 3 — bật ma trận làm luật thật

Chỉ chạy khi tab "Lệch" **im lặng vài ngày trên dữ liệu dùng thật**.

- `doiQuyen()` lấy quyết định từ ma trận; gỡ `laAdmin()`/`laQuanLy()` khỏi 83 chỗ gọi.
- **Cầu dao:** biến môi trường `MA_TRAN_QUYEN=off` lật ngược về luật cũ trong 1 phút, không
  cần deploy.
- Hai luật cứng **không bao giờ** đi qua ma trận, giữ trong code (`kiemTraSuaNhanVien`):
  *không tự khoá mình* và *phải còn ít nhất một admin hoạt động*. Tick nhầm không được phép
  khoá chết hệ thống.

## 8. Ngoài phạm vi (YAGNI)

- Ngoại lệ quyền cho từng người (per-person override) — dùng thêm role.
- Vai trò do admin tự khai báo trong DB — xem §6.
- Phân cấp trong bộ phận Kho / Kế toán — CEO nói "chưa phân role".
- Đổi nhà cung cấp đăng nhập, thêm mật khẩu, 2FA.
- Đụng RLS của Supabase — app vẫn đi qua `dataClient()` sau khi đã gác ở tầng app.

## 9. Cách kiểm chứng từng giai đoạn

| GD | CEO check gì |
|---|---|
| 1 | `/nhan-vien` thấy 12 role; tick `cs_manager` tự bỏ `cs`; mời được 1 email gmail thử; mọi trang CS/Sales/Work vẫn vào đúng như trước |
| 2 | `/nhan-vien/phan-quyen` tick được; tab "Lệch" trống khi chưa sửa gì; cố tình bỏ tick 1 quyền → thấy dòng lệch xuất hiện, nhưng thao tác thật VẪN chạy được |
| 3 | Bỏ tick 1 quyền → thao tác đó bị chặn thật; đặt `MA_TRAN_QUYEN=off` → chạy lại được ngay |
