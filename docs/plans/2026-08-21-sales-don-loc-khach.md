# Sales — Chi tiết đơn · Chuẩn filter · Hồ sơ khách — Kế hoạch thực thi

> **Cho người/agent thực thi:** dùng `superpowers:executing-plans` hoặc
> `superpowers:subagent-driven-development`, làm từng task một. Các bước dùng `- [ ]` để tick.

**Goal:** Bổ sung tổng VAT + đơn giá/thành tiền cho chi tiết đơn, kéo khu Sales về **chuẩn filter
dùng chung** của `apps/web/bang/`, và làm giàu hồ sơ khách (kênh, công ty, tổng tiền, công nợ,
SĐT phụ, sales chăm sóc) trên nền schema khách chung CS ⇄ Sales.

**Architecture:** Không dựng gói mới. Phần tính tiền là **hàm thuần** trong `_calc.ts` (test được,
không đụng DB); phần filter dùng lại nguyên gói `apps/web/bang/` mà 9 trang CSKH đang dùng, chỉ bổ
sung preset vào đó để cả app cùng hưởng; phần khách là mở rộng `customers` theo bộ cột chung đã
chốt với CS.

**Tech Stack:** Next.js 16 App Router (server components) · Supabase/PostgREST · Tailwind · Vitest.

**Spec:** [`docs/specs/2026-08-21-sales-don-loc-khach-design.md`](../specs/2026-08-21-sales-don-loc-khach-design.md)

## Global Constraints

- **`vat_pct` là PHÂN SỐ, không phải phần trăm.** `0.08` = 8%. Đây là cách Google Sheet lưu
  (699/810 dòng). Mọi công thức phải dùng `1 + vat_pct`, **không** `1 + vat_pct/100`.
- **Tiền là số nguyên đồng.** Làm tròn bằng `Math.round`, không để số lẻ lọt ra giao diện.
- **Ngày tính theo giờ máy (VN), KHÔNG dùng `toISOString()`.** `toISOString()` trả giờ UTC ⇒ từ
  00:00–07:00 giờ VN nó ra **ngày hôm trước**. Preset "Hôm nay" sai âm thầm. Dùng
  `getFullYear/getMonth/getDate`.
- **`apps/web/bang/` không được import gì ngoài `react` và `next/navigation`** — cố ý, để chép
  nguyên thư mục sang project khác là chạy.
- **Tuần bắt đầu Thứ 2.**
- **Không commit PII.** Test dùng số/tên giả, đánh dấu `// pii-ok` như `_calc.test.ts` đang làm.
- **Đơn từ Google Sheet KHÔNG có dòng quà** — quà là cả một đơn `DON_TANG` riêng. Đừng cố suy.
- Chạy trong worktree `~/gwt-worktrees/feat-sales-don-loc-khach`, nhánh `feat/sales-don-loc-khach`,
  **cổng dev 3201**.
- Trước khi gọi CEO: `npx tsc --noEmit` + `npm run test` + `npm run build` phải sạch.
- **`apps/web/app/actions.ts` là file DÙNG CHUNG** (CLAUDE.md) và `feat/nen-tang-tai-khoan` đang sửa
  dở. Nó đọc `province_moi` ở dòng 3050 + 3057. **Sales KHÔNG tự sửa file này** — báo CS, để CS sửa.
- **KHÔNG drop `customers.province_moi`** trong đợt này. Chỉ drop sau khi CS đã sửa `app/actions.ts`
  và đã báo trước ít nhất 1 ngày. Drop sớm là `.select()` của CS ném lỗi PostgREST ngay.

---

## Cấu trúc file

| File | Trách nhiệm | Task |
|---|---|---|
| `apps/web/app/sales/_calc.ts` | hàm thuần tính tiền — thêm `tachVat`, `tongDon` | 1 |
| `apps/web/app/sales/_calc.test.ts` | test cho hàm trên | 1 |
| `apps/web/app/sales/actions.ts` | `chiTietDon` trả thêm net/VAT/quà; `danhSachDon` nhận bộ lọc | 2, 7 |
| `apps/web/app/sales/don/[code]/page.tsx` | giao diện chi tiết đơn | 3 |
| `apps/web/app/sales/OrderForm.tsx` | ô VAT → dropdown | 4 |
| `apps/web/bang/ngay.ts` | **mới** — hàm thuần tính khoảng ngày cho preset | 5 |
| `apps/web/bang/ngay.test.ts` | **mới** — test preset | 5 |
| `apps/web/bang/LocNgay.tsx` | thêm hàng nút preset | 5 |
| `docs/CHUAN-FILTER.md` | **mới** — chuẩn filter toàn app | 6 |
| `apps/web/app/sales/page.tsx` | filter `/sales` theo chuẩn `bang/` | 7 |
| `apps/web/app/sales/khach/page.tsx` | filter `/sales/khach` | 8 |
| `supabase/migrations/…_sales_khach_cot_chung.sql` | **mới** — bộ cột khách chung | 9 |
| `apps/web/app/sales/khach/[code]/page.tsx` | hồ sơ khách | 11, 12 |
| `apps/web/app/sales/_types.ts`, `_db.ts`, `CustomerForm.tsx` | SĐT phụ + sales chăm sóc | 12 |

---

## ĐỢT 1 — Chi tiết đơn

### Task 1: Hàm thuần tách VAT

**Files:**
- Modify: `apps/web/app/sales/_calc.ts`
- Test: `apps/web/app/sales/_calc.test.ts`

**Interfaces:**
- Produces: `tachVat(amountVat, vatPct) -> { net: number; vat: number }` ·
  `tongDon(lines) -> { net: number; vat: number; sauVat: number }` với
  `lines: Array<{ amount_vat: number|null; amount_net: number|null; vat_pct: number|null }>`

- [ ] **Bước 1: Viết test trước (thất bại)**

Thêm vào cuối `apps/web/app/sales/_calc.test.ts`, và thêm `tachVat, tongDon` vào dòng `import` đầu file:

