# Chuẩn tìm kiếm · lọc · sắp xếp · phân trang — áp cho TOÀN APP

> **Chốt 21/08/2026.** Áp cho mọi khu: CSKH · Sales · Việc · và khu mới sau này.
> Gói cài sẵn: [`apps/web/bang/`](../apps/web/bang/README.md).

---

## Luật số 1 — đọc file này TRƯỚC khi viết filter

Sắp viết một ô lọc / ô tìm / phân trang ở bất kỳ khu nào?

1. **Đọc file này trước.** Gần như chắc chắn thứ bạn cần đã có sẵn trong `bang/`.
2. **Cần kiểu lọc chưa có** → thêm vào `bang/` để cả app dùng chung, **rồi bổ sung một mục vào
   file này**. Đừng viết riêng trong khu của mình.
3. **Không tự đặt tên tham số URL mới** khi bảng dưới đây đã có tên cho việc đó.

**Vì sao có luật này.** Tháng 8/2026 khu Sales viết một bộ filter riêng cho `/sales` với tham số
`tu`/`den`, trong khi gói chung đã có `LocNgay` dùng `ngtu`/`ngden` và 9 trang CSKH đang chạy bằng
nó. Kết quả: hai kiểu filter trong cùng một app, thiếu hẳn chế độ "trước ngày / sau ngày", và sửa
một chỗ không ăn chỗ kia. Bản đó đã bị bỏ và viết lại theo chuẩn.

---

## Tham số URL chuẩn

| Tham số | Nghĩa | Ai điều khiển |
|---|---|---|
| `q` | từ khoá tìm kiếm | `OTimKiem` |
| `ngtu` / `ngden` | lọc theo ngày (xem 4 chế độ dưới) | `LocNgay` |
| `trang` | trang hiện tại (1-based) | `PhanTrang` |
| `cot` / `chieu` | cột + chiều sắp xếp | `TieuDeCotSapXep` |
| tên ngắn tuỳ trang | mỗi bộ lọc chọn một tham số riêng: `sp` (sản phẩm), `kenh`, `tinh`, `tt` (tình trạng hàng), `tp` (thanh toán), `bh` (bảo hành), `loai` | `BoLocChon` |

**Đặt tên tham số mới:** ngắn, không dấu, không trùng bảng trên. Dùng lại tên đã có nếu cùng ý nghĩa
— `kenh` ở `/sales` và ở `/sales/khach` phải là **cùng một tên**.

---

## Dùng component nào

| Cần gì | Dùng | Ghi chú |
|---|---|---|
| Ô tìm kiếm | `<OTimKiem placeholder="…" />` | dùng `useSearchParams` ⇒ **phải bọc `<Suspense>`** |
| Lọc theo ngày | `<LocNgay nhan="Ngày đơn" />` | 4 chế độ + 4 preset, xem dưới. **Bọc `<Suspense>`** |
| Lọc một-chọn | `<BoLocChon param="sp" nhan="Sản phẩm" tuyChon={[{giaTri,nhan}]} />` | rộng cố định 192px. **Bọc `<Suspense>`** |
| Chip "đang lọc gì" | `<ThanhDangLoc dieuKien={[{nhan,giaTri,href?}]} hienThi={} tong={} nhan="đơn" sapXep={} />` | KHÔNG cần `<Suspense>` |
| Phân trang | `<PhanTrang trang={} soTrang={} />` | |
| Chọn nhiều dòng | `<KhungChon>` + `<OChonTatCa>` + `<OChonDong>` + `<ThanhDaChon>` | `thamSo` truyền vào **không chứa `trang`** |

Quên `<Suspense>` là `next build` **fail**, không phải cảnh báo.

---

## Bốn chế độ lọc ngày — suy từ dữ liệu, không có tham số `mode`

| Người dùng chọn | `ngtu` | `ngden` |
|---|---|---|
| Đúng ngày | X | X (bằng `ngtu`) |
| Trong khoảng | X | Y |
| **Trước ngày** | — | Y |
| **Từ ngày** (sau ngày) | X | — |

Bốn preset kèm sẵn: **Hôm nay · Tuần này · Tháng này · 30 ngày**. Preset chỉ set `ngtu`/`ngden` rồi
đi tiếp, **không đẻ tham số mới** — nên trang nào dùng `LocNgay` là tự có preset, không phải sửa gì.

Phía server, áp vào truy vấn:

```ts
if (ngtu) truyVan = truyVan.gte('order_date', ngtu)
if (ngden) truyVan = truyVan.lte('order_date', ngden)
```

---

## Luật bắt buộc

1. **Đổi bất kỳ bộ lọc nào ⇒ XOÁ `trang`** (về trang 1). Mọi component trong `bang/` đã tự làm.
   Tự viết tay thì phải nhớ, không thì người dùng đang ở trang 5 lọc lại ra trang trống.
