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
  dieuKien: { nhan: string; giaTri: string }[]
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
          <span key={d.nhan} className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs">
            {d.nhan}: <strong>{d.giaTri}</strong>
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
