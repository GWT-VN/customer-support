import Link from 'next/link'
import { listNeedsPhone } from '@/app/actions'

export default async function NeedsPhonePage() {
  const list = await listNeedsPhone()
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <Link href="/" className="text-sm text-slate-600 underline">← Tra cứu</Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Khách cần bổ sung SĐT</h1>
          <p className="text-sm text-slate-500 mt-1">
            {list.length} khách thiếu SĐT hoặc SĐT sai dạng (di trú từ Odoo giữ nguyên để sửa tay).
          </p>
        </div>
        <ul className="bg-white rounded-xl border divide-y">
          {list.map((c) => (
            <li key={c.id} className="px-4 py-3 flex items-center justify-between gap-4">
              <div>
                <Link href={`/khach/${c.id}`} className="text-slate-900 underline font-medium">{c.full_name}</Link>
                {c.notes && <p className="text-xs text-amber-700 mt-0.5">{c.notes}</p>}
              </div>
              <span className="font-mono text-xs text-slate-500">{c.primary_phone ?? '—'}</span>
            </li>
          ))}
          {list.length === 0 && <li className="px-4 py-10 text-center text-slate-400">Không còn khách nào. 🎉</li>}
        </ul>
      </div>
    </main>
  )
}
