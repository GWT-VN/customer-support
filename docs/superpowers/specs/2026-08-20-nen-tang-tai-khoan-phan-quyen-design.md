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

1. Danh sách vai trò thật của công ty (13 role, xem §3), thay 6 role hiện có.
2. **Một người kiêm nhiều role** — đúng với DB hiện tại (`staff.vai_tro` là `text[]`).
3. **Trong cùng bộ phận, cấp bậc loại trừ nhau** — không thể vừa `cs_manager` vừa `cs`.
   Khác bộ phận thì kiêm thoải mái (`cs`+`sales`, `cs_manager`+`sales_manager`…) — xem §3.1.
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
| Kế toán | `ke_toan` | — |
| Tài chính | `tai_chinh` | — |

7 role mới: `ceo`, `kt_giam_doc`, `ctv_lap_dat`, `marketing`, `kho`, `ke_toan`, `tai_chinh`
→ tổng **13 role**. GD1 chỉ **thêm vào danh sách** — chưa ai được gán, nên không ai đổi
quyền cho tới khi admin tự tick ở `/nhan-vien`.

### 3.1 Luật loại trừ cấp bậc — chỉ trong CÙNG bộ phận

Loại trừ áp **trong nội bộ một bộ phận**, KHÔNG cắt ngang bộ phận. Công ty nhỏ, kiêm nhiệm
chéo mảng là chuyện bình thường; cái vô lý duy nhất là vừa là trưởng vừa là nhân viên của
đúng mảng đó.

| Tổ hợp | Kết quả |
|---|---|
| `cs` + `sales` | ✅ được (2 người thật đang như vậy) |
| `cs_manager` + `sales_manager` | ✅ được — quản lý cả hai mảng |
| `cs` + `sales_manager` | ✅ được — nhân viên mảng này, trưởng mảng kia |
| `cs` + `cs_manager` | ❌ chặn — cùng bộ phận CS |
| `ky_thuat` + `ctv_lap_dat` | ❌ chặn — cùng bộ phận Kỹ thuật |
| `kt_giam_doc` + `ky_thuat` | ❌ chặn — cùng bộ phận Kỹ thuật |

Cài đặt: mỗi role khai báo `boPhan` + `capBac`. Khi lưu, với mỗi bộ phận chỉ giữ **cấp cao
nhất** người đó có. `admin`/`ceo`/`marketing`/`kho`/`ke_toan`/`tai_chinh` mỗi role một bộ
phận riêng, không có cấp bậc → không bao giờ bị loại trừ.

**Quyền của `ceo`:** mặc định tick sẵn MỌI quyền `*.xem` ở mọi khu; quyền ghi/xoá phải
tick thủ công. CEO thấy toàn bộ công ty nhưng không lỡ tay xoá dữ liệu.

**`ctv_lap_dat`:** admin mời từng người bằng email cá nhân (gmail…) ở `/nhan-vien`.
Có tên trong bảng `staff` thì đăng nhập Google được, không có thì vẫn chặn — đúng luật
hiện tại, KHÔNG nới `DOMAIN_CONG_TY`.

## 4. Dữ liệu thật hiện tại (đọc prod ngày 2026-08-20)

Ràng buộc: `CHECK (vai_tro <@ '{admin,cs_manager,cs,sales_manager,sales,ky_thuat}'::text[])`
→ **bắt buộc có migration** nới danh sách, nếu không insert role mới sẽ lỗi.

10 nhân sự đang hoạt động. **Hai người đang vi phạm luật loại trừ cấp bậc:**
một người `[cs, cs_manager]` → thành `[cs_manager]`; một người
`[cs, sales_manager, cs_manager, admin]` → thành `[sales_manager, cs_manager, admin]`
(giữ nguyên vai trưởng Sales — loại trừ không cắt ngang bộ phận, xem §3.1).
Người giữ `[cs, sales]` và `[ky_thuat, sales]` **không bị đụng** — khác bộ phận.

