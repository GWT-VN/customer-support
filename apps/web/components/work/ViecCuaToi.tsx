'use client'

/**
 * "Việc của tôi" — gộp theo hạn (Quá hạn / Hôm nay / Tuần này / Sắp tới / Không hạn)
 * thay vì một danh sách phẳng, để mở lên là biết ngay phải làm gì trước.
 * Logic gộp nằm ở lib/work.ts (có test), component chỉ lo hiển thị.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { doiTrangThai, type ViecRow, type NenTang } from '@/app/work/actions'
import { gomTheoHan } from '@/lib/work'
import { DongViec } from './DongViec'
import { FormTaoViec } from './FormTaoViec'
import { ChiTietViec } from './ChiTietViec'

const MAU_NHOM: Record<string, string> = {
  qua_han: 'text-red-600',
  hom_nay: 'text-amber-600',
  tuan_nay: 'text-slate-700',
  sap_toi: 'text-slate-500',
  khong_han: 'text-slate-400',
}

export function ViecCuaToi({ rowsBanDau, nenTang }: { rowsBanDau: ViecRow[]; nenTang: NenTang }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [mo, setMo] = useState<number | null>(null)
  const [loi, setLoi] = useState<string | null>(null)

  const nhom = gomTheoHan(rowsBanDau)

  function doi(id: number, status: string) {
    start(async () => {
      try {
        await doiTrangThai(id, status)
        setLoi(null)
        router.refresh()
      } catch (e) {
        setLoi(e instanceof Error ? e.message : 'Không đổi được trạng thái')
      }
    })
  }

  return (
    <div className="space-y-4">
      <FormTaoViec nenTang={nenTang} onXong={() => router.refresh()} />

      {loi && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{loi}</p>}

      {nhom.length === 0 ? (
        <div className="bg-white rounded-xl border p-6 text-center text-sm text-slate-500">
          Chưa có việc nào. Thêm việc đầu tiên ở trên.
        </div>
      ) : (
        nhom.map((g) => (
          <section key={g.nhom}>
            <h2 className={`text-xs font-semibold uppercase tracking-wide mb-1 ${MAU_NHOM[g.nhom] ?? 'text-slate-500'}`}>
              {g.nhan} <span className="text-slate-400 font-normal">· {g.viec.length}</span>
            </h2>
            <ul className="bg-white rounded-xl border divide-y divide-slate-100">
              {g.viec.map((v) => (
                <DongViec key={v.id} v={v} pending={pending} onDoiTrangThai={doi} onMo={setMo} />
              ))}
            </ul>
          </section>
        ))
      )}

      {pending && <p className="text-xs text-slate-400">Đang lưu…</p>}

      {mo !== null && (
        <ChiTietViec
          taskId={mo}
          nenTang={nenTang}
          onDong={() => setMo(null)}
          onDoi={() => router.refresh()}
        />
      )}
    </div>
  )
}
