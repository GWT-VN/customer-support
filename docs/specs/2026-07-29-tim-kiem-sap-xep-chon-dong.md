# Tìm kiếm · Sắp xếp · Chọn dòng — bản đã triển khai

> **Ngày:** 2026-07-29 · **Trạng thái:** đã lên `main`, đã deploy Vercel, đã kiểm trên bản chạy thật.
> Phần **§4 Chọn dòng** là **contract cho người viết hành động hàng loạt** (chị Trang) — phần chọn
> đã xong, phần hành động chưa có.
> Không chứa PII (an toàn commit). Kế hoạch gốc: [../plans/2026-07-29-search-filter-sort-phantrang.md](../plans/2026-07-29-search-filter-sort-phantrang.md).

---

## 1. Đã đổi những gì

| Commit | Nội dung |
|---|---|
| `a06ff47` | Tìm tên khách khớp theo **đầu từ** — hết nhiễu Phương/Thương |
| `75325cf` | `/bao-tri` hiểu tiếng Việt + trả lại tìm theo địa chỉ (kèm migration 07) |
| `55a799f` | Cân đệm chip đang lọc |
| `237900e` | Chọn nhiều dòng ở `/ticket` + chip nói rõ đang sắp xếp gì |
| `db750a0` | Ô lọc chốt cứng bề rộng, tự vẽ mũi tên |
| `2db62fb` | Ô lọc Sản phẩm hiện **mã máy** thay vì tên đầy đủ |
| `d487a33` | Nút bỏ sắp xếp, đưa bảng về thứ tự gốc |
| `ee25812` | Chọn dòng cho **tất cả** trang danh sách + tài liệu này |
| `82811c6` | Chọn **tất cả khớp bộ lọc**, không chỉ 50 dòng đang xem |
| `c097034` | Sửa lỗi Supabase cắt còn 1000 dòng mà không báo |
| `145b1f9` | `/serial` + `/bao-tri` thêm phân trang — mọi dòng chọn được đều xem tới được |
| `0230b46` | Tách thành gói dùng lại được ở [`app-cskh/bang/`](../../app-cskh/bang/README.md) |

Toàn bộ phần chung đã tách vào **[`app-cskh/bang/`](../../app-cskh/bang/README.md)** — chép
nguyên thư mục sang project khác là dùng được, chỉ cần sửa `giaoDien.ts` để đổi giao diện.
App này trỏ thẳng vào đó, **không có bản sao** nên không bao giờ lệch.

**Không đụng dữ liệu nghiệp vụ.** Migration 07 chỉ thêm cột sinh sẵn + index (xem §6).
69 test đơn vị, `tsc` + `lint` + `next build` sạch.

---

## 2. Tìm kiếm

### 2.1 Nguyên tắc: chuẩn hoá cả hai đầu

Cột trong DB có bản **bỏ dấu sinh sẵn** (`ten_kd`, `dia_chi_kd`, `section_kd`, `bo_may_kd`),
từ khoá người dùng gõ cũng được bỏ dấu bằng `boDau()` trước khi truy vấn. Nhờ vậy gõ `Hương`
hay `huong` đều ra kết quả y hệt.

⚠️ `boDau()` trong [`lib/timkiem.ts`](../../app-cskh/lib/timkiem.ts) phải khớp **đúng** với hàm
`public.khong_dau()` dưới Postgres. Lệch nhau là gõ ra kết quả rỗng mà không ai hiểu vì sao.

### 2.2 Tên người khớp theo ĐẦU TỪ, không phải chuỗi con

Trước đây dùng `ilike %huong%` nên khớp cả chuỗi con **giữa** từ. Đo trên DB thật: gõ `huong`
ra 41 máy, **21 dòng sai hoàn toàn** — toàn tên Phương / Phượng / Thương / Thường, kể cả một
công ty có chữ "THƯƠNG MẠI" trong tên.

Nay dùng toán tử `imatch` của PostgREST (`~*` của Postgres) với mốc đầu từ `\m`:

| Gõ `huong` | Trước | Sau |
|---|---|---|
| Máy đã lắp | 41 | **20** |
| Ticket | 7 | **4** |
| Khách | 30 | **14** |

Vẫn gõ được **một phần** tên: `\mle thi` khớp "Lê Thị Thu Hường" — mốc chỉ ràng buộc chỗ
**bắt đầu**, phần đuôi vẫn khớp lỏng. Gõ dở tới đâu lọc tới đó.

