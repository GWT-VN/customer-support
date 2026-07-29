'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Chọn nhiều dòng trong bảng — MỚI CHỈ CÓ PHẦN CHỌN, chưa có hành động nào.
 * Chỗ cắm hành động hàng loạt là `children` của <ThanhDaChon>; xem hướng dẫn ở
 * cuối file.
 *
 * Ba quyết định đã chốt, đừng đổi mà không bàn lại:
 *
 * 1. KHÔNG giữ lựa chọn khi sang trang / đổi lọc / đổi sắp xếp. Giữ qua trang
 *    nghe tiện nhưng đó là cách tạo ra tai nạn: người dùng tưởng đang chọn 10
 *    dòng trên màn hình, thực tế còn 190 dòng đã chọn ở các trang trước, bấm
 *    một phát đổi cả 200. Danh sách khoá của trang đổi -> xoá sạch lựa chọn.
 *
 * 2. Chỉ admin thấy ô chọn (`bat`). Đây là lớp che giao diện cho đỡ rối mắt,
 *    KHÔNG phải phân quyền — rào thật phải nằm trong Server Action mà chị Trang
 *    viết sau (gọi laAdmin() y như addTicketItem/deleteTicketItem đang làm).
 *
 * 3. Khoá dòng là khoá chính thật (ticket_code…), không phải chỉ số mảng — chỉ
 *    số đổi nghĩa mỗi lần sắp xếp lại.
 */

type BoiCanh = {
  bat: boolean
  daChon: Set<string>
  khoaTrang: string[]
  doiMot: (khoa: string, chon: boolean) => void
  doiTatCa: (chon: boolean) => void
}

const Ctx = createContext<BoiCanh | null>(null)

/** Tên bắt đầu bằng `use` là bắt buộc — quy tắc hook của React/ESLint. */
function useBoiCanh(ten: string): BoiCanh {
  const c = useContext(Ctx)
  if (!c) throw new Error(`<${ten}> phải nằm trong <KhungChon>.`)
  return c
}

export function KhungChon({
  khoaTrang,
  bat,
  children,
}: {
  /** Khoá chính của ĐÚNG các dòng đang hiện trên trang này, theo thứ tự hiển thị. */
  khoaTrang: string[]
  /** false -> không hiện ô chọn nào (vai trò cs). */
  bat: boolean
  children: ReactNode
}) {
  const [daChon, setDaChon] = useState<Set<string>>(() => new Set())

  // Bộ khoá của trang đổi -> bỏ chọn hết. Đây là mẫu "chỉnh state khi prop đổi"
  // của React (so sánh ngay trong lúc render, không dùng useEffect) — dùng
  // useEffect ở đây sẽ hiện một nhịp với lựa chọn CŨ trên dữ liệu MỚI.
  const chuKy = khoaTrang.join('|')
  const [chuKyCu, setChuKyCu] = useState(chuKy)
  if (chuKy !== chuKyCu) {
    setChuKyCu(chuKy)
    setDaChon(new Set())
  }

  function doiMot(khoa: string, chon: boolean) {
    setDaChon((cu) => {
      const moi = new Set(cu)
      if (chon) moi.add(khoa)
      else moi.delete(khoa)
      return moi
    })
  }

  function doiTatCa(chon: boolean) {
    setDaChon(chon ? new Set(khoaTrang) : new Set())
  }

  return (
    <Ctx.Provider value={{ bat, daChon, khoaTrang, doiMot, doiTatCa }}>
      <div className="space-y-4">{children}</div>
    </Ctx.Provider>
  )
}

/**
 * Hành động hàng loạt đọc lựa chọn qua hook này.
 * Trả về mảng khoá (đã theo đúng thứ tự hiển thị) chứ không phải Set — dễ đếm,
 * dễ đẩy thẳng vào Server Action.
 */
export function useDaChon() {
  const c = useBoiCanh('useDaChon')
  return {
    daChon: c.khoaTrang.filter((k) => c.daChon.has(k)),
    soDong: c.daChon.size,
    boChonHet: () => c.doiTatCa(false),
  }
}

