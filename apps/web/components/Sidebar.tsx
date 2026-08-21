import { layNguoiDung } from '@/lib/nen-tang/phien'
import { coTheVaoCS, laChiKyThuatVien } from '@/lib/nen-tang/gac-cong'
import { quyenChoMan } from '@/lib/nen-tang/kiem-quyen'
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
  const [quyen, chiKyThuat, vaoCS] = await Promise.all([
    quyenChoMan([
      ['cs.bao_tri.tao_plan', 'QUANLY'],
      ['cs.ky_thuat.ho_so', 'QUANLY'],
      ['cs.ky_thuat.xep_lich', 'QUANLY'],
      ['cs.yeu_cau.xem', 'QUANLY'],
      ['cs.bao_cao.doanh_so', 'ADMIN'],
      ['he_thong.catalog', 'ADMIN'],
      ['he_thong.nhat_ky', 'ADMIN'],
      ['he_thong.nhan_su.xem', 'ADMIN'],
    ]),
    laChiKyThuatVien(), coTheVaoCS(),
  ])
  return <SidebarNav quyen={quyen} chiKyThuat={chiKyThuat} coTheVaoCS={vaoCS} />
}