### 2.3 Cột nào khớp kiểu nào

| Kiểu | Cột | Vì sao |
|---|---|---|
| **Đầu từ** (`imatch` + `\m`) | tên khách, địa chỉ, tên công trình | là TÊN — khớp giữa từ sinh nhiễu |
| **Chuỗi con** (`ilike %…%`) | serial, SĐT, mã ticket, bộ máy, mô tả | là MÃ / văn xuôi — người dùng cố ý gõ mẩu giữa (4 số cuối SĐT, đuôi serial, "15a" trong "WH15A") |

Siết đầu từ cho serial/SĐT sẽ phá đúng thao tác dùng nhiều nhất.

### 2.4 Địa chỉ đã dùng lại được

Tìm theo địa chỉ từng phải gỡ bỏ vì "Phường" bỏ dấu thành `phuong`, chứa chuỗi con `huong`
→ 296/472 dòng nhiễu, 257 dòng trúng **chỉ vì** địa chỉ có chữ "Phường".

Khớp đầu từ diệt đúng nguyên nhân đó: `\mhuong` không khớp `phuong`. Đo lại còn 4 dòng, đều
là đường/phố tên Hương thật. Tổng trang Máy: 20 → 23.

### 2.5 `/bao-tri` trước đây KHÔNG hiểu tiếng Việt

Đây là lỗi nặng nhất được sửa trong đợt này. Migration 06 chỉ bỏ dấu cho `cs_customers`, nên
trang Lịch bảo trì vẫn so nguyên văn: **gõ `nguyen` ra đúng 0 dòng** dù có 18 lượt của khách
họ Nguyễn. Nhân viên gõ xong tưởng không có lịch nào.

Migration 07 thêm cột bỏ dấu cho `maintenance_plan` và `maintenance_visit`. Sau khi sửa:
`nguyen` → **57 lượt**, `15a` → 63 lượt.

### 2.6 ⚠️ BẮT BUỘC thoát ký tự regex

`mauDauTu()` phải thoát ký tự regex trước khi ghép vào truy vấn. Đã thử trên API thật: gõ `[`
mà không thoát thì Postgres báo regex hỏng và PostgREST trả **HTTP 400** — trang **vỡ trắng**,
chứ không phải ra kết quả rỗng. Sau khi thoát: HTTP 200, 0 dòng.

Thứ tự gọi bắt buộc: `chuanHoaTuKhoa()` → `antoanChoOr()` → `mauDauTu()`. `antoanChoOr()` bỏ
dấu phẩy và ngoặc vì PostgREST dùng chúng làm cú pháp `.or()`.

### 2.7 Còn sót: mấy cột vẫn phải gõ đúng dấu

Chưa có cột bỏ dấu riêng nên vẫn so nguyên văn:

- **Mô tả ticket** và **loại ticket** — gõ `thay loi` không ra ticket ghi "thay lõi".
- **`/loi`** (`v_core_forecast`) — `customer_name`, `product_name` chưa có bản bỏ dấu.

Muốn sửa thì làm y hệt migration 07: thêm cột sinh sẵn từ `public.khong_dau()` + index GIN.

---

## 3. Sắp xếp

### 3.1 Cơ chế chung

Bấm tiêu đề → URL thành `?cot=<tên cột>&chieu=asc|desc`, **xoá `trang`** (đổi thứ tự thì về
trang 1), giữ nguyên mọi tham số khác (`q`, `state`, `tt`, `bh`, `sp`…).

- Bấm **cột đang sắp** → đảo chiều. Bấm **cột khác** → nhảy sang, dùng chiều mặc định của cột.
- Mũi tên: **▲** tăng · **▼** giảm · **↕** xám = cột không đang sắp.
- Ô trống **luôn xuống cuối** (`nullsFirst: false`), bất kể chiều nào.
- Cột đang sắp: cả nhãn **đậm + đen + nền trắng**, kèm `aria-sort` và tooltip mô tả lần bấm kế tiếp.

**Chốt chặn injection:** `sapXepHopLe()` lọc qua danh sách trắng `COT_*`. Gõ tay
`?cot=mat_khau` bị bỏ qua, **bỏ luôn cả `chieu`**, rơi về mặc định của trang — không vỡ, không lộ.

**Khoá phụ:** mỗi danh sách thêm một khoá duy nhất sau cột chính, để `.range()` không nhảy/lặp
dòng giữa các trang khi cột chính có nhiều dòng bằng nhau.

