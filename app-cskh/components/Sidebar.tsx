import { laAdmin, laQuanLy, layNguoiDung } from '@/lib/supabase'
import { SidebarNav } from './SidebarNav'

/**
 * Vỏ server của menu dọc: chỉ hiện khi ĐÃ đăng nhập (login/chưa auth -> null,
 * nên trang /login không bị đội menu). Tính quyền để ẩn nhóm Quản lý / Quản trị.
 *
 * layNguoiDung() KHÔNG redirect (khác requireStaff) -> gọi an toàn ở layout gốc
 * vốn bọc cả /login.
 */
export async function Sidebar() {
  const user = await layNguoiDung()
  if (!user) return null
  const [admin, quanLy] = await Promise.all([laAdmin(), laQuanLy()])
  return <SidebarNav laAdmin={admin} laQuanLy={quanLy} />
}
