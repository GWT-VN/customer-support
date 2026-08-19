'use client'

import { TINH_VN } from '@/lib/tinh'

/**
 * Ô chọn Tỉnh/TP dùng chung (dropdown). Dùng lại danh mục `TINH_VN` của module bảo
 * trì ("tỉnh cũ hoặc mới sau sáp nhập đều được") để CẢ app một nguồn tỉnh duy nhất,
 * không đẻ ra danh sách thứ hai lệch nhau.
 *
 * Bảo toàn dữ liệu: khách cũ có thể ghi tỉnh không có trong danh mục (viết tắt/sai).
 * Nếu thế thì chèn thêm 1 option cho chính giá trị đó để mở trang không nuốt mất tỉnh.
 */
export function ChonTinh({
  value,
  onChange,
  className = 'mt-1 w-full rounded-lg border px-3 py-2 text-slate-900 bg-white',
}: {
  value: string | null
  onChange: (v: string) => void
  className?: string
}) {
  const hienTai = (value ?? '').trim()
  const laLa = hienTai !== '' && !TINH_VN.includes(hienTai)   // giá trị lạ, ngoài danh mục

  return (
    <select value={hienTai} onChange={(e) => onChange(e.target.value)} className={className}>
      <option value="">— Chọn tỉnh —</option>
      {laLa && <option value={hienTai}>{hienTai} (giữ nguyên)</option>}
      {TINH_VN.map((t) => <option key={t} value={t}>{t}</option>)}
    </select>
  )
}
