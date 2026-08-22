import { Suspense } from 'react'
import Link from 'next/link'
import { listKhachHang, khoaTatCaKhachHang, exportCuaToi, listBangView, kenhChon, demKhachThieuSdt } from '@/app/actions'
import { ExportKhachButton } from '@/components/ExportKhachButton'
import { ThaoTacHangLoat } from '@/components/ThaoTacHangLoat'
import { BangKhach } from '@/components/BangKhach'
import { DauTrang } from '@/components/DauTrang'
import { TaoKhachButton } from '@/components/TaoKhachButton'
import { SUA_HL_KHACH } from '@/lib/danhSach'
import { OTimKiem, ThanhDangLoc, PhanTrang } from '@/bang'
import { KhungChon, ThanhDaChon } from '@/bang'
import { hoiQuyen } from '@/lib/nen-tang/kiem-quyen'

export default async function KhachHangPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; trang?: string; cot?: string; chieu?: string; thieu_sdt?: string }>
}) {
  const { q = '', trang: trangRaw, cot, chieu, thieu_sdt } = await searchParams
  const locThieuSdt = thieu_sdt === '1'
  const trang = Math.max(1, Number(trangRaw) || 1)
  // Ba nút, ba quyền khác nhau — trước đây gom vào laQuanLy/laAdmin nên tick lại
  // ma trận là nút hiện sai. Cặp (mã quyền, luật cũ) khớp y hệt Server Action.
  const [{ rows: list, tong, soTrang, sapXep }, quyen, exportDuyet, views, kenh, soThieuSdt] = await Promise.all([
    listKhachHang(q, { trang, cot, chieu, thieuSdt: locThieuSdt }),
    hoiQuyen({
      hangLoat: ['cs.hang_loat.cap_nhat', 'QUANLY'],
      xoaHangLoat: ['cs.khach.xoa_hang_loat', 'ADMIN'],
      viewChung: ['he_thong.view_chung', 'QUANLY'],
    }),
    exportCuaToi(),
    listBangView('cs_customers'),
    kenhChon(),
    demKhachThieuSdt(),
  ])

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        <DauTrang tieuDe="Khách hàng" phuDe={`${tong.toLocaleString('vi-VN')} khách`}>
          <TaoKhachButton kenh={kenh} />
        </DauTrang>

        <Suspense>
          <OTimKiem placeholder="Gõ tên khách, SĐT…" />
        </Suspense>

        {/* Chip lọc "Cần xin lại SĐT" — CEO chốt 22/08: cho tạo khách không SĐT, đổi lại phải
            có chỗ lọc ra danh sách phải gọi xin số. Hiện SỐ ngay trên chip để CS thấy mà làm,
            chứ chip trống thì không ai bấm. */}
        {(soThieuSdt > 0 || locThieuSdt) && (
          <div className="flex">
            <Link
              href={locThieuSdt ? '/khach-hang' : '/khach-hang?thieu_sdt=1'}
              prefetch={false}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                locThieuSdt
                  ? 'bg-amber-600 text-white'
                  : 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'}`}
            >
              {locThieuSdt ? '✕ Bỏ lọc · ' : '☎ '}Cần xin lại SĐT ({soThieuSdt})
            </Link>
          </div>
        )}

        <ThanhDangLoc
          dieuKien={[
            ...(q ? [{ nhan: 'Từ khoá', giaTri: q }] : []),
            ...(locThieuSdt ? [{ nhan: 'Lọc', giaTri: 'Cần xin lại SĐT' }] : []),
          ]}
          hienThi={list.length}
          tong={tong}
          nhan="khách"
          sapXep={sapXep}
        />

        <ExportKhachButton q={q} daDuyet={exportDuyet} />

        <KhungChon
          khoaTrang={list.map((c) => c.id)}
          tong={tong}
          bat={quyen.hangLoat}
          thamSo={{ q, cot, chieu }}
          layTatCaKhoa={khoaTatCaKhachHang}
        >
          <ThanhDaChon nhan="khách">
            <ThaoTacHangLoat bang="cs_customers" truong={SUA_HL_KHACH} choPhepXoa={quyen.xoaHangLoat} />
          </ThanhDaChon>
          <Suspense>
            <BangKhach rows={list} choViewChung={quyen.viewChung} views={views} />
          </Suspense>
        </KhungChon>

        <Suspense>
          <PhanTrang trang={trang} soTrang={soTrang} />
        </Suspense>
      </div>
    </main>
  )
}