```ts
describe('tachVat', () => {
  it('vat_pct là PHÂN SỐ 0.08, không phải 8', () => {
    expect(tachVat(1080000, 0.08)).toEqual({ net: 1000000, vat: 80000 })
  })
  it('vat_pct = 0 -> không VAT', () => {
    expect(tachVat(500000, 0)).toEqual({ net: 500000, vat: 0 })
  })
  it('vat_pct null -> coi như không VAT, không đoán', () => {
    expect(tachVat(500000, null)).toEqual({ net: 500000, vat: 0 })
  })
  it('net + vat luôn bằng đúng tiền sau VAT (không rơi đồng lẻ)', () => {
    const r = tachVat(333333, 0.08)
    expect(r.net + r.vat).toBe(333333)
  })
  it('tiền 0 -> 0', () => expect(tachVat(0, 0.08)).toEqual({ net: 0, vat: 0 }))
})

describe('tongDon', () => {
  it('ưu tiên amount_net có sẵn (đơn từ Sheet)', () => {
    expect(tongDon([{ amount_vat: 1080000, amount_net: 1000000, vat_pct: 0.08 }]))
      .toEqual({ net: 1000000, vat: 80000, sauVat: 1080000 })
  })
  it('thiếu amount_net thì suy từ vat_pct (đơn app)', () => {
    expect(tongDon([{ amount_vat: 1080000, amount_net: null, vat_pct: 0.08 }]))
      .toEqual({ net: 1000000, vat: 80000, sauVat: 1080000 })
  })
  it('cộng nhiều dòng, trộn cả hai kiểu', () => {
    expect(tongDon([
      { amount_vat: 1080000, amount_net: 1000000, vat_pct: 0.08 },
      { amount_vat: 500000, amount_net: null, vat_pct: 0 },
    ])).toEqual({ net: 1500000, vat: 80000, sauVat: 1580000 })
  })
  it('đơn rỗng -> tất cả 0', () => expect(tongDon([])).toEqual({ net: 0, vat: 0, sauVat: 0 }))
})
```

- [ ] **Bước 2: Chạy test cho chắc là nó FAIL**

```bash
npm --prefix apps/web run test -- _calc
```

Kỳ vọng: FAIL — `tachVat is not defined`.

- [ ] **Bước 3: Viết hàm tối thiểu**

Thêm vào cuối `apps/web/app/sales/_calc.ts`:

```ts
/**
 * Tách tiền TRƯỚC VAT và tiền VAT từ tiền SAU VAT.
 *
 * ⚠️ `vatPct` là PHÂN SỐ: 0.08 = 8%. Đây là cách Google Sheet lưu (đo 21/08/2026:
 * 699/810 dòng `sales_order_lines` có vat_pct = 0.08). Dùng `1 + p/100` là sai 100 lần.
 *
 * null/0 -> coi như không VAT, KHÔNG đoán thuế suất.
 */
export function tachVat(
  amountVat: number | null | undefined,
  vatPct: number | null | undefined
): { net: number; vat: number } {
  const sau = Math.round(Number(amountVat) || 0)
  const p = Number(vatPct) || 0
  if (p <= 0) return { net: sau, vat: 0 }
  const net = Math.round(sau / (1 + p))
  return { net, vat: sau - net } // trừ ngược để net + vat LUÔN khớp tiền sau VAT
}

/** Tổng 1 đơn. Có `amount_net` (đơn Sheet) thì dùng thẳng; không thì suy từ `vat_pct` (đơn app). */
export function tongDon(
  lines: Array<{ amount_vat: number | null; amount_net: number | null; vat_pct: number | null }>
): { net: number; vat: number; sauVat: number } {
  let net = 0
  let sauVat = 0
  for (const l of lines) {
    const sau = Math.round(Number(l.amount_vat) || 0)
    sauVat += sau
    net += l.amount_net != null ? Math.round(Number(l.amount_net)) : tachVat(sau, l.vat_pct).net
  }
  return { net, vat: sauVat - net, sauVat }
}
```

- [ ] **Bước 4: Chạy lại test — phải PASS**

```bash
npm --prefix apps/web run test -- _calc
```

- [ ] **Bước 5: Commit**

```bash
git add apps/web/app/sales/_calc.ts apps/web/app/sales/_calc.test.ts
git commit -m "feat(sales/calc): tachVat + tongDon — vat_pct là phân số, không phải phần trăm"
```

---

### Task 2: `chiTietDon` trả thêm tiền trước VAT, VAT%, cờ quà

**Files:**
- Modify: `apps/web/app/sales/actions.ts` — `DonLine` (dòng 189), `MIRROR_COLS` (dòng 224), `chiTietDon` (dòng 228)

**Interfaces:**
- Consumes: `tachVat`, `tongDon` (Task 1)
- Produces: `DonLine` thêm 3 trường `unit_price_net`, `amount_net`, `vat_pct` (đều `number | null`)
  và `is_gift: boolean`; `DonChiTiet` thêm `total_net: number` và `total_vat_tien: number`.

- [ ] **Bước 1: Mở rộng kiểu `DonLine` và `DonChiTiet`**

Trong `apps/web/app/sales/actions.ts`, thêm vào `DonLine` (sau `amount_vat`):

```ts
  unit_price_net: number | null
  amount_net: number | null
  vat_pct: number | null
  is_gift: boolean
```

và thêm vào `DonChiTiet` (cạnh `total_vat`):

```ts
  /** Tổng TRƯỚC VAT. */
  total_net: number
  /** Tiền VAT = total_vat - total_net. */
  total_vat_tien: number
```

- [ ] **Bước 2: Cho `MIRROR_COLS` lấy thêm 3 cột tiền**

Đổi hằng `MIRROR_COLS` — thêm `unit_price_net, amount_net, vat_pct` vào cuối chuỗi:

```ts
const MIRROR_COLS =
  'id, source_tab, order_code, partner_order_code, category_l1, category_l2, order_date, channel, channel_detail, customer_name, province, internal_code, product_name, quantity, unit_price_vat, amount_vat, unit_price_net, amount_net, vat_pct, fulfillment_status, payment_status, note'
```

- [ ] **Bước 3: Điền 4 trường mới ở CẢ HAI nhánh của `chiTietDon`**

Nhánh **đơn app** (map từ `sales_order_items`) — thêm vào object `lines`:

```ts
      unit_price_net: null,      // sales_order_items không lưu giá trước VAT
      amount_net: null,          // -> tongDon() sẽ suy từ vat_pct
      vat_pct: it.vat_pct == null ? null : Number(it.vat_pct),
      is_gift: !!it.is_gift,
```

Nhánh **đơn mirror** (map từ `sales_order_lines`) — thêm:

```ts
      unit_price_net: (r.unit_price_net as number) ?? null,
      amount_net: (r.amount_net as number) ?? null,
      vat_pct: r.vat_pct == null ? null : Number(r.vat_pct),
      is_gift: false,            // đơn bán từ Sheet KHÔNG có dòng quà — xem spec §6.2
```

- [ ] **Bước 4: Tính tổng bằng `tongDon` ở cả hai nhánh**

Thêm `import { tachVat, tongDon } from './_calc'` (gộp vào import `_calc` nếu đã có), rồi trước mỗi
`return` của `chiTietDon`:

```ts
    const tong = tongDon(lines)
```

và trong object trả về, thay `total_vat` + thêm 2 trường:

```ts
      total_vat: tong.sauVat,
      total_net: tong.net,
      total_vat_tien: tong.vat,
```

