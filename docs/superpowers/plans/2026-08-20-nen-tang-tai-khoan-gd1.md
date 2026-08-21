# Nền tảng tài khoản & phân quyền — GĐ1 (gom khu dùng chung + 13 vai trò)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gom toàn bộ đăng nhập / phiên / phân quyền / quản lý nhân viên vào `apps/web/lib/nen-tang/` để mọi module dùng chung, mở danh sách lên 13 vai trò toàn công ty, và chặn luật "cùng bộ phận thì trưởng ⊕ nhân viên" — KHÔNG đổi quyền của bất kỳ ai đang dùng.

**Architecture:** `lib/nen-tang/` là khu mới, không import ngược ra ngoài. Ba file cũ (`lib/quyen.ts`, `lib/auth.ts`, `lib/supabase.ts`) biến thành **shim re-export** để 172 chỗ gọi `requireStaff()` và toàn bộ test cũ chạy y nguyên, không phải sửa hàng loạt trong một commit. Chiều import một chiều: `lib/*.ts` (shim) → `lib/nen-tang/*` → không ai import ngược lại shim, nên không có vòng lặp import.

**Tech Stack:** Next.js 16 (App Router, Server Actions), TypeScript, Supabase (`@supabase/ssr` + `supabase-js`), Vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-08-20-nen-tang-tai-khoan-phan-quyen-design.md`

## Global Constraints

- **KHÔNG đụng production.** Migration chỉ áp DB **local**. Không chạy lệnh ghi nào lên project Supabase `bwzmqfbcgouhvhoslmmm`. Nhánh chỉ deploy preview.
- Làm trên nhánh `feat/nen-tang-tai-khoan`, worktree `~/gwt-worktrees/nen-tang-tai-khoan`.
- **GĐ1 không đổi quyền của ai.** `coQuyenQuanLy` vẫn đúng `admin || cs_manager`; `VAI_TRO_VAO_APP` vẫn đúng `admin, cs, cs_manager, ky_thuat`. 7 vai trò mới chỉ được **thêm vào danh sách**, chưa có quyền gì và chưa gán cho ai.
- **Không sửa test cũ để chiều code.** `lib/quyen.test.ts`, `lib/auth.test.ts`, `lib/auth-nentang.test.ts`, `lib/actions-guard.test.ts` phải xanh **y nguyên nội dung**. Nếu một test cũ đỏ, đó là code sai chứ không phải test sai.
- Chạy test: `npm --prefix apps/web run test` · kiểm kiểu: `npx --prefix apps/web tsc --noEmit` · lint: `npm --prefix apps/web run lint`.
- Git author: `AIGWTVN <ai@gwt.vn>`. Không commit PII khách.
- 13 vai trò, đúng thứ tự này ở mọi nơi: `ceo`, `admin`, `kt_giam_doc`, `ky_thuat`, `ctv_lap_dat`, `cs_manager`, `cs`, `sales_manager`, `sales`, `marketing`, `kho`, `ke_toan`, `tai_chinh`.
- Luật loại trừ áp **trong cùng bộ phận**, KHÔNG cắt ngang bộ phận: `cs`+`sales` hợp lệ, `cs`+`cs_manager` không.

## Cấu trúc file sau GĐ1

| File | Trách nhiệm |
|---|---|
| `lib/nen-tang/vai-tro.ts` | 13 vai trò, bộ phận, cấp bậc, chuẩn hoá, luật loại trừ, luật sửa nhân viên. Hàm THUẦN, không đụng DB. |
| `lib/nen-tang/vao-cua.ts` | Luật đăng nhập THUẦN — một hàm `xetLuatVao(khu, …)` cho mọi khu. |
| `lib/nen-tang/db.ts` | `authClient()` + `dataClient()`. Không chứa gì khác. |
| `lib/nen-tang/phien.ts` | Đọc dòng staff, `requireStaff`, `requireNhanSu`, `layNhanVien`. |
| `lib/nen-tang/gac-cong.ts` | `laAdmin`, `laQuanLy`, `coTheVaoCS/Sales`, `chanNeuKhongPhai…`. |
| `lib/nen-tang/nhat-ky.ts` | `ghiAudit()` — nhật ký thao tác, dùng chung mọi module. |
| `lib/nen-tang/nhan-su-luat.ts` | Hằng số + hàm THUẦN của nhân sự (`chuanBiVaiTroDeGhi`, `kiemTraLoiMoi`). Tách riêng vì file `'use server'` KHÔNG được export gì ngoài hàm async. |
| `lib/nen-tang/nhan-su.ts` | `'use server'` — `listStaff`, `listAllStaff`, `suaNhanVien`, `doiTenNhanVien`, `moiNhanSu`. |
| `lib/quyen.ts` · `lib/auth.ts` · `lib/supabase.ts` | **Shim** — chỉ `export * from './nen-tang/…'`. Giữ để 172 chỗ gọi cũ không phải sửa. |

---

### Task 1: Khu vai trò — 13 role, bộ phận, luật loại trừ cấp bậc

**Files:**
- Create: `apps/web/lib/nen-tang/vai-tro.ts`
- Create: `apps/web/lib/nen-tang/vai-tro.test.ts`
- Modify: `apps/web/lib/quyen.ts` (120 dòng → shim re-export)

**Interfaces:**
- Consumes: không có (task đầu).
- Produces: `VAI_TRO: readonly VaiTro[]` · `type VaiTro` · `type BoPhan` · `HO_SO_VAI_TRO: Record<VaiTro,{boPhan:BoPhan;capBac:number;nhan:string}>` · `NHAN_VAI_TRO: Record<VaiTro,string>` · `laVaiTroHopLe(v:string):v is VaiTro` · `chuanHoaVaiTro(v:string|string[]|null|undefined):VaiTro[]` · `apDungLoaiTruCapBac(v:VaiTro[]):VaiTro[]` · `laQuyenAdmin(v):boolean` · `coQuyenQuanLy(v):boolean` · `laKyThuat(v):boolean` · `laChiKyThuat(v):boolean` · `kiemTraSuaNhanVien(y:YeuCauSua):{ok:true}|{ok:false;lyDo:string}` · `type YeuCauSua`.

- [ ] **Bước 1: Viết test thất bại cho luật loại trừ cấp bậc**

Tạo `apps/web/lib/nen-tang/vai-tro.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { VAI_TRO, apDungLoaiTruCapBac, chuanHoaVaiTro, coQuyenQuanLy, laVaiTroHopLe } from './vai-tro'

describe('danh sách 13 vai trò toàn công ty', () => {
  it('có đủ 13 vai trò, đúng thứ tự khai báo', () => {
    expect([...VAI_TRO]).toEqual([
      'ceo', 'admin',
      'kt_giam_doc', 'ky_thuat', 'ctv_lap_dat',
      'cs_manager', 'cs',
      'sales_manager', 'sales',
      'marketing', 'kho', 'ke_toan', 'tai_chinh',
    ])
  })

  it('7 vai trò mới là hợp lệ nhưng KHÔNG tự nhiên có quyền quản lý', () => {
    for (const v of ['ceo', 'kt_giam_doc', 'ctv_lap_dat', 'marketing', 'kho', 'ke_toan', 'tai_chinh']) {
      expect(laVaiTroHopLe(v), `${v} phải hợp lệ`).toBe(true)
      expect(coQuyenQuanLy([v]), `${v} chưa được có quyền quản lý ở GĐ1`).toBe(false)
    }
  })
})

describe('apDungLoaiTruCapBac — chỉ loại trừ TRONG cùng bộ phận', () => {
  it('kiêm nhiệm khác bộ phận thì giữ nguyên hết', () => {
    expect(apDungLoaiTruCapBac(['cs', 'sales'])).toEqual(['cs', 'sales'])
    expect(apDungLoaiTruCapBac(['cs_manager', 'sales_manager'])).toEqual(['cs_manager', 'sales_manager'])
    expect(apDungLoaiTruCapBac(['cs', 'sales_manager'])).toEqual(['sales_manager', 'cs'])
  })

  it('cùng bộ phận thì chỉ giữ cấp CAO NHẤT', () => {
    expect(apDungLoaiTruCapBac(['cs', 'cs_manager'])).toEqual(['cs_manager'])
    expect(apDungLoaiTruCapBac(['ky_thuat', 'ctv_lap_dat'])).toEqual(['ky_thuat'])
    expect(apDungLoaiTruCapBac(['kt_giam_doc', 'ky_thuat', 'ctv_lap_dat'])).toEqual(['kt_giam_doc'])
  })

  it('ca thật trên prod: [cs, sales_manager, cs_manager, admin] -> bỏ đúng cs', () => {
    expect(apDungLoaiTruCapBac(chuanHoaVaiTro(['cs', 'sales_manager', 'cs_manager', 'admin'])))
      .toEqual(['admin', 'cs_manager', 'sales_manager'])
  })

  it('vai trò không phân cấp (ceo/admin/marketing/kho/ke_toan/tai_chinh) không bao giờ bị loại', () => {
    expect(apDungLoaiTruCapBac(['ceo', 'admin', 'marketing', 'kho', 'ke_toan', 'tai_chinh']))
      .toEqual(['ceo', 'admin', 'marketing', 'kho', 'ke_toan', 'tai_chinh'])
  })

  it('kết quả luôn theo thứ tự khai báo VAI_TRO, không theo thứ tự người dùng tick', () => {
    expect(apDungLoaiTruCapBac(['sales', 'admin', 'cs'])).toEqual(['admin', 'cs', 'sales'])
  })

  it('mảng rỗng -> mảng rỗng', () => {
    expect(apDungLoaiTruCapBac([])).toEqual([])
  })
})
```

- [ ] **Bước 2: Chạy test để chắc chắn nó đỏ**

Chạy: `npm --prefix apps/web run test -- lib/nen-tang/vai-tro.test.ts`
Kỳ vọng: FAIL — `Failed to resolve import "./vai-tro"`.

- [ ] **Bước 3: Tạo `lib/nen-tang/vai-tro.ts`**

Chép nguyên văn `lib/quyen.ts` hiện tại sang file mới, rồi sửa 3 chỗ: mở rộng `VAI_TRO`, thêm `HO_SO_VAI_TRO`, thêm `apDungLoaiTruCapBac`. **Giữ nguyên** thân `coQuyenQuanLy`, `laKyThuat`, `laChiKyThuat`, `kiemTraSuaNhanVien` — GĐ1 không đổi hành vi.

```typescript
/**
 * Vai trò toàn công ty và luật sửa nhân viên — HÀM THUẦN, không đụng DB.
 *
 * Đây là chỗ DUY NHẤT quyết định ai làm được gì. Sai một luật là mở toang dữ
 * liệu khách hoặc khoá chết cả hệ thống. Mọi module (CS, Sales, Work…) dùng
 * chung file này.
 *
 * `vai_tro` là TẬP vai trò (mảng) — công ty nhỏ, một người kiêm nhiều mảng.
 * Loại trừ chỉ áp TRONG cùng bộ phận (xem apDungLoaiTruCapBac).
 */

