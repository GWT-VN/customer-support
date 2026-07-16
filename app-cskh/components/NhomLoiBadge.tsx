import type { MucDo } from '@/app/actions'

/** Mức độ quyết định màu — an toàn phải đập vào mắt, "không lỗi" phải chìm xuống. */
const STYLE: Record<MucDo, { cls: string; label: string }> = {
  an_toan: { cls: 'bg-red-600 text-white', label: 'AN TOÀN' },
  nghiem_trong: { cls: 'bg-red-100 text-red-700', label: 'Nghiêm trọng' },
  thuong: { cls: 'bg-amber-100 text-amber-800', label: 'Thường' },
  nhe: { cls: 'bg-slate-100 text-slate-600', label: 'Nhẹ' },
  khong_loi: { cls: 'bg-slate-100 text-slate-500', label: 'Không phải lỗi' },
}

export function MucDoBadge({ muc_do }: { muc_do: MucDo }) {
  const s = STYLE[muc_do] ?? STYLE.thuong
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${s.cls}`}>
      {s.label}
    </span>
  )
}

export function BaoHangBadge() {
  return (
    <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700 whitespace-nowrap">
      Báo hãng
    </span>
  )
}

/** nguồn gán: rule = máy tự gom, người = có người sửa tay */
export function NguonBadge({ nguon }: { nguon: string }) {
  if (nguon === 'người')
    return <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-700">người gán</span>
  return <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500">tự gom</span>
}
