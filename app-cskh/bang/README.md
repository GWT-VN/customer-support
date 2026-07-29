# `bang/` — bộ bảng dữ liệu dùng chung

Tìm kiếm tiếng Việt không dấu · lọc · sắp xếp · phân trang · chọn nhiều dòng.

**Mang sang project khác:** chép nguyên thư mục `bang/` vào, chạy `bang/sql/khong_dau.sql`
trên database, bọc `<CauHinhBang>` một lần ở layout. Xong.

Thư mục này **không import gì từ bên ngoài nó** ngoài `react` và `next/navigation` — cố tình
như vậy để chép đi là chạy. Đừng thêm `import` trỏ ra ngoài.

---

## Cần gì để chạy

- **Next.js App Router** (dùng `useSearchParams`, `usePathname`, `next/link`)
- **PostgREST / Supabase** cho `antoanChoOr()` và `mauDauTu()` — phần còn lại không phụ thuộc
- **Tailwind** cho giao diện mặc định (đổi được, xem bên dưới)

---

## Đổi giao diện — sửa đúng một file

Toàn bộ lớp CSS nằm ở [`giaoDien.ts`](./giaoDien.ts). Component **không viết `className` trực
tiếp**, đều lấy qua `useGiaoDien()`.

Đổi vài chỗ thì truyền đè, không cần chép lại cả bảng:

```tsx
<CauHinhBang
  giaoDien={{
    chon_thanh: 'flex items-center gap-3 rounded-xl bg-emerald-700 px-4 py-2 text-white',
    sapXep_chip: 'inline-flex items-center gap-1.5 rounded-md bg-emerald-50 text-emerald-900',
  }}
>
```

Dùng CSS thường thay Tailwind cũng được — thay bằng tên lớp của bạn, cấu trúc thẻ không đổi.

---

## Nối vào project

### 1. Layout — bọc một lần

```tsx
import { CauHinhBang } from '@/bang'

<CauHinhBang tenCot={TEN_COT} nghiaSapXep={NGHIA_SAP_XEP}>
  {children}
</CauHinhBang>
```

`tenCot` và `nghiaSapXep` là **của từng dự án**, không nằm trong gói:

```ts
export const TEN_COT = { install_date: 'Ngày lắp', customer_name: 'Tên khách' }

export const NGHIA_SAP_XEP = {
  // Nói bằng LỜI, không để người dùng đoán từ mũi tên. ▲ trên cột ngày là
  // "cũ nhất trước" hay "mới nhất trước"? Đoán sai là đọc nhầm cả bảng.
  install_date: { asc: 'lắp lâu nhất trước', desc: 'lắp gần đây nhất trước' },
  customer_name: { asc: 'A → Z', desc: 'Z → A' },
}
```

Không khai báo cũng chạy, chỉ là chip nói chung chung "tăng dần/giảm dần".

### 2. Hàm liệt kê phía server

```ts
import { antoanChoOr, chuanHoaTuKhoa, mauDauTu, sapXepHopLe } from '@/bang'
import type { KetQuaTrang, TuyChonDanhSach } from '@/bang'

const COT_CHO_PHEP = ['install_date', 'serial', 'customer_name'] as const

export async function timMay(q: string, tuyChon: TuyChonDanhSach = {}): Promise<KetQuaTrang<May>> {
  const sx = sapXepHopLe(tuyChon.cot, tuyChon.chieu, COT_CHO_PHEP, { cot: 'install_date', tang: false })
  const trang = Math.max(1, tuyChon.trang ?? 1)
  const moi = tuyChon.moiTrang ?? 50            // moiTrang: để gomKhoa() gọi lại được
  const tu = (trang - 1) * moi

  let truyVan = db.from('v_may').select('*', { count: 'exact' })

  const kw = antoanChoOr(chuanHoaTuKhoa(q))
  if (kw) {
    truyVan = truyVan.or(
      // TÊN người: khớp ĐẦU TỪ. MÃ/số: khớp chuỗi con. Xem "Ba cái bẫy" bên dưới.
      `ten_kd.imatch.${mauDauTu(kw)},serial.ilike.%${kw}%`
    )
  }

  const { data, error, count } = await truyVan
    .order(sx.cot, { ascending: sx.tang, nullsFirst: false })
    .order('serial', { ascending: true })       // khoá phụ DUY NHẤT — bắt buộc
    .range(tu, tu + moi - 1)
  if (error) throw new Error(error.message)

  const tong = count ?? 0
  return { rows: data ?? [], tong, trang, soTrang: Math.max(1, Math.ceil(tong / moi)), sapXep: sx }
}
```

### 3. Trang danh sách