### 3.2 Từng trang

| Trang | Cột sắp được | Mặc định | Khoá phụ |
|---|---|---|---|
| `/` Máy đã lắp | Serial · Máy · Khách · Lắp · **Hạn bảo hành** | `install_date` giảm | `serial` |
| `/ticket` | Mã · Ngày · Khách · Trạng thái | `created_at` giảm | `ticket_code` |
| `/loi` Lịch thay lõi | Khách · Máy · **Hạn** | `han_som` **tăng** | `serial` + `filter_code` |
| `/khach` Khách cần dọn | Khách · Tỉnh | `full_name` tăng | `id` |
| `/bao-tri` Lịch bảo trì | **Khách · Đến hạn** | `due_date` tăng | `visit_id` |
| `/nhom-loi`, `/doanh-so`, `/nhan-vien` | *không sắp được* | cố định | — |

`/loi` là trang duy nhất mặc định **tăng dần**, vì việc gấp nhất là cái quá hạn lâu nhất.
Trang này 100 dòng/trang, các trang khác 50. Cả 6 trang danh sách đều có nút chuyển trang.

### 3.3 Hai điều dễ hiểu nhầm ở `/ticket`

**Khẩn luôn xếp TRƯỚC cột bạn chọn.** Câu lệnh đặt `.order('khan')` ở vị trí đầu tiên. Nên
bấm "Ngày" cũng không bao giờ đẩy được một ticket mới nhưng thường lên trên một ticket cũ
đang Khẩn. Chip sắp xếp ghi rõ "Khẩn luôn lên đầu" để không ai tưởng sắp xếp hỏng.

**Cột Trạng thái sắp theo chữ tiếng Anh trong DB**, không theo nhãn tiếng Việt. Giá trị thật
là `Cancel` / `Done` / `Open`, nên tăng dần cho ra **Đã huỷ → Đã xong → Đang mở** — nhìn màn
hình thì thứ tự này vô nghĩa. Chip viết đủ 3 nhãn để người dùng biết trước.

### 3.4 ChipSapXep — nói bằng lời, không chỉ mũi tên

Mũi tên ▲▼ chỉ nói **chiều**, không nói **nghĩa**. ▲ trên cột "Hạn thay lõi" là "quá hạn lâu
nhất trước" hay "còn nhiều thời gian nhất trước"? Đoán sai thì gọi nhầm khách.

Chip đặt ngay trên bảng, viết thẳng:

```
↑ Sắp xếp: Hạn bảo hành · hết bảo hành sớm nhất trước
↓ Sắp xếp: Ngày tạo · mới nhất trước · Khẩn luôn lên đầu
```

Nhãn cột và nghĩa từng chiều khai báo ở `TEN_COT` / `NGHIA_SAP_XEP` trong
[`lib/danhSach.ts`](../../app-cskh/lib/danhSach.ts). Thêm cột sắp mới thì **nhớ khai báo cả hai**,
thiếu thì chip rơi về câu chung chung "tăng dần/giảm dần".

⚠️ Chip đọc `KetQuaTrang.sapXep` — **cột máy chủ đã chốt**, KHÔNG đọc lại URL. Gõ tay
`?cot=mat_khau` thì bảng sắp theo mặc định, chip mà đọc URL sẽ khoe "mat_khau" trong khi bảng
đang sắp cột khác. Nói sai điều đang xảy ra còn tệ hơn không nói.

### 3.5 Nút bỏ sắp xếp

Dấu `×` trên chip bỏ **riêng** cột/chiều, **giữ nguyên** từ khoá và bộ lọc — khác hẳn nút
"Xoá lọc" vốn quét sạch mọi thứ. Người muốn về thứ tự gốc thường vẫn đang cần giữ kết quả lọc.

Nút chỉ hiện khi **thật sự có cái để bỏ**: `sapXepHopLe()` trả thêm cờ `macDinh`, so với **giá
trị** mặc định chứ không phải "URL có `?cot=` hay không". Khác biệt có thật — bấm vòng quanh
rồi quay đúng về thứ tự gốc thì cũng là mặc định; nếu chỉ xét sự có mặt của `?cot=` thì nút
hiện ra nhưng bấm vào không đổi gì, người dùng tưởng nút hỏng.

---

## 4. Chọn dòng — **contract cho phần hành động hàng loạt**

### 4.1 Hiện có gì

