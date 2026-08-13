import { requireStaff } from '@/lib/supabase'
import { lichCuaToi } from '@/app/actions'
import { LichCuaToiKT } from '@/components/LichCuaToiKT'
import { DoiMatKhau } from '@/components/DoiMatKhau'
import { NutQuayLai } from '@/components/NutQuayLai'

/** Màn hình cho KỸ THUẬT: lịch chuyến của chính mình (7 ngày trước → 30 ngày tới). */
export default async function LichCuaToiPage() {
  await requireStaff()
  const hom = new Date()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const tu = new Date(hom); tu.setDate(tu.getDate() - 7)
  const den = new Date(hom); den.setDate(den.getDate() + 30)
  const { kt, rows } = await lichCuaToi(iso(tu), iso(den))

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
        <NutQuayLai macDinh="/" />
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Lịch của tôi</h1>
          <p className="text-sm text-slate-500">
            {kt ? `Kỹ thuật: ${kt.ten}` : 'Tài khoản chưa gắn hồ sơ kỹ thuật.'} · Chuyến 7 ngày qua đến 30 ngày tới.
          </p>
        </div>

        {!kt ? (
          <div className="bg-white rounded-xl border p-5 text-sm text-slate-600">
            Tài khoản của bạn chưa được gắn với hồ sơ kỹ thuật (khớp theo email). Liên hệ quản trị để được cấp.
          </div>
        ) : (
          <LichCuaToiKT rows={rows} />
        )}

        <details className="bg-white rounded-xl border p-4">
          <summary className="text-sm font-medium text-slate-700 cursor-pointer">Đổi mật khẩu</summary>
          <p className="text-xs text-slate-500 mt-1 mb-2">Nên đổi mật khẩu tạm được cấp sang mật khẩu của riêng bạn.</p>
          <DoiMatKhau />
        </details>
      </div>
    </main>
  )
}
