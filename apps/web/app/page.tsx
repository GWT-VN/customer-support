import { Suspense } from 'react'
import { searchMachines, machineModels, khoaTatCaMay, listBangView } from './actions'
import { OTimKiem } from '@/bang'
import { ThanhDangLoc } from '@/bang'
import { PhanTrang } from '@/bang'
import { BoLocChon } from '@/bang'
import { LocNgay } from '@/bang'
import { NHAN_TINH_TRANG_BH, TINH_TRANG_BH, tenModel, moTaLocNgay, docLocNgay, type TinhTrangBH } from '@/lib/danhSach'
import { redirect } from 'next/navigation'
import { laQuanLy, quyenNenTang } from '@/lib/supabase'
import { KhungChon, ThanhDaChon } from '@/bang'
import { ExportMayButton } from '@/components/ExportMayButton'
import { BangMay } from '@/components/BangMay'
import { DauTrang } from '@/components/DauTrang'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; trang?: string; cot?: string; chieu?: string; sp?: string; bh?: string; ngtu?: string; ngden?: string }>
}) {
  // Định tuyến qua CỔNG NỀN TẢNG (requireNhanSu) — KHÔNG đá non-CS ra /login.
  const { chiKyThuat, vaoCS, vaoSales } = await quyenNenTang()
  // Kỹ thuật hiện trường: không có nghiệp vụ ở trang máy — đưa thẳng về lịch của họ.
  if (chiKyThuat) redirect('/ky-thuat/cua-toi')
  // Ngoài khu CS: Sales thuần -> khu Sales; còn lại (Marketing…) -> khu Việc.
  if (!vaoCS) redirect(vaoSales ? '/sales' : '/work')
  const { q = '', trang: trangRaw, cot, chieu, sp, bh, ngtu, ngden } = await searchParams
  const trang = Math.max(1, Number(trangRaw) || 1)
  const [{ rows: machines, tong, soTrang, sapXep }, models, admin] = await Promise.all([
    searchMachines(q, { trang, cot, chieu, maSanPham: sp, tinhTrangBH: bh, ngtu, ngden }),
    machineModels(),
    laQuanLy(),
  ])
  const views = await listBangView('installed_base')

  const tenSanPham = models.find((m) => m.internal_code === sp)?.product_name ?? sp
  const tenBaoHanh = bh && TINH_TRANG_BH.includes(bh as TinhTrangBH) ? NHAN_TINH_TRANG_BH[bh as TinhTrangBH] : bh

  // Link bỏ RIÊNG một điều kiện, giữ nguyên các điều kiện còn lại (kể cả cột/chiều đang
  // sắp) — không đụng `trang` (bỏ lọc không nhất thiết phải về trang 1, nhưng để đơn
  // giản thì bỏ luôn cho khỏi lệch).
  function hrefBoDieuKien(bo: string) {
    const params = new URLSearchParams()
    if (q && bo !== 'q') params.set('q', q)
    if (sp && bo !== 'sp') params.set('sp', sp)
    if (bh && bo !== 'bh') params.set('bh', bh)
    if (ngtu && bo !== 'ngay') params.set('ngtu', ngtu)
    if (ngden && bo !== 'ngay') params.set('ngden', ngden)
    if (cot) params.set('cot', cot)
    if (chieu) params.set('chieu', chieu)
    const qs = params.toString()
    return qs ? `/?${qs}` : '/'
  }

  const { tu: ngtuOk, den: ngdenOk } = docLocNgay({ ngtu, ngden })
  const moTaNgay = moTaLocNgay(ngtuOk, ngdenOk, 'Ngày lắp')

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <DauTrang
          tieuDe="Máy đã lắp"
          phuDe={`${tong.toLocaleString('vi-VN')} máy · lọc theo sản phẩm, bảo hành, ngày lắp`}
        />

        <Suspense>
          <OTimKiem placeholder="Gõ SĐT, serial hoặc tên khách…" />
        </Suspense>

        <Suspense>
          <div className="flex gap-2 flex-wrap">
            <BoLocChon
              param="sp"
              nhan="Sản phẩm"
              // Ô chọn hiện MÃ MÁY cho gọn ("GN610"), còn chip lọc bên dưới vẫn
              // hiện tên đầy đủ — chỗ nào cần đọc kỹ thì có, chỗ nào cần liếc
              // nhanh thì ngắn.
              tuyChon={models.map((m) => ({
                giaTri: m.internal_code,
                nhan: tenModel(m.product_name, m.internal_code),
              }))}
            />
            <BoLocChon
              param="bh"
              nhan="Bảo hành"
              tuyChon={TINH_TRANG_BH.map((k) => ({ giaTri: k, nhan: NHAN_TINH_TRANG_BH[k] }))}
            />
            <LocNgay nhan="Ngày lắp" />
          </div>
        </Suspense>

        <ThanhDangLoc
          dieuKien={[
            ...(q ? [{ nhan: 'Từ khoá', giaTri: q, href: hrefBoDieuKien('q') }] : []),
            ...(sp ? [{ nhan: 'Sản phẩm', giaTri: tenSanPham ?? sp, href: hrefBoDieuKien('sp') }] : []),
            ...(bh ? [{ nhan: 'Bảo hành', giaTri: tenBaoHanh ?? bh, href: hrefBoDieuKien('bh') }] : []),
            ...(moTaNgay ? [{ nhan: 'Ngày lắp', giaTri: moTaNgay.replace(/^Ngày lắp\s*[:=]?\s*/, ''), href: hrefBoDieuKien('ngay') }] : []),
          ]}
          hienThi={machines.length}
          tong={tong}
          nhan="máy"
          sapXep={sapXep}
        />

        <KhungChon
          khoaTrang={machines.map((m) => m.serial)}
          tong={tong}
          bat={admin}
          // KHÔNG có `trang`: lật trang không được coi là đổi bộ lọc, xem ChonDong.tsx
          thamSo={{ q, sp, bh, cot, chieu, ngtu, ngden }}
          layTatCaKhoa={khoaTatCaMay}
        >
        <ThanhDaChon nhan="máy" />
        <BangMay rows={machines} admin={admin} views={views}
          congCu={admin && <ExportMayButton q={q} sp={sp} bh={bh} ngtu={ngtu} ngden={ngden} />} />
        </KhungChon>

        <Suspense>
          <PhanTrang trang={trang} soTrang={soTrang} />
        </Suspense>
      </div>
    </main>
  )
}
