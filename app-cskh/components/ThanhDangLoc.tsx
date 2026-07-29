'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
}: {
  // `href`: link BỎ RIÊNG điều kiện này (giữ mọi điều kiện khác) — cho phép
  // gỡ từng bộ lọc một khi trang có NHIỀU điều kiện cùng lúc (q + sp + bh…).
  // Không truyền thì chip chỉ hiển thị, không gỡ riêng được (trang cũ chỉ có
  // đúng 1 điều kiện q -> nút "Xoá lọc" chung đã đủ).
  dieuKien: { nhan: string; giaTri: string; href?: string }[]
  hienThi: number
  tong: number
  nhan?: string
}) {
  const pathname = usePathname()
  const dangLoc = dieuKien.length > 0
  const dong = hienThi < tong ? `Hiện ${hienThi} trên ${tong} ${nhan}` : `${tong} ${nhan}`

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
      <div className="flex items-center gap-2 flex-wrap">
        {dieuKien.map((d) => (
          // Đệm hai bên phải CÂN MẮT. Trước đây px-2 dùng chung cho cả chip, còn dấu ×
          // là chữ trơn nằm trong luồng văn bản -> bên phải chỉ còn đúng 8px tính từ
          // nét chữ tới viền, nhìn như dính vào viền trong khi bên trái thoáng hơn hẳn.
          // Nay × là ô vuông 16px có tâm riêng: lề phải bóp còn pr-1, cộng khoảng trống
          // trong ô thành ~9px tới nét chữ — cân với pl-2.5 (10px) bên trái. Chip không
          // có nút gỡ thì không cần bù, giữ px-2.5 đối xứng.
          <span
            key={d.nhan}
            className={`inline-flex items-center gap-1 py-1 rounded-full bg-slate-100 text-slate-700 text-xs ${
              d.href ? 'pl-2.5 pr-1' : 'px-2.5'
            }`}
          >
            <span>
              {d.nhan}: <strong>{d.giaTri}</strong>
            </span>
            {d.href && (
              <Link
                href={d.href}
                aria-label={`Bỏ lọc ${d.nhan}`}
                className="flex-none grid place-items-center w-4 h-4 rounded-full leading-none text-slate-400 hover:bg-slate-200 hover:text-slate-900"
              >
                ×
              </Link>
            )}
          </span>
        ))}
        <span className="text-slate-500">{dong}</span>
      </div>
      {dangLoc && (
        <Link href={pathname} className="text-slate-600 underline hover:text-slate-900 flex-none">
          Xoá lọc
        </Link>
      )}
    </div>
  )
}
