import { chanNeuThieuQuyen } from '@/lib/nen-tang/kiem-quyen'
import Link from 'next/link'
import { laAdmin } from '@/lib/nen-tang/gac-cong'
import { dsKyThuat, trangThaiTaiKhoanKT } from '@/app/actions'
import { RosterKyThuat } from '@/components/RosterKyThuat'

/** Quản lý danh sách kỹ thuật + (admin) cấp/thu quyền đăng nhập cho họ. */
export default async function NhanSuKyThuatPage() {
  await chanNeuThieuQuyen('cs.ky_thuat.ho_so', 'QUANLY')
  const [dsKt, admin, trangThai] = await Promise.all([dsKyThuat(false), laAdmin(), trangThaiTaiKhoanKT()])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Danh sách kỹ thuật</h1>
            <p className="text-sm text-slate-500">Nhân viên + cộng tác viên đi hiện trường. {admin ? 'Cấp đăng nhập cho kỹ thuật bằng email của họ (họ chỉ thấy lịch chuyến của mình).' : 'Chỉ quản trị mới cấp được quyền đăng nhập.'}</p>
          </div>
          <Link href="/ky-thuat" className="rounded-lg border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Gán lịch →</Link>
        </header>

        <RosterKyThuat dsKt={dsKt} trangThai={trangThai} laAdmin={admin} />
      </div>
    </main>
  )
}