**Cách xử lý:** chuẩn hoá **khi admin bấm lưu**, KHÔNG migration hàng loạt.
Bỏ role cấp dưới khi đã có role cấp trên trong cùng bộ phận là **không mất quyền nào**
(`cs_manager` bao trùm `cs`: cả `coQuyenQuanLy` lẫn `VAI_TRO_VAO_APP` đều đã cho qua).
Dữ liệu cũ vẫn đọc được bình thường; `chuanHoaVaiTro()` chịu trách nhiệm làm sạch lúc đọc.

## 5. Giai đoạn 1 — gom khu nền tảng dùng chung

Tạo `apps/web/lib/nen-tang/`:

| File | Chứa gì | Lấy từ |
|---|---|---|
| `vai-tro.ts` | 13 role, bộ phận, cấp bậc, luật loại trừ, `chuanHoaVaiTro` | `lib/quyen.ts` (mở rộng) |
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

**Migration (chỉ local):** `db/cs/migrations/50_vai_tro_toan_cong_ty.sql` (46-49 đã bị các nhánh khác chiếm) — nới `chk_vai_tro`
lên 13 role. Không đụng dữ liệu dòng nào.

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

### 6.1 Kho quyền — 45 quyền, chốt với CEO 20/08

Gom từ **149 hàm** thật trong `app/actions.ts`, `app/sales/actions.ts`, `app/work/actions.ts`,
`lib/nen-tang/nhan-su.ts` theo *đối tượng + hành động*. Cột "Mặc định" = **hành vi HÔM NAY**,
dùng làm giá trị khởi tạo ⇒ ngày đầu ma trận khớp 100%, số lệch = 0.

Viết tắt: **A** = Quản trị · **TCS** = Trưởng CSKH trở lên · **CS** = mọi nhân viên vào được khu CS ·
**NS** = mọi nhân sự đang hoạt động.

