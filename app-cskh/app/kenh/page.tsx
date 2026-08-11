import { listKenh, type Kenh } from '@/app/actions'

export default async function KenhPage() {
  const kenh = await listKenh()
  const nhom = new Map<string, Kenh[]>()
  for (const k of kenh) {
    const g = nhom.get(k.channel_l1) ?? []
    g.push(k); nhom.set(k.channel_l1, g)
  }
  const tongGan = kenh.reduce((s, k) => s + (k.so_khach ?? 0), 0)

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <header>
          <h1 className="text-xl font-semibold text-slate-900">Kênh / đối tác</h1>
          <p className="text-sm text-slate-500 mt-1">
            Đại lý/KTS/KOL quản lý khách — taxonomy dùng chung <span className="font-mono">dim_channel</span> với Sales
            (CSKH chỉ gắn khách, không sửa danh mục kênh). Đã gắn: <strong>{tongGan}</strong> khách.
          </p>
        </header>

        {[...nhom.entries()].map(([l1, ks]) => (
          <section key={l1} className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b font-medium text-slate-800">{l1}</div>
            <ul className="divide-y text-sm">
              {ks.map((k) => (
                <li key={k.id} className="px-4 py-2 flex items-center justify-between gap-3">
                  <span className="text-slate-700">{k.channel_l2 || <span className="text-slate-400">(không phân nhánh)</span>}</span>
                  <span className={`text-xs ${k.so_khach ? 'text-slate-600' : 'text-slate-300'}`}>
                    {k.so_khach ?? 0} khách
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  )
}
