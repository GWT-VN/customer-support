'use server'

import { revalidatePath } from 'next/cache'
import { dataClient } from './db'
import { KHONG_DU_QUYEN } from './nhan-su-luat'
import { coQuyen } from './kiem-quyen'
import { ghiAudit } from './nhat-ky'
import { requireStaff } from './phien'
import { MAC_DINH, laMaQuyenHopLe, type MaQuyen } from './quyen'
import { laVaiTroHopLe, type VaiTro } from './vai-tro'

/**
 * Đọc ma trận từ DB.
 *
 * Vai trò chưa có dòng nào trong bảng = **thật sự không có quyền gì**, KHÔNG phải
 * "chưa khởi tạo" — nên KHÔNG rơi về MAC_DINH ở đây. Nếu rơi về mặc định thì bỏ
 * tick hết một vai trò sẽ tự nhiên khôi phục lại toàn bộ quyền, đúng kiểu lỗ hổng
 * âm thầm. MAC_DINH chỉ dùng làm giá trị SEED lúc migration.
 */
export async function docMaTran(): Promise<Record<string, MaQuyen[]>> {
  await requireStaff()
  if (!(await coQuyen('he_thong.phan_quyen', 'ADMIN'))) throw new Error(KHONG_DU_QUYEN)

  const { data, error } = await dataClient()
    .from('quyen_vai_tro').select('vai_tro, ma_quyen')
  if (error) throw new Error(error.message)

  const ra: Record<string, MaQuyen[]> = {}
  for (const r of data ?? []) {
    const { vai_tro, ma_quyen } = r as { vai_tro: string; ma_quyen: string }
    if (!laMaQuyenHopLe(ma_quyen)) continue // mã lạ còn sót trong DB: bỏ qua, không tin
    ;(ra[vai_tro] ??= []).push(ma_quyen)
  }
  return ra
}

/**
 * Tick / bỏ tick MỘT ô của ma trận.
 *
 * Vai trò `admin` cố tình KHÔNG sửa được: nó là đường thoát hiểm cuối cùng. Bỏ
 * tick `he_thong.phan_quyen` của admin là khoá chết chính màn hình này, phải vào
 * DB sửa tay mới gỡ được.
 */
export async function datQuyen(vaiTro: string, maQuyen: string, bat: boolean) {
  await requireStaff()
  if (!(await coQuyen('he_thong.phan_quyen', 'ADMIN'))) return { ok: false as const, error: KHONG_DU_QUYEN }

  if (!laVaiTroHopLe(vaiTro)) return { ok: false as const, error: 'Vai trò không hợp lệ.' }
  if (!laMaQuyenHopLe(maQuyen)) return { ok: false as const, error: 'Quyền không hợp lệ.' }
  if (vaiTro === 'admin') {
    return {
      ok: false as const,
      error: 'Quản trị hệ thống luôn có toàn quyền — bỏ tick là khoá chết chính màn hình này.',
    }
  }

  const db = dataClient()
  const { error } = bat
    ? await db.from('quyen_vai_tro').upsert({ vai_tro: vaiTro, ma_quyen: maQuyen })
    : await db.from('quyen_vai_tro').delete().eq('vai_tro', vaiTro).eq('ma_quyen', maQuyen)
  if (error) return { ok: false as const, error: error.message }

  await ghiAudit('doi_ma_tran_quyen', `${vaiTro}:${maQuyen}`, { bat })
  revalidatePath('/nhan-vien/phan-quyen')
  return { ok: true as const }
}

/** Trả một vai trò về đúng giá trị khởi tạo (hành vi gốc) — cho ca tick nhầm loạn. */
export async function datLaiVaiTro(vaiTro: string) {
  await requireStaff()
  if (!(await coQuyen('he_thong.phan_quyen', 'ADMIN'))) return { ok: false as const, error: KHONG_DU_QUYEN }
  if (!laVaiTroHopLe(vaiTro)) return { ok: false as const, error: 'Vai trò không hợp lệ.' }

  const db = dataClient()
  const { error: e1 } = await db.from('quyen_vai_tro').delete().eq('vai_tro', vaiTro)
  if (e1) return { ok: false as const, error: e1.message }

  const ds = MAC_DINH[vaiTro as VaiTro].map((q) => ({ vai_tro: vaiTro, ma_quyen: q }))
  if (ds.length) {
    const { error: e2 } = await db.from('quyen_vai_tro').insert(ds)
    if (e2) return { ok: false as const, error: e2.message }
  }
  await ghiAudit('dat_lai_ma_tran_quyen', vaiTro, { so_quyen: ds.length })
  revalidatePath('/nhan-vien/phan-quyen')
  return { ok: true as const }
}

export type DongLech = {
  email: string | null
  ma_quyen: string
  luat_cu: boolean
  ma_tran: boolean
  so_lan: number
  lan_cuoi: string
}

/**
 * Những chỗ ma trận nói KHÁC luật cũ, gộp theo (người, quyền).
 *
 * Đây là màn hình quan trọng nhất của GĐ2: chỉnh ma trận tới khi bảng này chỉ còn
 * những dòng CỐ Ý, rồi mới bật GĐ3. Mỗi dòng còn sót lúc bật là một người đột ngột
 * mất (hoặc bỗng có) một việc.
 */
export async function docLech(): Promise<DongLech[]> {
  await requireStaff()
  if (!(await coQuyen('he_thong.phan_quyen', 'ADMIN'))) throw new Error(KHONG_DU_QUYEN)

  const { data, error } = await dataClient()
    .from('nhat_ky_lech_quyen')
    .select('email, ma_quyen, luat_cu, ma_tran, so_lan, lan_cuoi')
    .order('so_lan', { ascending: false })
    .limit(300)
  if (error) throw new Error(error.message)
  return (data ?? []) as DongLech[]
}

/** Xoá sạch nhật ký lệch — dùng sau khi chỉnh ma trận, để đo lại từ đầu. */
export async function xoaLech() {
  await requireStaff()
  if (!(await coQuyen('he_thong.phan_quyen', 'ADMIN'))) {
    return { ok: false as const, error: KHONG_DU_QUYEN }
  }
  const { error } = await dataClient().from('nhat_ky_lech_quyen').delete().gte('id', 0)
  if (error) return { ok: false as const, error: error.message }
  await ghiAudit('xoa_nhat_ky_lech_quyen')
  revalidatePath('/nhan-vien/phan-quyen')
  return { ok: true as const }
}