| Mã quyền | Việc nó mở | Mặc định |
|---|---|---|
| `cs.khach.xem` | Tìm / xem hồ sơ khách, danh sách khách | CS |
| `cs.khach.sua` | Sửa thông tin khách, thêm-xoá liên hệ | CS |
| `cs.khach.xin_xoa` | Gửi yêu cầu xoá khách / máy (chờ duyệt) | CS |
| `cs.khach.gop` | Gộp 2 hồ sơ trùng NGAY, không qua duyệt | TCS |
| `cs.khach.duyet_cho` | Duyệt khách chờ | TCS |
| `cs.khach.xin_xuat` | Xin xuất danh sách khách ra Excel | CS |
| `cs.khach.duyet_xuat` | Duyệt yêu cầu xuất | TCS |
| `cs.khach.xoa_hang_loat` | Xoá nhiều khách một lúc | A |
| `cs.may.xem` | Xem máy, tra serial, lịch sử | CS |
| `cs.may.kich_hoat_bh` | Kích hoạt bảo hành, lắp bộ combo | CS |
| `cs.may.lap_thu_doi` | Lắp / thu hồi / đổi máy cho khách | TCS |
| `cs.serial.kho` | Kho serial: nhập, nhập bảng, đổi trạng thái | TCS |
| `cs.serial.duyet` | Duyệt / từ chối serial chờ | TCS |
| `cs.may.thay_loi` | Ghi / sửa / xoá lần thay lõi | CS |
| `cs.may.trang_thai` | Tạo-sửa-xoá trạng thái máy tuỳ chỉnh | TCS |
| `cs.ticket.xem` | Xem ticket, danh sách, chi tiết | CS |
| `cs.ticket.tao_sua` | Tạo, sửa, nhận ticket, ghi chú | CS |
| `cs.ticket.chi_phi` | Ghi mục / chi phí ticket, thu phí | **CS** ⚠️ |
| `cs.ticket.nhom_loi` | Tạo-sửa-xoá nhóm lỗi, gán ticket vào nhóm | TCS |
| `cs.bao_tri.xem` | Xem lịch bảo trì, lượt tới hạn | CS |
| `cs.bao_tri.ghi_ket_qua` | Đánh dấu đã bảo trì, ghi kết quả đo | CS |
| `cs.bao_tri.tao_plan` | Tạo plan / gán khách / lên lịch → vào hàng **chờ duyệt** | **CS** ⚠️ |
| `cs.bao_tri.duyet_plan` | **Duyệt** plan bảo trì đang chờ | **TCS** ⚠️ mới |
| `cs.ky_thuat.lich_cua_toi` | Xem lịch chuyến của chính mình | NS |
| `cs.ky_thuat.ho_so` | Tạo-sửa-xoá hồ sơ kỹ thuật viên | TCS |
| `cs.ky_thuat.xep_lich` | Xếp lịch chuyến, đặt ngày nghỉ | TCS |
| `cs.ky_thuat.tai_khoan` | Cấp / thu tài khoản đăng nhập cho KTV | A |
| `cs.bao_cao.xuat` | Xuất Excel ticket / máy / bảo trì / lỗi | TCS |
| `cs.bao_cao.doanh_so` | Xem doanh số CSKH | CS |
| `cs.yeu_cau.gui` | Gửi yêu cầu sửa dữ liệu | CS |
| `cs.yeu_cau.duyet` | **Duyệt** yêu cầu sửa dữ liệu | A |
| `cs.yeu_cau.tu_choi` | Xem + **từ chối** yêu cầu sửa dữ liệu | TCS |
| `cs.hang_loat.cap_nhat` | Cập nhật hàng loạt nhiều bản ghi | TCS |
| `work.viec.xem_tao` | Xem + tạo việc, bình luận | NS |
| `work.viec.giao` | Giao việc cho người khác, đổi hàng loạt | NS |
| `work.luat_tu_sinh` | Bật / tắt / chạy tay luật tự sinh việc | TCS |
| `sales.don.xem` | Xem đơn hàng Sales | khu Sales |
| `sales.don.ghi` | Tạo / sửa / xoá đơn Sales | khu Sales |
| `he_thong.nhan_su.xem` | Xem danh sách nhân sự đầy đủ | A |
| `he_thong.nhan_su.sua` | Đổi vai trò, khoá-mở, mời người ngoài | A |
| `he_thong.phan_quyen` | Sửa CHÍNH ma trận này | A |
| `he_thong.nhat_ky` | Xem nhật ký thao tác | A |
| `he_thong.catalog` | Đồng bộ danh mục sản phẩm | A |
| `he_thong.kenh` | Quản lý kênh bán, gán kênh | CS |
| `he_thong.view_chung` | Lưu / xoá view bảng dùng chung | TCS |

**Ba ô ⚠️ là CEO CHỦ ĐỘNG ĐỔI so với hiện trạng** (20/08), không phải sao chép hành vi cũ:

1. `cs.ticket.chi_phi` hạ từ TCS xuống **CS** — nhân viên CSKH ghi chi phí / thu phí được.
2. `cs.bao_tri.tao_plan` hạ từ TCS xuống **CS**, NHƯNG kết quả vào hàng **chờ duyệt**.
3. `cs.bao_tri.duyet_plan` là quyền **MỚI** cho TCS.

⚠️ Điểm 2-3 **KHÔNG phải chỉ là ô tick**: ma trận trả lời *ai được làm gì*, còn *làm xong nằm
chờ duyệt* là cơ chế khác. App đã có mẫu ở 3 chỗ (serial chờ · khách chờ · yêu cầu sửa) nhưng
plan bảo trì thì CHƯA có hàng chờ. Phải dựng thêm luồng đó — **làm SAU khi ma trận xong**, xem §6.3.

Vì ba ô này khác hiện trạng, tab "Lệch" ở GĐ2 sẽ hiện chúng ngay — đó là **kết quả đúng**, và cũng
là phép thử thật cho cơ chế dò lệch. Chúng chỉ có hiệu lực THẬT từ GĐ3.

### 6.1b Đợt 2 — CEO chốt 20/08 (sau khi xem màn ma trận)

**1. Vai trò thứ 14: `quan_tri_ht` — "Quản trị hệ thống" (IT).**
Lo NGƯỜI và CẤU HÌNH, **mù hoàn toàn với dữ liệu nghiệp vụ**. Được: quản lý nhân sự ·
gửi lại mật khẩu · sửa ma trận quyền · nhật ký · đồng bộ danh mục · kênh bán · view bảng ·
cấu hình nhóm lỗi · trạng thái máy. **KHÔNG được**: khách · máy · ticket · bảo trì ·
doanh số · đơn Sales. Tổng 13 quyền.

