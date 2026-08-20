import { cache } from 'react'
import { dataClient } from './db'
import { laAdmin, laQuanLy } from './gac-cong'
import { layNhanVien } from './phien'
import { laMaQuyenHopLe, type MaQuyen } from './quyen'

/**
 * Luật CŨ đang gác chỗ gọi này — người gọi phải nói ra, vì hàm không tự đoán được.
 *  ADMIN    — trước đây gác bằng laAdmin()
 *  QUANLY   — trước đây gác bằng laQuanLy()
 *  NHANVIEN — trước đây chỉ cần requireStaff() (ai vào được khu là làm được)
 */
export type GateCu = 'ADMIN' | 'QUANLY' | 'NHANVIEN'

/**
 * Cầu dao GĐ3. Mặc định TẮT ⇒ ma trận chỉ được hỏi ý kiến, luật cũ quyết định.
 * Đặt MA_TRAN_QUYEN=on để ma trận làm luật thật; đặt lại off là quay về luật cũ
 * trong một phút, không cần deploy.
 */
export function maTranDangLamLuat(): boolean {
  return process.env.MA_TRAN_QUYEN === 'on'
}

/**
 * Tập quyền của người đang đăng nhập, gộp từ MỌI vai trò họ giữ.
 *
 * cache() gom về MỘT lượt đọc cho cả request — một trang gọi chục Server Action,
 * không thể mỗi lần lại hỏi database (nó ở Singapore).
 */
export const quyenCuaToi = cache(async (): Promise<Set<MaQuyen>> => {
  const nv = await layNhanVien()
  if (!nv || nv.vai_tro.length === 0) return new Set()

  const { data, error } = await dataClient()
    .from('quyen_vai_tro').select('ma_quyen').in('vai_tro', nv.vai_tro)
  if (error) throw new Error(error.message)

  const ra = new Set<MaQuyen>()
  for (const r of data ?? []) {
    const ma = (r as { ma_quyen: string }).ma_quyen
    if (laMaQuyenHopLe(ma)) ra.add(ma) // mã lạ còn sót trong DB: không tin
  }
  return ra
})

/** Ghi lệch — hỏng thì im, KHÔNG được làm chết nghiệp vụ chỉ vì ghi log. */
async function ghiLech(ma: MaQuyen, luatCu: boolean, maTran: boolean) {
  try {
    const nv = await layNhanVien()
    await dataClient().rpc('nen_tang_ghi_lech_quyen', {
      p_staff_id: nv?.id ?? null,
      p_email: nv?.email ?? null,
      p_ma_quyen: ma,
      p_luat_cu: luatCu,
      p_ma_tran: maTran,
    })
  } catch {
    // nuốt có chủ đích
  }
}

/**
 * Cổng quyền dùng chung — thay cho laAdmin()/laQuanLy() rải rác.
 *
 * GĐ2 (mặc định): TRẢ VỀ KẾT QUẢ LUẬT CŨ, và ghi một dòng lệch nếu ma trận nói
 * khác. Nhờ vậy dò được ô tick sai trên dữ liệu dùng thật mà KHÔNG khoá nhầm ai.
 * GĐ3 (MA_TRAN_QUYEN=on): ma trận quyết định.
 *
 * Hai luật cứng chống khoá chết hệ thống (không tự khoá mình, phải còn ít nhất
 * một admin) KHÔNG BAO GIỜ đi qua đây — chúng nằm trong vai-tro.ts:kiemTraSuaNhanVien.
 */
export async function coQuyen(ma: MaQuyen, gateCu: GateCu): Promise<boolean> {
  const cu =
    gateCu === 'ADMIN' ? await laAdmin()
    : gateCu === 'QUANLY' ? await laQuanLy()
    : true

  const moi = (await quyenCuaToi()).has(ma)
  if (moi !== cu) await ghiLech(ma, cu, moi)

  return maTranDangLamLuat() ? moi : cu
}

/**
 * Dùng ở chỗ TRƯỚC ĐÂY KHÔNG CÓ RÀO nào ngoài requireStaff().
 *
 * Chỉ đo và ghi lệch, luôn cho qua ở GĐ2 — nhưng ở GĐ3 thì chặn thật. Đây là chỗ
 * bắt được ca kỹ thuật thuần: hôm nay họ sửa được hồ sơ khách, ma trận nói không.
 */
export async function doQuyen(ma: MaQuyen): Promise<boolean> {
  return coQuyen(ma, 'NHANVIEN')
}