```tsx
<OTimKiem placeholder="Gõ tên, SĐT, mã…" />          {/* bọc <Suspense> */}
<BoLocChon param="sp" nhan="Sản phẩm" tuyChon={...} />
<ThanhDangLoc dieuKien={[...]} hienThi={rows.length} tong={tong} nhan="máy" sapXep={sapXep} />

<KhungChon khoaTrang={rows.map(r => r.serial)} tong={tong} bat={laAdmin}
           thamSo={{ q, sp, cot, chieu }}      {/* KHÔNG chứa `trang` */}
           layTatCaKhoa={khoaTatCaMay}>
  <ThanhDaChon nhan="máy">{/* hành động hàng loạt cắm vào đây */}</ThanhDaChon>
  <table>
    <thead><tr>
      <OChonTatCa nhan="máy" />
      <TieuDeCotSapXep cot="serial" nhan="Serial" chieuMacDinh="asc" />
    </tr></thead>
    <tbody>{rows.map(r => (
      <tr key={r.serial}>
        <OChonDong khoa={r.serial} moTa={`máy ${r.serial}`} />
        …
      </tr>
    ))}</tbody>
  </table>
</KhungChon>

<PhanTrang trang={trang} soTrang={soTrang} />        {/* bọc <Suspense> */}
```

### 4. Chọn tất cả khớp bộ lọc

```ts
export async function khoaTatCaMay(t: ThamSoLoc): Promise<string[]> {
  return gomKhoa(
    (trang, moiTrang) => timMay(t.q ?? '', { trang, moiTrang, cot: t.cot, chieu: t.chieu }),
    (r) => r.serial,
    2000                                        // trần một lượt
  )
}
```

Gọi lại **đúng hàm liệt kê**, đừng viết truy vấn lọc riêng — chép bộ lọc làm hai bản thì sớm
muộn lệch, lúc đó màn hình ghi "91" mà chọn tất cả ra 87 và không ai phát hiện.

---

## Ba cái bẫy đã trả giá — đọc trước khi sửa

**1. `<Suspense>` cho `useSearchParams`.** Thiếu thì `next build` vỡ mà `npm run dev` vẫn chạy
bình thường. Lỗi **chỉ lộ lúc build**. `OTimKiem`, `PhanTrang`, `TieuDeCotSapXep`, `BoLocChon`
đều cần. `ChipSapXep` đã tự bọc bên trong `ThanhDangLoc`.

**2. PostgREST chặn cứng 1000 dòng mỗi request** (`db-max-rows`). `.limit(2000)` KHÔNG báo lỗi
— nó lặng lẽ trả 1000. `gomKhoa()` lấy theo lô 1000 rồi ghép; cột phải dùng `.range()` chứ
`.limit()` không lấy được lô thứ hai.

**3. Phải thoát ký tự regex trong `mauDauTu()`.** Người dùng gõ `[` mà không thoát thì Postgres
báo regex hỏng và PostgREST trả **HTTP 400** — trang **vỡ trắng**, không phải ra rỗng.
Thứ tự bắt buộc: `chuanHoaTuKhoa()` → `antoanChoOr()` → `mauDauTu()`.

---

## Bốn quyết định thiết kế, đừng đảo mà không cân nhắc

**Tên người khớp ĐẦU TỪ, mã/số khớp chuỗi con.** `ilike %huong%` khớp cả giữa từ nên ra luôn
Phương/Thương/Thường (đo thật: 41 dòng, 21 dòng sai). Nhưng siết đầu từ cho serial và SĐT lại
phá đúng thao tác dùng nhiều nhất — gõ 4 số cuối điện thoại, gõ đuôi serial.

**Chip sắp xếp đọc cột MÁY CHỦ đã chốt, không đọc lại URL.** Gõ tay `?cot=mat_khau` thì bảng
sắp theo mặc định; chip mà đọc URL sẽ khoe "mat_khau" trong khi bảng đang sắp cột khác.

**Lựa chọn xoá theo CHỮ KÝ BỘ LỌC, không theo danh sách khoá của trang.** Lấy khoá trang làm
mốc thì chọn tất cả 472 dòng xong lật trang là mất sạch.

**Chọn vượt phạm vi trang thì phải NÓI RA.** Thanh ghi "(gồm cả dòng ở trang khác)". Và chỉ
được mời "chọn tất cả N" khi người dùng **lật tới xem được** N dòng đó — trang không có phân
trang mà mời chọn 1.891 dòng là mời chọn thứ không nhìn thấy được.

---

## Còn thiếu gì

- Chưa có test cho phần React (chỉ có test hàm thuần ở `timkiem.test.ts`).
- `BoLocChon` mới hỗ trợ chọn một giá trị, chưa chọn nhiều.
- Chưa có bản không-Next (phụ thuộc `next/navigation`).
