import Link from 'next/link'
import type { CapNghiTrung } from '@/lib/nghiTrung'

/**
 * Danh sách cặp hồ sơ nghi trùng, bấm là mở thẳng màn gộp với hai bên điền sẵn.
 *
 * CEO: "hiện ko biết có khách nào" — trước đây muốn gộp phải tự nhớ ra tên rồi gõ
 * tay vào ô tìm. Nay mở màn gộp là thấy ngay danh sách việc cần làm.
 */
export function GoiYGopKhach({ cap }: { cap: CapNghiTrung[] }) {
  if (cap.length === 0) {
    return (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        Không thấy cặp hồ sơ nào nghi trùng ✓
      </p>
    )
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-slate-900">{cap.length} cặp nghi trùng</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Dò theo TÊN. Không dò theo SĐT vì mỗi số chỉ thuộc một hồ sơ (ràng buộc DB) — không bao giờ có hai hồ sơ trùng số.
        </p>
      </div>
      <ul className="divide-y divide-slate-100">
        {cap.map((c) => (
          <li key={`${c.giu.id}-${c.gop.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <span
              className={
                'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ' +
                (c.do_chac === 'cao' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800')
              }
            >
              {c.do_chac === 'cao' ? 'Trùng tên' : 'Nghi ngờ'}
            </span>

            <span className="min-w-0 flex-1">
              <span className="font-medium text-slate-900">{c.giu.full_name}</span>
              <span className="text-slate-400"> ⟵ </span>
              <span className="text-slate-700">{c.gop.full_name}</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                giữ lại bên trái ({c.giu.so_may} máy · {c.giu.so_ticket} ticket · {c.giu.so_plan} lịch)
                {' · '}{c.ly_do.join(' · ')}
              </span>
            </span>

            <Link
              href={`/khach/gop?giu=${encodeURIComponent(c.giu.id)}&gop=${encodeURIComponent(c.gop.id)}`}
              prefetch={false}
              className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Xem &amp; gộp →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
