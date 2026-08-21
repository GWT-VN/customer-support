import Link from 'next/link'

/**
 * Đường tắt từ hồ sơ khách sang màn gộp, với hồ sơ đang mở điền sẵn vào ô GIỮ LẠI.
 *
 * Trước đây nút này tự mở một hộp chọn khách ngay tại chỗ, chỉ hiện tên + SĐT —
 * không đủ để biết có đúng người không, và không đảo chiều gộp được. Việc so sánh
 * nay dồn hết về /khach/gop để đi đường nào cũng thấy cùng một bảng.
 */
export function GopKhachButton({ giuId }: { giuId: string; tenGiu?: string }) {
  return (
    <Link
      href={`/khach/gop?giu=${encodeURIComponent(giuId)}`}
      prefetch={false}
      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
    >
      Gộp hồ sơ trùng
    </Link>
  )
}
