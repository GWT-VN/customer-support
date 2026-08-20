'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { KhachPicker } from '@/components/KhachPicker'

/**
 * Hai đường tạo khách, cùng chỗ:
 *  · **Tạo nhanh** — hộp thoại 4 ô (tên, SĐT, địa chỉ, tỉnh), cho ca đang vội.
 *  · **Nhập chi tiết** — sang `/khach/moi`, có thêm ghi chú và khối thông tin
 *    công ty (tên, MST, địa chỉ thuế, SĐT, email) để còn xuất hoá đơn/hợp đồng.
 *
 * CEO 20/08/2026 yêu cầu đúng cặp này: giữ đường nhanh, thêm đường đủ.
 */
export function TaoKhachButton() {
  const [mo, setMo] = useState(false)
  const router = useRouter()

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMo(true)}
          className="rounded-[9px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ＋ Tạo nhanh
        </button>
        <Link
          href="/khach/moi"
          prefetch={false}
          className="rounded-[9px] bg-[#b5642a] px-4 py-2 text-sm font-medium text-white hover:bg-[#8a4a1c]"
        >
          Nhập chi tiết
        </Link>
      </div>

      {mo && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-semibold text-slate-900">Tạo nhanh khách mới</h2>
              <button type="button" onClick={() => setMo(false)}
                className="text-slate-400 hover:text-slate-900" aria-label="Đóng">
                ✕
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Gõ SĐT để tra trước — trùng thì chọn luôn hồ sơ cũ, khỏi tạo hai bản cho một người.{' '}
              Cần ghi thông tin công ty (MST, hoá đơn)?{' '}
              <Link href="/khach/moi" prefetch={false} className="text-[#0a6771] underline">
                nhập chi tiết
              </Link>.
            </p>
            <KhachPicker
              onPick={() => {
                setMo(false)
                router.refresh()
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}