[`components/ChonDong.tsx`](../../app-cskh/components/ChonDong.tsx):

- Cột checkbox + ô "chọn tất cả trang này" (có trạng thái chọn-một-phần).
- Thanh đen "Đã chọn N … · Bỏ chọn" hiện khi có ít nhất một dòng.
- Hook `useDaChon()` để lấy danh sách đã chọn.

Đã gắn ở **6 trang**, mỗi trang một khoá dòng riêng:

| Trang | Khoá dòng | Bảng nguồn |
|---|---|---|
| `/` Máy đã lắp | `serial` | `installed_base` |
| `/ticket` | `ticket_code` | `tickets` |
| `/loi` Lịch thay lõi | **`serial` + `filter_code`** | `filter_replacement` |
| `/khach` Khách cần dọn | `id` | `cs_customers` |
| `/bao-tri` Lịch bảo trì | `visit_id` | `maintenance_visit` |
| `/serial` Kho serial | `serial` | `serial_registry` |

⚠️ `/loi` là trường hợp duy nhất cần **khoá ghép**: một máy có nhiều lõi nên riêng `serial`
không định danh được một dòng — dùng khoá trùng là tick một ô sáng nhiều ô. Đúng cặp khoá
đang dùng cho React key và cho khoá phụ phân trang.

### Chọn tất cả khớp bộ lọc

Chọn hết trang → thanh mời **"Chọn tất cả N … khớp bộ lọc"**. Hai bước có chủ ý như
Gmail/GitHub, không âm thầm gom.

Ba điều đáng chú ý về an toàn:

1. **Mốc xoá lựa chọn là CHỮ KÝ BỘ LỌC, không phải danh sách khoá của trang.** Đổi
   lọc/từ khoá/sắp xếp thì xoá; lật trang thì giữ. Lấy khoá trang làm mốc thì chọn tất cả
   472 máy xong lật trang 2 là mất sạch — đúng thứ vừa bấm.
2. **Vượt phạm vi trang thì phải nói ra.** Thanh ghi thêm *"(gồm cả dòng ở trang khác)"*.
   Tai nạn kinh điển của chọn-xuyên-trang là nhìn thấy 3 ô tick rồi bấm, không biết còn 189
   dòng nữa đang được chọn.
3. **Nút "Bỏ chọn" xoá SẠCH** (`xoaHet`), không phải `doiTatCa(false)` vốn chỉ đụng trang
   hiện tại — nếu không, sau khi chọn 472 rồi bỏ chọn sẽ còn sót 422 dòng ngoài tầm mắt.

**Nguyên tắc:** chỉ được mời chọn thứ người dùng **lật tới xem được**. `/serial` từng hiện 50
dòng đầu trên 1.891 mà không có nút chuyển trang — 1.841 dòng vĩnh viễn không xem tới được,
vậy mà vẫn mời "chọn tất cả 1891". `/bao-tri` đúng bệnh (100 trên 467). Sửa gốc là **thêm
phân trang** cho hai trang đó, không phải bỏ nút chọn. Nay cả 6 trang đều phân trang đầy đủ.

Cách lấy khoá: 6 hàm `khoaTatCa*` gọi lại **đúng hàm liệt kê của trang đó** rồi rút khoá.
KHÔNG viết truy vấn lọc riêng — chép bộ lọc làm hai bản thì sớm muộn lệch, lúc đó màn hình
ghi "91 ticket" mà bấm chọn tất cả ra 87 và không ai phát hiện cho tới khi sửa nhầm.

**Ba trang cố ý KHÔNG có chọn dòng**, vì dòng ở đó không phải bản ghi thao tác được:

- `/doanh-so` — mỗi dòng là **tổng theo tháng**, không có bản ghi nào để sửa.
- `/nhom-loi` — mỗi dòng là một **nhóm lỗi** (cụm ticket), không phải một ticket.
- `/nhan-vien` — đã có thao tác riêng từng dòng, và chỉ vài nhân viên nên hàng loạt vô nghĩa.

**Chưa có hành động nào.** Thanh ghi thẳng *"Thao tác hàng loạt đang được bổ sung — hiện chỉ
chọn được"* thay vì để một nút giả: chọn xong mà không làm gì được thì người dùng phải biết
là do **chưa có**, không phải do bấm hỏng.

### 4.2 Ba quyết định đã chốt — đừng đổi mà không bàn lại