export const VAI_TRO = [
  'ceo', 'admin',
  'kt_giam_doc', 'ky_thuat', 'ctv_lap_dat',
  'cs_manager', 'cs',
  'sales_manager', 'sales',
  'marketing', 'kho', 'ke_toan', 'tai_chinh',
] as const
export type VaiTro = (typeof VAI_TRO)[number]

export type BoPhan =
  | 'dieu_hanh' | 'he_thong' | 'ky_thuat' | 'cs' | 'sales'
  | 'marketing' | 'kho' | 'ke_toan' | 'tai_chinh'

export const NHAN_BO_PHAN: Record<BoPhan, string> = {
  dieu_hanh: 'Điều hành',
  he_thong: 'Hệ thống',
  ky_thuat: 'Kỹ thuật',
  cs: 'CSKH',
  sales: 'Sales',
  marketing: 'Marketing',
  kho: 'Kho',
  ke_toan: 'Kế toán',
  tai_chinh: 'Tài chính',
}

/**
 * Hồ sơ từng vai trò.
 *
 * `capBac` càng lớn càng cao, và CHỈ so sánh trong cùng `boPhan`. Bộ phận chỉ
 * có một vai trò thì để 0 — không có gì để loại trừ.
 */
export const HO_SO_VAI_TRO: Record<VaiTro, { boPhan: BoPhan; capBac: number; nhan: string }> = {
  ceo: { boPhan: 'dieu_hanh', capBac: 0, nhan: 'CEO' },
  admin: { boPhan: 'he_thong', capBac: 0, nhan: 'Quản trị hệ thống' },
  kt_giam_doc: { boPhan: 'ky_thuat', capBac: 2, nhan: 'Giám đốc Kỹ thuật' },
  ky_thuat: { boPhan: 'ky_thuat', capBac: 1, nhan: 'Nhân viên Kỹ thuật' },
  ctv_lap_dat: { boPhan: 'ky_thuat', capBac: 0, nhan: 'CTV lắp đặt' },
  cs_manager: { boPhan: 'cs', capBac: 2, nhan: 'Trưởng CSKH' },
  cs: { boPhan: 'cs', capBac: 1, nhan: 'Nhân viên CSKH' },
  sales_manager: { boPhan: 'sales', capBac: 2, nhan: 'Trưởng Sales' },
  sales: { boPhan: 'sales', capBac: 1, nhan: 'Nhân viên Sales' },
  marketing: { boPhan: 'marketing', capBac: 0, nhan: 'Marketing' },
  kho: { boPhan: 'kho', capBac: 0, nhan: 'Kho' },
  ke_toan: { boPhan: 'ke_toan', capBac: 0, nhan: 'Kế toán' },
  tai_chinh: { boPhan: 'tai_chinh', capBac: 0, nhan: 'Tài chính' },
}

/** Nhãn tiếng Việt — sinh từ HO_SO_VAI_TRO để không bao giờ lệch nhau. */
export const NHAN_VAI_TRO: Record<VaiTro, string> = Object.fromEntries(
  VAI_TRO.map((v) => [v, HO_SO_VAI_TRO[v].nhan])
) as Record<VaiTro, string>

export function laVaiTroHopLe(v: string): v is VaiTro {
  return (VAI_TRO as readonly string[]).includes(v)
}

/**
 * Chuẩn hoá vai_tro về MẢNG role sạch (bỏ giá trị lạ, khử trùng lặp).
 *
 * Nhận cả CHUỖI cũ ('admin') lẫn MẢNG mới (['admin','cs']) — nhờ vậy code đọc
 * được ở CẢ HAI thời kỳ schema. KHÔNG áp loại trừ cấp bậc ở đây: đọc dữ liệu cũ
 * phải trung thực, loại trừ chỉ áp lúc GHI (xem apDungLoaiTruCapBac).
 */
export function chuanHoaVaiTro(v: string | string[] | null | undefined): VaiTro[] {
  const raw = v == null ? [] : Array.isArray(v) ? v : [v]
  const hopLe = raw.filter((x): x is VaiTro => typeof x === 'string' && laVaiTroHopLe(x))
  return [...new Set(hopLe)]
}

/**
 * Luật CEO chốt: trong CÙNG một bộ phận, cấp bậc loại trừ nhau — không thể vừa
 * là trưởng vừa là nhân viên của đúng mảng đó. Khác bộ phận thì kiêm thoải mái
 * (cs + sales, cs_manager + sales_manager, cs + sales_manager… đều hợp lệ).
 *
 * Cách xử lý: mỗi bộ phận chỉ giữ vai trò có capBac CAO NHẤT. Bỏ vai trò cấp
 * dưới không mất quyền nào — cấp trên đã bao trùm (cs_manager qua được mọi chỗ
 * cs qua được).
 *
 * Chỉ gọi lúc GHI (admin bấm lưu / mời người mới), KHÔNG gọi lúc đọc: dữ liệu cũ
 * còn 2 người giữ cả cs lẫn cs_manager, đọc phải ra đúng cái đang có trong DB.
 */
export function apDungLoaiTruCapBac(vaiTro: VaiTro[]): VaiTro[] {
  const caoNhat = new Map<BoPhan, VaiTro>()
  for (const v of vaiTro) {
    const { boPhan, capBac } = HO_SO_VAI_TRO[v]
    const dangGiu = caoNhat.get(boPhan)
    if (!dangGiu || capBac > HO_SO_VAI_TRO[dangGiu].capBac) caoNhat.set(boPhan, v)
  }
  const giu = new Set(caoNhat.values())
  // Trả theo thứ tự khai báo VAI_TRO để kết quả ổn định, không phụ thuộc thứ tự tick.
  return VAI_TRO.filter((v) => giu.has(v))
}
```

Rồi chép nguyên phần còn lại của `lib/quyen.ts` hiện tại **không sửa một chữ**: `laQuyenAdmin`, `coQuyenQuanLy`, `laKyThuat`, `laChiKyThuat`, `type YeuCauSua`, `kiemTraSuaNhanVien` (kèm đầy đủ khối chú thích của chúng).

- [ ] **Bước 4: Chạy test mới, phải xanh**

Chạy: `npm --prefix apps/web run test -- lib/nen-tang/vai-tro.test.ts`
Kỳ vọng: PASS toàn bộ.

- [ ] **Bước 5: Biến `lib/quyen.ts` thành shim**

Thay TOÀN BỘ nội dung `apps/web/lib/quyen.ts` bằng:

```typescript
/**
 * SHIM — nội dung thật đã dời sang lib/nen-tang/vai-tro.ts (dùng chung mọi module).
 *
 * Giữ file này để code CS cũ không phải sửa import hàng loạt trong một commit.
 * Code MỚI hãy import thẳng từ '@/lib/nen-tang/vai-tro'.
 */
export * from './nen-tang/vai-tro'
```

- [ ] **Bước 6: Chạy TOÀN BỘ test — test cũ phải xanh y nguyên**

Chạy: `npm --prefix apps/web run test`
Kỳ vọng: PASS hết, gồm cả `lib/quyen.test.ts` **chưa sửa một dòng nào**. Nếu `lib/quyen.test.ts` đỏ, sửa `vai-tro.ts` chứ tuyệt đối không sửa test.

- [ ] **Bước 7: Kiểm kiểu**

Chạy: `npx --prefix apps/web tsc --noEmit`
Kỳ vọng: không lỗi.

- [ ] **Bước 8: Commit**

```bash
cd ~/gwt-worktrees/nen-tang-tai-khoan
git add apps/web/lib/nen-tang/vai-tro.ts apps/web/lib/nen-tang/vai-tro.test.ts apps/web/lib/quyen.ts
git -c user.name=AIGWTVN -c user.email=ai@gwt.vn commit -m "feat(nen-tang): 13 vai trò toàn công ty + luật loại trừ cấp bậc trong bộ phận

lib/quyen.ts thành shim re-export. Chưa đổi quyền của ai: coQuyenQuanLy
vẫn admin||cs_manager, 7 vai trò mới chưa có quyền gì.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Hợp nhất luật vào cửa thành một hàm theo "khu"

**Files:**
- Create: `apps/web/lib/nen-tang/vao-cua.ts`
- Create: `apps/web/lib/nen-tang/vao-cua.test.ts`
- Modify: `apps/web/lib/auth.ts` (73 dòng → shim re-export)

**Interfaces:**
- Consumes: không có (file thuần, không import `vai-tro.ts` — luật vào cửa chỉ so chuỗi).
- Produces: `DOMAIN_CONG_TY: string` · `VAI_TRO_CSKH` · `VAI_TRO_VAO_APP` · `type DongStaff` · `type KetQuaVaoCua` · `type Khu = 'cs' | 'nen_tang'` · `chuanHoaEmail(e):string` · `xetLuatVao(khu:Khu, email:string, dong:DongStaff):KetQuaVaoCua` · `xetLuatVaoCua(email,dong)` · `xetLuatVaoNenTang(email,dong)`.

- [ ] **Bước 1: Viết test thất bại cho hàm hợp nhất**

