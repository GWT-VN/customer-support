'use client'

import { Fragment, useRef, useState, useTransition } from 'react'
import { datLaiVaiTro, datQuyen } from '@/lib/nen-tang/ma-tran'
import {
  HO_SO_QUYEN, NHAN_NHOM, QUYEN, type MaQuyen, type NhomQuyen,
} from '@/lib/nen-tang/quyen'
import { HO_SO_VAI_TRO, NHAN_BO_PHAN, NHAN_VAI_TRO, VAI_TRO, type VaiTro } from '@/lib/nen-tang/vai-tro'

/** Nhiều quyền (45) nhưng ít vai trò (13) -> quyền làm DÒNG, vai trò làm CỘT. */
const NHOM_QUYEN: { nhom: NhomQuyen; ds: MaQuyen[] }[] = []
for (const q of QUYEN) {
  const n = HO_SO_QUYEN[q].nhom
  const cuoi = NHOM_QUYEN[NHOM_QUYEN.length - 1]
  if (cuoi && cuoi.nhom === n) cuoi.ds.push(q)
  else NHOM_QUYEN.push({ nhom: n, ds: [q] })
}

const TEN_COT: Record<VaiTro, string> = {
  ceo: 'CEO', admin: 'Quản trị',
  kt_giam_doc: 'GĐ KT', ky_thuat: 'NV KT', ctv_lap_dat: 'CTV',
  cs_manager: 'Trưởng CS', cs: 'NV CS',
  sales_manager: 'Trưởng SL', sales: 'NV SL',
  marketing: 'MKT', kho: 'Kho', ke_toan: 'Kế toán', tai_chinh: 'Tài chính',
}

const GHIM = 'sticky left-0 z-20 bg-inherit border-r'

export function MaTranQuyen({ maTran }: { maTran: Record<string, MaQuyen[]> }) {
  const [ghiDe, setGhiDe] = useState<Record<string, boolean>>({})
  const [loi, setLoi] = useState<string | null>(null)
  const luot = useRef<Record<string, number>>({})
  const [, batDau] = useTransition()

  const khoa = (v: VaiTro, q: MaQuyen) => `${v}|${q}`
  const coQuyen = (v: VaiTro, q: MaQuyen) =>
    v === 'admin' ? true : (ghiDe[khoa(v, q)] ?? (maTran[v] ?? []).includes(q))

  function tick(v: VaiTro, q: MaQuyen) {
    if (v === 'admin') return
    const k = khoa(v, q)
    const bat = !coQuyen(v, q)
    const cuaToi = (luot.current[k] ?? 0) + 1
    luot.current[k] = cuaToi

    setGhiDe((g) => ({ ...g, [k]: bat }))
    setLoi(null)
    batDau(async () => {
      const r = await datQuyen(v, q, bat)
      if (luot.current[k] !== cuaToi) return
      if (!r.ok) setLoi(r.error ?? 'Không lưu được.')
      setGhiDe((g) => Object.fromEntries(Object.entries(g).filter(([x]) => x !== k)))
    })
  }

  function datLai(v: VaiTro) {
    setLoi(null)
    batDau(async () => {
      const r = await datLaiVaiTro(v)
      if (!r.ok) setLoi(r.error ?? 'Không đặt lại được.')
      else setGhiDe({})
    })
  }

  return (
    <div className="space-y-2">
      {loi && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{loi}</p>}

      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="text-sm border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-100">
              <th className={`${GHIM} bg-slate-100 text-left px-3 py-2 font-medium border-b`}>
                Được làm gì
              </th>
              {VAI_TRO.map((v) => (
                <th
                  key={v}
                  title={`${NHAN_VAI_TRO[v]} · ${NHAN_BO_PHAN[HO_SO_VAI_TRO[v].boPhan]}`}
                  className="px-2 py-2 text-[11px] font-medium border-b border-l text-center whitespace-nowrap"
                >
                  {TEN_COT[v]}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {NHOM_QUYEN.map(({ nhom, ds }) => (
              <Fragment key={nhom}>
                  <tr className="bg-slate-50">
                    <td
                      className={`${GHIM} bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 border-b`}
                    >
                      {NHAN_NHOM[nhom]}
                    </td>
                    <td colSpan={VAI_TRO.length} className="border-b border-l bg-slate-50" />
                  </tr>
                  {ds.map((q) => (
                    <tr key={q} className="bg-white hover:bg-slate-50">
                      <td className={`${GHIM} bg-white px-3 py-1.5 border-b`}>
                        <div className="text-slate-800">{HO_SO_QUYEN[q].nhan}</div>
                        <div className="text-[10px] font-mono text-slate-400">{q}</div>
                      </td>
                      {VAI_TRO.map((v) =>
                        // Cột Quản trị: vẽ dấu tích đặc thay vì ô khoá. Ô checkbox bị
                        // disabled render mờ tới mức đọc nhầm thành "không có quyền".
                        v === 'admin' ? (
                          <td
                            key={v}
                            title="Quản trị hệ thống luôn có toàn quyền"
                            className="px-2 py-1.5 border-b border-l text-center bg-slate-100 text-slate-500"
                          >
                            ✓
                          </td>
                        ) : (
                          <td key={v} className="px-2 py-1.5 border-b border-l text-center">
                            <input
                              type="checkbox"
                              aria-label={`${NHAN_VAI_TRO[v]} — ${HO_SO_QUYEN[q].nhan}`}
                              checked={coQuyen(v, q)}
                              onChange={() => tick(v, q)}
                              className="rounded border-slate-300"
                            />
                          </td>
                        )
                      )}
                    </tr>
                  ))}
              </Fragment>
            ))}

            <tr className="bg-slate-50">
              <td className={`${GHIM} bg-slate-50 px-3 py-2 text-xs text-slate-500 border-t`}>
                Trả vai trò về mặc định
              </td>
              {VAI_TRO.map((v) => (
                <td key={v} className="px-1 py-2 border-t border-l text-center">
                  <button
                    type="button"
                    disabled={v === 'admin'}
                    onClick={() => datLai(v)}
                    className="text-[11px] text-slate-500 underline hover:text-slate-800 disabled:opacity-30 disabled:no-underline"
                  >
                    đặt lại
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
