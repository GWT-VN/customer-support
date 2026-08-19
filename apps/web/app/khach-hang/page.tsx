import { Suspense } from 'react'
import { listKhachHang, khoaTatCaKhachHang, exportCuaToi, listBangView } from '@/app/actions'
import { ExportKhachButton } from '@/components/ExportKhachButton'
import { ThaoTacHangLoat } from '@/components/ThaoTacHangLoat'
import { BangKhach } from '@/components/BangKhach'
import { DauTrang } from '@/components/DauTrang'
import { TaoKhachButton } from '@/components/TaoKhachButton'
import { SUA_HL_KHACH } from '@/lib/danhSach'
import { OTimKiem, ThanhDangLoc, PhanTrang } from '@/bang'
import { KhungChon, ThanhDaChon } from '@/bang'
import { laAdmin, laQuanLy } from '@/lib/supabase'

export default async function KhachHangPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; trang?: string; cot?: string; chieu?: string }>
}) {
  const { q = '', trang: trangRaw, cot, chieu } = await searchParams
  const trang = Math.max(1, Number(trangRaw) || 1)
  // quanLy (admin|cs_manager): xem/sửa hàng loạt + nút nâng cao. chiAdmin: riêng XOÁ khách.
  const [{ rows: list, tong, soTrang, sapXep }, quanLy, chiAdmin, exportDuyet, views] = await Promise.all([
    listKhachHang(q, { trang, cot, chieu }),
    laQuanLy(),
    laAdmin(),
    exportCuaToi(),
    listBangView('cs_customers'),
  ])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        <DauTrang tieuDe="Khách hàng" phuDe={`${tong.toLocaleString('vi-VN')} khách`}>
          <TaoKhachButton />
        </DauTrang>

        <Suspense>
          <OTimKiem placeholder="Gõ tên khách, SĐT…" />
        </Suspense>

        <ThanhDangLoc
          dieuKien={q ? [{ nhan: 'Từ khoá', giaTri: q }] : []}
          hienThi={list.length}
          tong={tong}
          nhan="khách"
          sapXep={sapXep}
        />

        <ExportKhachButton q={q} daDuyet={exportDuyet} />

        <KhungChon
          khoaTrang={list.map((c) => c.id)}
          tong={tong}
          bat={quanLy}
          thamSo={{ q, cot, chieu }}
          layTatCaKhoa={khoaTatCaKhachHang}
        >
          <ThanhDaChon nhan="khách">
            <ThaoTacHangLoat bang="cs_customers" truong={SUA_HL_KHACH} choPhepXoa={chiAdmin} />
          </ThanhDaChon>
          <Suspense>
            <BangKhach rows={list} admin={quanLy} views={views} />
          </Suspense>
        </KhungChon>

        <Suspense>
          <PhanTrang trang={trang} soTrang={soTrang} />
        </Suspense>
      </div>
    </main>
  )
}