2. **Sắp xếp phải có khoá phụ DUY NHẤT** (`.order('serial')`, `.order('order_code')`…). Thiếu nó,
   Postgres trả thứ tự không ổn định giữa các trang ⇒ có dòng hiện hai lần, có dòng biến mất.
3. **Chip phải hiện `KetQuaTrang.sapXep`** (cột máy chủ THỰC SỰ dùng), không phải đọc lại `?cot=`.
   Gõ tay `?cot=mat_khau` thì bảng sắp theo mặc định mà chip lại khoe `mat_khau` — nói sai điều đang
   xảy ra còn tệ hơn không nói.
4. **Luôn phân biệt "đang thấy X" với "có Y".** `ThanhDangLoc` làm sẵn. Cắt cứng N dòng mà không
   báo là người dùng tưởng đó là toàn bộ.
5. **Bọc `<Suspense>`** quanh mọi component đọc `useSearchParams`.

---

## Bẫy đã trả giá

### Ngày — không dùng `toISOString()`

Nó trả giờ **UTC**. Từ 00:00–07:00 giờ VN, `new Date().toISOString().slice(0,10)` ra **ngày hôm
trước** ⇒ preset "Hôm nay" sai âm thầm. Dùng `isoNgay()` trong [`bang/ngay.ts`](../apps/web/bang/ngay.ts)
(lấy `getFullYear/getMonth/getDate`). Có test chứng minh đúng cái bẫy này.

Cộng/trừ ngày bằng `new Date(y, m, d - n)` chứ **không** trừ mili-giây (`- n * 864e5`) — trừ
mili-giây sai vào ngày đổi giờ. **Tuần bắt đầu Thứ 2.**

### Tìm kiếm — tên người khớp ĐẦU TỪ, mã/số khớp chuỗi con

```ts
`ten_kd.imatch.${mauDauTu(kw)},serial.ilike.%${kw}%`
```

Dùng `ilike %huong%` cho tên người thì khớp cả **giữa** từ: đo trên DB thật, gõ `huong` ra 41 máy
thì **21 dòng sai hoàn toàn** — Phương / Phượng / Thương, kể cả công ty có chữ "THƯƠNG MẠI".

`boDau()` trong `bang/timkiem.ts` phải khớp **đúng** hàm `public.khong_dau()` dưới Postgres. Lệch
nhau là gõ ra kết quả rỗng mà không ai hiểu vì sao.

### Danh mục lọc phải khớp NGUỒN CHÂN LÝ

Lấy danh sách lựa chọn từ đúng nguồn đang sinh ra dữ liệu, đừng gõ lại từ trí nhớ.

Ví dụ đã dính (21/08/2026): `FULFILL_OPTS` của khu Sales chỉ có 6 tình trạng trong khi Google Sheet
(`Code.gs` hằng `TTHANG`) có 9. Thiếu *Chuẩn bị hàng · Đã giao chờ lắp · Hoàn hàng*, và ghi *Hoàn
thành* trong khi dữ liệu thật là *Hoàn thành (Không lắp)*. Lọc trượt **280 + 53** dòng. Tình trạng
thanh toán thiếu *Đã cọc* — trượt thêm **61** dòng.

### Một giá trị, nhiều cách viết → gom nhóm LÚC ĐỌC

Dữ liệu thật hay có nhiều cách viết cho cùng một thứ. Đo 21/08/2026, cùng là TP.HCM:

| Cột | `HCM` | `Hồ Chí Minh` | `TP. Hồ Chí Minh` |
|---|---:|---:|---:|
| `sales_order_lines.province` | 162 | 0 | 50 |
| `customers.province` | 64 | 13 | 13 |
| `cs_customers.province` | 1 | 109 | 0 |

Cũng vậy: `Đã lắp đặt` (356 dòng) và `ĐÃ LẮP ĐẶT` (46 dòng).

Ô lọc dựng thẳng từ `select distinct` sẽ đẻ 2–3 mục cho cùng một tỉnh, mỗi mục thiếu dữ liệu.
**Gom nhóm lúc ĐỌC** — ô lọc hiện một mục, truy vấn khớp mọi biến thể — chứ đừng sửa dữ liệu, trừ
khi được giao dọn hẳn ở nguồn.

---

## Kiểu dữ liệu chung

`KetQuaTrang<T>` · `TuyChonDanhSach` · `ThamSoLoc` · `SapXep` — xem `bang/kieu.ts`.
Hàm liệt kê phía server trả `KetQuaTrang<T>` để giao diện có đủ `tong`, `soTrang`, `sapXep`.

**Đọc thêm:** [`apps/web/bang/README.md`](../apps/web/bang/README.md) ·
[`docs/specs/2026-07-29-tim-kiem-sap-xep-chon-dong.md`](specs/2026-07-29-tim-kiem-sap-xep-chon-dong.md)
