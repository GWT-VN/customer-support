'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { syncCatalogNow, type CatalogSyncLog } from '@/app/actions'

const BANG = ['catalog_item', 'catalog_category', 'supplier_code',
  'product_bundle', 'product_filter', 'product_warranty']

function khiNao(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('vi-VN', { hour12: false })
}

/** Nút bấm tay đồng bộ catalog + nhật ký các lần chạy. Chỉ admin thấy trang này. */
export function NutDongBoCatalog({ logs }: { logs: CatalogSyncLog[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function chay() {
    setBusy(true); setErr(null); setOk(null)
    const r = await syncCatalogNow()
    setBusy(false)
    if (!r.ok) { setErr(r.error); return }
    const t = r.ket_qua?.tables ?? {}
    setOk('Đã đồng bộ: ' + BANG.map((b) => `${b}=${(t as Record<string, unknown>)[b] ?? '—'}`).join(' · '))
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={chay} disabled={busy}
          className="rounded-lg bg-slate-900 text-white px-5 py-2.5 font-medium disabled:opacity-50">
          {busy ? 'Đang đồng bộ…' : '⟳ Đồng bộ catalog ngay'}
        </button>
        <span className="text-xs text-slate-500">Tự chạy hàng ngày 02:00 (giờ VN). Nút này để chạy ngay khi cần.</span>
      </div>
      {ok && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{ok}</p>}
      {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}

      <div>
        <h2 className="text-sm font-medium text-slate-700 mb-2">Nhật ký gần đây</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-400">Chưa có lần chạy nào.</p>
        ) : (
          <ul className="divide-y border rounded-lg">
            {logs.map((l) => (
              <li key={l.id} className="px-3 py-2.5 text-sm flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className={l.ok ? 'text-emerald-700' : 'text-red-600'}>
                    {l.ok ? '✓ OK' : '✗ Lỗi'}
                  </span>
                  <span className="text-slate-500 ml-2">{khiNao(l.chay_luc)}</span>
                  {l.thong_bao && <div className="text-xs text-amber-700 mt-0.5">{l.thong_bao}</div>}
                  {l.chi_tiet && (
                    <div className="font-mono text-xs text-slate-500 mt-0.5 truncate">
                      {JSON.stringify(l.chi_tiet)}
                    </div>
                  )}
                </div>
                {l.ms != null && <span className="text-xs text-slate-400 flex-none">{l.ms}ms</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