> Nhánh đơn app trước đây lấy `total_vat` từ `header.total_vat`. Đổi sang `tong.sauVat` để tổng
> **luôn khớp với các dòng đang hiển thị** — nếu lệch thì là dữ liệu hỏng, phải thấy ngay chứ
> không nên che.

- [ ] **Bước 5: Kiểm biên dịch**

```bash
npx --prefix apps/web tsc --noEmit
```

Kỳ vọng: sạch. Nếu báo thiếu trường ở chỗ khác dựng `DonLine`, điền nốt theo mẫu trên.

- [ ] **Bước 6: Commit**

```bash
git add apps/web/app/sales/actions.ts
git commit -m "feat(sales/don): chiTietDon trả tiền trước VAT, VAT%, cờ quà"
```

---

### Task 3: Giao diện chi tiết đơn — 3 dòng tổng, cột tiền, badge Tặng, hình thức TT

**Files:**
- Modify: `apps/web/app/sales/don/[code]/page.tsx`

**Interfaces:**
- Consumes: `DonChiTiet.total_net`, `.total_vat_tien`, `.total_vat`, `DonLine.is_gift`, `.vat_pct` (Task 2)

- [ ] **Bước 1: Đưa Hình thức TT lên khối header**

Trong `<dl>` đầu tiên, đổi `<Field label="Số dòng" …>` thành hai ô:

```tsx
            <Field label="Hình thức TT" value={don.payment_method} />
            <Field label="Số dòng" value={don.lines.length} />
```

và **bỏ** `don.payment_method` khỏi điều kiện + khỏi `<dl>` của khối phụ bên dưới (khối
`don.is_app && (…)`), để không hiện hai lần.

- [ ] **Bước 2: Thêm cột VAT% vào bảng dòng sản phẩm**

Trong `<thead>`, chèn giữa "Đơn giá (VAT)" và "Thành tiền (VAT)":

```tsx
                  <th className="px-3 py-2.5 text-right font-medium">VAT</th>
```

- [ ] **Bước 3: Badge Tặng + ô VAT% ở từng dòng**

Đổi ô tên sản phẩm thành:

```tsx
                    <td className="px-3 py-2.5 text-slate-800">
                      <span className="inline-flex items-center gap-2">
                        {l.product_name || '—'}
                        {l.is_gift && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">Tặng</span>
                        )}
                      </span>
                    </td>
```

và chèn ô VAT% ngay trước ô "Thành tiền":

```tsx
                    <td className="px-3 py-2.5 text-right text-slate-500">
                      {l.vat_pct == null ? '—' : `${Math.round(l.vat_pct * 100)}%`}
                    </td>
```

- [ ] **Bước 4: Thay `<tfoot>` bằng ba dòng tổng**

```tsx
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={6} className="px-3 py-2 text-right text-slate-600">Tổng trước VAT</td>
                  <td className="px-3 py-2 text-right text-slate-700">{fmtVnd(don.total_net)}</td>
                </tr>
                <tr>
                  <td colSpan={6} className="px-3 py-2 text-right text-slate-600">Tiền VAT</td>
                  <td className="px-3 py-2 text-right text-slate-700">{fmtVnd(don.total_vat_tien)}</td>
                </tr>
                <tr className="border-t border-slate-200">
                  <td colSpan={6} className="px-3 py-2.5 text-right font-medium text-slate-700">Tổng sau VAT</td>
                  <td className="px-3 py-2.5 text-right text-base font-semibold text-slate-900">{fmtVnd(don.total_vat)}</td>
                </tr>
              </tfoot>
```

> `colSpan={6}` vì bảng nay có 7 cột (Sản phẩm · Mã nội bộ · Danh mục · SL · Đơn giá · VAT · Thành tiền).
> Thêm/bớt cột thì phải sửa số này, nếu không bảng lệch.

- [ ] **Bước 5: Đổi nhãn ô "Tổng (VAT)" ở khối header cho khỏi mơ hồ**

```tsx
            <Field label="Tổng sau VAT" value={<span className="font-semibold">{fmtVnd(don.total_vat)}</span>} />
```

- [ ] **Bước 6: Kiểm**

```bash
npx --prefix apps/web tsc --noEmit && npm --prefix apps/web run test && npm --prefix apps/web run build
```

- [ ] **Bước 7: Commit**

```bash
git add "apps/web/app/sales/don/[code]/page.tsx"
git commit -m "feat(sales/don): 3 dòng tổng VAT, cột VAT%, badge Tặng, hình thức TT lên header"
```

---

### Task 4: Ô VAT trong form → dropdown (sửa bẫy đơn vị)

**Files:**
- Modify: `apps/web/app/sales/OrderForm.tsx:291`
- Modify: `apps/web/app/sales/_types.ts` — thêm hằng `VAT_OPTS`

- [ ] **Bước 1: Thêm hằng lựa chọn VAT**

Cuối `apps/web/app/sales/_types.ts`:

```ts
/**
 * Thuế suất VAT lưu dạng PHÂN SỐ (0.08 = 8%) — khớp đúng cách Google Sheet lưu.
 * Đừng đổi sang phần trăm: 810 dòng `sales_order_lines` đang là phân số.
 */
export const VAT_OPTS: { nhan: string; giaTri: number | null }[] = [
  { nhan: '—', giaTri: null },
  { nhan: '0%', giaTri: 0 },
  { nhan: '5%', giaTri: 0.05 },
  { nhan: '8%', giaTri: 0.08 },
  { nhan: '10%', giaTri: 0.1 },
]
```

- [ ] **Bước 2: Thay ô nhập số bằng dropdown**

Trong `OrderForm.tsx`, thay dòng `<input … placeholder="VAT%" title="VAT %" />` bằng:

```tsx
                <select
                  className={inp + ' col-span-2 sm:col-span-1 text-right'}
                  value={l.vat_pct ?? ''}
                  onChange={(e) => setLine(l.key, { vat_pct: e.target.value === '' ? null : Number(e.target.value) })}
                  title="Thuế suất VAT"
                >
                  {VAT_OPTS.map((v) => (
                    <option key={v.nhan} value={v.giaTri ?? ''}>{v.nhan}</option>
                  ))}
                </select>
```

và thêm `VAT_OPTS` vào dòng `import … from './_types'`.

- [ ] **Bước 3: Kiểm + commit**

```bash
npx --prefix apps/web tsc --noEmit && npm --prefix apps/web run build
git add apps/web/app/sales/OrderForm.tsx apps/web/app/sales/_types.ts
git commit -m "fix(sales/form): VAT thành dropdown lưu phân số — hết lệch 100 lần với đơn từ Sheet"
```

- [ ] **Bước 4: MỜI CEO XEM ĐỢT 1**

```bash
npm --prefix apps/web run env:local
cd apps/web && npx next dev -p 3201
```

