import { laAdmin, layNguoiDung } from '@/lib/supabase'
import { SidebarNav } from './SidebarNav'

/**
 * Vỏ server của menu dọc: chỉ hiện khi ĐÃ đăng nhập (login/chưa auth -> null,
 * nên trang /login không bị đội menu). Tính laAdmin để ẩn nhóm Quản trị.
 *
 * layNguoiDung() KHÔNG redirect (khác requireStaff) -> gọi an toàn ở layout gốc
 * vốn bọc cả /login.
 */
export async function Sidebar() {
  const user = await layNguoiDung()
  if (!user) return null
  return <SidebarNav laAdmin={await laAdmin()} />
}
