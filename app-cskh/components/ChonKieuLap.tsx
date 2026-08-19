'use client'

import { useState } from 'react'
import { DangKyBHForm } from '@/components/DangKyBHForm'
import { LapBoForm } from '@/components/LapBoForm'

/** Gộp Đăng ký BH: chọn lắp "1 máy lẻ" (DangKyBHForm) hay "1 bộ combo" (LapBoForm). */
export function ChonKieuLap() {
  const [kieu, setKieu] = useState<'le' | 'bo'>('le')
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button onClick={() => setKieu('le')}
          className={`px-4 py-2 rounded-lg text-sm border ${kieu === 'le' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'}`}>
          Lắp 1 máy lẻ
        </button>
        <button onClick={() => setKieu('bo')}
          className={`px-4 py-2 rounded-lg text-sm border ${kieu === 'bo' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'}`}>
          Lắp 1 bộ combo (WH15A/WH30A…)
        </button>
      </div>
      {kieu === 'le' ? <DangKyBHForm /> : <LapBoForm />}
    </div>
  )
}