Tạo `apps/web/lib/nen-tang/vao-cua.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { xetLuatVao, xetLuatVaoCua, xetLuatVaoNenTang } from './vao-cua'

describe('xetLuatVao — một hàm cho mọi khu', () => {
  it("khu 'cs' cho ra ĐÚNG kết quả của xetLuatVaoCua cũ", () => {
    const ca: [string, { hoat_dong: boolean; vai_tro: string[] } | null][] = [
      ['ai@gwt.vn', null],
      ['ai@gwt.vn', { hoat_dong: true, vai_tro: ['cs'] }],
      ['ai@gwt.vn', { hoat_dong: false, vai_tro: ['cs'] }],
      ['ai@gwt.vn', { hoat_dong: true, vai_tro: ['sales'] }],
      ['ngoai@gmail.com', null],
    ]
    for (const [email, dong] of ca) {
      expect(xetLuatVao('cs', email, dong), `${email}`).toEqual(xetLuatVaoCua(email, dong))
    }
  })

  it("khu 'nen_tang' cho ra ĐÚNG kết quả của xetLuatVaoNenTang cũ", () => {
    expect(xetLuatVao('nen_tang', 'ai@gwt.vn', { hoat_dong: true, vai_tro: ['sales'] }))
      .toEqual(xetLuatVaoNenTang('ai@gwt.vn', { hoat_dong: true, vai_tro: ['sales'] }))
  })

  it('khác biệt cốt lõi: sales thuần vào được nền tảng nhưng KHÔNG vào được khu CS', () => {
    const dong = { hoat_dong: true, vai_tro: ['sales'] }
    expect(xetLuatVao('cs', 'a@gwt.vn', dong)).toEqual({ duocVao: false, lyDo: 'ngoai_cs' })
    expect(xetLuatVao('nen_tang', 'a@gwt.vn', dong)).toEqual({ duocVao: true, nguon: 'staff' })
  })

  it('7 vai trò mới: vào được nền tảng, CHƯA vào được khu CS (GĐ1 không đổi quyền)', () => {
    for (const v of ['ceo', 'kt_giam_doc', 'ctv_lap_dat', 'marketing', 'kho', 'ke_toan', 'tai_chinh']) {
      const dong = { hoat_dong: true, vai_tro: [v] }
      expect(xetLuatVao('nen_tang', 'a@gwt.vn', dong).duocVao, `${v} vào nền tảng`).toBe(true)
      expect(xetLuatVao('cs', 'a@gwt.vn', dong).duocVao, `${v} KHÔNG vào khu CS`).toBe(false)
    }
  })

  it('người bị khoá bị chặn ở MỌI khu', () => {
    const dong = { hoat_dong: false, vai_tro: ['admin'] }
    expect(xetLuatVao('cs', 'a@gwt.vn', dong)).toEqual({ duocVao: false, lyDo: 'bi_khoa' })
    expect(xetLuatVao('nen_tang', 'a@gwt.vn', dong)).toEqual({ duocVao: false, lyDo: 'bi_khoa' })
  })

  it('CTV được mời (email ngoài domain, có trong bảng, đang bật) vào được nền tảng', () => {
    expect(xetLuatVao('nen_tang', 'ctv@gmail.com', { hoat_dong: true, vai_tro: ['ctv_lap_dat'] }))
      .toEqual({ duocVao: true, nguon: 'staff' })
  })
})
```

- [ ] **Bước 2: Chạy test để chắc chắn nó đỏ**

Chạy: `npm --prefix apps/web run test -- lib/nen-tang/vao-cua.test.ts`
Kỳ vọng: FAIL — `Failed to resolve import "./vao-cua"`.

- [ ] **Bước 3: Tạo `lib/nen-tang/vao-cua.ts`**

```typescript
/**
 * Luật vào cửa — HÀM THUẦN: không đụng DB, không import gì.
 *
 * Đây là chỗ DUY NHẤT chứa luật. Mọi đường đăng nhập (Google, mật khẩu) đều
 * phải đi qua đây, nếu không thì chặn một đường còn đường kia vẫn hở.
 *
 * Spec: docs/superpowers/specs/2026-08-20-nen-tang-tai-khoan-phan-quyen-design.md
 */

export const DOMAIN_CONG_TY = '@gwt.vn'

/** Vai trò nhân sự CSKH (nghiệp vụ chăm sóc khách). */
export const VAI_TRO_CSKH = ['admin', 'cs', 'cs_manager'] as const

/**
 * Vai trò được PHÉP vào KHU CS. Gồm nhân sự CSKH + kỹ thuật hiện trường.
 * Kỹ thuật vào được nhưng bị ép về giao diện rút gọn ở tầng app (chỉ lịch của mình).
 * Sales thuần / vai trò khác -> chặn khỏi khu CS (vẫn vào được nền tảng).
 */
export const VAI_TRO_VAO_APP = [...VAI_TRO_CSKH, 'ky_thuat'] as const

/** Dòng tương ứng trong staff, hoặc null nếu chưa có ai ghi */
export type DongStaff = { hoat_dong: boolean; vai_tro: string[] } | null

export type KetQuaVaoCua =
  | { duocVao: true; nguon: 'staff' }
  | { duocVao: false; lyDo: 'bi_khoa' | 'ngoai_danh_sach' | 'cho_duyet' | 'ngoai_cs' }

/**
 * Khu đang xin vào.
 *  - 'cs'       : khu CSKH — cần vai trò trong VAI_TRO_VAO_APP.
 *  - 'nen_tang' : khu chung (Việc/Work và module không phải CS) — mọi nhân sự
 *                 đang hoạt động đều vào được, không cần vai trò cụ thể.
 *
 * Module mới chỉ việc chọn một trong hai khu này, KHÔNG đẻ thêm hàm mới.
 */
export type Khu = 'cs' | 'nen_tang'

export function chuanHoaEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

/**
 * Bốn luật, thứ tự KHÔNG được đổi:
 *  1&2. Có tên trong bảng thì BẢNG quyết định, kể cả email @gwt.vn. hoat_dong=false
 *       phải THẮNG luật domain bên dưới — đó chính là cơ chế khoá người nghỉ việc.
 *  3.   Đúng domain công ty nhưng CHƯA có hồ sơ -> CHỜ DUYỆT, KHÔNG tự cấp quyền.
 *  4.   Còn lại -> ngoài danh sách.
 */
export function xetLuatVao(khu: Khu, email: string, dong: DongStaff): KetQuaVaoCua {
  const e = chuanHoaEmail(email)

  if (dong) {
    if (!dong.hoat_dong) return { duocVao: false, lyDo: 'bi_khoa' }
    if (khu === 'cs') {
      const duocVaoCua = dong.vai_tro.some((r) => (VAI_TRO_VAO_APP as readonly string[]).includes(r))
      if (!duocVaoCua) return { duocVao: false, lyDo: 'ngoai_cs' }
    }
    return { duocVao: true, nguon: 'staff' }
  }

  if (e.endsWith(DOMAIN_CONG_TY)) return { duocVao: false, lyDo: 'cho_duyet' }
  return { duocVao: false, lyDo: 'ngoai_danh_sach' }
}

/** Khu CSKH. Giữ tên cũ để code hiện có không phải sửa. */
export function xetLuatVaoCua(email: string, dong: DongStaff): KetQuaVaoCua {
  return xetLuatVao('cs', email, dong)
}

/** Khu nền tảng (Việc/Work…). Giữ tên cũ để code hiện có không phải sửa. */
export function xetLuatVaoNenTang(email: string, dong: DongStaff): KetQuaVaoCua {
  return xetLuatVao('nen_tang', email, dong)
}
```

- [ ] **Bước 4: Chạy test mới, phải xanh**

Chạy: `npm --prefix apps/web run test -- lib/nen-tang/vao-cua.test.ts`
Kỳ vọng: PASS.

- [ ] **Bước 5: Biến `lib/auth.ts` thành shim**

Thay TOÀN BỘ nội dung `apps/web/lib/auth.ts` bằng:

```typescript
/**
 * SHIM — nội dung thật đã dời sang lib/nen-tang/vao-cua.ts (dùng chung mọi module).
 *
 * Giữ file này để code CS cũ không phải sửa import hàng loạt trong một commit.
 * Code MỚI hãy import thẳng từ '@/lib/nen-tang/vao-cua'.
 */
export * from './nen-tang/vao-cua'
```

- [ ] **Bước 6: Chạy toàn bộ test + kiểm kiểu**

Chạy: `npm --prefix apps/web run test && npx --prefix apps/web tsc --noEmit`
Kỳ vọng: PASS hết. `lib/auth.test.ts` và `lib/auth-nentang.test.ts` **chưa sửa một dòng nào** vẫn xanh.

- [ ] **Bước 7: Commit**

