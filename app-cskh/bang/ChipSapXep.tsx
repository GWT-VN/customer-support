'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useCauHinh } from './CauHinh'

/**
 * Câu "đang sắp xếp theo gì" bằng tiếng Việt, đặt ngay trên bảng, kèm nút bỏ.
 *
 * Vì sao cần, dù tiêu đề cột đã có mũi tên: mũi tên chỉ nói CHIỀU, không nói
 * NGHĨA. ▲ trên cột "Hạn thay lõi" là "quá hạn lâu nhất trước" hay "còn lâu
 * nhất trước"? Người dùng phải suy ra từ dữ liệu — mà suy sai thì gọi nhầm
 * khách. Chip này nói thẳng bằng lời.
 *
 * Cột/chiều nhận qua props là giá trị MÁY CHỦ ĐÃ CHỐT (KetQuaTrang.sapXep), KHÔNG
 * đọc lại từ URL: gõ tay ?cot=mat_khau thì sapXepHopLe() bỏ qua và dùng mặc định,
 * chip mà đọc URL sẽ khoe "mat_khau" trong khi bảng sắp theo cột khác.
 * useSearchParams ở đây CHỈ để dựng link bỏ sắp xếp, không để quyết định hiển thị.
 */
export function ChipSapXep({
  cot,
  tang,
  macDinh,
  ghiChu,
}: {
  cot: string
  tang: boolean
  /** Đang là thứ tự gốc của trang -> không hiện nút bỏ (bấm cũng không đổi gì). */
  macDinh: boolean
  /** Ràng buộc luôn áp trước cột này, vd "Khẩn luôn lên đầu" ở trang Ticket. */
  ghiChu?: string
}) {
  const { giaoDien: gd, tenCot, nghiaSapXep } = useCauHinh()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const ten = tenCot[cot] ?? cot
  const nghia = nghiaSapXep[cot]?.[tang ? 'asc' : 'desc'] ?? (tang ? 'tăng dần' : 'giảm dần')

  // Bỏ RIÊNG cột/chiều, GIỮ nguyên từ khoá và bộ lọc — khác hẳn nút "Xoá lọc"
  // vốn quét sạch mọi thứ. Người dùng muốn về thứ tự gốc thường vẫn đang cần
  // giữ kết quả đang lọc. Xoá luôn `trang` vì đổi thứ tự thì số trang đổi nghĩa.
  const sp = new URLSearchParams(searchParams.toString())
  sp.delete('cot')
  sp.delete('chieu')
  sp.delete('trang')
  const qs = sp.toString()
  const hrefBo = qs ? `${pathname}?${qs}` : pathname

  return (
    <span
      className={`${gd.sapXep_chip} ${macDinh ? gd.sapXep_chipTron : gd.sapXep_chipCoNutGo}`}
    >
      <span aria-hidden className={gd.sapXep_muiTen}>{tang ? '↑' : '↓'}</span>
      <span>
        Sắp xếp: <strong>{ten}</strong> · {nghia}
        {ghiChu && <span className={gd.sapXep_ghiChu}> · {ghiChu}</span>}
      </span>
      {!macDinh && (
        <Link
          href={hrefBo}
          aria-label="Bỏ sắp xếp, về thứ tự mặc định"
          title="Bỏ sắp xếp, về thứ tự mặc định"
          className={gd.sapXep_nutGo}
        >
          ×
        </Link>
      )}
    </span>
  )
}
