import { coTheVaoCS, coTheVaoSales, laAdmin, laChiKyThuatVien, laQuanLy, layNguoiDung } from '@/lib/supabase'
import { TopNavClient } from './TopNavClient'

/**
 * Vỏ server của thanh điều hướng ngang: chỉ hiện khi ĐÃ đăng nhập
 * (login/chưa auth -> null). Tính quyền phía server rồi truyền xuống client.
 *
 * layNguoiDung() KHÔNG redirect (khác requireStaff) -> gọi an toàn ở layout gốc
 * vốn bọc cả /login.
 */
export async function TopNav() {
  const user = await layNguoiDung()
  if (!user) return null
  const [admin, quanLy, chiKyThuat, vaoCS, vaoSales] = await Promise.all([
    laAdmin(), laQuanLy(), laChiKyThuatVien(), coTheVaoCS(), coTheVaoSales(),
  ])
  return (
    <TopNavClient
      laAdmin={admin}
      laQuanLy={quanLy}
      chiKyThuat={chiKyThuat}
      coTheVaoCS={vaoCS}
      coTheVaoSales={vaoSales}
      email={user.email ?? null}
    />
  )
}