```bash
cd ~/gwt-worktrees/nen-tang-tai-khoan
git add apps/web/lib/nen-tang/vao-cua.ts apps/web/lib/nen-tang/vao-cua.test.ts apps/web/lib/auth.ts
git -c user.name=AIGWTVN -c user.email=ai@gwt.vn commit -m "refactor(nen-tang): hợp nhất 2 luật vào cửa thành xetLuatVao(khu, ...)

lib/auth.ts thành shim. Module mới chọn khu 'cs' hoặc 'nen_tang' thay vì
đẻ thêm hàm. Hành vi không đổi — test cũ xanh y nguyên.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Tách phiên đăng nhập và gác cổng khỏi `lib/supabase.ts`

**Files:**
- Create: `apps/web/lib/nen-tang/db.ts`
- Create: `apps/web/lib/nen-tang/phien.ts`
- Create: `apps/web/lib/nen-tang/gac-cong.ts`
- Modify: `apps/web/lib/supabase.ts` (226 dòng → shim re-export)

**Interfaces:**
- Consumes: `chuanHoaEmail`, `xetLuatVao`, `type KetQuaVaoCua` (Task 2); `chuanHoaVaiTro`, `laQuyenAdmin`, `coQuyenQuanLy`, `laChiKyThuat`, `type VaiTro` (Task 1).
- Produces:
  - `db.ts`: `authClient():Promise<SupabaseClient>` · `dataClient():SupabaseClient`
  - `phien.ts`: `type NhanVien` · `layNguoiDung()` · `kiemTraVaoCua(email)` · `kiemTraVaoNenTang(email)` · `ghiNhanNhanVienMoi(email)` · `requireStaff()` · `requireNhanSu()` · `layNhanVien():Promise<NhanVien|null>`
  - `gac-cong.ts`: `laAdmin()` · `laQuanLy()` · `laChiKyThuatVien()` · `coTheVaoCS()` · `coTheVaoSales()` · `chanNeuKhongPhaiAdmin()` · `chanNeuKhongPhaiQuanLy()`

**Chiều import (không được có vòng lặp):** `gac-cong.ts` → `phien.ts` → `db.ts`. `lib/supabase.ts` (shim) import cả ba, không ai import ngược lại shim.

- [ ] **Bước 1: Tạo `lib/nen-tang/db.ts`**

Cắt nguyên văn từ `lib/supabase.ts` dòng 1-48: khối chú thích "Hai client TÁCH BIỆT", `const URL`, `const ANON`, `authClient()`, `dataClient()`. Import cần: `createServerClient` từ `@supabase/ssr`, `createClient` từ `@supabase/supabase-js`, `cookies` từ `next/headers`. **Không** import gì từ `./vai-tro` hay `./vao-cua`.

- [ ] **Bước 2: Tạo `lib/nen-tang/phien.ts`**

Cắt nguyên văn từ `lib/supabase.ts`: `layNguoiDung` (58-61), `type NhanVien` (63-69), `layDongStaff` (khối 71-89), `kiemTraVaoCua` (92-96), `ghiNhanNhanVienMoi` (98-113), `requireStaff` (115-140), `kiemTraVaoNenTang` (142-147), `requireNhanSu` (149-164), `layNhanVien` (180-189). Giữ nguyên mọi khối chú thích — nhất là cảnh báo "TUYỆT ĐỐI không bọc requireStaff() trong try/catch".

Đầu file:

```typescript
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { authClient, dataClient } from './db'
import { chuanHoaEmail, xetLuatVao, type KetQuaVaoCua } from './vao-cua'
import { chuanHoaVaiTro, type VaiTro } from './vai-tro'
```

Đổi hai chỗ gọi luật sang hàm hợp nhất (hành vi y hệt):

```typescript
export async function kiemTraVaoCua(email: string): Promise<KetQuaVaoCua> {
  const e = chuanHoaEmail(email)
  const dong = await layDongStaff(e)
  return xetLuatVao('cs', e, dong ? { hoat_dong: dong.hoat_dong, vai_tro: dong.vai_tro } : null)
}

export async function kiemTraVaoNenTang(email: string): Promise<KetQuaVaoCua> {
  const e = chuanHoaEmail(email)
  const dong = await layDongStaff(e)
  return xetLuatVao('nen_tang', e, dong ? { hoat_dong: dong.hoat_dong, vai_tro: dong.vai_tro } : null)
}
```

`authClient` chỉ dùng trong `layNguoiDung` — vẫn import từ `./db`.

- [ ] **Bước 3: Tạo `lib/nen-tang/gac-cong.ts`**

Cắt nguyên văn từ `lib/supabase.ts` dòng 166-226: `coTheVaoCS`, `coTheVaoSales`, `laAdmin`, `laQuanLy`, `laChiKyThuatVien`, `chanNeuKhongPhaiAdmin`, `chanNeuKhongPhaiQuanLy` — giữ nguyên thân hàm và chú thích.

Đầu file:

```typescript
import { redirect } from 'next/navigation'
import { layNhanVien } from './phien'
import { VAI_TRO_VAO_APP } from './vao-cua'
import { coQuyenQuanLy, laChiKyThuat, laQuyenAdmin } from './vai-tro'
```

- [ ] **Bước 4: Biến `lib/supabase.ts` thành shim**

Thay TOÀN BỘ nội dung bằng:

```typescript
/**
 * SHIM — nội dung thật đã dời sang lib/nen-tang/ (dùng chung mọi module):
 *   db.ts       — authClient / dataClient
 *   phien.ts    — requireStaff / requireNhanSu / layNhanVien
 *   gac-cong.ts — laAdmin / laQuanLy / chanNeuKhongPhai…
 *
 * Giữ file này vì requireStaff() được gọi ở 172 chỗ — đổi hết trong một commit là
 * rủi ro sót một chỗ, mà chỗ sót nghĩa là một trang KHÔNG GÁC CỔNG.
 * Code MỚI hãy import thẳng từ '@/lib/nen-tang/…'.
 */
export * from './nen-tang/db'
export * from './nen-tang/phien'
export * from './nen-tang/gac-cong'
```

- [ ] **Bước 5: Chạy toàn bộ test + kiểm kiểu + build**

```bash
npm --prefix apps/web run test
npx --prefix apps/web tsc --noEmit
npm --prefix apps/web run lint
npm --prefix apps/web run build
```
Kỳ vọng: cả bốn đều sạch. `next build` là chốt quan trọng nhất ở task này — nó bắt được lỗi vòng lặp import mà `tsc` bỏ qua.

- [ ] **Bước 6: Kiểm tra bằng mắt là không còn logic sót lại trong shim**

Chạy: `wc -l apps/web/lib/supabase.ts apps/web/lib/auth.ts apps/web/lib/quyen.ts`
Kỳ vọng: cả ba đều dưới 20 dòng (chỉ còn chú thích + `export *`).

- [ ] **Bước 7: Commit**

```bash
cd ~/gwt-worktrees/nen-tang-tai-khoan
git add apps/web/lib/nen-tang/db.ts apps/web/lib/nen-tang/phien.ts apps/web/lib/nen-tang/gac-cong.ts apps/web/lib/supabase.ts
git -c user.name=AIGWTVN -c user.email=ai@gwt.vn commit -m "refactor(nen-tang): tách phiên đăng nhập + gác cổng khỏi lib/supabase.ts

supabase.ts còn đúng việc của nó (authClient/dataClient) và thành shim
re-export. 172 chỗ gọi requireStaff() không phải sửa.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Dời quản lý nhân viên ra khỏi `app/actions.ts`, áp luật loại trừ lúc ghi

**Files:**
- Create: `apps/web/lib/nen-tang/nhat-ky.ts`
- Create: `apps/web/lib/nen-tang/nhan-su-luat.ts`
- Create: `apps/web/lib/nen-tang/nhan-su.ts`
- Create: `apps/web/lib/nen-tang/nhan-su-luat.test.ts`
- Modify: `apps/web/app/actions.ts` (xoá dòng 25-43 `ghiAudit`, xoá dòng 3093-3202 khối nhân viên, thêm re-export)
- Modify: `apps/web/app/nhan-vien/page.tsx:2` (đổi import)

**Interfaces:**
- Consumes: `dataClient` (Task 3, `./db`) · `requireStaff`, `layNhanVien`, `type NhanVien` (Task 3, `./phien`) · `laAdmin` (Task 3, `./gac-cong`) · `chuanHoaVaiTro`, `apDungLoaiTruCapBac`, `laVaiTroHopLe`, `laQuyenAdmin`, `kiemTraSuaNhanVien`, `type VaiTro` (Task 1) · `chuanHoaEmail` (Task 2).
- Produces:
  - `nhat-ky.ts`: `ghiAudit(hanhDong:string, doiTuong?:string, chiTiet?:Record<string,unknown>, ketQua?:string):Promise<void>`
  - `nhan-su-luat.ts`: `KHONG_DU_QUYEN: string` · `type Staff = { id:string; ten:string; vai_tro:VaiTro[]; email:string|null }` · `toStaff(r):Staff` · `chuanBiVaiTroDeGhi(v:string[]|undefined)`
  - `nhan-su.ts`: `listStaff():Promise<Staff[]>` · `currentStaff():Promise<Staff|null>` · `listAllStaff():Promise<(Staff&{hoat_dong:boolean})[]>` · `suaNhanVien(id:string, patch:{vai_tro?:string[];hoat_dong?:boolean})` · `doiTenNhanVien(id:string, ten:string)`

**Luật `'use server'` — đọc kỹ, sai là `next build` đổ:** một file có `'use server'` ở đầu CHỈ được export hàm `async`. Hằng số (`KHONG_DU_QUYEN`) và hàm thuần (`chuanBiVaiTroDeGhi`) phải nằm ở file KHÁC, đó là lý do có `nhan-su-luat.ts`. `nhat-ky.ts` cố tình KHÔNG có `'use server'`: `ghiAudit` chỉ được gọi từ code server, đánh dấu `'use server'` là biến nó thành endpoint gọi được từ trình duyệt.

**Lưu ý vòng lặp import:** `ghiAudit` hiện nằm trong `actions.ts` và gọi `layNhanVien` + `dataClient`. Dời nó vào `nen-tang/nhat-ky.ts` là bắt buộc — nếu để nguyên thì `nen-tang/nhan-su.ts` phải import ngược từ `app/actions.ts`, tạo vòng lặp.

- [ ] **Bước 1: Viết test thất bại cho việc áp loại trừ lúc ghi**

`suaNhanVien` chạm DB nên không unit-test trực tiếp được. Tách phần thuần ra và test phần thuần đó. Tạo `apps/web/lib/nen-tang/nhan-su-luat.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { chuanBiVaiTroDeGhi } from './nhan-su-luat'

describe('chuanBiVaiTroDeGhi — chuẩn hoá TẬP vai trò trước khi ghi DB', () => {
  it('undefined nghĩa là KHÔNG đổi vai trò', () => {
    expect(chuanBiVaiTroDeGhi(undefined)).toEqual({ ok: true, vaiTro: undefined })
  })

  it('chặn vai trò lạ, không ghi gì cả', () => {
    expect(chuanBiVaiTroDeGhi(['cs', 'superuser'])).toEqual({ ok: false, lyDo: 'Vai trò không hợp lệ.' })
  })

  it('áp loại trừ cấp bậc: tick cả cs lẫn cs_manager thì chỉ ghi cs_manager', () => {
    expect(chuanBiVaiTroDeGhi(['cs', 'cs_manager'])).toEqual({ ok: true, vaiTro: ['cs_manager'] })
  })

  it('KHÔNG đụng kiêm nhiệm khác bộ phận', () => {
    expect(chuanBiVaiTroDeGhi(['cs', 'sales'])).toEqual({ ok: true, vaiTro: ['cs', 'sales'] })
    expect(chuanBiVaiTroDeGhi(['cs_manager', 'sales_manager']))
      .toEqual({ ok: true, vaiTro: ['cs_manager', 'sales_manager'] })
  })

  it('khử trùng lặp và sắp theo thứ tự khai báo', () => {
    expect(chuanBiVaiTroDeGhi(['sales', 'admin', 'sales'])).toEqual({ ok: true, vaiTro: ['admin', 'sales'] })
  })

  it('mảng rỗng là hợp lệ — gỡ hết vai trò của một người', () => {
    expect(chuanBiVaiTroDeGhi([])).toEqual({ ok: true, vaiTro: [] })
  })

  it('nhận 7 vai trò mới', () => {
    expect(chuanBiVaiTroDeGhi(['ceo', 'tai_chinh'])).toEqual({ ok: true, vaiTro: ['ceo', 'tai_chinh'] })
  })
})
```

