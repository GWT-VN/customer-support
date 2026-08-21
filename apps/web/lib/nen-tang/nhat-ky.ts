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