Chờ dòng `Ready in`, rồi đưa CEO đường dẫn `http://localhost:3201/sales` và bảo bấm vào một mã đơn.
🚫 Tuyệt đối không `pkill -f "next dev"` — giết luôn dev server của các phiên khác.

---

## ĐỢT 2 — Chuẩn filter chung

### Task 5: Preset khoảng ngày trong gói `bang/`

**Files:**
- Create: `apps/web/bang/ngay.ts`, `apps/web/bang/ngay.test.ts`
- Modify: `apps/web/bang/LocNgay.tsx`, `apps/web/bang/index.ts`

**Interfaces:**
- Produces: `isoNgay(d: Date) -> string` · `khoangPreset(ma: MaPreset, homNay: Date) -> { tu: string; den: string }` ·
  `PRESETS: { ma: MaPreset; nhan: string }[]` với `type MaPreset = 'homnay' | 'tuannay' | 'thangnay' | 'ngay30'`

- [ ] **Bước 1: Viết test trước**

Tạo `apps/web/bang/ngay.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isoNgay, khoangPreset } from './ngay'

// Thứ Tư 2026-08-19, 00:30 giờ máy — giờ sớm là chỗ toISOString() hay sai.
const thuTu = new Date(2026, 7, 19, 0, 30)

describe('isoNgay', () => {
  it('lấy ngày theo giờ máy, KHÔNG lệch sang hôm trước như toISOString', () => {
    expect(isoNgay(thuTu)).toBe('2026-08-19')
  })
  it('đệm 0 cho tháng/ngày một chữ số', () => {
    expect(isoNgay(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('khoangPreset', () => {
  it('hôm nay = đúng một ngày', () => {
    expect(khoangPreset('homnay', thuTu)).toEqual({ tu: '2026-08-19', den: '2026-08-19' })
  })
  it('tuần này bắt đầu THỨ 2', () => {
    expect(khoangPreset('tuannay', thuTu)).toEqual({ tu: '2026-08-17', den: '2026-08-19' })
  })
  it('chủ nhật vẫn thuộc tuần bắt đầu thứ 2 trước đó', () => {
    const chuNhat = new Date(2026, 7, 23, 12, 0)
    expect(khoangPreset('tuannay', chuNhat)).toEqual({ tu: '2026-08-17', den: '2026-08-23' })
  })
  it('tháng này bắt đầu ngày 1', () => {
    expect(khoangPreset('thangnay', thuTu)).toEqual({ tu: '2026-08-01', den: '2026-08-19' })
  })
  it('30 ngày tính lùi, qua được mốc đầu tháng', () => {
    expect(khoangPreset('ngay30', thuTu)).toEqual({ tu: '2026-07-20', den: '2026-08-19' })
  })
})
```

- [ ] **Bước 2: Chạy test cho chắc là FAIL**

```bash
npm --prefix apps/web run test -- bang/ngay
```

Kỳ vọng: FAIL — không tìm thấy `./ngay`.

- [ ] **Bước 3: Viết `apps/web/bang/ngay.ts`**

```ts
/**
 * Khoảng ngày cho preset lọc. Hàm THUẦN — không React, không DB, test được.
 *
 * ⚠️ KHÔNG dùng `toISOString()`: nó trả giờ UTC, nên từ 00:00–07:00 giờ VN sẽ ra
 * NGÀY HÔM TRƯỚC. Preset "Hôm nay" sai âm thầm, không ai phát hiện.
 */
export type MaPreset = 'homnay' | 'tuannay' | 'thangnay' | 'ngay30'

export const PRESETS: { ma: MaPreset; nhan: string }[] = [
  { ma: 'homnay', nhan: 'Hôm nay' },
  { ma: 'tuannay', nhan: 'Tuần này' },
  { ma: 'thangnay', nhan: 'Tháng này' },
  { ma: 'ngay30', nhan: '30 ngày' },
]

/** Date -> 'YYYY-MM-DD' theo giờ MÁY. */
export function isoNgay(d: Date): string {
  const th = String(d.getMonth() + 1).padStart(2, '0')
  const ng = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${th}-${ng}`
}

export function khoangPreset(ma: MaPreset, homNay: Date): { tu: string; den: string } {
  const den = isoNgay(homNay)
  const y = homNay.getFullYear()
  const m = homNay.getMonth()
  const d = homNay.getDate()
  switch (ma) {
    case 'homnay':
      return { tu: den, den }
    case 'tuannay': {
      const lui = (homNay.getDay() + 6) % 7 // Thứ 2 = 0, Chủ nhật = 6
      return { tu: isoNgay(new Date(y, m, d - lui)), den }
    }
    case 'thangnay':
      return { tu: isoNgay(new Date(y, m, 1)), den }
    case 'ngay30':
      return { tu: isoNgay(new Date(y, m, d - 30)), den }
  }
}
```

> Dùng `new Date(y, m, d - lui)` chứ không trừ mili-giây: cộng/trừ `864e5` sai vào ngày đổi giờ.
> VN không đổi giờ nhưng gói `bang/` được thiết kế để chép sang project khác.

- [ ] **Bước 4: Test phải PASS**

```bash
npm --prefix apps/web run test -- bang/ngay
```

- [ ] **Bước 5: Gắn preset vào `LocNgay.tsx`**

Thêm `import { PRESETS, khoangPreset } from './ngay'` rồi chèn ngay trước thẻ `</div>` cuối của
component (sau khối `che === 'khoang'`):

```tsx
      <span className="ml-1 flex flex-wrap items-center gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.ma}
            type="button"
            onClick={() => { const k = khoangPreset(p.ma, new Date()); setChe(k.tu === k.den ? 'dung' : 'khoang'); di(k.tu, k.den) }}
            className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:border-slate-300 hover:text-slate-700"
          >
            {p.nhan}
          </button>
        ))}
      </span>
