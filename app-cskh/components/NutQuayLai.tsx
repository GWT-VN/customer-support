'use client'

import { useRouter } from 'next/navigation'

/**
 * Nút lui đi theo LỊCH SỬ THẬT, không đoán trang cha.
 *
 * Vì sao không dùng link cứng: trang chi tiết vào được từ nhiều nhánh. Chi tiết
 * khách vào được từ Máy đã lắp, Khách cần dọn, Ticket, Lịch lõi, Nhóm lỗi — link
 * cứng về '/' thì ai đi từ "Khách cần dọn" sẽ bị ném sang "Máy đã lắp".
 *
 * `macDinh` chỉ dùng khi KHÔNG có lịch sử để lui: người dùng mở thẳng link được
 * gửi, hoặc mở tab mới. Lúc đó lui về đâu là đoán, nên chọn nơi hợp lý nhất.
 */
export function NutQuayLai({ macDinh }: { macDinh: string }) {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back()
        else router.push(macDinh)
      }}
      className="text-sm text-slate-600 underline hover:text-slate-900"
    >
      ← Quay lại
    </button>
  )
}