**1. KHÔNG giữ lựa chọn khi sang trang / đổi lọc / đổi sắp xếp.**
Giữ qua trang nghe tiện nhưng đó là cách tạo tai nạn: người dùng tưởng đang chọn 10 dòng trên
màn hình, thực tế còn 190 dòng đã chọn ở các trang trước, bấm một phát đổi cả 200. Danh sách
khoá của trang đổi → xoá sạch lựa chọn.

*Chi tiết kỹ thuật:* so sánh chữ ký `khoaTrang` **ngay trong lúc render**, không dùng
`useEffect` — dùng effect sẽ hiện một nhịp với lựa chọn **cũ** trên dữ liệu **mới**.

**2. Chỉ admin thấy ô chọn** (prop `bat`). Đây là **che giao diện cho đỡ rối mắt, KHÔNG phải
phân quyền** — rào thật phải nằm trong Server Action.

**3. Khoá dòng là khoá chính thật** (`ticket_code`), không phải chỉ số mảng — chỉ số đổi nghĩa
mỗi lần sắp xếp lại.

### 4.3 Cắm hành động vào như thế nào

Viết một Client Component, gọi `useDaChon()`, rồi đặt vào `children` của `<ThanhDaChon>`:

```tsx
// components/DoiTrangThaiHangLoat.tsx
'use client'
import { useDaChon } from '@/components/ChonDong'

export function DoiTrangThaiHangLoat() {
  const { daChon, soDong, boChonHet } = useDaChon()
  // daChon = string[] các ticket_code, đúng thứ tự đang hiện trên màn hình
  ...
}
```

```tsx
// app/ticket/page.tsx
<ThanhDaChon nhan="ticket">
  <DoiTrangThaiHangLoat />
</ThanhDaChon>
```

### 4.4 ⚠️ Ba việc BẮT BUỘC trong Server Action

Rút từ audit các đường ghi ngày 2026-07-29 (§5):

**1. Gọi `laAdmin()`.** `updateTicket()` hiện **KHÔNG có rào admin nào** — chỉ có
`requireStaff()`. Dựng bulk lên trên nó mà không thêm rào thì bất kỳ CS nào cũng lật được
200 ticket. Theo đúng mẫu `addTicketItem()` / `deleteTicketItem()`.

**2. Chặn số dòng mỗi lượt** (~200). Mảng khoá đến từ trình duyệt; một request bịa có thể
đẩy vào 5.000 mã và ghi đè cả bảng.

**3. Ghi vết trước/sau vào `ticket_note`.** `updateTicket()` đè thẳng `patch` lên
`state`/`khan`/`cs_phu_trach`/`ky_thuat`, **không lưu giá trị cũ ở đâu cả**. Sửa 1 dòng thì
còn nhớ được; sửa nhầm 50 dòng thì **không có đường lần ngược**. Bảng `ticket_note` đã có sẵn.

Ngoài ra:

- **Hộp xác nhận ghi rõ số dòng** trước khi chạy (đã chốt với user).
- **Danh sách trắng trường được sửa** — đừng đẩy thẳng object từ client vào `.update()`, cùng
  kỷ luật với `sapXepHopLe()`.
- **Một lệnh `.in()`**, không lặp N lượt: DB ở Singapore, 50 dòng = 50 lượt mạng.
- **Báo số dòng THẬT đã đổi**, lấy từ DB chứ không phải số đã chọn. `.in()` có thể trúng ít
  hơn nếu ai đó vừa xoá dòng — báo nhầm là mất niềm tin ngay lần đầu.

### 4.5 Nên làm hành động nào trước

Đếm trên dữ liệu thật (2026-07-29):

| Việc | Số dòng đang chờ |
|---|---|
| Đánh dấu **đã thay lõi** (`/loi` quá hạn) | **282** |
| **Gán người phụ trách** cho ticket chưa có | **91** |
| Bảo trì quá hạn | 33 |
| **Đổi trạng thái** ticket đang mở | **18** |

Món hay được nhắc tên — "sửa hàng loạt trạng thái" — thực ra chỉ động tới 18 dòng.

---

## 5. Audit các đường ghi dữ liệu (nền cho §4)

**21 Server Action có ghi DB. Chỉ 7 có rào admin** (soát lại 2026-07-29 sau khi hệ serial vào
`main` — 4 action serial mới đã thêm 3 chỗ có rào). Mọi đường đụng khách, máy, ticket, bảo trì
vẫn chỉ có `requireStaff()`.

