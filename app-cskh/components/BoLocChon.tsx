'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * Ô chọn lọc theo MỘT tham số URL (vd sản phẩm, tình trạng bảo hành, loại lỗi).
 * Đổi lựa chọn -> điều hướng ngay, XOÁ `trang` (đổi lọc thì về trang 1), giữ
 * nguyên mọi tham số khác.
 *
 * Dùng useSearchParams -> nơi gọi phải nằm trong <Suspense>.
 */
export function BoLocChon({
  param,
  nhan,
  tuyChon,
}: {
  /** Tên tham số trên URL, vd 'sp', 'bh', 'loai'. */
  param: string
  /** Nhãn hiển thị khi chưa chọn gì (option "Tất cả"). */
  nhan: string
  tuyChon: { giaTri: string; nhan: string }[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    <select
      value={searchParams.get(param) ?? ''}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString())
        if (e.target.value) params.set(param, e.target.value)
        else params.delete(param)
        params.delete('trang')
        const qs = params.toString()
        router.push(qs ? `${pathname}?${qs}` : pathname)
      }}
      className="rounded-lg border px-3 py-1.5 text-sm text-slate-700 bg-white"
    >
      <option value="">{nhan}: Tất cả</option>
      {tuyChon.map((t) => (
        <option key={t.giaTri} value={t.giaTri}>
          {t.nhan}
        </option>
      ))}
    </select>
  )
}
