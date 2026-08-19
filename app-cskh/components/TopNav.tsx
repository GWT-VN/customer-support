import { layNguoiDung, quyenNenTang } from '@/lib/supabase'
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
  // Cổng NỀN TẢNG: KHÔNG được đá Sales/Marketing (ngoài CS) ra login khi render nav.
  const { admin, quanLy, chiKyThuat, vaoCS, vaoSales } = await quyenNenTang()
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
