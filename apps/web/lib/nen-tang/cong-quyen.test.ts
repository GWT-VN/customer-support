import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { laMaQuyenHopLe } from './quyen'

/**
 * Lưới an toàn cho ma trận phân quyền.
 *
 * Sau GĐ2-B, mọi chỗ gác trong actions.ts phải đi qua coQuyen() để ma trận NHÌN
 * THẤY. Còn sót một laQuanLy()/laAdmin() thô nghĩa là chỗ đó vô hình với ma trận:
 * tab "Lệch" im lặng mà thực tế vẫn lệch, và tới GĐ3 thì tick hay không tick cũng
 * chẳng ảnh hưởng gì tới nó. Kiểm tĩnh trên mã nguồn — rẻ và không đụng đăng nhập.
 */
const doc = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')

const FILE = [
  ['app/actions.ts', doc('../../app/actions.ts')],
  ['lib/nen-tang/nhan-su.ts', doc('./nhan-su.ts')],
  ['lib/nen-tang/ma-tran.ts', doc('./ma-tran.ts')],
] as const

describe('mọi chỗ gác đều đi qua ma trận', () => {
  it('không còn laQuanLy() / laAdmin() thô ở tầng nghiệp vụ', () => {
    for (const [ten, src] of FILE) {
      const tho = [...src.matchAll(/await (laQuanLy|laAdmin)\(\)/g)].map((m) => m[1])
      expect(tho, `${ten} còn ${tho.length} chỗ gác không qua coQuyen()`).toEqual([])
    }
  })

  it('mọi mã quyền dùng trong coQuyen() đều CÓ THẬT trong kho quyền', () => {
    // Gõ sai tên quyền là hở: coQuyen trả về false mãi mãi mà không ai báo.
    for (const [ten, src] of FILE) {
      for (const m of src.matchAll(/coQuyen\(\s*'([^']+)'/g)) {
        expect(laMaQuyenHopLe(m[1]), `${ten} dùng mã lạ: ${m[1]}`).toBe(true)
      }
    }
  })

  it('mọi coQuyen() đều khai báo luật cũ hợp lệ', () => {
    for (const [ten, src] of FILE) {
      for (const m of src.matchAll(/coQuyen\(\s*'[^']+',\s*'([^']+)'/g)) {
        expect(['ADMIN', 'QUANLY', 'NHANVIEN'], `${ten}: gate lạ ${m[1]}`).toContain(m[1])
      }
    }
  })

  it('PHỦ KÍN: mọi hàm chạm DB trong actions.ts đều đi qua ma trận', () => {
    // Một hàm chạm dataClient() mà không qua coQuyen/doQuyen là VÔ HÌNH với ma trận:
    // tick hay không tick cũng không ảnh hưởng tới nó, kể cả sau GĐ3.
    const src = doc('../../app/actions.ts')
    const doan = src.split(/(?=async function )/)
    const viPham: string[] = []
    for (const p of doan) {
      const m = p.match(/\basync function (\w+)/)
      if (!m) continue
      if (!p.includes('dataClient(')) continue
      if (!/\b(coQuyen|doQuyen)\(/.test(p)) viPham.push(m[1])
    }
    expect(
      viPham,
      `Hàm chạm DB nhưng KHÔNG qua ma trận: ${viPham.join(', ')}. ` +
        "Thêm await doQuyen('<mã quyền>') ngay sau requireStaff().",
    ).toEqual([])
  })

  it('chốt mốc: đã nối đủ nhiều chỗ (chống test xanh giả khi đổi cấu trúc file)', () => {
    const tong = FILE.reduce(
      (n, [, src]) => n + [...src.matchAll(/\b(?:coQuyen|doQuyen)\(/g)].length,
      0,
    )
    expect(tong).toBeGreaterThanOrEqual(140)
  })
})
