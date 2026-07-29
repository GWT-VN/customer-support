'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { GIAO_DIEN_MAC_DINH, type GiaoDienBang } from './giaoDien'

/**
 * Cấu hình dùng chung cho cả bộ bảng: giao diện + cách gọi tên cột.
 *
 * Vì sao cần: nhãn cột và nghĩa của từng chiều sắp xếp là chuyện CỦA TỪNG DỰ ÁN
 * (dự án này gọi "Hạn thay lõi", dự án khác gọi "Ngày hết hạn"). Nhét chúng vào
 * component là mỗi lần tái sử dụng lại phải sửa trong lõi.
 *
 * KHÔNG bắt buộc bọc: không có <CauHinhBang> thì rơi về mặc định, chạy bình
 * thường, chỉ là chip sắp xếp nói chung chung "tăng dần/giảm dần".
 */

export type NghiaChieu = { asc: string; desc: string }

export type CauHinh = {
  giaoDien: GiaoDienBang
  /** Tên cột hiện cho người dùng: { install_date: 'Ngày lắp' } */
  tenCot: Record<string, string>
  /** Nghĩa từng chiều: { install_date: { asc: 'lắp lâu nhất trước', desc: '…' } } */
  nghiaSapXep: Record<string, NghiaChieu>
}

const MAC_DINH: CauHinh = {
  giaoDien: GIAO_DIEN_MAC_DINH,
  tenCot: {},
  nghiaSapXep: {},
}

const Ctx = createContext<CauHinh>(MAC_DINH)

export function CauHinhBang({
  giaoDien,
  tenCot,
  nghiaSapXep,
  children,
}: Partial<CauHinh> & { children: ReactNode }) {
  return (
    <Ctx.Provider
      value={{
        // Gộp chứ không thay thế: chỉ muốn đổi 2 lớp CSS thì truyền 2 khoá,
        // không phải chép lại cả bảng giao diện.
        giaoDien: { ...GIAO_DIEN_MAC_DINH, ...giaoDien },
        tenCot: tenCot ?? {},
        nghiaSapXep: nghiaSapXep ?? {},
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useCauHinh(): CauHinh {
  return useContext(Ctx)
}

/** Lớp CSS — dùng trong mọi component của bộ bảng. */
export function useGiaoDien(): GiaoDienBang {
  return useContext(Ctx).giaoDien
}

/** Nhãn cột; không khai báo thì trả về chính tên cột trong DB. */
export function useTenCot(cot: string, duPhong?: string): string {
  return useContext(Ctx).tenCot[cot] ?? duPhong ?? cot
}
