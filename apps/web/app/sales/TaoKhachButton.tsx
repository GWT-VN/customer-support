'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Kenh } from '@/app/actions'
import { CustomerForm } from './CustomerForm'
import type { NhanVienChon } from './actions'

/**
 * MỘT nút tạo khách. CEO chốt 22/08/2026 — làm giống CSKH:
 * không có cặp "tạo nhanh / nhập chi tiết", vì người dùng phải ĐOÁN TRƯỚC mình cần đường nào
 * trong khi chưa gõ SĐT thì chưa ai biết khách có công ty hay không. Đoán sai là gõ lại từ đầu.
 *
 * Nay: một nút → khung cơ bản → cần thêm thì bung ngay tại chỗ, không rời màn.
 *
 * `/sales/khach/moi` vẫn giữ cho ai mở thẳng bằng đường dẫn — dùng CHUNG `CustomerForm`.
 */
export function TaoKhachButton({ kenh, nhanVien }: { kenh: Kenh[]; nhanVien: NhanVienChon[] }) {
  const [mo, setMo] = useState(false)
  const router = useRouter()

  return (
    <>
      <button type="button" onClick={() => setMo(true)}
        className="rounded-lg bg-[#0e8c9a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a6771]">
        ＋ Tạo khách
      </button>

      {mo && (
        // overflow-y-auto: bung hết chi tiết thì form cao hơn màn hình, phải cuộn được.
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 p-4"
          role="dialog" aria-modal="true" aria-label="Tạo khách mới">
          <div className="mx-auto w-full max-w-2xl">
            <div className="flex items-center justify-between gap-3 rounded-t-xl bg-white px-5 py-3">
              <h2 className="font-semibold text-slate-900">Tạo khách mới</h2>
              <button type="button" onClick={() => setMo(false)}
                className="text-slate-400 hover:text-slate-900" aria-label="Đóng">✕</button>
            </div>
            <div className="rounded-b-xl bg-slate-50 p-4">
              <CustomerForm mode="create" kenh={kenh} nhanVien={nhanVien} onXong={() => { setMo(false); router.refresh() }} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
