'use client'

import { useState, useTransition } from 'react'
import { doiTenNhanVien, suaNhanVien } from '@/app/actions'
import { NHAN_VAI_TRO, VAI_TRO } from '@/lib/quyen'

export type DongNhanVien = {
  id: string
  ten: string
  vai_tro: string[]
  email: string | null
  hoat_dong: boolean
}

export function BangNhanVien({ ds, toiId }: { ds: DongNhanVien[]; toiId: string }) {
  const [loi, setLoi] = useState<string | null>(null)
  const [dangChay, batDau] = useTransition()

  function chay(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setLoi(null)
    batDau(async () => {
      const r = await fn()
      if (!r.ok) setLoi(r.error ?? 'Không lưu được.')
    })
  }

  return (
    <div className="space-y-3">
      {loi && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{loi}</p>
      )}

      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Tên</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Vai trò</th>
              <th className="text-left px-4 py-3 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {ds.map((nv) => {
              const laToi = nv.id === toiId
              return (
                <tr key={nv.id} className={`align-top ${nv.hoat_dong ? '' : 'bg-slate-50 text-slate-400'}`}>
                  <td className="px-4 py-3">
                    <input
                      defaultValue={nv.ten}
                      disabled={dangChay}
                      onBlur={(e) => {
                        const t = e.target.value.trim()
                        if (t && t !== nv.ten) chay(() => doiTenNhanVien(nv.id, t))
                      }}
                      className="w-full max-w-48 rounded-lg border px-2 py-1 text-slate-900"
                    />
                    {laToi && <div className="text-xs text-slate-400 mt-1">← bạn</div>}
                  </td>

                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {nv.email ?? <span className="text-amber-600">chưa có email</span>}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {VAI_TRO.map((v) => {
                        const co = nv.vai_tro.includes(v)
                        return (
                          <label key={v} className="inline-flex items-center gap-1.5 text-slate-800 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={co}
                              disabled={dangChay}
                              onChange={() => {
                                const moi = co
                                  ? nv.vai_tro.filter((x) => x !== v)
                                  : [...nv.vai_tro, v]
                                chay(() => suaNhanVien(nv.id, { vai_tro: moi }))
                              }}
                              className="rounded border-slate-300"
                            />
                            {NHAN_VAI_TRO[v]}
                          </label>
                        )
                      })}
                    </div>
                    {nv.vai_tro.length === 0 && (
                      <div className="text-xs text-amber-600 mt-1">chưa gán vai trò</div>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={dangChay}
                      onClick={() => chay(() => suaNhanVien(nv.id, { hoat_dong: !nv.hoat_dong }))}
                      className={
                        'rounded-lg border px-3 py-1 disabled:opacity-50 ' +
                        (nv.hoat_dong
                          ? 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                          : 'text-slate-500 hover:bg-slate-100')
                      }
                    >
                      {nv.hoat_dong ? 'Đang hoạt động' : 'Đã khoá'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Khoá một người là họ mất đường vào ngay lần tải trang kế tiếp, kể cả email
        <code className="mx-1 text-[11px]">@gwt.vn</code>. Sửa tên xong bấm ra ngoài ô là lưu.
      </p>
    </div>
  )
}
