import { layNguoiDung } from '@/lib/nen-tang/phien'
import { coTheVaoCS, coTheVaoSales, laChiKyThuatVien } from '@/lib/nen-tang/gac-cong'
import { quyenChoMan } from '@/lib/nen-tang/kiem-quyen'
import { TopNavClient } from './TopNavClient'

/**
 * Vỏ server của thanh điều hướng ngang: chỉ hiện khi ĐÃ đăng nhập
 * (login/chưa auth -> null). Tính quyền phía server rồi truyền xuống client.
 *
 * layNguoiDung() KHÔNG redirect (khác requireStaff) -> gọi an toàn ở layout gốc
 * vốn bọc cả /login.
 *
 * Mỗi mục menu hỏi ĐÚNG mã quyền gác trang nó dẫn tới, không gom vào một cờ
 * laAdmin/laQuanLy như trước. Gom lại thì ngay khi CEO tick khác luật cũ là menu
 * nói một đằng còn trang làm một nẻo: bấm vào bị đá ra, hoặc mục biến mất dù đã
 * được cấp quyền. Cặp (mã quyền, luật cũ) dưới đây phải khớp y hệt lời gọi
 * chanNeuThieuQuyen() ở trang tương ứng.
 */
const MUC_MENU = [
  ['cs.bao_tri.tao_plan', 'QUANLY'],   // /bao-tri/map · /bao-tri/len-lich
  ['cs.ky_thuat.ho_so', 'QUANLY'],     // /ky-thuat · /ky-thuat/nhan-su
  ['cs.ky_thuat.xep_lich', 'QUANLY'],  // /ky-thuat/lich
  ['cs.yeu_cau.xem', 'QUANLY'],        // /duyet
  ['cs.bao_cao.doanh_so', 'ADMIN'],    // /doanh-so
  ['he_thong.catalog', 'ADMIN'],       // /dong-bo-catalog
  ['he_thong.nhat_ky', 'ADMIN'],       // /audit
  ['he_thong.nhan_su.xem', 'ADMIN'],   // /nhan-vien
] as const

export async function TopNav() {
  const user = await layNguoiDung()
  if (!user) return null
  const [chiKyThuat, vaoCS, vaoSales, quyen] = await Promise.all([
    laChiKyThuatVien(), coTheVaoCS(), coTheVaoSales(), quyenChoMan(MUC_MENU),
  ])
  return (
    <TopNavClient
      quyen={quyen}
      chiKyThuat={chiKyThuat}
      coTheVaoCS={vaoCS}
      coTheVaoSales={vaoSales}
      email={user.email ?? null}
    />
  )
}
