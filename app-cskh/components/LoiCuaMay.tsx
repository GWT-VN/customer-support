import { coreForecast, replacementsOfSerial } from '@/app/actions'
import { ThayLoiButton } from '@/components/ThayLoiButton'
import { vnDate } from '@/components/Badge'

/** Lõi của 1 máy: cần thay khi nào + lịch sử đã thay. Nhúng vào trang chi tiết máy. */
export async function LoiCuaMay({ serial }: { serial: string }) {
  const [all, history] = await Promise.all([coreForecast('', serial), replacementsOfSerial(serial)])
  const rows = all.filter((r) => r.serial === serial)

  if (rows.length === 0)
    return (
      <p className="text-sm text-slate-400">
        Máy này chưa có dữ liệu lõi lọc trong <code className="text-xs">product_filter</code>.
      </p>
    )

  return (
    <div className="space-y-4">
      <ul className="divide-y border rounded-lg">
        {rows.map((r) => (
          <li key={r.filter_code} className="px-3 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-slate-900">{r.filter_name}</p>
              <p className="font-mono text-xs text-slate-500">{r.filter_code} · {r.chu_ky_raw}</p>
              <p className="text-xs text-slate-500">
                Đến hạn <strong>{vnDate(r.han_som)}</strong>
                {r.han_muon !== r.han_som && <> (muộn nhất {vnDate(r.han_muon)})</>}
                {' · '}
                {r.tinh_trang === 'QUÁ HẠN'
                  ? <span className="text-red-600">quá {Math.abs(r.con_bao_nhieu_ngay ?? 0)} ngày</span>
                  : r.con_bao_nhieu_ngay !== null
                    ? <span className="text-slate-600">còn {r.con_bao_nhieu_ngay} ngày</span>
                    : <span className="text-slate-400">không rõ</span>}
              </p>
              <p className="text-[10px] text-slate-400">
                tính từ {r.lan_thay_gan_nhat ? `lần thay ${vnDate(r.lan_thay_gan_nhat)}` : `ngày lắp ${vnDate(r.install_date)} — chưa có log thay`}
              </p>
            </div>
            <ThayLoiButton serial={serial} filterCode={r.filter_code} filterName={r.filter_name} />
          </li>
        ))}
      </ul>

      {history.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1">Lịch sử đã thay ({history.length})</p>
          <ul className="text-xs text-slate-600 space-y-0.5">
            {history.map((h) => (
              <li key={h.id}>
                {vnDate(h.replaced_at)} — <span className="font-mono">{h.filter_code}</span>
                {h.note && <span className="text-slate-400"> · {h.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