- [ ] **Bước 2: Chạy test để chắc chắn nó đỏ**

Chạy: `npm --prefix apps/web run test -- lib/nen-tang/nhan-su-luat.test.ts`
Kỳ vọng: FAIL — `Failed to resolve import "./nhan-su-luat"`.

- [ ] **Bước 3: Tạo `lib/nen-tang/nhat-ky.ts`**

```typescript
import { dataClient } from './db'
import { layNhanVien } from './phien'

/**
 * Nhật ký thao tác — dùng chung mọi module.
 *
 * KHÔNG đánh dấu 'use server': hàm này chỉ gọi từ code server. Đánh dấu là biến
 * nó thành endpoint ai cũng gọi được để bơm rác vào nhật ký.
 *
 * Audit hỏng TUYỆT ĐỐI không được chặn nghiệp vụ: nuốt lỗi có chủ đích.
 */
export async function ghiAudit(
  hanhDong: string,
  doiTuong?: string,
  chiTiet?: Record<string, unknown>,
  ketQua = 'ok'
) {
  try {
    const nv = await layNhanVien()
    await dataClient().from('audit_log').insert({
      actor: nv?.email ?? null,
      actor_id: nv?.id ?? null,
      hanh_dong: hanhDong,
      doi_tuong: doiTuong ?? null,
      chi_tiet: chiTiet ?? null,
      ket_qua: ketQua,
    })
  } catch {
    // audit hỏng tuyệt đối không chặn nghiệp vụ
  }
}
```

- [ ] **Bước 4: Tạo `lib/nen-tang/nhan-su-luat.ts` (hàm thuần)**

```typescript
/**
 * Hằng số + luật THUẦN của quản lý nhân sự — không đụng DB, test được.
 *
 * Tách khỏi nhan-su.ts vì file đó có 'use server', mà file 'use server' chỉ được
 * export hàm async.
 */
import {
  apDungLoaiTruCapBac, chuanHoaVaiTro, laVaiTroHopLe, type VaiTro,
} from './vai-tro'
import { chuanHoaEmail } from './vao-cua'

export const KHONG_DU_QUYEN = 'Chỉ quản trị mới làm được việc này.'

export type Staff = { id: string; ten: string; vai_tro: VaiTro[]; email: string | null }

/** Chuẩn hoá 1 dòng staff thô về Staff — vai_tro coerce về MẢNG. */
export function toStaff(r: { id: string; ten: string; vai_tro: unknown; email: string | null }): Staff {
  return { id: r.id, ten: r.ten, email: r.email, vai_tro: chuanHoaVaiTro(r.vai_tro as string | string[] | null) }
}

/**
 * Chuẩn hoá TẬP vai trò TRƯỚC KHI GHI.
 *
 * Ba việc: chặn vai trò lạ (client gửi gì cũng không tin), khử trùng lặp, và áp
 * luật loại trừ cấp bậc trong cùng bộ phận. `undefined` = thao tác này không đổi
 * vai trò (ví dụ chỉ bật/tắt hoạt động).
 *
 * Chỉ áp lúc GHI. Lúc ĐỌC vẫn trung thực với DB — hiện còn 2 người giữ cả cs lẫn
 * cs_manager từ trước, họ sẽ tự được dọn ở lần admin bấm lưu kế tiếp.
 */
export function chuanBiVaiTroDeGhi(
  vaiTro: string[] | undefined
): { ok: true; vaiTro: VaiTro[] | undefined } | { ok: false; lyDo: string } {
  if (vaiTro === undefined) return { ok: true, vaiTro: undefined }
  if (!vaiTro.every(laVaiTroHopLe)) return { ok: false, lyDo: 'Vai trò không hợp lệ.' }
  return { ok: true, vaiTro: apDungLoaiTruCapBac(chuanHoaVaiTro(vaiTro)) }
}
```

`chuanHoaEmail` được import sẵn ở đây vì Task 7 sẽ thêm `kiemTraLoiMoi` vào đúng file này.

- [ ] **Bước 4b: Tạo `lib/nen-tang/nhan-su.ts` (Server Action)**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { dataClient } from './db'
import { laAdmin } from './gac-cong'
import { ghiAudit } from './nhat-ky'
import { KHONG_DU_QUYEN, chuanBiVaiTroDeGhi, toStaff, type Staff } from './nhan-su-luat'
import { layNhanVien, requireStaff } from './phien'
import { chuanHoaVaiTro, kiemTraSuaNhanVien, laQuyenAdmin, type VaiTro } from './vai-tro'

/** Danh sách NV đang hoạt động — để chọn người phụ trách. */
export async function listStaff(): Promise<Staff[]> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('staff').select('id, ten, vai_tro, email').eq('hoat_dong', true).order('ten')
  if (error) throw new Error(error.message)
  return (data ?? []).map(toStaff)
}

/** NV ứng với người đang đăng nhập (khớp email) — cho lọc "việc của tôi". */
export async function currentStaff(): Promise<Staff | null> {
  const user = await requireStaff()
  if (!user.email) return null
  const { data, error } = await dataClient()
    .from('staff').select('id, ten, vai_tro, email').eq('email', user.email).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toStaff(data) : null
}

/** Toàn bộ NV kể cả đã khoá — cho màn /nhan-vien. Khác listStaff() vốn chỉ lấy NV đang hoạt động. */
export async function listAllStaff(): Promise<(Staff & { hoat_dong: boolean })[]> {
  await requireStaff()
  if (!(await laAdmin())) throw new Error(KHONG_DU_QUYEN)
  const { data, error } = await dataClient()
    .from('staff').select('id, ten, vai_tro, email, hoat_dong')
    .order('hoat_dong', { ascending: false }).order('vai_tro').order('ten')
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({ ...toStaff(r), hoat_dong: (r as { hoat_dong: boolean }).hoat_dong }))
}

/**
 * Đổi vai trò hoặc bật/tắt hoạt động của một nhân viên.
 *
 * Luật chống khoá chết hệ thống nằm ở nen-tang/vai-tro.ts (có unit test): không tự
 * khoá mình, không tự hạ quyền mình, không hạ/khoá admin cuối cùng.
 */
export async function suaNhanVien(
  id: string,
  patch: { vai_tro?: string[]; hoat_dong?: boolean }
) {
  await requireStaff()
  const toi = await layNhanVien()
  if (!toi || !(await laAdmin())) return { ok: false as const, error: KHONG_DU_QUYEN }

  // Chặn role lạ, khử trùng, áp loại trừ cấp bậc. undefined = không đổi role.
  const kq = chuanBiVaiTroDeGhi(patch.vai_tro)
  if (!kq.ok) return { ok: false as const, error: kq.lyDo }
  const vaiTroMoi: VaiTro[] | undefined = kq.vaiTro

  const db = dataClient()
  const { data: biSua, error: e1 } = await db
    .from('staff').select('id, vai_tro, hoat_dong').eq('id', id).maybeSingle()
  if (e1) return { ok: false as const, error: e1.message }
  if (!biSua) return { ok: false as const, error: 'Không tìm thấy nhân viên.' }

  // Đếm admin đang hoạt động bằng coerce trong JS thay vì .eq('vai_tro','admin')
  // — đúng cho cả cột chuỗi cũ lẫn text[] mới (bảng staff nhỏ, không lo chi phí).
  const { data: dsHoatDong, error: e2 } = await db
    .from('staff').select('vai_tro').eq('hoat_dong', true)
  if (e2) return { ok: false as const, error: e2.message }
  const soAdmin = (dsHoatDong ?? [])
    .filter((r) => laQuyenAdmin((r as { vai_tro: unknown }).vai_tro as string | string[] | null)).length

  const kt = kiemTraSuaNhanVien({
    idNguoiSua: toi.id,
    idBiSua: id,
    vaiTroMoi,
    hoatDongMoi: patch.hoat_dong,
    vaiTroHienTai: chuanHoaVaiTro((biSua as { vai_tro: unknown }).vai_tro as string | string[] | null),
    soAdminDangHoatDong: soAdmin,
  })
  if (!kt.ok) return { ok: false as const, error: kt.lyDo }

  // Ghi TẬP đã chuẩn hoá (không ghi mảng thô từ client).
  const capNhat: { vai_tro?: VaiTro[]; hoat_dong?: boolean } = {}
  if (vaiTroMoi !== undefined) capNhat.vai_tro = vaiTroMoi
  if (patch.hoat_dong !== undefined) capNhat.hoat_dong = patch.hoat_dong

  const { error } = await db.from('staff').update(capNhat).eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  await ghiAudit('sua_nv', `nv:${id}`, capNhat as Record<string, unknown>)
  revalidatePath('/nhan-vien')
  return { ok: true as const }
}

