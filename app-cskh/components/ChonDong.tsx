'use client'

import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from 'react'

/**
 * Chọn nhiều dòng trong bảng — MỚI CHỈ CÓ PHẦN CHỌN, chưa có hành động nào.
 * Chỗ cắm hành động hàng loạt là `children` của <ThanhDaChon>; xem hướng dẫn ở
 * cuối file.
 *
 * Bốn quyết định đã chốt, đừng đổi mà không bàn lại:
 *
 * 1. Xoá sạch lựa chọn khi ĐỔI BỘ LỌC / TỪ KHOÁ / SẮP XẾP, nhưng GIỮ khi lật
 *    trang. Mốc so sánh là chữ ký bộ lọc (`thamSo`), KHÔNG phải danh sách khoá
 *    của trang — lấy khoá trang làm mốc thì chọn tất cả 472 máy xong lật sang
 *    trang 2 là mất sạch, đúng thứ vừa bấm.
 *
 * 2. Chọn quá phạm vi trang thì PHẢI NÓI RA. Thanh luôn ghi con số thật, và khi
 *    lựa chọn có dòng nằm ngoài trang đang xem thì ghi thêm "gồm cả dòng ở trang
 *    khác". Tai nạn kinh điển của chọn-xuyên-trang là người dùng nhìn thấy 3 ô
 *    tick trên màn hình rồi bấm, không biết còn 189 dòng nữa đang được chọn.
 *
 * 3. Chỉ admin thấy ô chọn (`bat`). Đây là lớp che giao diện cho đỡ rối mắt,
 *    KHÔNG phải phân quyền — rào thật phải nằm trong Server Action.
 *
 * 4. Khoá dòng là khoá chính thật (ticket_code, visit_id, serial+filter_code…),
 *    không phải chỉ số mảng — chỉ số đổi nghĩa mỗi lần sắp xếp lại.
 */

/** Nhận nguyên khối searchParams của trang (đã bỏ `trang`) — xem `thamSo`. */
type ThamSoLoc = Record<string, string | undefined>

type BoiCanh = {
  bat: boolean
  daChon: Set<string>
  khoaTrang: string[]
  tong: number
  dangLay: boolean
  loi: string | null
  doiMot: (khoa: string, chon: boolean) => void
  doiTatCa: (chon: boolean) => void
  /** Xoá SẠCH, kể cả dòng đã chọn ở trang khác. Khác doiTatCa(false) vốn chỉ đụng trang này. */
  xoaHet: () => void
  chonToanBo: (() => void) | null
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
  tong,
  bat,
  thamSo,
  layTatCaKhoa,
  children,
}: {
  /** Khoá chính của ĐÚNG các dòng đang hiện trên trang này, theo thứ tự hiển thị. */
  khoaTrang: string[]
  /** Tổng số dòng khớp bộ lọc (tất cả các trang). */
  tong: number
  /** false -> không hiện ô chọn nào (vai trò cs). */
  bat: boolean
  /**
   * Bộ lọc hiện hành của trang — q, tt, sp, bh, cot, chieu… KHÔNG chứa `trang`.
   * Dùng cho hai việc: làm mốc xoá lựa chọn, và làm tham số cho layTatCaKhoa().
   */
  thamSo: ThamSoLoc
  /** Server Action trả TOÀN BỘ khoá khớp bộ lọc (khoaTatCa* trong app/actions.ts). */
  layTatCaKhoa?: (t: ThamSoLoc) => Promise<string[]>
  children: ReactNode
}) {
  const [daChon, setDaChon] = useState<Set<string>>(() => new Set())
  const [loi, setLoi] = useState<string | null>(null)
  const [dangLay, batDau] = useTransition()

  // Đổi bộ lọc -> bỏ chọn hết. Đây là mẫu "chỉnh state khi prop đổi" của React
  // (so sánh ngay trong lúc render, không dùng useEffect) — dùng useEffect ở đây
  // sẽ hiện một nhịp với lựa chọn CŨ trên dữ liệu MỚI.
  //
  // Cố ý KHÔNG lấy khoaTrang làm mốc: lật trang thì khoaTrang đổi nhưng bộ lọc
  // vẫn thế, mà lật trang KHÔNG phải lý do để vứt lựa chọn người dùng vừa làm.
  const chuKy = JSON.stringify(thamSo)
  const [chuKyCu, setChuKyCu] = useState(chuKy)
  if (chuKy !== chuKyCu) {
    setChuKyCu(chuKy)
    setDaChon(new Set())
    setLoi(null)
  }

  function doiMot(khoa: string, chon: boolean) {
    setDaChon((cu) => {
      const moi = new Set(cu)
      if (chon) moi.add(khoa)
      else moi.delete(khoa)
      return moi
    })
    setLoi(null)
  }

  /** Chỉ tác động trong phạm vi TRANG: giữ nguyên các dòng đã chọn ở trang khác. */
  function doiTatCa(chon: boolean) {
    setDaChon((cu) => {
      const moi = new Set(cu)
      for (const k of khoaTrang) {
        if (chon) moi.add(k)
        else moi.delete(k)
      }
      return moi
    })
    setLoi(null)
  }

  function xoaHet() {
    setDaChon(new Set())
    setLoi(null)
  }

  const chonToanBo = layTatCaKhoa
    ? () => {
        setLoi(null)
        batDau(async () => {
          try {
            const tatCa = await layTatCaKhoa(thamSo)
            setDaChon(new Set(tatCa))
          } catch {
            setLoi('Không lấy được toàn bộ danh sách. Thử lại.')
          }
        })
      }
    : null

  return (
    <Ctx.Provider
      value={{ bat, daChon, khoaTrang, tong, dangLay, loi, doiMot, doiTatCa, xoaHet, chonToanBo }}
    >
      <div className="space-y-4">{children}</div>
    </Ctx.Provider>
  )
}

