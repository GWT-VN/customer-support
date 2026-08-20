import { chanNeuThieuQuyen } from '@/lib/nen-tang/kiem-quyen'
import { BangNhanVien } from '@/components/BangNhanVien'
import { MoiNhanSu } from '@/components/MoiNhanSu'
import { listAllStaff } from '@/lib/nen-tang/nhan-su'
import { layNhanVien } from '@/lib/nen-tang/phien'
import { laQuyenAdmin } from '@/lib/nen-tang/vai-tro'

export default async function NhanVienPage() {
  // Rào THẬT của trang này. Ẩn mục menu chỉ là cho gọn mắt.
  await chanNeuThieuQuyen('he_thong.nhan_su.xem', 'ADMIN')

  const [ds, toi] = await Promise.all([listAllStaff(), layNhanVien()])
  const soAdmin = ds.filter((n) => n.hoat_dong && laQuyenAdmin(n.vai_tro)).length

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">Nhân viên</h1>
          <a
            href="/nhan-vien/phan-quyen"
            className="rounded-lg border bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Phân quyền theo vai trò →
          </a>
        </header>

        <p className="text-sm text-slate-500">
          {ds.length} người · {soAdmin} quản trị đang hoạt động. Ai đăng nhập bằng email
          <code className="mx-1 text-xs">@gwt.vn</code> lần đầu sẽ tự xuất hiện ở đây (đang khoá, chưa
          gán vai trò) — bật hoạt động và tích vai trò cho họ. Một người có thể giữ nhiều vai trò.
        </p>

        <BangNhanVien ds={ds} toiId={toi?.id ?? ''} />

        <MoiNhanSu />

        <div className="bg-white rounded-xl border p-4 text-sm text-slate-600 space-y-1">
          <p className="font-medium text-slate-900">Cách gán vai trò</p>
          <p>· Một người <b>kiêm nhiều bộ phận</b> thoải mái — CSKH + Sales, Trưởng CSKH + Trưởng Sales,
            hay nhân viên mảng này kiêm trưởng mảng kia đều được.</p>
          <p>· Trong <b>cùng một bộ phận</b> thì trưởng và nhân viên loại trừ nhau: tích Trưởng CSKH
            là tự bỏ tích Nhân viên CSKH.</p>
          <p>· <b>Trưởng CSKH</b> thêm quyền <i>duyệt</i> (serial, yêu cầu sửa, export, khách chờ) + nghiệp
            vụ nâng cao (ghi chi phí ticket, lắp/thu hồi/đổi máy, kho serial, nhóm lỗi, xuất báo cáo).</p>
          <p>· <b>Quản trị hệ thống</b>: toàn quyền — quản lý nhân viên, đồng bộ catalog, nhật ký, và
            <b> xoá thông tin khách</b>.</p>
          <p className="text-slate-500 pt-1">
            CEO, Giám đốc Kỹ thuật, CTV lắp đặt, Marketing, Kho, Kế toán, Tài chính mới được thêm vào
            danh sách và <b>chưa có quyền riêng</b> trong app — sẽ cấp ở bước ma trận phân quyền.
          </p>
        </div>
      </div>
    </main>
  )
}