/** Sửa tên hiển thị — người vào lần đầu chỉ có tên tạm lấy từ email. */
export async function doiTenNhanVien(id: string, ten: string) {
  await requireStaff()
  if (!(await laAdmin())) return { ok: false as const, error: KHONG_DU_QUYEN }
  const t = ten.trim()
  if (!t) return { ok: false as const, error: 'Tên không được để trống.' }
  const { error } = await dataClient().from('staff').update({ ten: t }).eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/nhan-vien')
  return { ok: true as const }
}
```

- [ ] **Bước 5: Chạy test mới, phải xanh**

Chạy: `npm --prefix apps/web run test -- lib/nen-tang/nhan-su-luat.test.ts`
Kỳ vọng: PASS.

- [ ] **Bước 6: Gỡ khối cũ khỏi `app/actions.ts` và re-export**

Xoá `app/actions.ts` dòng 25-43 (`ghiAudit`), dòng 19 (`const KHONG_DU_QUYEN`), và khối 3093-3202. Thêm ở đầu file, cạnh các import sẵn có:

```typescript
import { ghiAudit } from '@/lib/nen-tang/nhat-ky'
import { KHONG_DU_QUYEN } from '@/lib/nen-tang/nhan-su-luat'
```

và ở cuối file:

```typescript
// Quản lý nhân viên đã dời sang lib/nen-tang/nhan-su.ts (dùng chung mọi module).
// Re-export để code CS đang import từ '@/app/actions' không phải sửa.
export { currentStaff, doiTenNhanVien, listAllStaff, listStaff, suaNhanVien } from '@/lib/nen-tang/nhan-su'
export type { Staff } from '@/lib/nen-tang/nhan-su-luat'
```

- [ ] **Bước 7: Đổi import ở trang nhân viên sang khu nền tảng**

Sửa `apps/web/app/nhan-vien/page.tsx` dòng 2-4:

```typescript
import { listAllStaff } from '@/lib/nen-tang/nhan-su'
import { chanNeuKhongPhaiAdmin } from '@/lib/nen-tang/gac-cong'
import { layNhanVien } from '@/lib/nen-tang/phien'
import { laQuyenAdmin } from '@/lib/nen-tang/vai-tro'
```

- [ ] **Bước 8: Chạy toàn bộ test + kiểm kiểu + build**

```bash
npm --prefix apps/web run test
npx --prefix apps/web tsc --noEmit
npm --prefix apps/web run build
```
Kỳ vọng: sạch cả ba. Chú ý `lib/actions-guard.test.ts` — nó quét chuỗi trong `app/actions.ts`; sau khi gỡ khối nhân viên, test "vẫn quét được thân actions.ts" phải vẫn xanh (số hàm có gate vẫn nhiều). **Nếu nó đỏ, KHÔNG sửa test** — báo lại, vì đó là dấu hiệu đã gỡ nhầm.

- [ ] **Bước 9: Commit**

```bash
cd ~/gwt-worktrees/nen-tang-tai-khoan
git add apps/web/lib/nen-tang/nhat-ky.ts apps/web/lib/nen-tang/nhan-su-luat.ts apps/web/lib/nen-tang/nhan-su.ts apps/web/lib/nen-tang/nhan-su-luat.test.ts apps/web/app/actions.ts apps/web/app/nhan-vien/page.tsx
git -c user.name=AIGWTVN -c user.email=ai@gwt.vn commit -m "refactor(nen-tang): dời quản lý nhân viên + nhật ký ra khỏi actions.ts của CS

Thêm chuanBiVaiTroDeGhi(): áp luật loại trừ cấp bậc lúc GHI, đọc vẫn
trung thực với DB. actions.ts re-export để code CS không phải sửa.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Migration 50 — nới ràng buộc lên 13 vai trò (CHỈ ÁP LOCAL)

**Files:**
- Create: `db/cs/migrations/50_vai_tro_toan_cong_ty.sql`
- Modify: `../GWT-SHARED/SYSTEM.md` (thêm một dòng Changelog — `staff` là bảng DÙNG CHUNG)

**Interfaces:**
- Consumes: danh sách 13 vai trò (Task 1).
- Produces: ràng buộc `chk_vai_tro` chấp nhận 13 giá trị.

⚠️ **Chỉ áp DB local.** Không chạy lệnh này lên project `bwzmqfbcgouhvhoslmmm`.

- [ ] **Bước 1: Xác nhận ràng buộc hiện tại trên DB local**

```bash
psql "$DATABASE_URL_LOCAL" -c "select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.staff'::regclass and conname='chk_vai_tro';"
```
Kỳ vọng: `CHECK ((vai_tro <@ '{admin,cs_manager,cs,sales_manager,sales,ky_thuat}'::text[]))`.
Nếu DB local chưa dựng, xem `docs/LOCAL-DEV.md` trước.

- [ ] **Bước 2: Viết migration**

Tạo `db/cs/migrations/50_vai_tro_toan_cong_ty.sql`:

```sql
-- 50 — Mở danh sách vai trò lên 13 role toàn công ty.
--
-- Vì sao: trước đây app chỉ phục vụ CSKH nên chk_vai_tro chỉ có 6 giá trị.
-- Nay nền tảng dùng chung cho mọi module, cần đủ vai trò các bộ phận.
--
-- KHÔNG đụng dữ liệu dòng nào — chỉ nới ràng buộc. Vai trò mới chưa gán cho ai
-- và chưa có quyền gì ở GĐ1 (xem docs/superpowers/specs/2026-08-20-…-design.md).
--
-- Luật "cùng bộ phận thì trưởng ⊕ nhân viên" KHÔNG cài ở DB: hai người đang giữ
-- cả cs lẫn cs_manager từ trước, thêm CHECK là migration đổ. Luật áp ở tầng app
-- lúc GHI (lib/nen-tang/nhan-su.ts:chuanBiVaiTroDeGhi), dữ liệu cũ tự dọn dần.

alter table public.staff drop constraint if exists chk_vai_tro;
alter table public.staff add constraint chk_vai_tro
  check (vai_tro <@ '{
    ceo, admin,
    kt_giam_doc, ky_thuat, ctv_lap_dat,
    cs_manager, cs,
    sales_manager, sales,
    marketing, kho, ke_toan, tai_chinh
  }'::text[]);
```

- [ ] **Bước 3: Áp lên DB LOCAL và kiểm chứng**

```bash
psql "$DATABASE_URL_LOCAL" -f db/cs/migrations/50_vai_tro_toan_cong_ty.sql
psql "$DATABASE_URL_LOCAL" -c "select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.staff'::regclass and conname='chk_vai_tro';"
```
Kỳ vọng: ràng buộc mới có đủ 13 giá trị.

- [ ] **Bước 4: Kiểm chứng ràng buộc thật sự còn gác**

```bash
psql "$DATABASE_URL_LOCAL" -c "update public.staff set vai_tro = '{tai_chinh}' where email = (select email from public.staff limit 1);"
psql "$DATABASE_URL_LOCAL" -c "update public.staff set vai_tro = '{khong_ton_tai}' where email = (select email from public.staff limit 1);"
```
Kỳ vọng: lệnh đầu THÀNH CÔNG (vai trò mới nhận được), lệnh sau **LỖI** `violates check constraint "chk_vai_tro"` (vai trò lạ vẫn bị chặn). Sau đó hoàn tác dòng vừa sửa về vai trò cũ.

- [ ] **Bước 5: Ghi Changelog vào SYSTEM.md**

`staff` là bảng DÙNG CHUNG giữa các module, nên theo `CLAUDE.md` phải ghi một dòng Changelog trong `../GWT-SHARED/SYSTEM.md`:

```
- 2026-08-20 · `staff.chk_vai_tro` nới từ 6 lên 13 vai trò toàn công ty (thêm ceo,
  kt_giam_doc, ctv_lap_dat, marketing, kho, ke_toan, tai_chinh). Migration
  `db/cs/migrations/50_vai_tro_toan_cong_ty.sql` — MỚI ÁP LOCAL, chưa áp production.
  Vai trò mới chưa có quyền gì; module khác không cần đổi gì.
```

- [ ] **Bước 6: Commit**

```bash
cd ~/gwt-worktrees/nen-tang-tai-khoan
git add db/cs/migrations/50_vai_tro_toan_cong_ty.sql
git -c user.name=AIGWTVN -c user.email=ai@gwt.vn commit -m "feat(db): migration 50 nới chk_vai_tro lên 13 vai trò toàn công ty

CHỈ ÁP LOCAL. Không đụng dữ liệu dòng nào. Luật loại trừ cấp bậc cố tình
KHÔNG cài ở DB — 2 người đang giữ cả cs lẫn cs_manager, app dọn dần lúc ghi.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

(`SYSTEM.md` nằm ngoài repo này — commit riêng trong repo `GWT-SHARED`.)

---

### Task 6: Màn `/nhan-vien` — 13 vai trò nhóm theo bộ phận, tick loại trừ ngay trên giao diện

**Files:**
- Modify: `apps/web/components/BangNhanVien.tsx:5,65-91`
- Modify: `apps/web/app/nhan-vien/page.tsx:28-38` (khối giải thích cấp quyền)

**Interfaces:**
- Consumes: `VAI_TRO`, `HO_SO_VAI_TRO`, `NHAN_VAI_TRO`, `NHAN_BO_PHAN`, `apDungLoaiTruCapBac`, `type BoPhan`, `type VaiTro` (Task 1); `suaNhanVien`, `doiTenNhanVien` (Task 4).
- Produces: không có (thành phần lá).

- [ ] **Bước 1: Đổi import trong `BangNhanVien.tsx`**

Thay dòng 4-5:

```typescript
import { doiTenNhanVien, suaNhanVien } from '@/lib/nen-tang/nhan-su'
import {
  HO_SO_VAI_TRO, NHAN_BO_PHAN, NHAN_VAI_TRO, VAI_TRO,
  apDungLoaiTruCapBac, type BoPhan, type VaiTro,
} from '@/lib/nen-tang/vai-tro'
```

- [ ] **Bước 2: Thêm hằng nhóm vai trò theo bộ phận, ngay dưới `export type DongNhanVien`**

```typescript
/** Gom vai trò theo bộ phận để bảng đỡ thành một hàng 13 ô tick rối mắt. */
const NHOM_THEO_BO_PHAN = VAI_TRO.reduce<Partial<Record<BoPhan, VaiTro[]>>>((acc, v) => {
  const bp = HO_SO_VAI_TRO[v].boPhan
  ;(acc[bp] ??= []).push(v)
  return acc
}, {})
```

- [ ] **Bước 3: Thay ô "Vai trò" (dòng 65-91) bằng bản nhóm theo bộ phận**

```tsx
<td className="px-4 py-3">
  <div className="space-y-1.5">
    {(Object.entries(NHOM_THEO_BO_PHAN) as [BoPhan, VaiTro[]][]).map(([bp, ds]) => (
      <div key={bp} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-xs text-slate-400 w-20 shrink-0">{NHAN_BO_PHAN[bp]}</span>
        {ds.map((v) => {
          const co = nv.vai_tro.includes(v)
          return (
            <label key={v} className="inline-flex items-center gap-1.5 text-slate-800 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={co}
                disabled={dangChay}
                onChange={() => {
                  // Tick trưởng thì tự bỏ nhân viên CÙNG bộ phận (luật CEO chốt).
                  // Khác bộ phận không đụng — cs + sales là kiêm nhiệm hợp lệ.
                  const moi = co
                    ? nv.vai_tro.filter((x) => x !== v)
                    : apDungLoaiTruCapBac([...(nv.vai_tro as VaiTro[]), v])
                  chay(() => suaNhanVien(nv.id, { vai_tro: moi }))
                }}
                className="rounded border-slate-300"
              />
              {NHAN_VAI_TRO[v]}
            </label>
          )
        })}
      </div>
    ))}
  </div>
  {nv.vai_tro.length === 0 && (
    <div className="text-xs text-amber-600 mt-1">chưa gán vai trò</div>
  )}
