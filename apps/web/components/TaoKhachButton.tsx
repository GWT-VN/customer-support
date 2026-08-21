'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { KhachPicker } from '@/components/KhachPicker'

/**
 * Nút tạo khách ngay trên trang Khách hàng. Trước đây muốn thêm khách phải đi
 * vòng qua ticket hoặc kích hoạt bảo hành — CEO báo là lỗi #2.
 *
 * Không viết lại luồng tạo: bọc thẳng KhachPicker (đã có tra SĐT chống trùng,
 * tạo khách mới thì chờ admin duyệt). Chọn/tạo xong thì làm mới danh sách.
 */
export function TaoKhachButton() {
  const [mo, setMo] = useState(false)
  const router = useRouter()

  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        className="rounded-[9px] bg-[#b5642a] px-4 py-2 text-sm font-medium text-white hover:bg-[#8a4a1c]"
      >
        ＋ Tạo khách
      </button>

      {mo && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-semibold text-slate-900">Tạo khách mới</h2>
              <button
                type="button"
                onClick={() => setMo(false)}
                className="text-slate-400 hover:text-slate-900"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Gõ SĐT để tra trước — trùng thì chọn luôn hồ sơ cũ, khỏi tạo hai bản cho một người.
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
