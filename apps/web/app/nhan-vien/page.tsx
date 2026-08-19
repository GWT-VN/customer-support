import { BangNhanVien } from '@/components/BangNhanVien'
import { listAllStaff } from '@/app/actions'
import { chanNeuKhongPhaiAdmin, layNhanVien } from '@/lib/supabase'
import { laQuyenAdmin } from '@/lib/quyen'

export default async function NhanVienPage() {
  // Rào THẬT của trang này. Ẩn mục menu chỉ là cho gọn mắt.
  await chanNeuKhongPhaiAdmin()

  const [ds, toi] = await Promise.all([listAllStaff(), layNhanVien()])
  const soAdmin = ds.filter((n) => n.hoat_dong && laQuyenAdmin(n.vai_tro)).length

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">Nhân viên</h1>
        </header>

        <p className="text-sm text-slate-500">
          {ds.length} người · {soAdmin} quản trị đang hoạt động. Ai đăng nhập bằng email
          <code className="mx-1 text-xs">@gwt.vn</code> lần đầu sẽ tự xuất hiện ở đây (đang khoá, chưa
          gán vai trò) — bật hoạt động và tích vai trò cho họ. Một người có thể giữ nhiều vai trò.
        </p>

        <BangNhanVien ds={ds} toiId={toi?.id ?? ''} />

        <div className="bg-white rounded-xl border p-4 text-sm text-slate-600 space-y-1">
          <p className="font-medium text-slate-900">Ba cấp quyền (một người giữ nhiều vai trò)</p>
          <p>· <b>NV CSKH / NV Sales</b>: xem + xử lý khách, máy, ticket, lịch lõi như thường ngày.</p>
          <p>· <b>Trưởng CSKH</b>: thêm quyền <i>duyệt</i> (serial, yêu cầu sửa, export, khách chờ) + nghiệp
            vụ nâng cao (ghi chi phí ticket, lắp/thu hồi/đổi máy, kho serial, nhóm lỗi, xuất báo cáo).</p>
          <p>· <b>Quản trị</b>: toàn quyền — quản lý nhân viên, đồng bộ catalog, nhật ký, và <b>xoá thông tin
            khách</b> (chỉ admin duyệt).</p>
          <p className="text-slate-500 pt-1">
            Trưởng Sales / NV Sales chưa có nghiệp vụ riêng trong app CSKH này.
          </p>
        </div>
      </div>
    </main>
  )
}