</td>
```

- [ ] **Bước 4: Cập nhật khối giải thích ở `app/nhan-vien/page.tsx` (dòng 28-38)**

```tsx
<div className="bg-white rounded-xl border p-4 text-sm text-slate-600 space-y-1">
  <p className="font-medium text-slate-900">Cách gán vai trò</p>
  <p>· Một người <b>kiêm nhiều bộ phận</b> thoải mái — CSKH + Sales, Trưởng CSKH + Trưởng Sales,
    hay nhân viên mảng này kiêm trưởng mảng kia đều được.</p>
  <p>· Trong <b>cùng một bộ phận</b> thì trưởng và nhân viên loại trừ nhau: tích Trưởng CSKH
    là tự bỏ tích Nhân viên CSKH.</p>
  <p>· <b>Trưởng CSKH</b> thêm quyền <i>duyệt</i> (serial, yêu cầu sửa, export, khách chờ) + nghiệp
    vụ nâng cao (ghi chi phí ticket, lắp/thu hồi/đổi máy, kho serial, nhóm lỗi, xuất báo cáo).</p>
  <p>· <b>Quản trị hệ thống</b>: toàn quyền — quản lý nhân viên, đồng bộ catalog, nhật ký, và
    <b> xoá thông tin khách</b>.</p>
  <p className="text-slate-500 pt-1">
    CEO, Giám đốc Kỹ thuật, CTV lắp đặt, Marketing, Kho, Kế toán, Tài chính mới được thêm vào
    danh sách và <b>chưa có quyền riêng</b> trong app — sẽ cấp ở bước ma trận phân quyền.
  </p>
</div>
```

- [ ] **Bước 5: Kiểm kiểu + lint + build**

```bash
npx --prefix apps/web tsc --noEmit && npm --prefix apps/web run lint && npm --prefix apps/web run build
```
Kỳ vọng: sạch.

- [ ] **Bước 6: Xem thật trên máy (DB local)**

```bash
npm --prefix apps/web run env:local && npm --prefix apps/web run dev
```
Mở `http://localhost:3000/nhan-vien` bằng tài khoản admin. Kiểm:
1. Thấy đủ 13 vai trò, xếp theo 9 bộ phận.
2. Tích **Trưởng CSKH** cho một người đang là Nhân viên CSKH → ô Nhân viên CSKH tự bỏ tích sau khi lưu.
3. Tích **Nhân viên Sales** cho người đang là Nhân viên CSKH → **giữ cả hai** (khác bộ phận).
4. Người đang giữ cả `cs` lẫn `cs_manager` từ trước: lần đầu bấm lưu bất kỳ là được dọn còn `cs_manager`.

- [ ] **Bước 7: Commit**

```bash
cd ~/gwt-worktrees/nen-tang-tai-khoan
git add apps/web/components/BangNhanVien.tsx apps/web/app/nhan-vien/page.tsx
git -c user.name=AIGWTVN -c user.email=ai@gwt.vn commit -m "feat(nhan-vien): bảng vai trò nhóm theo bộ phận, tick trưởng tự bỏ nhân viên

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Admin mời người ngoài `@gwt.vn` (cho CTV lắp đặt)

**Files:**
- Modify: `apps/web/lib/nen-tang/nhan-su-luat.ts` (thêm `kiemTraLoiMoi` — hàm thuần)
- Modify: `apps/web/lib/nen-tang/nhan-su.ts` (thêm `moiNhanSu` — Server Action)
- Modify: `apps/web/lib/nen-tang/nhan-su-luat.test.ts` (thêm mô tả cho `kiemTraLoiMoi`)
- Create: `apps/web/components/MoiNhanSu.tsx`
- Modify: `apps/web/app/nhan-vien/page.tsx` (đặt form vào trang)

**Interfaces:**
- Consumes: `requireStaff`, `laAdmin`, `dataClient`, `ghiAudit`, `chuanBiVaiTroDeGhi`, `chuanHoaEmail`, `KHONG_DU_QUYEN`.
- Produces: `kiemTraLoiMoi(email:string, vaiTro:string[]):{ok:true;email:string;vaiTro:VaiTro[]}|{ok:false;lyDo:string}` · `moiNhanSu(email:string, vaiTro:string[]):Promise<{ok:true}|{ok:false;error:string}>`

- [ ] **Bước 1: Viết test thất bại cho luật lời mời**

Thêm vào cuối `apps/web/lib/nen-tang/nhan-su-luat.test.ts`:

```typescript
import { kiemTraLoiMoi } from './nhan-su-luat'

describe('kiemTraLoiMoi — admin mời người ngoài domain', () => {
  it('email hợp lệ + vai trò hợp lệ thì qua, email được hạ chữ thường', () => {
    expect(kiemTraLoiMoi('  CTV.Nam@Gmail.com ', ['ctv_lap_dat']))
      .toEqual({ ok: true, email: 'ctv.nam@gmail.com', vaiTro: ['ctv_lap_dat'] })
  })

  it('email rỗng hoặc sai định dạng thì chặn', () => {
    expect(kiemTraLoiMoi('', ['ctv_lap_dat'])).toEqual({ ok: false, lyDo: 'Email không hợp lệ.' })
    expect(kiemTraLoiMoi('khong-phai-email', ['ctv_lap_dat'])).toEqual({ ok: false, lyDo: 'Email không hợp lệ.' })
    expect(kiemTraLoiMoi('a@b', ['ctv_lap_dat'])).toEqual({ ok: false, lyDo: 'Email không hợp lệ.' })
  })

  it('bắt buộc chọn ít nhất một vai trò — mời vào mà không vai trò là tài khoản trống', () => {
    expect(kiemTraLoiMoi('ctv@gmail.com', [])).toEqual({ ok: false, lyDo: 'Phải chọn ít nhất một vai trò.' })
  })

  it('vai trò lạ bị chặn', () => {
    expect(kiemTraLoiMoi('ctv@gmail.com', ['superuser'])).toEqual({ ok: false, lyDo: 'Vai trò không hợp lệ.' })
  })

  it('áp luật loại trừ cấp bậc ngay lúc mời', () => {
    expect(kiemTraLoiMoi('x@gmail.com', ['ky_thuat', 'ctv_lap_dat']))
      .toEqual({ ok: true, email: 'x@gmail.com', vaiTro: ['ky_thuat'] })
  })

  it('KHÔNG cho mời thẳng vào quyền quản trị — phải gán riêng sau', () => {
    expect(kiemTraLoiMoi('x@gmail.com', ['admin']))
      .toEqual({ ok: false, lyDo: 'Không mời thẳng vào quyền quản trị. Mời trước, gán quyền sau.' })
  })
})
```

- [ ] **Bước 2: Chạy test để chắc chắn nó đỏ**

Chạy: `npm --prefix apps/web run test -- lib/nen-tang/nhan-su-luat.test.ts`
Kỳ vọng: FAIL — `kiemTraLoiMoi is not a function`.

- [ ] **Bước 3a: Thêm `kiemTraLoiMoi` vào `lib/nen-tang/nhan-su-luat.ts`** (hàm thuần, không phải Server Action)

```typescript
/**
 * Luật lời mời — hàm THUẦN, test được.
 *
 * Vì sao chặn mời thẳng vào 'admin': lời mời là đường DUY NHẤT đưa email ngoài
 * @gwt.vn vào hệ thống. Gõ nhầm một ký tự mà lại kèm quyền quản trị thì người lạ
 * cầm chìa khoá. Mời trước (quyền thấp), admin gán quyền sau ở bảng bên dưới.
 */
export function kiemTraLoiMoi(
  email: string,
  vaiTro: string[]
): { ok: true; email: string; vaiTro: VaiTro[] } | { ok: false; lyDo: string } {
  const e = chuanHoaEmail(email)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(e)) return { ok: false, lyDo: 'Email không hợp lệ.' }
  if (vaiTro.length === 0) return { ok: false, lyDo: 'Phải chọn ít nhất một vai trò.' }
  if (vaiTro.includes('admin')) {
    return { ok: false, lyDo: 'Không mời thẳng vào quyền quản trị. Mời trước, gán quyền sau.' }
  }
  const kq = chuanBiVaiTroDeGhi(vaiTro)
  if (!kq.ok) return { ok: false, lyDo: kq.lyDo }
  return { ok: true, email: e, vaiTro: kq.vaiTro ?? [] }
}

```

- [ ] **Bước 3b: Thêm `moiNhanSu` vào `lib/nen-tang/nhan-su.ts`**

Bổ sung `import { KHONG_DU_QUYEN, chuanBiVaiTroDeGhi, kiemTraLoiMoi, toStaff, type Staff } from './nhan-su-luat'` (thay dòng import cũ), rồi thêm:

```typescript
/**
 * Mời một người vào hệ thống bằng email cá nhân — dùng cho CTV lắp đặt, những
 * người không có email công ty.
 *
 * KHÔNG nới DOMAIN_CONG_TY: luật vào cửa vẫn là "có tên trong bảng staff thì
 * vào được". Lời mời chính là việc ghi tên vào bảng đó.
 *
 * hoat_dong=true ngay: admin đã chủ động nhập email và chọn vai trò rồi, bắt
 * duyệt thêm một lần nữa là thừa. Người được mời vẫn phải đăng nhập Google bằng
 * ĐÚNG email đó mới vào được.
 */