| Hành động | Bảng | Rào quyền | Hoàn tác |
|---|---|---|---|
| `activateWarranty` | `warranty` (RPC) | chỉ nhân viên | ❌ **không có đường huỷ** |
| `updateCustomer` | `cs_customers` | chỉ nhân viên | ghi đè, không lưu giá trị cũ |
| `addContact` | `customer_contacts` | chỉ nhân viên | xoá lại được |
| `deleteContact` | `customer_contacts` | chỉ nhân viên | ❌ **xoá cứng** |
| `markMaintenanceDone` / `unmark` | `maintenance_visit` | chỉ nhân viên | ✅ có cặp đối xứng |
| `logReplacement` | `filter_replacement` | chỉ nhân viên | xoá lại được |
| `deleteReplacement` | `filter_replacement` | chỉ nhân viên | ❌ xoá cứng · **mã chết, không nơi nào gọi** |
| `createTicket` | `tickets` | chỉ nhân viên | — |
| `updateTicket` | `tickets` | chỉ nhân viên | ghi đè, không lưu giá trị cũ |
| `addTicketNote` / `updateTicketNote` | `ticket_note` | chỉ nhân viên | ghi đè |
| `deleteTicketNote` | `ticket_note` | chỉ nhân viên | ❌ **xoá cứng** |
| `createSerialPending` | `serial_pending` | chỉ nhân viên | admin duyệt/từ chối sau |
| `approveSerial` | `serial_registry` (RPC) | **admin** ✅ | đẩy lên kho, không có đường lùi |
| `rejectSerial` | `serial_pending` | **admin** ✅ | đổi lại được |
| `deleteSerialPending` | `serial_pending` | **admin** ✅ | ❌ xoá cứng — **có `confirm()`** ✅ |
| `suaNhanVien`, `doiTenNhanVien` | `staff` | **admin** ✅ | đổi lại được |
| `addTicketItem` | `ticket_muc` | **admin** ✅ | xoá lại được |
| `deleteTicketItem` | `ticket_muc` | **admin** ✅ | ❌ xoá cứng |

### Bốn chỗ nên có hộp xác nhận (chưa có)

1. **Kích hoạt bảo hành** — nguy nhất và đang không ai để ý. Không có hàm huỷ kích hoạt nào
   trong toàn bộ `actions.ts`. Bấm một lần là đồng hồ bảo hành chạy, RPC tính và ghi
   `full_end`/`core_end`. Đây là **cam kết thương mại với khách**, sai ngày phải sửa tay dưới DB.
2. **Ba nút Xoá bấm một phát là mất** — xoá liên hệ, xoá nhật ký, xoá chi phí. Không cột
   soft-delete, không bảng lưu vết.
   Nút xoá liên hệ đáng lo nhất: **SĐT là khoá định danh khách** (bài học "2 khách tên Yến").
   Mẫu đúng để làm theo đã có sẵn: `SerialPendingList` hỏi
   *"Xoá hẳn serial pending này? Không khôi phục được."* trước khi gọi `deleteSerialPending`.
3. **`updateTicket` không lưu giá trị cũ** — xem §4.4.
4. **`deleteReplacement` là mã chết** — export nhưng không component nào gọi. Nên xoá hẳn;
   Server Action đã export là đã mở một đường ghi.

---

## 6. Migration DB

`supabase-cskh/migrations/07_bao_tri_tim_khong_dau.sql` — đã apply lên
`bwzmqfbcgouhvhoslmmm`.

- Thêm cột **sinh sẵn** (`generated always as … stored`): `maintenance_plan.ten_kd`,
  `.bo_may_kd`, `maintenance_visit.section_kd`.
- 3 index GIN trigram.
- Tạo lại `v_maintenance_due`: **giữ nguyên 14 cột cũ, đúng tên, đúng thứ tự** (app dùng
  `select('*')`), chỉ thêm 3 cột vào cuối.

**Không có lệnh insert/update/delete nào.** Cột sinh sẵn tự tính lại mỗi khi dòng đổi nên
không bao giờ lệch pha với cột gốc; bỏ cột đi thì dữ liệu gốc vẫn nguyên.

Kiểm chứng sau khi apply: `v_maintenance_due` vẫn đúng **467 dòng**; 158 dòng có
`customer_name` thì đúng 158 dòng có `ten_kd` — không lệch dòng nào. Đây chính là chỗ
migration 06 từng sai ở `v_tickets` (thiếu một nhánh `coalesce` làm 8/83 ticket biến mất khỏi
kết quả tìm dù tên vẫn hiện trên màn hình), nên lần này kiểm trước.

