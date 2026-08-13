import Link from 'next/link'
import { chanNeuKhongPhaiQuanLy } from '@/lib/supabase'
import { dsKyThuat, boiCanhKhach, type ViecInput } from '@/app/actions'
import { KyThuatBang } from '@/components/KyThuatBang'

export default async function KyThuatPage({
  searchParams,
}: {
  searchParams: Promise<{ kh?: string; loai?: string; ref?: string; mota?: string; ngay?: string }>
}) {
  await chanNeuKhongPhaiQuanLy()
  const { kh, loai, ref, mota, ngay } = await searchParams
  const dsKt = await dsKyThuat()

  // Quick-link từ ticket/máy/bảo trì: prefill khách + 1 việc.
  let prefill: { khachId: string; ctx: Awaited<ReturnType<typeof boiCanhKhach>>; ngay?: string; viec?: ViecInput[] } | undefined
  if (kh) {
    const ctx = await boiCanhKhach(kh)
    const viec: ViecInput[] | undefined = loai ? [{ loai_viec: loai, ref: ref || undefined, mo_ta: mota || undefined }] : undefined
    prefill = { khachId: kh, ctx, ngay: ngay || undefined, viec }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Gán lịch kỹ thuật</h1>
            <p className="text-sm text-slate-500">Gán việc cho kỹ thuật (nhân viên + cộng tác viên). 1 chuyến đi có thể gồm nhiều việc: lắp máy · bảo trì · ticket · thay lõi · khảo sát · thu tiền · khác.</p>
          </div>
          <Link href="/ky-thuat/lich" className="rounded-lg border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Xem lịch đã lên →</Link>
        </header>

        {prefill && <p className="text-sm bg-sky-50 text-sky-900 rounded-lg px-3 py-2">Đã tạo sẵn 1 việc từ liên kết nhanh — chọn kỹ thuật + ngày rồi tạo chuyến (thêm việc khác nếu cần).</p>}

        <KyThuatBang dsKt={dsKt} prefill={prefill} />
      </div>
    </main>
  )
}