```

- [ ] **Bước 6: Xuất ra khỏi gói**

Thêm vào `apps/web/bang/index.ts`, dưới khối "Hàm thuần":

```ts
export { isoNgay, khoangPreset, PRESETS, type MaPreset } from './ngay'
```

- [ ] **Bước 7: Kiểm + commit**

```bash
npx --prefix apps/web tsc --noEmit && npm --prefix apps/web run test
git add apps/web/bang/
git commit -m "feat(bang): preset Hôm nay/Tuần này/Tháng này/30 ngày cho LocNgay"
```

---

### Task 6: `docs/CHUAN-FILTER.md`

**Files:**
- Create: `docs/CHUAN-FILTER.md`
- Modify: `CLAUDE.md` — thêm một dòng trỏ sang tài liệu này

- [ ] **Bước 1: Viết tài liệu**

Tạo `docs/CHUAN-FILTER.md` với các mục sau (viết đủ, không để trống):

1. **Luật số 1** — viết filter mới ở bất kỳ khu nào: **đọc file này TRƯỚC**; thêm chuẩn mới thì
   **bổ sung vào đây** rồi mới code. Lý do: tháng 8/2026 khu Sales tự viết filter riêng
   (param `tu`/`den`) trong khi gói chung đã có sẵn (`ngtu`/`ngden`) — hai kiểu filter trong cùng
   một app, sửa một chỗ không ăn chỗ kia.
2. **Bảng tên tham số URL chuẩn:** `q` (từ khoá) · `ngtu`/`ngden` (lọc ngày) · `trang` (phân trang) ·
   `cot`/`chieu` (sắp xếp) · tên ngắn cho từng bộ lọc chọn (`sp`, `kenh`, `tinh`, `tt`, `tp`).
3. **Dùng component nào:** `OTimKiem` (tìm) · `LocNgay` (ngày, 4 chế độ + 4 preset) ·
   `BoLocChon` (lọc một-chọn theo param) · `ThanhDangLoc` (chip "đang lọc gì") ·
   `PhanTrang` · `KhungChon`/`OChonDong` (chọn nhiều dòng).
4. **Luật bắt buộc:** đổi bất kỳ bộ lọc nào ⇒ **xoá `trang`** (về trang 1). Mọi component trong
   `bang/` đã tự làm; tự viết tay thì phải nhớ.
5. **Bốn chế độ lọc ngày** suy từ dữ liệu, không cần param `mode`:
   `tu==den` → đúng ngày · có cả hai → trong khoảng · chỉ `ngden` → trước ngày · chỉ `ngtu` → từ ngày.
6. **Bẫy ngày:** không dùng `toISOString()` (lệch UTC, sai từ 00:00–07:00 giờ VN). Tuần bắt đầu Thứ 2.
7. **Bẫy tìm kiếm:** tên người khớp **đầu từ** (`imatch` + `\m`), mã/số khớp chuỗi con (`ilike`).
   `boDau()` phải khớp đúng hàm `public.khong_dau()` dưới Postgres.
8. **Nơi chứa gói:** [`apps/web/bang/`](../apps/web/bang/README.md) — không import gì ra ngoài gói.

- [ ] **Bước 2: Trỏ từ `CLAUDE.md`**

Thêm vào mục "Chạy / kiểm tra" của `CLAUDE.md`:

```markdown
Viết filter/tìm kiếm/phân trang ở BẤT KỲ khu nào → đọc `docs/CHUAN-FILTER.md` trước.
```

- [ ] **Bước 3: Commit**

```bash
git add docs/CHUAN-FILTER.md CLAUDE.md
git commit -m "docs: chuẩn filter dùng chung toàn app"
```

---

### Task 7: `/sales` dùng chuẩn `bang/` + lọc Kênh & Sản phẩm

**Files:**
- Modify: `apps/web/app/sales/page.tsx`, `apps/web/app/sales/actions.ts` (`danhSachDon`, dòng 82)

**Interfaces:**
- Consumes: `LocNgay`, `BoLocChon`, `OTimKiem`, `ThanhDangLoc` từ `@/bang`
- Produces: `danhSachDon(q, tab, loc)` với
  `loc: { ngtu?: string; ngden?: string; tt?: string[]; tp?: string[]; kenh?: string; sp?: string }`

- [ ] **Bước 1: Cho `danhSachDon` nhận bộ lọc**

Đổi chữ ký và áp bộ lọc vào truy vấn `sales_order_lines`:

```ts
export type LocDon = {
  ngtu?: string; ngden?: string
  tt?: string[]; tp?: string[]
  kenh?: string; sp?: string
}

