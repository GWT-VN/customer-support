import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Lưới an toàn tầng app cho #1 (RLS least-privilege).
 *
 * App truy cập DB bằng service_role (dataClient) — BỎ QUA RLS. Nên rào quyền
 * thật nằm ở `requireStaff()` đầu mỗi Server Action. Nếu một hàm chạm DB mà QUÊN
 * gọi requireStaff() thì dữ liệu khách lộ ra qua service_role, không có lưới đỡ.
 *
 * Test này chốt bất biến: MỌI hàm trong actions.ts có gọi `dataClient()` đều
 * phải gọi `requireStaff()`. Kiểm tĩnh trên mã nguồn (heuristic chuỗi) — rẻ, an
 * toàn, KHÔNG đụng cơ chế đăng nhập. Bổ trợ cho RLS Tầng 0 (migration 15).
 *
 * Hàm chỉ UỶ QUYỀN cho hàm khác (không tự gọi dataClient) đương nhiên qua được —
 * ví dụ searchSerials -> truyVanSerial (đã gate), khoaTatCa* -> hàm search đã gate.
 */
const src = readFileSync(fileURLToPath(new URL('../app/actions.ts', import.meta.url)), 'utf8')

describe('actions.ts — mọi hàm chạm DB đều gác requireStaff()', () => {
  // Cắt nguồn theo từng khai báo `async function` (export hoặc private).
  const doan = src.split(/(?=async function )/)
  const viPham: string[] = []
  for (const p of doan) {
    const m = p.match(/^async function (\w+)/) ?? p.match(/\basync function (\w+)/)
    if (!m) continue
    const ten = m[1]
    // Gate hợp lệ: requireStaff() hoặc layNhanVien() (layNhanVien gọi requireStaff bên trong).
    if (p.includes('dataClient(') && !/\b(requireStaff|layNhanVien)\b/.test(p)) viPham.push(ten)
  }

  it('không hàm nào gọi dataClient() mà thiếu requireStaff()', () => {
    expect(
      viPham,
      `Các hàm chạm DB nhưng THIẾU requireStaff(): ${viPham.join(', ')}. ` +
        'Thêm `await requireStaff()` (hoặc laAdmin cho việc admin) ở đầu hàm.',
    ).toEqual([])
  })

  it('vẫn quét được thân actions.ts (chống test rỗng do đổi cấu trúc file)', () => {
    // Nếu file đổi cách viết khiến 0 hàm nào chạm dataClient bị soi, test trên
    // sẽ "xanh giả". Chốt mốc: phải thấy nhiều hàm có cả dataClient lẫn requireStaff.
    const soHamGate = doan.filter(
      (p) => p.includes('dataClient(') && /\brequireStaff\b/.test(p),
    ).length
    expect(soHamGate).toBeGreaterThan(20)
  })
})
