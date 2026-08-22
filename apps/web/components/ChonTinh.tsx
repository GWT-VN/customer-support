'use client'

import { OChonGoiY } from '@/bang'
import { TINH_VN } from '@/lib/tinh'

/**
 * Ô chọn Tỉnh/TP dùng chung. Dùng lại danh mục `TINH_VN` ("tỉnh cũ hoặc mới sau sáp
 * nhập đều được") để CẢ app một nguồn tỉnh duy nhất, không đẻ ra danh sách thứ hai.
 *
 * 22/08/2026: đổi từ `<select>` trần sang GÕ-ĐỂ-TÌM. Luật CEO chốt cùng ngày — danh
 * sách quá 10 mục phải cho gõ tìm; đây có 64 tỉnh. Xem `docs/CHUAN-FILTER.md` luật số 2.
 * Props giữ NGUYÊN nên mọi chỗ đang gọi không phải sửa gì.
 *
 * Bảo toàn dữ liệu: khách cũ có thể ghi tỉnh không có trong danh mục (viết tắt/sai).
 * Giá trị lạ vẫn được giữ và hiện kèm "(giữ nguyên)" — mở trang không nuốt mất tỉnh.
 */
export function ChonTinh({
  value,
  onChange,
  className,
}: {
  value: string | null
  onChange: (v: string) => void
  className?: string
}) {
  const hienTai = (value ?? '').trim()
  const laLa = hienTai !== '' && !TINH_VN.includes(hienTai)

  const tuyChon = [
    ...(laLa ? [{ gt: hienTai, nhan: `${hienTai} (giữ nguyên)` }] : []),
    ...TINH_VN.map((t) => ({ gt: t, nhan: t })),
  ]

  return (
    <OChonGoiY
      giaTri={hienTai || null}
      onChon={onChange}
      tuyChon={tuyChon}
      choTrong="Gõ tên tỉnh…"
      className={className}
    />
  )
}