export async function danhSachDon(q = '', tab = '', loc: LocDon = {}): Promise<DonRow[]> {
```

Trong nhánh dựng `mq` (truy vấn mirror), sau `if (s) mq = mq.or(…)` thêm:

```ts
    if (loc.ngtu) mq = mq.gte('order_date', loc.ngtu)
    if (loc.ngden) mq = mq.lte('order_date', loc.ngden)
    if (loc.tt?.length) mq = mq.in('fulfillment_status', loc.tt)
    if (loc.tp?.length) mq = mq.in('payment_status', loc.tp)
    if (loc.kenh) mq = mq.eq('channel', loc.kenh)
    if (loc.sp) mq = mq.eq('internal_code', loc.sp)
```

> `internal_code` nằm ở **dòng**, không ở đơn ⇒ lọc Sản phẩm trả về **đơn CÓ CHỨA** sản phẩm đó.
> Đó là điều người dùng mong đợi, nhưng `line_count`/`total_vat` khi đó chỉ tính các dòng khớp —
> phải ghi rõ trên giao diện, xem bước 4.

- [ ] **Bước 2: Bọc trang trong `<Suspense>`**

`OTimKiem`, `LocNgay`, `BoLocChon` đều dùng `useSearchParams` ⇒ **bắt buộc** bọc, nếu không
`next build` fail. Trong `apps/web/app/sales/page.tsx`:

```tsx
import { Suspense } from 'react'
…
        <Suspense fallback={<div className="h-10" />}>
          <div className="flex flex-wrap items-center gap-2">
            <OTimKiem placeholder="Mã đơn, tên khách, sản phẩm…" />
            <LocNgay nhan="Ngày đơn" />
            <BoLocChon param="kenh" nhan="Kênh" tuyChon={kenhOpts} />
            <BoLocChon param="sp" nhan="Sản phẩm" tuyChon={spOpts} />
          </div>
        </Suspense>
```

- [ ] **Bước 3: Đọc tham số theo TÊN CHUẨN**

Đổi `searchParams` sang `{ q, tab, ngtu, ngden, tt, tp, kenh, sp }` — **bỏ hẳn `tu`/`den`/`ttx`/`tpx`**
của bản cũ trên `feat/sales-ghi`.

- [ ] **Bước 4: Chip "đang lọc gì"**

```tsx
          <ThanhDangLoc
            dieuKien={[
              ngtu || ngden ? { nhan: 'Ngày', giaTri: `${ngtu || '…'} → ${ngden || '…'}` } : null,
              kenh ? { nhan: 'Kênh', giaTri: kenh } : null,
              sp ? { nhan: 'Sản phẩm', giaTri: sp } : null,
            ].filter(Boolean)}
            hienThi={rows.length}
            tong={rows.length}
            nhan="đơn"
          />
```

Nếu `sp` đang bật, thêm dòng nhắc dưới bảng:

```tsx
          {sp && <p className="mt-2 text-xs text-amber-700">Đang lọc theo sản phẩm — cột Số dòng và Tổng chỉ tính các dòng khớp sản phẩm này, không phải tổng cả đơn.</p>}
```

> Đọc kỹ chữ ký thật của `ThanhDangLoc` trong `apps/web/bang/ThanhDangLoc.tsx` rồi khớp đúng
> tên thuộc tính — đừng đoán.

- [ ] **Bước 5: Nguồn cho 2 dropdown**

Thêm vào `actions.ts`:

```ts
/** Kênh có thật trong đơn (không lấy cả dim_channel để khỏi hiện kênh rỗng). */
export async function kenhTrongDon(): Promise<string[]> {
  await chanSales()
  const db = dataClient()
  const { data } = await db.from('sales_order_lines').select('channel').not('channel', 'is', null).limit(5000)
  return [...new Set(((data ?? []) as { channel: string }[]).map((r) => r.channel))].sort((a, b) => a.localeCompare(b, 'vi'))
}

/** Mã sản phẩm có thật trong đơn. Nhãn = mã nội bộ (ngắn), như /serial bên CSKH. */
export async function spTrongDon(): Promise<string[]> {
  await chanSales()
  const db = dataClient()
  const { data } = await db.from('sales_order_lines').select('internal_code').not('internal_code', 'is', null).limit(5000)
  return [...new Set(((data ?? []) as { internal_code: string }[]).map((r) => r.internal_code))].sort()
}
```

- [ ] **Bước 6: Kiểm + commit**

```bash
npx --prefix apps/web tsc --noEmit && npm --prefix apps/web run test && npm --prefix apps/web run build
git add apps/web/app/sales/page.tsx apps/web/app/sales/actions.ts
git commit -m "feat(sales): filter /sales theo chuẩn bang/ + lọc Kênh và Sản phẩm"
```

---

### Task 8: `/sales/khach` — lọc Kênh + Tỉnh/TP

**Files:**
- Modify: `apps/web/app/sales/khach/page.tsx`, `apps/web/app/sales/actions.ts` (`danhSachKhach`, dòng 166)

- [ ] **Bước 1: `danhSachKhach(q, loc)` nhận `{ kenh?: string; tinh?: string }`**

Áp vào truy vấn `customers`: `if (loc.tinh) query = query.eq('province', loc.tinh)`.

> Dùng `province` (tỉnh MỚI theo quy ước chốt 21/08), **không** `province_moi` — cột đó sắp bỏ.
> Nếu Task 9/10 chưa chạy xong thì `province` vẫn là tỉnh cũ ⇒ **làm Task 8 SAU Task 10**.

Lọc kênh dùng `channel_id` (có sau Task 9).

- [ ] **Bước 2: Giao diện — thêm `OTimKiem` + 2 `BoLocChon` trong `<Suspense>`**, cùng khuôn Task 7.

- [ ] **Bước 3: Kiểm + commit**

```bash
npx --prefix apps/web tsc --noEmit && npm --prefix apps/web run build
git add apps/web/app/sales/khach/page.tsx apps/web/app/sales/actions.ts
git commit -m "feat(sales/khach): lọc Kênh + Tỉnh theo chuẩn bang/"
```

---

## ĐỢT 3 — Schema khách chung

> ✅ **Đã xong trước kế hoạch này:** cột `province_truoc_sap_nhap` (migration
> `sales_khach_them_province_truoc_sap_nhap`, đã áp prod 21/08), báo CS, ghi `SYSTEM.md` §8.
> Apps Script CEO đã sửa + deploy.

### Task 9: Migration bộ cột khách chung

**Files:**
- Create: `supabase/migrations/<ts>_sales_khach_cot_chung.sql`

- [ ] **Bước 1: Viết migration**

```sql
-- Bộ cột khách chung CS ⇄ Sales — CEO chốt 21/08/2026.
-- Cột MỚI đặt tên GIỐNG HỆT ở cả customers và cs_customers.
-- CS tự chạy phần cs_customers; file này chỉ đụng bảng Sales làm chủ.
alter table public.customers add column if not exists channel_id   integer references public.dim_channel(id) on delete set null;
alter table public.customers add column if not exists phone2       text;  -- ⛔ CHỜ CEO CHỐT, xem ghi chú dưới
alter table public.customers add column if not exists sales_owner  uuid    references public.staff(id) on delete set null;
alter table public.customers add column if not exists email        text;
alter table public.customers add column if not exists ngay_sinh    date;
alter table public.customers add column if not exists dia_chi_cty  text;
alter table public.customers add column if not exists sdt_cty      text;
alter table public.customers add column if not exists email_cty    text;
alter table public.customers add column if not exists source       text;

comment on column public.customers.sales_owner is 'Nhân sự Sales chăm sóc khách này -> staff.id. Cùng tên/ý nghĩa với cs_customers.sales_owner.';
comment on column public.customers.phone2 is 'SĐT phụ. Cùng tên/ý nghĩa với cs_customers.phone2.';
comment on column public.customers.channel_id is 'Kênh khách đến từ -> dim_channel.id. Khoá kênh dùng chung, xem SYSTEM.md §4.';

> ⚠️ **`on delete set null` là bắt buộc, KHÔNG được đổi thành `cascade`** — yêu cầu của khu Nền tảng
> (21/08). `staff.id` đã có 5 khoá ngoại cascade và nút "xoá nhân sự" phải rào chặt vì thế; thêm một
> cascade nữa mà là dữ liệu khách hàng thì xoá nhầm một nhân sự có thể cuốn theo dữ liệu Sales.
> Để trần (NO ACTION) cũng không nên: nó **chặn** xoá nhân sự đang chăm khách, làm nút xoá báo lỗi
> khó hiểu. Nhân sự nghỉ thì khách mất người chăm, chứ khách không biến mất.
> Hàm `nen_tang_dem_tham_chieu_staff(uuid)` đọc `pg_constraint` nên tự thấy khoá ngoại mới — không
> phải đăng ký thêm ở đâu.

create index if not exists customers_channel_id_idx on public.customers(channel_id);
create index if not exists customers_sales_owner_idx on public.customers(sales_owner);
```

> ⛔ **`phone2` — CHỜ CEO CHỐT trước khi chạy.** CS phản đối có lý và đã kiểm được: CS **không** lưu
> SĐT phụ dạng cột phẳng, mà có bảng 1-N `customer_contacts(customer_id, phone, contact_name, role,
> is_primary, zalo_ok)` + `customer_addresses` — màn Gộp khách đang chạy production ghi thẳng vào đó.
> Thêm `phone2` là đẻ nguồn sự thật thứ hai cho cùng một dữ kiện. Hai hướng: (a) `customers.phone2`
> chỉ là ô phẳng phía Sales, ánh xạ sang `customer_contacts` khi đọc chéo; (b) Sales bỏ `phone2`,
> dùng thẳng `customer_contacts` — nhưng bảng đó CS làm chủ, **Sales hiện không có quyền ghi**.
> Sales đã rút đề nghị CS thêm `phone2`. Nếu CEO chọn (b) thì bỏ dòng `phone2` khỏi migration này.

> **`email`/`ngay_sinh`/`sales_owner` phía `cs_customers`: CS tự chạy SAU khi CEO chốt**, không phải
> Sales ra lệnh. File migration này chỉ đụng bảng Sales làm chủ.

> **KHÔNG** thêm `ten_kd`/`dia_chi_kd` bằng `text` thường — bên CS chúng là cột **sinh sẵn** từ
> `khong_dau()`. Trước khi thêm, chạy
> `select column_name, generation_expression from information_schema.columns where table_name='cs_customers' and column_name in ('ten_kd','dia_chi_kd');`
> rồi **chép đúng biểu thức đó**, nếu không tìm kiếm hai bên sẽ ra kết quả khác nhau.

- [ ] **Bước 2: Áp local rồi áp prod**

```bash
supabase migration up
```

Rồi nhờ áp lên prod qua Supabase MCP `apply_migration` **cùng tên file**.

- [ ] **Bước 3: Đối chiếu local vs prod** — bắt buộc trước khi merge (bẫy migration 46, xem `CLAUDE.md`).

- [ ] **Bước 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(sales/db): bộ cột khách chung CS <-> Sales (kênh, SĐT phụ, sales chăm sóc, email, ngày sinh, công ty)"
```

---

### Task 10: Backfill tỉnh cho khách `KA…` + nghiệm thu sau sync

- [ ] **Bước 1: Chờ CEO chạy xong 2 mục đồng bộ** ("Đồng bộ khách + lịch sử mua", "Đồng bộ doanh thu").

- [ ] **Bước 2: Nghiệm thu sync — chạy trên prod**

```sql
select count(*) filter (where province_truoc_sap_nhap is not null) as co_tinh_cu,
       count(*) filter (where province is distinct from province_moi) as con_lech,
       count(*) as tong
from public.customers where customer_code like 'KH%';
```

Kỳ vọng: `co_tinh_cu` ≈ 46, `con_lech` = 0. Còn lệch nhiều nghĩa là Apps Script chưa ăn — dừng, báo CEO.

- [ ] **Bước 3: Backfill khách `KA…`** (sync không đụng nhóm này)

```sql
update public.customers
   set province_truoc_sap_nhap = province,
       province = province_moi
 where customer_code like 'KA%'
   and province_moi is not null
   and province is distinct from province_moi;
```

- [ ] **Bước 4: Ghi kết quả nghiệm thu vào `SYSTEM.md` §8** (nối vào dòng changelog 21/08 của Sales).

---

### Task 10b: Dọn 10 chỗ Sales còn đọc `province_moi`

**Files:**
- Modify: `apps/web/app/sales/_db.ts:44,240,259` · `actions.ts:172,182,387,470` ·
  `_types.ts:66` · `OrderForm.tsx:136,251`

> **Vì sao không gấp nhưng vẫn phải làm:** sau flip, `province_moi || province` **vẫn trả tỉnh MỚI**
> (Apps Script bỏ key `province_moi` khỏi payload ⇒ upsert giữ nguyên giá trị cũ vốn đã là tỉnh mới;
> hàng mới thì null nên rơi xuống `province`). Nên **không có cửa sổ dữ liệu sai**. Nhưng cột này
> sắp bỏ, và mỗi chỗ còn đọc nó là một chỗ sẽ vỡ lúc drop.

- [ ] **Bước 1:** Bỏ `province_moi` khỏi mọi chuỗi `.select(...)` trong `app/sales/*`.
- [ ] **Bước 2:** Đổi mọi `(x.province_moi as string) || (x.province as string)` thành `(x.province as string)`.
- [ ] **Bước 3:** Bỏ trường `province_moi` khỏi `CustomerHit` trong `_types.ts:66` và khỏi
      `OrderForm.tsx:136,251`.
- [ ] **Bước 4:** `grep -rn "province_moi" apps/web/app/sales/` phải ra **rỗng**.
- [ ] **Bước 5:** Kiểm + commit

```bash
npx --prefix apps/web tsc --noEmit && npm --prefix apps/web run test && npm --prefix apps/web run build
git add apps/web/app/sales/
git commit -m "refactor(sales): bỏ đọc province_moi — province đã là tỉnh mới theo quy ước chung"
```

---

### Task 10c: Port `tinhMoi_()` sang TypeScript — CHỜ CEO CHỐT

> ⛔ **Chưa làm cho tới khi CEO trả lời.** Vấn đề: `apps/web/lib/tinh.ts` `TINH_VN` là bộ **63 tỉnh CŨ**
> (comment trong file ghi rõ là cố ý), và nó là nguồn cho `ChonTinh.tsx`, `KyThuatBang.tsx` (CS),
> `khopPlanKhach.ts`, `OrderForm.tsx`, `CustomerForm.tsx`. ⇒ Sau khi chốt `province` = tỉnh MỚI,
> **mọi bản ghi nhập tay từ giao diện (cả CS lẫn Sales) vẫn ghi tên tỉnh CŨ**. Chỉ hàng qua Apps
> Script mới được quy đổi. Quy ước sẽ đúng với hàng sync, sai với hàng nhập tay.

**Files (nếu CEO duyệt):**
- Create: `apps/web/lib/tinhMoi.ts`, `apps/web/lib/tinhMoi.test.ts`
- Modify: `apps/web/app/sales/_db.ts` (`cleanCustomer`), `createSalesOrder`/`updateSalesOrder`

- [ ] **Bước 1:** Chép **nguyên** bảng `PROVINCE_PAIRS` (30 cặp) từ `Sales Tracking/apps-script/Code.gs:170`.
      Đọc luôn `mapTinh_` ở cùng file để khớp **đúng** cách nó chuẩn hoá (bỏ dấu, bỏ gạch nối) —
      `TINH_VN` ghi `'Thừa Thiên - Huế'` còn bảng cặp ghi `'Thừa Thiên Huế'`, so chuỗi thô là trượt.
- [ ] **Bước 2:** Viết test trước: `tinhMoi('Bắc Kạn') === 'Thái Nguyên'`,
      `tinhMoi('Thừa Thiên - Huế') === 'Huế'`, `tinhMoi('Hà Nội') === 'Hà Nội'` (34 tỉnh mới ánh xạ về chính nó),
      `tinhMoi('') === ''`, `tinhMoi(null) === null`.
- [ ] **Bước 3:** Chuẩn hoá **phía server lúc ghi** trong `cleanCustomer`:
      `province: tinhMoi(input.province)`, `province_truoc_sap_nhap: input.province?.trim() || null`.
      Giữ nguyên dropdown 63 tên cũ — nhân viên không phải học lại tên mới.
- [ ] **Bước 4:** Báo CS là file dùng chung được, để CS khỏi viết bản thứ hai.

---

## ĐỢT 4 — Hồ sơ khách

### Task 11: Kênh · tổng tiền đã mua · công nợ

**Files:**
- Modify: `apps/web/app/sales/actions.ts` (`chiTietKhach`, dòng 379), `apps/web/app/sales/khach/[code]/page.tsx`

**Interfaces:**
- Produces: `KhachChiTiet` thêm `kenh: string | null`, `tong_da_mua: number`,
  `so_don_thieu_tien: number`, `no: { order_code: string; order_date: string | null; payment_status: string | null; amount: number }[]`

- [ ] **Bước 1: Lấy tiền theo đơn của khách**

Trong `chiTietKhach`, sau khi có `purchases`, gom mã đơn rồi truy `sales_order_lines`:

```ts
  const maDon = [...new Set(purchases.map((p) => p.order_code).filter(Boolean) as string[])]
  const tienTheoDon = new Map<string, { tien: number; tt: string | null; ngay: string | null }>()
  if (maDon.length) {
    const { data: tienRows } = await db
      .from('sales_order_lines')
      .select('order_code, amount_vat, payment_status, order_date')
      .in('order_code', maDon)
    for (const r of (tienRows ?? []) as Array<Record<string, unknown>>) {
      const k = r.order_code as string
      const cur = tienTheoDon.get(k) ?? { tien: 0, tt: null, ngay: null }
      cur.tien += Number(r.amount_vat) || 0
      cur.tt = (r.payment_status as string) ?? cur.tt
      cur.ngay = (r.order_date as string) ?? cur.ngay
      tienTheoDon.set(k, cur)
    }
  }
  const tong_da_mua = [...tienTheoDon.values()].reduce((s, v) => s + v.tien, 0)
  const so_don_thieu_tien = maDon.filter((m) => !tienTheoDon.has(m)).length
  const CHUA_THU = ['Chờ cọc', 'Chờ đối soát', 'Còn nợ']
  const no = [...tienTheoDon.entries()]
    .filter(([, v]) => v.tt && CHUA_THU.includes(v.tt))
    .map(([order_code, v]) => ({ order_code, order_date: v.ngay, payment_status: v.tt, amount: v.tien }))
    .sort((a, b) => (b.order_date ?? '').localeCompare(a.order_date ?? ''))
```

- [ ] **Bước 2: Kênh** — đọc `customers.channel_id` rồi nối `dim_channel`, ghép
  `channel_l1 · channel_l2`. Nhớ thêm `channel_id`, `phone2`, `sales_owner`, `email`, `ngay_sinh`,
  `dia_chi_cty`, `sdt_cty`, `email_cty` vào hằng `CUST_COLS` trong `_db.ts` và vào `select` của
  `chiTietKhach`.

- [ ] **Bước 3: Giao diện** — thêm vào `<dl>` đầu trang:
  `Kênh` · `Tổng đã mua` (in đậm) · `SĐT phụ` · `Sales chăm sóc` · `Công ty`/`MST`/`Địa chỉ cty`/`SĐT cty`/`Email cty`.

  Cạnh "Tổng đã mua", **nếu `so_don_thieu_tien > 0` thì phải nói rõ**:

```tsx
  {data.so_don_thieu_tien > 0 && (
    <span className="ml-2 text-xs text-amber-700">({data.so_don_thieu_tien} đơn chưa có dữ liệu tiền)</span>
  )}
```

> Đo 21/08: 10/428 đơn không khớp được sang `sales_order_lines`. Không được để CEO tưởng tổng đã đủ.

- [ ] **Bước 4: Khối "Đơn còn nợ"** — bảng Mã đơn (link `/sales/don/…`) · Ngày · Trạng thái TT ·
  Số tiền, cộng dòng tổng nợ. Rỗng thì hiện `<Empty>Không có đơn nào còn nợ.</Empty>`.

- [ ] **Bước 5: Kiểm + commit**

```bash
npx --prefix apps/web tsc --noEmit && npm --prefix apps/web run test && npm --prefix apps/web run build
git add apps/web/app/sales/
git commit -m "feat(sales/khach): kênh, tổng đã mua, danh sách đơn còn nợ"
```

---

### Task 12: Gán SĐT phụ + sales chăm sóc

**Files:**
- Modify: `apps/web/app/sales/_types.ts` (`CustomerInput`), `_db.ts` (`cleanCustomer`, `getCustomerForEdit`,
  `createCustomer`, `updateCustomer`), `CustomerForm.tsx`, `actions.ts`

- [ ] **Bước 1:** Thêm `phone2`, `sales_owner`, `email`, `ngay_sinh`, `channel_id`, `dia_chi_cty`,
  `sdt_cty`, `email_cty` vào `CustomerInput` và vào `cleanCustomer` (chuẩn hoá `phone2` bằng
  `phoneChuan`, các ô text `.trim() || null`).

- [ ] **Bước 2:** Thêm hàm nguồn cho dropdown:

```ts
export async function listSalesStaff(): Promise<{ id: string; ten: string }[]> {
  const db = dataClient()
  const { data } = await db.from('staff').select('id, ten')
    .eq('hoat_dong', true).overlaps('vai_tro', ['sales', 'sales_manager']).order('ten')
  return (data ?? []) as { id: string; ten: string }[]
}
```

> Đo 21/08: chỉ **2** nhân sự khớp. Dropdown rỗng/ngắn là đúng dữ liệu, không phải bug —
> muốn thêm người thì gán vai trò trước (`SYSTEM.md` §6).

- [ ] **Bước 3:** Thêm các ô vào `CustomerForm.tsx`: SĐT phụ (text), Sales chăm sóc (select từ
  `listSalesStaff`), Kênh (select từ `listChannels` đã có sẵn trong `_db.ts`), Email, Ngày sinh,
  và nhóm 3 ô công ty.

- [ ] **Bước 4: Kiểm + commit**

```bash
npx --prefix apps/web tsc --noEmit && npm --prefix apps/web run test && npm --prefix apps/web run build
git add apps/web/app/sales/
git commit -m "feat(sales/khach): gán SĐT phụ, sales chăm sóc, kênh, thông tin công ty"
```

- [ ] **Bước 5: MỜI CEO XEM ĐỢT 4** — `http://localhost:3201/sales/khach`, bấm vào một mã khách.

---

## Sau khi CEO duyệt hết

- [ ] Đối chiếu migration local vs prod (Supabase MCP, project `bwzmqfbcgouhvhoslmmm`).
- [ ] Merge `feat/sales-don-loc-khach` → `main`.
- [ ] Xoá nhánh `feat/sales-ghi` + gỡ worktree `~/gwt-sales-dev` (2 commit filter tự viết đã bị thay).
- [ ] `bash tools/wt.sh xong feat/sales-don-loc-khach`, xoá `.next` + `node_modules` (~1 GB).
- [ ] Chuyển 4 đợt sang `⏳ CHỜ TÔI CHECK` trong `backlog/sales.md`.