`admin` giữ nguyên nghĩa **toàn quyền** (đổi nhãn thành "Quản trị toàn quyền") — đó là tài
khoản phá-kính-khẩn-cấp; `quan_tri_ht` mới là tài khoản IT dùng hằng ngày. Hai vai trò cùng
bộ phận Hệ thống nên **loại trừ nhau**: tick admin là tự bỏ quan_tri_ht.

**2. Tách `cs.ticket.nhom_loi` làm đôi** — điều kiện để (1) tồn tại:
`cs.nhom_loi.cau_hinh` (danh mục, IT sửa được) ⊥ `cs.nhom_loi.gan_ticket` (chạm ticket của
khách, IT KHÔNG được).

**3. Thêm `he_thong.nhan_su.mat_khau`** — gửi email đặt lại mật khẩu. Dùng lại đúng luồng
"Quên mật khẩu?" sẵn có; admin KHÔNG bao giờ biết mật khẩu của nhân viên.

⚠️ **Bảng `staff` và `auth.users` là hai thứ khác nhau.** 19 dòng staff trên máy local nhưng
chỉ 2 tài khoản đăng nhập thật — tài khoản chỉ sinh ra khi người đó đăng nhập Google lần đầu
(hoặc admin tạo tay trên Supabase). `resetPasswordForEmail` cố ý báo THÀNH CÔNG cả khi email
không có tài khoản (chống dò email), nên phải hỏi trước qua RPC `public.nen_tang_co_tai_khoan`
— không thì nút này nói dối.

**4. NV Kỹ thuật CHỈ xem lịch chuyến của mình** — từ 19 quyền (y hệt NV CSKH) xuống còn 3.
`ky_thuat` rời khỏi mức mặc định `CS`. Họ VẪN vào được khu CS (`VAI_TRO_VAO_APP` không đổi):
*vào cửa* và *được-làm-gì* là hai chuyện khác nhau.

⇒ Tổng **47 quyền**, **14 vai trò**. Ba thay đổi 1-4 khác hiện trạng nên sẽ hiện ở tab "Lệch",
và chỉ có hiệu lực THẬT từ GĐ3.

**5. Sửa lỗi bảng nhân viên nhảy dòng:** `listAllStaff()` sắp xếp theo `vai_tro`, nên tick một ô
là đổi khoá sắp xếp và dòng nhảy chỗ ngay giữa lúc đang tick. Bỏ `vai_tro` khỏi ORDER BY.

### 6.2 Một điểm lệch sẵn có trong code, CEO cần biết

Trưởng CSKH **xem và TỪ CHỐI** được yêu cầu sửa dữ liệu (`listYeuCauThayDoi`, `tuChoiYeuCau` gác
`laQuanLy`) nhưng **KHÔNG duyệt** được (`duyetYeuCau` gác `laAdmin`). Có thể cố ý (duyệt mới là
thao tác nguy hiểm), có thể là sót. GĐ2 giữ NGUYÊN, tách thành 2 quyền để CEO tự quyết sau.

### 6.3 Luồng "chờ duyệt" cho plan bảo trì — làm sau ma trận

Theo đúng mẫu sẵn có của serial chờ / khách chờ: bản ghi tạo ra ở trạng thái chờ, TCS duyệt thì
mới có hiệu lực. Chưa thiết kế chi tiết — sẽ brainstorm riêng khi tới lượt.

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

### 7.1 GĐ3 đã làm — ghi lại những gì chỉ lộ ra khi bật thật

**1. `doQuyen()` trả boolean là KHÔNG chặn gì cả.** 91 chỗ gọi nó như một câu lệnh
trống (`await doQuyen('...')`), không ai đọc giá trị trả về. Ở GĐ2 vô hại; bật GĐ3
lên thì nó tính ra "cấm" rồi vẫn chạy tiếp. Chỉ lộ khi thử thật bằng tài khoản kỹ
thuật. Sửa: `doQuyen` **đá về trang chủ** (`redirect`), không trả boolean.