---

## 7. Bẫy đã vấp — đọc trước khi sửa

**Supabase chặn cứng 1000 dòng mỗi request** (`db-max-rows` của PostgREST). `.limit(2000)`
KHÔNG báo lỗi — nó lặng lẽ trả về 1000. Đã dính đúng bẫy này: bấm "chọn tất cả 1891 serial"
ra 1000, giao diện không hề biết bị cắt nên vẫn mời bấm lại mãi. Phải lấy theo **lô 1000**
rồi ghép (`gomKhoa()`), và cột dùng `.range()` chứ `.limit()` thì không lấy được lô thứ hai.

**Lỗi ESLint chặn deploy Vercel.** `npm run build` ở máy có thể qua trong khi Vercel thì
không. Chạy `npm run lint` là bước **bắt buộc** trước khi push, không phải tuỳ chọn.

**`useSearchParams` phải nằm trong `<Suspense>`** — thiếu thì `next build` vỡ mà `npm run dev`
vẫn chạy bình thường. Lỗi **chỉ lộ lúc build**. `ChipSapXep` được bọc Suspense ngay bên trong
`ThanhDangLoc` thay vì bắt 4 trang gọi nó phải nhớ bọc.

**File `'use server'` chỉ được export async function.** Hằng số (`MOI_TRANG`, `COT_*`…) phải
để ở `lib/danhSach.ts`, không export thẳng từ `actions.ts`.

**`CREATE OR REPLACE VIEW`** không cho chèn/đổi tên cột giữa chừng — cột mới phải thêm **ở cuối**.

**Chữ `đ`/`Đ` (U+0111) KHÔNG tách được bằng NFD** — phải thay tay, cả trong JS lẫn trong SQL.

**`internal_code` ≠ mã CS đang dùng.** Đối chiếu trên DB thật: `GN610` = `GPUN-4000XEN-G`,
`DN810` = `GTUN-8500XDS-G`, `USH10` = `GTUN-8600HP-G`, `B04` = `GEUT-50B04-G`. Hiện mã nhà máy
trong ô lọc là nhân viên không nhận ra máy của mình. Ô lọc Sản phẩm rút mã từ **tên hiển thị**
qua `tenModel()` (có test khoá 18 dòng thật + 4 cặp mã lệch này).

**`<select>` tự động rộng bằng option dài nhất.** Ô "Sản phẩm" từng phình 382px trong khi ô
"Bảo hành" 173px. Nay chốt cứng `w-48` cho mọi ô lọc.

**Mũi tên mặc định của `<select>` nằm ngoài tầm CSS** — đặt `padding-right` bao nhiêu nó vẫn
bám mép phải theo cách riêng từng trình duyệt. Phải `appearance-none` + tự vẽ mới cân được
với lề trái.

---

## 8. Còn treo

- [ ] **Hành động hàng loạt** — §4. Đề xuất làm "đã thay lõi" trước (282 dòng).
- [ ] **Hộp xác nhận** cho 4 chỗ ở §5.
- [ ] **Bỏ dấu cho mô tả ticket + `v_core_forecast`** — §2.7.
- [ ] Trang `/tim` (tìm gộp máy/ticket/khách) đã build xong nhưng **chưa có lối vào menu**.
- [ ] Bộ lọc chưa có: tỉnh, nhóm lỗi, người phụ trách, thiếu SĐT.
- [ ] `/khach` có `province` trong danh sách cột sắp được nhưng **bảng không hiện cột Tỉnh** →
      bấm không tới.
- [ ] `loading.tsx` cho 4 trang chi tiết + prefetch khi rê chuột.
- [ ] **Hai cặp serial trùng** lệch nhau đúng ký tự `l` / `I` / `1` — nhìn y hệt nhau, làm
      phồng số máy. **Quyết định về dữ liệu, cần người xác nhận**, không tự gộp.
- [ ] **`vai_tro = 'ky_thuat'`** dùng trong code nhưng không nằm trong danh sách vai trò hợp lệ
      (`admin`, `cs`) → nhánh đó không bao giờ chạy. Cần quyết định về nghiệp vụ.
- [ ] RLS least-privilege cho các bảng CS (hiện RLS bật, 0 policy, chỉ `service_role` đọc được).
