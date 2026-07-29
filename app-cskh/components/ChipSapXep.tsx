import { NGHIA_SAP_XEP, TEN_COT } from '@/lib/danhSach'

/**
 * Câu "đang sắp xếp theo gì" bằng tiếng Việt, đặt ngay trên bảng.
 *
 * Vì sao cần, dù tiêu đề cột đã có mũi tên: mũi tên chỉ nói CHIỀU, không nói
 * NGHĨA. ▲ trên cột "Hạn thay lõi" là "quá hạn lâu nhất trước" hay "còn lâu
 * nhất trước"? Người dùng phải suy ra từ dữ liệu — mà suy sai thì gọi nhầm
 * khách. Chip này nói thẳng bằng lời.
 *
 * KHÔNG dùng useSearchParams: nhận cột/chiều ĐÃ ĐƯỢC MÁY CHỦ CHỐT (trả về
 * trong KetQuaTrang.sapXep) chứ không đọc lại URL. Khác biệt quan trọng — gõ
 * tay ?cot=mat_khau thì sapXepHopLe() bỏ qua và dùng mặc định, nếu chip đọc URL
 * nó sẽ khoe "mat_khau" trong khi bảng đang sắp theo cột khác.
 * Nhờ vậy cũng không cần bọc <Suspense>.
 */
export function ChipSapXep({
  cot,
  tang,
  ghiChu,
}: {
  cot: string
  tang: boolean
  /** Ràng buộc luôn áp trước cột này, vd "Khẩn luôn lên đầu" ở trang Ticket. */
  ghiChu?: string
}) {
  const ten = TEN_COT[cot] ?? cot
  const nghia = NGHIA_SAP_XEP[cot]?.[tang ? 'asc' : 'desc'] ?? (tang ? 'tăng dần' : 'giảm dần')

  return (
    <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full bg-sky-50 text-sky-900 text-xs">
      <span aria-hidden className="text-sky-500">{tang ? '↑' : '↓'}</span>
      <span>
        Sắp xếp: <strong>{ten}</strong> · {nghia}
        {ghiChu && <span className="text-sky-700"> · {ghiChu}</span>}
      </span>
    </span>
  )
}
