import { redirect } from 'next/navigation'
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
 * KHÔNG trả boolean mà ĐÁ VỀ TRANG CHỦ khi bị từ chối. Hai lý do:
 *
 *  1. 91 chỗ gọi hàm này đều gọi như một câu lệnh trống (`await doQuyen('...')`),
 *     không ai đọc giá trị trả về — trả boolean thì ở GĐ3 nó tính ra "cấm" rồi
 *     vẫn chạy tiếp, tức là KHÔNG chặn gì cả.
 *  2. Ném lỗi thì chặn được, nhưng người dùng chỉ thấy trang trắng "A server
 *     error occurred" — đúng cái mà requireStaff() đã cố tránh. redirect() cho
 *     họ về trang chủ kèm lý do đọc được.
 *
 * LƯU Ý: redirect() hoạt động bằng cách ném NEXT_REDIRECT — người gọi TUYỆT ĐỐI
 * không được bọc doQuyen() trong try/catch, sẽ nuốt mất redirect.
 *
 * Ở GĐ2 (cầu dao tắt) coQuyen luôn trả kết quả luật cũ = true nên không bao giờ
 * đá ai — chỉ ghi lệch. Từ GĐ3 mới chặn thật.
 */
export async function doQuyen(ma: MaQuyen): Promise<void> {
  if (!(await coQuyen(ma, 'NHANVIEN'))) redirect('/?loi=khong_du_quyen')
}

/**
 * Chặn TRANG theo quyền — thay chanNeuKhongPhaiAdmin()/chanNeuKhongPhaiQuanLy().
 *
 * Ẩn mục menu KHÔNG phải phân quyền: ai biết đường dẫn vẫn mở được. Rào thật nằm
 * ở đây và ở từng Server Action.
 *
 * Ở GĐ2 vẫn cho qua đúng như luật cũ (và ghi lệch); từ GĐ3 thì ma trận chặn thật.
 */
export async function chanNeuThieuQuyen(ma: MaQuyen, gateCu: GateCu) {
  if (!(await coQuyen(ma, gateCu))) redirect('/?loi=khong_du_quyen')
}
