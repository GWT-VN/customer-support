'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Suspense } from 'react'
import { ChipSapXep } from './ChipSapXep'
import { useGiaoDien } from './CauHinh'

/**
 * Thanh trạng thái "đang lọc": chip điều kiện đang bật + số dòng đang thấy
 * trên tổng số thật + nút Xoá lọc (link về pathname trần, bỏ mọi query).
 *
 * Vá lỗi cắt-cứng-N-dòng: trước đây lọc ra 80 kết quả chỉ hiện 50 (giới hạn
 * 1 trang) mà không có gì báo — người dùng tưởng đó là toàn bộ. Nay luôn
 * phân biệt "đang thấy X" với "có Y" khi X < Y, dù có đang lọc hay không.
 *
 * Không đụng useSearchParams (chỉ usePathname) -> KHÔNG cần bọc <Suspense>.
 *
 * `nhan`: danh từ cho số đếm (mặc định "kết quả") — mỗi trang danh sách có
 * một danh từ khác nhau (máy, ticket, khách cần dọn, nhóm lỗi…), giữ đúng
 * giọng văn cũ thay vì đổi hết về "kết quả" chung chung.
 */
export function ThanhDangLoc({
  dieuKien,
  hienThi,
  tong,
  nhan = 'kết quả',
  sapXep,
}: {
  // `href`: link BỎ RIÊNG điều kiện này (giữ mọi điều kiện khác) — cho phép
  // gỡ từng bộ lọc một khi trang có NHIỀU điều kiện cùng lúc (q + sp + bh…).
  // Không truyền thì chip chỉ hiển thị, không gỡ riêng được (trang cũ chỉ có
  // đúng 1 điều kiện q -> nút "Xoá lọc" chung đã đủ).
  dieuKien: { nhan: string; giaTri: string; href?: string }[]
  hienThi: number
  tong: number
  nhan?: string
  // Cột/chiều MÁY CHỦ đã chốt (KetQuaTrang.sapXep), không phải giá trị trên URL —
  // xem chú thích trong ChipSapXep. Trang không sắp xếp được thì bỏ trống.
  sapXep?: { cot: string; tang: boolean; macDinh: boolean; ghiChu?: string }
}) {
  const gd = useGiaoDien()
  const pathname = usePathname()
  const dangLoc = dieuKien.length > 0
  const dong = hienThi < tong ? `Hiện ${hienThi} trên ${tong} ${nhan}` : `${tong} ${nhan}`

  return (
    <div className={gd.dangLoc_khung}>
      <div className={gd.dangLoc_nhomChip}>
        {dieuKien.map((d) => (
          // Đệm hai bên phải CÂN MẮT. Trước đây px-2 dùng chung cho cả chip, còn dấu ×
          // là chữ trơn nằm trong luồng văn bản -> bên phải chỉ còn đúng 8px tính từ
          // nét chữ tới viền, nhìn như dính vào viền trong khi bên trái thoáng hơn hẳn.
          // Nay × là ô vuông 16px có tâm riêng. Nét chữ × chỉ chiếm giữa ô, chừa sẵn
          // 4.5px mỗi bên, nên lề phải chỉ cần pr-1.5 (6px) là ra 10.5px từ nét chữ tới
          // viền — khớp pl-2.5 (10px) bên trái. Đã đo trên bản chạy thật bằng Range:
          // trái 10 / phải 10.5 / trên 4 / dưới 4. Chip không có nút gỡ giữ px-2.5.
          <span
            key={d.nhan}
            className={`${gd.dangLoc_chip} ${d.href ? gd.dangLoc_chipCoNutGo : gd.dangLoc_chipTron}`}
          >
            <span>
              {d.nhan}: <strong>{d.giaTri}</strong>
            </span>
            {d.href && (
              <Link
                href={d.href}
                aria-label={`Bỏ lọc ${d.nhan}`}
                className={gd.dangLoc_nutGoChip}
              >
                ×
              </Link>
            )}
          </span>
        ))}
        <span className={gd.dangLoc_soDong}>{dong}</span>
        {/* ChipSapXep dùng useSearchParams (dựng link bỏ sắp xếp) -> phải có
            Suspense, không thì next build vỡ. Bọc ở đây thay vì bắt 4 trang gọi
            ThanhDangLoc phải nhớ bọc. */}
        {sapXep && (
          <Suspense>
            <ChipSapXep
              cot={sapXep.cot} tang={sapXep.tang} macDinh={sapXep.macDinh} ghiChu={sapXep.ghiChu}
            />
          </Suspense>
        )}
      </div>
      {dangLoc && (
        <Link href={pathname} className={gd.dangLoc_nutXoaLoc}>
          Xoá lọc
        </Link>
      )}
    </div>
  )
}
