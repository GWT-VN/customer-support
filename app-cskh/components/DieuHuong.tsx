import { laAdmin } from '@/lib/supabase'
import { DieuHuongClient } from './DieuHuongClient'

/**
 * Vỏ server của menu: chỉ làm một việc là hỏi "người này có phải admin không",
 * rồi giao cho lõi client (cần usePathname để biết đang ở mục nào).
 *
 * Tách vậy để mục "Nhân viên" chỉ hiện với admin mà 9 trang đang gọi <DieuHuong />
 * không phải sửa gì. Ẩn mục này KHÔNG phải phân quyền — /nhan-vien tự chặn ở
 * server bằng chanNeuKhongPhaiAdmin().
 */
export async function DieuHuong() {
  return <DieuHuongClient laAdmin={await laAdmin()} />
}
