import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
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

/**
 * Lưới an toàn cho GIAO DIỆN (việc 24).
 *
 * Rào thật đã đi qua ma trận từ GĐ3, nhưng giao diện thì vẫn ẩn/hiện nút bằng
 * cờ vai trò thô. Hai bên nói khác nhau ngay khi CEO tick khác luật cũ: nút vẫn
 * hiện mà bấm vào bị chặn, hoặc nút bị ẩn dù đã cấp quyền — người dùng không có
 * cách nào biết mình đang thiếu quyền hay app hỏng.
 *
 * Kiểm tĩnh trên mã nguồn cho rẻ. Cố tình KHÔNG cấm coTheVaoCS/coTheVaoSales/
 * laChiKyThuatVien: chúng trả lời "vào được KHU nào" — luật vào cửa, không phải
 * ma trận quyền.
 */
const GOC = fileURLToPath(new URL('../../', import.meta.url))

function moiFileTsx(thuMuc: string): string[] {
  const ra: string[] = []
  for (const m of readdirSync(GOC + thuMuc, { withFileTypes: true, recursive: true })) {
    if (!m.isFile() || !m.name.endsWith('.tsx')) continue
    ra.push(`${m.parentPath ?? m.path}/${m.name}`)
  }
  return ra
}

const FILE_GIAO_DIEN = ['app', 'components', 'bang'].flatMap(moiFileTsx)

describe('giao diện ẩn/hiện nút theo MA TRẬN, không theo vai trò', () => {
  it('quét được file để kiểm — nếu 0 file thì bài kiểm này vô nghĩa', () => {
    expect(FILE_GIAO_DIEN.length).toBeGreaterThan(30)
  })

  it('không còn chỗ nào ẩn/hiện bằng laAdmin / laQuanLy', () => {
    const viPham: string[] = []
    for (const f of FILE_GIAO_DIEN) {
      // Bỏ chú thích trước khi soi: nhiều file KỂ LẠI lịch sử "trước đây gọi
      // laAdmin()" và đó là ghi chép có ích, không phải vi phạm.
      const src = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')
      // Khớp TÊN ở bất kỳ đâu trong code, kể cả dòng import: file giao diện thì
      // không nên biết tới hai hàm này. Bản hẹp hơn (chỉ khớp `laAdmin(` hoặc
      // `laAdmin=`) đã ĐỂ LỌT một file thử cố tình vi phạm — đo được, nên bỏ.
      if (/\b(laAdmin|laQuanLy)\b/.test(src)) viPham.push(f.replace(GOC, ''))
    }
    expect(viPham, `còn ${viPham.length} file ẩn/hiện theo vai trò thô`).toEqual([])
  })

  it('mọi mã quyền dùng để vẽ giao diện đều CÓ THẬT và khai đúng luật cũ', () => {
    // Gõ sai mã ở đây thì nút biến mất vĩnh viễn mà không ai báo lỗi.
    for (const f of FILE_GIAO_DIEN) {
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(/\[\s*'((?:cs|work|sales|he_thong)\.[a-z_.]+)',\s*'([A-Z]+)'\s*\]/g)) {
        expect(laMaQuyenHopLe(m[1]), `${f.replace(GOC, '')} dùng mã lạ: ${m[1]}`).toBe(true)
        expect(['ADMIN', 'QUANLY', 'NHANVIEN'], `${f.replace(GOC, '')}: gate lạ ${m[2]}`).toContain(m[2])
      }
    }
  })
})
