import Link from 'next/link'
import { NutQuayLai } from '@/components/NutQuayLai'
import { notFound } from 'next/navigation'
import { getMachine, ticketsOfSerial, lichSuSerial, dsTrangThai, daiLyCuaMay, donDaiLyChon } from '@/app/actions'
import { NHAN_DO_CHAC } from '@/lib/danhSach'
import { WarrantyBadge, vnDate } from '@/components/Badge'
import { ActivateForm } from '@/components/ActivateForm'
import { TicketList } from '@/components/TicketList'
import { LoiCuaMay } from '@/components/LoiCuaMay'
import { QuanLyMay } from '@/components/QuanLyMay'
import { GanDonDaiLy } from '@/components/GanDonDaiLy'
import { hoiQuyen } from '@/lib/nen-tang/kiem-quyen'

export default async function MachinePage({ params }: { params: Promise<{ serial: string }> }) {
  const { serial } = await params
  const m = await getMachine(decodeURIComponent(serial))
  if (!m) notFound()
  const [tickets, vongDoi, quyen, dsTT, daiLy, donDaiLy] = await Promise.all([
    ticketsOfSerial(m.serial), lichSuSerial(m.serial), hoiQuyen({
      lichKT: ['cs.ky_thuat.ho_so', 'QUANLY'],
      lapThuDoi: ['cs.may.lap_thu_doi', 'QUANLY'],
      suaKhach: ['cs.khach.xin_xoa', 'NHANVIEN'],
      khoSerial: ['cs.serial.kho', 'QUANLY'],
    }), dsTrangThai(), daiLyCuaMay(m.serial), donDaiLyChon(),
  ])
  // Máy này có phải máy THAY THẾ (đổi máy cho khách) không -> hiện tính chuyển tiếp.
  const suKienThayThe = vongDoi.su_kien.find((s) => s.su_kien === 'doi_may_lap_moi')

  // Chỉ chứa DỮ LIỆU, không chứa JSX — cách hiển thị do chỗ render quyết định.
  // (Để JSX trong mảng thì eslint react/jsx-key báo lỗi, dù ở đây không cần key.)
  const rows: { label: string; value: React.ReactNode; mono?: boolean }[] = [
    { label: 'Serial', value: m.serial, mono: true },
    { label: 'Máy', value: m.product_name ?? '—' },
    { label: 'Mã nội bộ', value: m.internal_code ?? '—', mono: true },
    { label: 'Nhóm', value: m.category_l2 ?? '—' },
    {
      label: 'Ngày bắt đầu BH',
      value: (
        <>
          {vnDate(m.warranty_start ?? m.install_date)}
          {/* Ngày đoán phải nhìn ra ngay — nếu không, CS đọc hạn BH rồi báo chắc nịch
              cho khách trong khi mốc gốc chỉ là ước lượng. */}
          {m.ngay_lap_do_chac && m.ngay_lap_do_chac !== 'chinh_xac' && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {NHAN_DO_CHAC[m.ngay_lap_do_chac]} — ngày chỉ là ước lượng
            </span>
          )}
        </>
      ),
    },
    { label: 'Trạng thái máy', value: m.status },
    { label: 'Hết BH máy', value: vnDate(m.warranty_full_end) },
    { label: 'Hết BH linh kiện', value: vnDate(m.warranty_core_end) },
    ...(m.ghi_chu ? [{ label: 'Ghi chú', value: m.ghi_chu }] : []),
  ]

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <NutQuayLai macDinh="/" />
        </div>

        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{m.product_name}</h1>
          <WarrantyBadge m={m} />
        </div>

        <section className="bg-white rounded-xl border p-5">
          <h2 className="font-medium text-slate-900 mb-3">Khách hàng</h2>
          {suKienThayThe && (
            <p className="text-sm bg-indigo-50 text-indigo-800 rounded-lg px-3 py-2 mb-3">
              🔄 <strong>Máy thay thế</strong> — {suKienThayThe.ghi_chu ?? 'kế thừa bảo hành + khách của máy cũ'}
            </p>
          )}
          {m.customer_id ? (
            <p className="text-sm">
              <Link href={`/khach/${m.customer_id}`} prefetch={false} className="text-slate-900 underline font-medium">
                {m.customer_name}
              </Link>
              <span className="text-slate-500"> · </span>
              <span className="font-mono text-xs">{m.primary_phone ?? <span className="text-amber-600">chưa có SĐT</span>}</span>
            </p>
          ) : <p className="text-sm text-slate-400">Chưa gắn khách</p>}
        </section>

        <section className="bg-white rounded-xl border p-5">
          <h2 className="font-medium text-slate-900 mb-3">Thông tin máy</h2>
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {rows.map(({ label, value, mono }) => (
              <div key={label} className="flex justify-between border-b border-slate-100 py-1.5">
                <dt className="text-slate-500">{label}</dt>
                <dd className={`text-slate-900 text-right${mono ? ' font-mono text-xs' : ''}`}>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="bg-white rounded-xl border p-5">
          <h2 className="font-medium text-slate-900 mb-3">Lõi lọc & lịch thay</h2>
          <LoiCuaMay serial={m.serial} />
          {quyen.lichKT && m.customer_id && (
            <Link href={`/ky-thuat?kh=${m.customer_id}&loai=thay_loi&ref=${encodeURIComponent(m.serial)}`}
              className="mt-3 inline-block rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium">
              + Tạo lịch kỹ thuật (thay lõi máy này)
            </Link>
          )}
        </section>

        <section className="bg-white rounded-xl border p-5">
          <h2 className="font-medium text-slate-900 mb-3">Ticket của máy này ({tickets.length})</h2>
          <TicketList tickets={tickets} empty="Máy này chưa có ticket nào." />
        </section>

        <section className="bg-white rounded-xl border p-5">
          <h2 className="font-medium text-slate-900 mb-3">Bảo hành</h2>
          <ActivateForm
            serial={m.serial}
            defaultDate={m.warranty_start ?? m.install_date}
            activated={m.warranty_activated}
            hasPolicy={m.co_chinh_sach_bh}
          />
        </section>

        <section className="bg-white rounded-xl border p-5">
          <h2 className="font-medium text-slate-900 mb-3">Quản lý máy</h2>
          <GanDonDaiLy serial={m.serial} daiLyTen={daiLy.dai_ly_ten}
            daiLyDon={daiLy.dai_ly_don} donList={donDaiLy} />

          <QuanLyMay serial={m.serial} internalCode={m.internal_code} trangThai={vongDoi.trang_thai} suKien={vongDoi.su_kien}
            dangLap={!!m.customer_id} ds={dsTT}
            choLapThuDoi={quyen.lapThuDoi} choSuaKhach={quyen.suaKhach} choKhoSerial={quyen.khoSerial} />
        </section>
      </div>
    </main>
  )
}