/** `<th>` ô chọn tất cả. Đặt làm cột ĐẦU TIÊN của `<tr>` trong `<thead>`. */
export function OChonTatCa({ nhan = 'dòng' }: { nhan?: string }) {
  const c = useBoiCanh('OChonTatCa')
  const ref = useRef<HTMLInputElement>(null)
  const tong = c.khoaTrang.length
  const soChon = c.khoaTrang.filter((k) => c.daChon.has(k)).length
  const het = tong > 0 && soChon === tong

  // "Chọn một phần" không set được bằng thuộc tính JSX, phải gán qua DOM.
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = soChon > 0 && soChon < tong
  }, [soChon, tong])

  if (!c.bat) return null

  return (
    <th className="w-10 px-4 py-3">
      <input
        ref={ref}
        type="checkbox"
        checked={het}
        disabled={tong === 0}
        onChange={(e) => c.doiTatCa(e.target.checked)}
        aria-label={`Chọn tất cả ${tong} ${nhan} trên trang này`}
        title={`Chọn tất cả ${tong} ${nhan} trên trang này`}
        className="align-middle accent-slate-900"
      />
    </th>
  )
}

/** `<td>` ô chọn của một dòng. Đặt làm cột ĐẦU TIÊN của mỗi `<tr>` trong `<tbody>`. */
export function OChonDong({ khoa, moTa }: { khoa: string; moTa?: string }) {
  const c = useBoiCanh('OChonDong')
  if (!c.bat) return null

  return (
    <td className="w-10 px-4 py-3">
      <input
        type="checkbox"
        checked={c.daChon.has(khoa)}
        onChange={(e) => c.doiMot(khoa, e.target.checked)}
        aria-label={`Chọn ${moTa ?? khoa}`}
        className="align-middle accent-slate-900"
      />
    </td>
  )
}

/**
 * Thanh "Đã chọn N …" — chỉ hiện khi có ít nhất một dòng được chọn.
 *
 * 👉 CHỖ CẮM HÀNH ĐỘNG HÀNG LOẠT (cho chị Trang):
 *    Viết một Client Component riêng, trong đó gọi `useDaChon()` để lấy
 *    `daChon` (mảng khoá) và `boChonHet`, rồi đặt nó vào `children` của thanh này:
 *
 *      <ThanhDaChon nhan="ticket">
 *        <DoiTrangThaiHangLoat />
 *      </ThanhDaChon>
 *
 *    Ba việc BẮT BUỘC trong Server Action tương ứng (đã soát code ngày 2026-07-29):
 *      • gọi laAdmin() — updateTicket() hiện KHÔNG có rào admin nào
 *      • chặn số dòng mỗi lượt (~200) để request bịa không ghi đè cả bảng
 *      • ghi vết trước/sau vào ticket_note — updateTicket() đè thẳng, không lưu
 *        giá trị cũ, sửa nhầm 50 dòng là không lần ngược được
 */
export function ThanhDaChon({ nhan = 'dòng', children }: { nhan?: string; children?: ReactNode }) {
  const c = useBoiCanh('ThanhDaChon')
  const soDong = c.daChon.size
  if (!c.bat || soDong === 0) return null

  return (
    <div className="flex items-center gap-3 flex-wrap rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-sm text-white">
      <span>
        Đã chọn <strong>{soDong}</strong> {nhan}
      </span>
      <button
        type="button"
        onClick={() => c.doiTatCa(false)}
        className="text-slate-300 underline hover:text-white"
      >
        Bỏ chọn
      </button>
      {children ? (
        <div className="flex items-center gap-2 flex-wrap ml-auto">{children}</div>
      ) : (
        // Nói thật trạng thái thay vì để một nút giả: chọn xong mà không làm gì
        // được thì người dùng phải biết là do CHƯA CÓ, không phải do bấm hỏng.
        <span className="ml-auto text-xs text-slate-400">
          Thao tác hàng loạt đang được bổ sung — hiện chỉ chọn được.
        </span>
      )}
    </div>
  )
}