/**
 * Hành động hàng loạt đọc lựa chọn qua hook này.
 *
 * `daChon` là mảng khoá THẬT, kể cả khi người dùng bấm "chọn tất cả khớp bộ lọc"
 * — không có chế độ ngầm nào để bên gọi phải tự đoán. Đổi lại, hành động phải
 * chịu được mảng vài trăm phần tử: chia lô mà gửi, đừng bắn từng dòng một.
 */
export function useDaChon() {
  const c = useBoiCanh('useDaChon')
  return {
    daChon: [...c.daChon],
    soDong: c.daChon.size,
    boChonHet: c.xoaHet,
  }
}

/** `<th>` ô chọn tất cả TRÊN TRANG. Đặt làm cột ĐẦU TIÊN của `<tr>` trong `<thead>`. */
export function OChonTatCa({ nhan = 'dòng' }: { nhan?: string }) {
  const c = useBoiCanh('OChonTatCa')
  const ref = useRef<HTMLInputElement>(null)
  const tongTrang = c.khoaTrang.length
  const soChon = c.khoaTrang.filter((k) => c.daChon.has(k)).length
  const het = tongTrang > 0 && soChon === tongTrang

  // "Chọn một phần" không set được bằng thuộc tính JSX, phải gán qua DOM.
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = soChon > 0 && soChon < tongTrang
  }, [soChon, tongTrang])

  if (!c.bat) return null

  return (
    <th className="w-10 px-4 py-3">
      <input
        ref={ref}
        type="checkbox"
        checked={het}
        disabled={tongTrang === 0}
        onChange={(e) => c.doiTatCa(e.target.checked)}
        aria-label={`Chọn ${tongTrang} ${nhan} trên trang này`}
        title={`Chọn ${tongTrang} ${nhan} trên trang này`}
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
 *    Bốn việc BẮT BUỘC trong Server Action tương ứng (đã soát code 2026-07-29):
 *      • gọi laAdmin() — updateTicket() hiện KHÔNG có rào admin nào
 *      • hộp xác nhận ghi rõ SỐ DÒNG trước khi chạy
 *      • chia lô khi ghi (mảng có thể tới vài trăm khoá sau khi "chọn tất cả")
 *      • ghi vết trước/sau vào ticket_note — updateTicket() đè thẳng, không lưu
 *        giá trị cũ, sửa nhầm 50 dòng là không lần ngược được
 */
export function ThanhDaChon({ nhan = 'dòng', children }: { nhan?: string; children?: ReactNode }) {
  const c = useBoiCanh('ThanhDaChon')
  const soDong = c.daChon.size
  if (!c.bat || soDong === 0) return null

  const soTrenTrang = c.khoaTrang.filter((k) => c.daChon.has(k)).length
  const hetTrang = c.khoaTrang.length > 0 && soTrenTrang === c.khoaTrang.length
  // Lựa chọn vượt khỏi trang đang xem -> BẮT BUỘC nói ra, xem quyết định 2 ở đầu file.
  const vuotTrang = soDong > soTrenTrang
  const conNua = c.tong > c.khoaTrang.length
  const moiChonToanBo = hetTrang && conNua && soDong < c.tong && c.chonToanBo

  return (
    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-sm text-white">
      <span>
        Đã chọn <strong>{soDong}</strong> {nhan}
        {vuotTrang && <span className="text-slate-300"> (gồm cả dòng ở trang khác)</span>}
      </span>

      {moiChonToanBo && (
        <button
          type="button"
          onClick={c.chonToanBo!}
          disabled={c.dangLay}
          className="underline decoration-dotted underline-offset-2 text-sky-300 hover:text-white disabled:opacity-50"
        >
          {c.dangLay ? 'Đang lấy…' : `Chọn tất cả ${c.tong} ${nhan} khớp bộ lọc`}
        </button>
      )}

      {/* xoaHet chứ KHÔNG doiTatCa(false): sau khi "chọn tất cả 472", bỏ chọn mà
          chỉ xoá trong phạm vi trang thì còn sót 422 dòng đang chọn ngoài tầm mắt. */}
      <button
        type="button"
        onClick={c.xoaHet}
        className="text-slate-300 underline hover:text-white"
      >
        Bỏ chọn
      </button>

      {c.loi && <span className="text-red-300">{c.loi}</span>}

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
