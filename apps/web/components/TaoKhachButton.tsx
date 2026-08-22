'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Kenh } from '@/app/actions'
import { TaoKhachForm } from '@/components/TaoKhachForm'

/**
 * MỘT nút tạo khách duy nhất.
 *
 * CEO chốt 22/08/2026, nguyên văn: *"không muốn có 2 button riêng Tạo nhanh vs Nhập chi tiết
 * (chỉ có Tạo, luôn mở ra khung tạo nhanh, sau khi điền xong 4 thông tin cơ bản cho phép click
 * để điền thêm chi tiết thì mở ra bảng chi tiết) ⇒ luôn thiết kế để UX tốt nhất, ít step."*
 *
 * Vì sao bỏ hai nút: người dùng phải ĐOÁN TRƯỚC mình cần đường nào, mà lúc chưa gõ SĐT thì chưa
 * ai biết khách này có công ty hay không. Đoán sai là phải nhập lại từ đầu ở màn kia — đúng thứ
 * CEO gọi là "nhiều step".
 *
 * Nay: một nút → khung 4 ô cơ bản → cần thêm thì **bung ngay tại chỗ**, không rời màn, không
 * mất chữ đã gõ.
 *
 * `/khach/moi` vẫn giữ cho ai mở thẳng bằng đường dẫn — dùng CHUNG `TaoKhachForm`, nên hai chỗ
 * không bao giờ lệch bộ ô (đúng chỗ CEO bắt được là màn tạo và màn sửa đang lệch nhau).
 */
export function TaoKhachButton({ kenh }: { kenh: Kenh[] }) {
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
        // overflow-y-auto: khi bung hết phần chi tiết thì form cao hơn màn hình, phải cuộn được.
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Tạo khách mới"
        >
          <div className="mx-auto w-full max-w-2xl">
            <div className="flex items-center justify-between gap-3 rounded-t-xl bg-white px-5 py-3">
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

            <TaoKhachForm kenh={kenh} onXong={() => { setMo(false); router.refresh() }} />
          </div>
        </div>
      )}
    </>
  )
}
