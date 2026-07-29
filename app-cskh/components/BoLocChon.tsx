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

  const dangChon = searchParams.get(param) ?? ''
  const nhanDangChon = tuyChon.find((t) => t.giaTri === dangChon)?.nhan ?? `${nhan}: Tất cả`

  return (
    // Bọc relative để tự vẽ mũi tên. Mũi tên MẶC ĐỊNH của trình duyệt
    // (appearance: auto) nằm ngoài tầm kiểm soát của CSS: đặt padding-right bao
    // nhiêu nó vẫn bám mép phải theo cách riêng của từng trình duyệt, nên không
    // cân được với lề trái. appearance-none + mũi tên tự vẽ mới chốt được cả hai bên.
    <div className="relative inline-flex max-w-full">
      <select
        value={dangChon}
        title={nhanDangChon}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString())
          if (e.target.value) params.set(param, e.target.value)
          else params.delete(param)
          params.delete('trang')
          const qs = params.toString()
          router.push(qs ? `${pathname}?${qs}` : pathname)
        }}
        // w-56 CỐ ĐỊNH, không để trình duyệt tự co giãn: select tự động rộng bằng
        // option DÀI NHẤT, mà danh sách sản phẩm có tên tới 47 ký tự -> ô "Sản phẩm"
        // phình ra 382px trong khi ô "Bảo hành" chỉ 173px. Hai ô cạnh nhau lệch hơn
        // gấp đôi, và chữ đang chọn thì dính mép trái còn mũi tên bị đẩy ra tận mép
        // phải, chính giữa trống hoác. (Đo trên bản chạy thật 2026-07-29.)
        //
        // Chốt cứng bằng nhau -> hàng bộ lọc thẳng hàng. Tên dài bị cắt bằng
        // truncate, bù lại bằng title= để rê chuột đọc đủ.
        className="w-56 max-w-full truncate appearance-none rounded-lg border bg-white pl-3 pr-8 py-1.5 text-sm text-slate-700"
      >
        <option value="">{nhan}: Tất cả</option>
        {tuyChon.map((t) => (
          <option key={t.giaTri} value={t.giaTri}>
            {t.nhan}
          </option>
        ))}
      </select>
      {/* Mép phải mũi tên cách viền 12px = đúng lề trái 12px của chữ. */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"
      >
        ▼
      </span>
    </div>
  )
}
