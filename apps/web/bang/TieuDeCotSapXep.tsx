'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useCauHinh } from './CauHinh'

/**
 * `<th>` bấm được để đổi cột sắp xếp — CHỈ dùng cho cột nằm trong whitelist
 * COT_* ở lib/danhSach.ts (tầng truy vấn đã chặn injection qua sapXepHopLe(),
 * đây chỉ là phần bấm-để-đổi-URL). Cột ngoài whitelist giữ `<th>` thường,
 * đừng bọc component này — bấm mà không đổi được gì thì gây hiểu lầm.
 *
 * Bấm cột đang sắp -> đảo chiều. Bấm cột khác -> chuyển sang cột đó, dùng
 * `chieuMacDinh` làm chiều khởi đầu. Luôn XOÁ `trang` (đổi thứ tự -> về
 * trang 1), giữ nguyên mọi tham số khác trên URL (q, state, tt, bh…).
 *
 * Dùng useSearchParams -> nơi gọi (bọc quanh `<thead>`) phải nằm trong
 * <Suspense>, không thì build production vỡ — lỗi CHỈ lộ lúc build, chạy
 * dev vẫn bình thường (xem AGENTS.md).
 */
export function TieuDeCotSapXep({
  cot,
  nhan,
  chieuMacDinh = 'asc',
  dangMacDinh = false,
}: {
  /** Tên cột — PHẢI có trong whitelist COT_* tương ứng, không thì bấm vô tác dụng. */
  cot: string
  nhan: string
  /** Chiều dùng khi cột này đang là mặc định của trang, hoặc lần đầu bấm sang nó. */
  chieuMacDinh?: 'asc' | 'desc'
  /** true nếu đây là cột sắp xếp mặc định của trang lúc URL CHƯA có ?cot=. */
  dangMacDinh?: boolean
}) {
  const { giaoDien: gd, tenCot, nghiaSapXep } = useCauHinh()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const cotUrl = searchParams.get('cot')
  const dangChonCotNay = cotUrl ? cotUrl === cot : dangMacDinh
  // chieu trên URL chỉ có ý nghĩa khi ?cot= trùng đúng cột này — khớp với
  // sapXepHopLe(): cot rỗng/lạ thì bỏ qua LUÔN CẢ chieu, dùng nguyên macDinh.
  const chieuHienTai: 'asc' | 'desc' =
    cotUrl === cot ? (searchParams.get('chieu') === 'asc' ? 'asc' : 'desc') : chieuMacDinh
  const chieuKeTiep: 'asc' | 'desc' = dangChonCotNay
    ? chieuHienTai === 'asc' ? 'desc' : 'asc'
    : chieuMacDinh

  const params = new URLSearchParams(searchParams.toString())
  params.set('cot', cot)
  params.set('chieu', chieuKeTiep)
  params.delete('trang')

  // Cột ĐANG sắp phải nhìn ra ngay: trước đây chỉ đổi màu mỗi mũi tên nhỏ xíu,
  // liếc qua cả hàng tiêu đề không biết đang sắp theo cột nào. Nay cả nhãn đậm
  // + đen + nền trắng nổi khỏi nền xám của <thead>.
  const nghia = nghiaSapXep[cot]
  const moTaKeTiep = nghia
    ? `Sắp theo ${(tenCot[cot] ?? nhan).toLowerCase()}: ${nghia[chieuKeTiep]}`
    : `Sắp theo ${nhan}`

  return (
    <th
      className={`${gd.tieuDe_o} ${dangChonCotNay ? gd.tieuDe_oDangSap : ''}`}
      aria-sort={dangChonCotNay ? (chieuHienTai === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <Link
        href={`${pathname}?${params.toString()}`}
        title={moTaKeTiep}
        className={`${gd.tieuDe_link} ${dangChonCotNay ? gd.tieuDe_linkDangSap : ''}`}
      >
        {nhan}
        <span className={dangChonCotNay ? gd.tieuDe_muiTenDangSap : gd.tieuDe_muiTenThuong}>
          {dangChonCotNay ? (chieuHienTai === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </Link>
    </th>
  )
}