export async function moiNhanSu(email: string, vaiTro: string[]) {
  await requireStaff()
  if (!(await laAdmin())) return { ok: false as const, error: KHONG_DU_QUYEN }

  const kt = kiemTraLoiMoi(email, vaiTro)
  if (!kt.ok) return { ok: false as const, error: kt.lyDo }

  const db = dataClient()
  const { data: daCo, error: e1 } = await db
    .from('staff').select('id').eq('email', kt.email).maybeSingle()
  if (e1) return { ok: false as const, error: e1.message }
  if (daCo) return { ok: false as const, error: 'Email này đã có trong danh sách nhân viên.' }

  const { error } = await db.from('staff').insert({
    email: kt.email,
    ten: kt.email.split('@')[0],
    vai_tro: kt.vaiTro,
    hoat_dong: true,
  })
  if (error) return { ok: false as const, error: error.message }

  await ghiAudit('moi_nhan_su', `email:${kt.email}`, { vai_tro: kt.vaiTro })
  revalidatePath('/nhan-vien')
  return { ok: true as const }
}
```

- [ ] **Bước 4: Chạy test, phải xanh**

Chạy: `npm --prefix apps/web run test -- lib/nen-tang/nhan-su-luat.test.ts`
Kỳ vọng: PASS toàn bộ.

- [ ] **Bước 5: Tạo `apps/web/components/MoiNhanSu.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { moiNhanSu } from '@/lib/nen-tang/nhan-su'
import { HO_SO_VAI_TRO, NHAN_VAI_TRO, VAI_TRO, apDungLoaiTruCapBac, type VaiTro } from '@/lib/nen-tang/vai-tro'

/** Không mời thẳng vào quyền quản trị — xem kiemTraLoiMoi(). */
const VAI_TRO_MOI_DUOC = VAI_TRO.filter((v) => v !== 'admin')

export function MoiNhanSu() {
  const [email, setEmail] = useState('')
  const [chon, setChon] = useState<VaiTro[]>([])
  const [loi, setLoi] = useState<string | null>(null)
  const [xong, setXong] = useState<string | null>(null)
  const [dangChay, batDau] = useTransition()

  function gui() {
    setLoi(null)
    setXong(null)
    batDau(async () => {
      const r = await moiNhanSu(email, chon)
      if (!r.ok) { setLoi(r.error); return }
      setXong(`Đã thêm ${email.trim().toLowerCase()} vào danh sách.`)
      setEmail('')
      setChon([])
    })
  }

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <div>
        <p className="font-medium text-slate-900">Mời người ngoài @gwt.vn</p>
        <p className="text-sm text-slate-500">
          Dành cho cộng tác viên lắp đặt và người dùng email cá nhân. Họ đăng nhập Google
          bằng đúng email này. Gõ sai email là mời nhầm người lạ — kiểm lại trước khi bấm.
        </p>
      </div>

      {loi && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{loi}</p>}
      {xong && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{xong}</p>}

      <input
        type="email"
        value={email}
        disabled={dangChay}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="ctv.nam@gmail.com"
        className="w-full max-w-80 rounded-lg border px-3 py-2 text-slate-900"
      />

      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {VAI_TRO_MOI_DUOC.map((v) => (
          <label key={v} className="inline-flex items-center gap-1.5 text-sm text-slate-800 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={chon.includes(v)}
              disabled={dangChay}
              onChange={() =>
                setChon((truoc) =>
                  truoc.includes(v)
                    ? truoc.filter((x) => x !== v)
                    : apDungLoaiTruCapBac([...truoc, v])
                )
              }
              className="rounded border-slate-300"
            />
            {NHAN_VAI_TRO[v]}
            <span className="text-xs text-slate-400">({HO_SO_VAI_TRO[v].boPhan})</span>
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={gui}
        disabled={dangChay || !email.trim() || chon.length === 0}
        className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm disabled:opacity-40"
      >
        {dangChay ? 'Đang thêm…' : 'Mời vào hệ thống'}
      </button>
    </div>
  )
}
```

- [ ] **Bước 6: Đặt form vào trang `/nhan-vien`**

Thêm `import { MoiNhanSu } from '@/components/MoiNhanSu'` và đặt `<MoiNhanSu />` ngay dưới `<BangNhanVien … />`.

- [ ] **Bước 7: Kiểm kiểu + lint + build + toàn bộ test**

```bash
npm --prefix apps/web run test
npx --prefix apps/web tsc --noEmit && npm --prefix apps/web run lint && npm --prefix apps/web run build
```
Kỳ vọng: sạch.

- [ ] **Bước 8: Xem thật trên máy (DB local)**

Mở `http://localhost:3000/nhan-vien` bằng tài khoản admin:
1. Mời `thu-nghiem-ctv@gmail.com` với vai trò **CTV lắp đặt** → xuất hiện trong bảng, đang hoạt động.
2. Mời lại đúng email đó → báo "đã có trong danh sách", không tạo dòng thứ hai.
3. Gõ `khong-phai-email` → báo "Email không hợp lệ.".
4. Bấm mời khi chưa tích vai trò nào → nút bị khoá.
5. Xoá dòng thử nghiệm khỏi DB local sau khi xong.

- [ ] **Bước 9: Commit**

```bash
cd ~/gwt-worktrees/nen-tang-tai-khoan
git add apps/web/lib/nen-tang/nhan-su-luat.ts apps/web/lib/nen-tang/nhan-su.ts apps/web/lib/nen-tang/nhan-su-luat.test.ts apps/web/components/MoiNhanSu.tsx apps/web/app/nhan-vien/page.tsx
git -c user.name=AIGWTVN -c user.email=ai@gwt.vn commit -m "feat(nhan-vien): admin mời người ngoài @gwt.vn (CTV lắp đặt)

Không nới DOMAIN_CONG_TY — lời mời chính là ghi tên vào bảng staff, đúng
luật vào cửa sẵn có. Chặn mời thẳng vào quyền quản trị.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Chuyển khu Work và Sales sang import thẳng `@/lib/nen-tang/*`

**Files:**
- Modify: `apps/web/app/work/page.tsx` · `apps/web/app/work/actions.ts`
- Modify: `apps/web/app/sales/page.tsx` · `apps/web/app/sales/khach/page.tsx` · `apps/web/app/sales/actions.ts`

**Interfaces:**
- Consumes: mọi thứ Task 3 sinh ra.
- Produces: không có. Đây là bước chứng minh khu nền tảng đứng độc lập — module không phải CS không còn import gì từ `lib/supabase.ts`.

Khu CS **cố tình giữ nguyên** trên shim: 172 chỗ gọi, đổi hết trong một commit là rủi ro sót, mà sót một chỗ nghĩa là một trang không gác cổng. CS sẽ chuyển dần ở GĐ2/GĐ3 khi từng file được sờ tới vì lý do khác.

- [ ] **Bước 1: Liệt kê chính xác chỗ cần đổi**

```bash
cd ~/gwt-worktrees/nen-tang-tai-khoan/apps/web
grep -rn "from '@/lib/supabase'" app/work app/sales
```
Ghi lại danh sách — chỉ đổi đúng những dòng này.

- [ ] **Bước 2: Đổi từng import theo đúng đích**

| Ký hiệu đang import | Đổi sang |
|---|---|
| `requireStaff`, `requireNhanSu`, `layNhanVien`, `NhanVien` | `@/lib/nen-tang/phien` |
| `dataClient`, `authClient` | `@/lib/nen-tang/db` |
| `laAdmin`, `laQuanLy`, `coTheVaoCS`, `coTheVaoSales`, `chanNeuKhongPhai*` | `@/lib/nen-tang/gac-cong` |

Không đổi gì khác trong các file này — không sửa logic, không đổi tên biến.

- [ ] **Bước 3: Xác nhận khu Work/Sales đã sạch shim**

```bash
grep -rn "from '@/lib/supabase'\|from '@/lib/quyen'\|from '@/lib/auth'" app/work app/sales
```
Kỳ vọng: **không ra kết quả nào**.

- [ ] **Bước 4: Chạy toàn bộ kiểm tra**

```bash
npm --prefix apps/web run test
npx --prefix apps/web tsc --noEmit && npm --prefix apps/web run lint && npm --prefix apps/web run build
```
Kỳ vọng: sạch cả bốn.

- [ ] **Bước 5: Xem thật trên máy (DB local)**

Mở `http://localhost:3000/work` và `http://localhost:3000/sales` — vào được như trước, không lỗi console.

- [ ] **Bước 6: Commit**

```bash
cd ~/gwt-worktrees/nen-tang-tai-khoan
git add apps/web/app/work apps/web/app/sales
git -c user.name=AIGWTVN -c user.email=ai@gwt.vn commit -m "refactor(work,sales): import thẳng từ lib/nen-tang, không qua shim của CS

Khu CS tạm giữ shim — 172 chỗ gọi requireStaff(), chuyển dần chứ không
sửa hàng loạt một lượt.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Kiểm chứng cuối GĐ1 (trước khi báo CEO check)

- [ ] `npm --prefix apps/web run test` — xanh hết, **không sửa một dòng nào** trong 4 file test cũ.
- [ ] `npx --prefix apps/web tsc --noEmit` — sạch.
- [ ] `npm --prefix apps/web run lint` — sạch.
- [ ] `npm --prefix apps/web run build` — thành công.
- [ ] `grep -rn "from '@/lib/supabase'" apps/web/app/work apps/web/app/sales` — rỗng.
- [ ] `wc -l apps/web/lib/{supabase,auth,quyen}.ts` — cả ba dưới 20 dòng.
- [ ] DB **production chưa bị đụng**: `git log --oneline` không có commit nào áp migration lên remote; migration 50 chỉ chạy trên local.
- [ ] Cập nhật `BACKLOG.md`: chuyển mục nền tảng sang `⏳ CHỜ TÔI CHECK` với đúng danh sách check ở §9 của spec.
