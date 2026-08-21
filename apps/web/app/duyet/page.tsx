import { chanNeuThieuQuyen, coQuyenHienNut } from '@/lib/nen-tang/kiem-quyen'
import { listKhachChoDuyet, listYeuCauThayDoi, listYeuCauExport } from '@/app/actions'
import { KhachChoDuyetList } from '@/components/KhachChoDuyetList'
import { DuyetList } from '@/components/DuyetList'
import { DuyetExportList } from '@/components/DuyetExportList'

export default async function DuyetPage() {
  await chanNeuThieuQuyen('cs.yeu_cau.xem', 'QUANLY')
  // Trang này gác bằng cs.yeu_cau.xem, nhưng khối "khách chờ duyệt" bên dưới đòi
  // cs.khach.duyet_cho — HAI quyền khác nhau. Ai được tick quyền này mà không được
  // tick quyền kia thì gọi vô điều kiện là bị đá khỏi trang.
  const duocDuyetKhach = await coQuyenHienNut('cs.khach.duyet_cho', 'QUANLY')
  const [khachCho, yeuCau, yeuCauExport] = await Promise.all([
    duocDuyetKhach ? listKhachChoDuyet() : Promise.resolve([]),
    listYeuCauThayDoi(), listYeuCauExport(),
  ])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">Chờ duyệt</h1>
        </header>

        <section className="space-y-2">
          <h2 className="font-medium text-slate-900">Khách mới ({khachCho.length})</h2>
          <p className="text-xs text-slate-400">Khách do CS tạo, chờ duyệt để chính thức.</p>
          <KhachChoDuyetList items={khachCho} />
        </section>

        <section className="space-y-2">
          <h2 className="font-medium text-slate-900">Yêu cầu sửa/xoá ({yeuCau.length})</h2>
          <p className="text-xs text-slate-400">CS đề xuất sửa/xoá khách · SĐT phụ · lịch thay lõi · máy đã lắp. Duyệt là áp thật.</p>
          <DuyetList items={yeuCau} />
        </section>

        <section className="space-y-2">
          <h2 className="font-medium text-slate-900">Yêu cầu xuất có SĐT/địa chỉ ({yeuCauExport.length})</h2>
          <p className="text-xs text-slate-400">Duyệt xong người gửi mới tải được bản có PII.</p>
          <DuyetExportList items={yeuCauExport} />
        </section>
      </div>
    </main>
  )
}
