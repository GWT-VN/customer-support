import Link from 'next/link'
import { Suspense } from 'react'
import { searchMachines, machineModels, khoaTatCaMay } from './actions'
import { WarrantyBadge, vnDate } from '@/components/Badge'
import { OTimKiem } from '@/bang'
import { ThanhDangLoc } from '@/bang'
import { PhanTrang } from '@/bang'
import { TieuDeCotSapXep } from '@/bang'
import { BoLocChon } from '@/bang'
import { NHAN_TINH_TRANG_BH, TINH_TRANG_BH, tenModel, type TinhTrangBH } from '@/lib/danhSach'
import { laAdmin } from '@/lib/supabase'
import { KhungChon, OChonTatCa, OChonDong, ThanhDaChon } from '@/bang'
import { ExportMayButton } from '@/components/ExportMayButton'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; trang?: string; cot?: string; chieu?: string; sp?: string; bh?: string }>
}) {
  const { q = '', trang: trangRaw, cot, chieu, sp, bh } = await searchParams
  const trang = Math.max(1, Number(trangRaw) || 1)
  const [{ rows: machines, tong, soTrang, sapXep }, models, admin] = await Promise.all([
    searchMachines(q, { trang, cot, chieu, maSanPham: sp, tinhTrangBH: bh }),
    machineModels(),
    laAdmin(),
  ])

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
    if (cot) params.set('cot', cot)
    if (chieu) params.set('chieu', chieu)
    const qs = params.toString()
    return qs ? `/?${qs}` : '/'
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">Máy đã lắp</h1>
        </header>

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
          </div>
        </Suspense>

        <ThanhDangLoc
          dieuKien={[
            ...(q ? [{ nhan: 'Từ khoá', giaTri: q, href: hrefBoDieuKien('q') }] : []),
            ...(sp ? [{ nhan: 'Sản phẩm', giaTri: tenSanPham ?? sp, href: hrefBoDieuKien('sp') }] : []),
            ...(bh ? [{ nhan: 'Bảo hành', giaTri: tenBaoHanh ?? bh, href: hrefBoDieuKien('bh') }] : []),
          ]}
          hienThi={machines.length}
          tong={tong}
          nhan="máy"
          sapXep={sapXep}
        />

        {admin && <ExportMayButton q={q} sp={sp} bh={bh} />}

        <KhungChon
          khoaTrang={machines.map((m) => m.serial)}
          tong={tong}
          bat={admin}
          // KHÔNG có `trang`: lật trang không được coi là đổi bộ lọc, xem ChonDong.tsx
          thamSo={{ q, sp, bh, cot, chieu }}
          layTatCaKhoa={khoaTatCaMay}
        >
        <ThanhDaChon nhan="máy" />
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <Suspense>
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <OChonTatCa nhan="máy" />
                  <TieuDeCotSapXep cot="serial" nhan="Serial" chieuMacDinh="asc" />
                  <TieuDeCotSapXep cot="product_name" nhan="Máy" chieuMacDinh="asc" />
                  <TieuDeCotSapXep cot="customer_name" nhan="Khách" chieuMacDinh="asc" />
                  <th className="text-left px-4 py-3 font-medium">SĐT</th>
                  <TieuDeCotSapXep cot="install_date" nhan="Lắp" chieuMacDinh="desc" dangMacDinh />
                  {/* Sắp theo warranty_full_end (ngày hết BH máy) — tăng dần = sắp hết hạn
                      lên đầu, đúng thứ tự cần gọi khách. Máy chưa kích hoạt BH có
                      full_end null nên rơi xuống cuối (nullsFirst: false). */}
                  <TieuDeCotSapXep cot="warranty_full_end" nhan="Bảo hành" chieuMacDinh="asc" />
                </tr>
              </thead>
            </Suspense>
            <tbody className="divide-y">
              {machines.map((m) => (
                <tr key={m.serial} className="hover:bg-slate-50">
                  <OChonDong khoa={m.serial} moTa={`máy ${m.serial}`} />
                  <td className="px-4 py-3">
                    <Link href={`/may/${encodeURIComponent(m.serial)}`} prefetch={false} className="font-mono text-xs text-slate-900 underline">
                      {m.serial}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{m.product_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    {m.customer_id ? (
                      <Link href={`/khach/${m.customer_id}`} prefetch={false} className="text-slate-900 underline">{m.customer_name}</Link>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">
                    {m.primary_phone ?? <span className="text-amber-600">thiếu</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{vnDate(m.install_date)}</td>
                  <td className="px-4 py-3"><WarrantyBadge m={m} /></td>
                </tr>
              ))}
              {machines.length === 0 && (
                <tr>
                  <td colSpan={admin ? 7 : 6} className="px-4 py-10 text-center text-slate-400">
                    Không tìm thấy máy nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </KhungChon>

        <Suspense>
          <PhanTrang trang={trang} soTrang={soTrang} />
        </Suspense>
      </div>
    </main>
  )
}