Ném lỗi cũng chặn được nhưng người dùng thấy trang trắng *"A server error occurred"* —
đúng cái `requireStaff()` đã cố tránh. Dùng `redirect` cho thống nhất với phần còn lại.

**2. Gác cấp TRANG (12 trang)** đổi sang `chanNeuThieuQuyen(mã, gateCũ)`. Trong lúc
map lộ thêm một lỗ cùng loại với ca kỹ thuật: trang `/doanh-so` gác `laAdmin` nhưng
hàm `doanhSoCskh` phía sau chỉ có `requireStaff` ⇒ nhân viên CS gọi thẳng vẫn ra số.
Hạ `cs.bao_cao.doanh_so` về mức A cho khớp rào của trang.

**3. Biểu ngữ trang phân quyền phải theo trạng thái cầu dao.** Bản đầu ghi cứng
"CHẠY THỬ" — nguy hiểm, vì khi đã bật thật mà màn hình vẫn nói chưa ảnh hưởng ai thì
người dùng tick thoải mái rồi khoá nhầm người.

**Đã kiểm cả hai chiều trên local:** `MA_TRAN_QUYEN=on` → tài khoản chỉ giữ vai
`ky_thuat` bị đá khỏi `/khach-hang` về màn rút gọn; `=off` → vào lại được như cũ và
vẫn ghi lệch. Admin vào đủ 14 trang, không chặn nhầm.

### 7.2 Dọn kèm

Xoá 3 shim `lib/{supabase,auth,quyen}.ts`, chuyển **32 file** sang import thẳng
`lib/nen-tang/*`. 3 file test cũ dời sang `lib/nen-tang/`, mỗi file khác **đúng 2
dòng import** — không khẳng định nào bị đụng.

### 7.3 CÒN NỢ trước khi bật trên production

**Giao diện vẫn ẩn/hiện nút theo LUẬT CŨ** (16 trang + `Sidebar`/`TopNav` gọi
`laAdmin()`/`laQuanLy()`). Hôm nay chưa sai vì giá trị khởi tạo của ma trận trùng
luật cũ — nhưng **ngay khi CEO tick khác đi là lệch**: nút vẫn hiện, bấm vào thì bị
chặn (hoặc ngược lại, nút bị ẩn dù đã được cấp quyền).

Không sửa được bằng một phép thay máy móc: mỗi cờ boolean đang gác NHIỀU nút thuộc
các quyền khác nhau (ví dụ trang ticket dùng chung một cờ cho *sửa hàng loạt* và
*xuất Excel*). Phải tách theo từng nút — một lượt riêng.

## 8. Ngoài phạm vi (YAGNI)

- Ngoại lệ quyền cho từng người (per-person override) — dùng thêm role.
- Vai trò do admin tự khai báo trong DB — xem §6.
- Phân cấp trong bộ phận Kho / Kế toán / Tài chính — CEO nói "chưa phân role".
- Đổi nhà cung cấp đăng nhập, thêm mật khẩu, 2FA.
- Đụng RLS của Supabase — app vẫn đi qua `dataClient()` sau khi đã gác ở tầng app.

## 9. Cách kiểm chứng từng giai đoạn

| GD | CEO check gì |
|---|---|
| 1 | `/nhan-vien` thấy 13 role; gán được `cs`+`sales` cho một người (khác bộ phận thì không chặn); tick `cs_manager` tự bỏ `cs`; mời được 1 email gmail thử; mọi trang CS/Sales/Work vẫn vào đúng như trước |
| 2 | `/nhan-vien/phan-quyen` tick được; tab "Lệch" trống khi chưa sửa gì; cố tình bỏ tick 1 quyền → thấy dòng lệch xuất hiện, nhưng thao tác thật VẪN chạy được |
| 3 | Bỏ tick 1 quyền → thao tác đó bị chặn thật; đặt `MA_TRAN_QUYEN=off` → chạy lại được ngay |
