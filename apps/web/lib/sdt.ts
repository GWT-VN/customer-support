/**
 * Một nguồn sự thật cho SĐT của cả app. Trước đây luật này bị chép ở
 * `app/actions.ts` và `components/KhachPicker.tsx`, sửa một chỗ là lệch chỗ kia.
 *
 * CEO chốt 20/08/2026: SĐT chuẩn là **đúng 10 số, bắt đầu bằng 0** (không nhận
 * số bắt đầu bằng 9 hay 84). Nhưng dữ liệu cũ có `84…` và số thiếu số 0 đầu, nên
 * đây là **CẢNH BÁO, KHÔNG CHẶN LƯU** — mở hồ sơ cũ ra sửa vẫn lưu được bình
 * thường, chỉ hiện một dòng chữ hổ phách nhắc.
 */

/** Chuẩn hoá về `0` + 9 số cuối. Nhận cả `84…`, `+84…`, số dính dấu, thiếu số 0 đầu. */
export function chuanHoaSdt(raw: string | null | undefined): {
  chuan: string
  cuoi9: string
  hopLe: boolean
} {
  let so = (raw ?? '').replace(/\D/g, '')
  if (so.startsWith('84')) so = '0' + so.slice(2)
  else if (so.length === 9) so = '0' + so
  // `hopLe` giữ ĐÚNG độ rộng của rào server hiện hành (10 HOẶC 11 số) — đây là
  // ngưỡng "lưu được", cố tình rộng hơn `sdtChuanMuc` để không chặn dữ liệu cũ.
  const hopLe = /^0\d{9,10}$/.test(so)
  const cuoi9 = so.length >= 9 ? so.slice(-9) : so
  return { chuan: so, cuoi9, hopLe }
}

/** Đúng luật CEO: sau khi chuẩn hoá phải là đúng 10 số và bắt đầu bằng 0. */
export function sdtChuanMuc(raw: string | null | undefined): boolean {
  return /^0\d{9}$/.test(chuanHoaSdt(raw).chuan)
}

/**
 * Câu nhắc hiện dưới ô nhập. `null` = không có gì để nhắc.
 * Ô rỗng KHÔNG cảnh báo ở đây — việc "bắt buộc nhập" là của từng form.
 */
export function canhBaoSdt(raw: string | null | undefined): string | null {
  const goc = (raw ?? '').trim()
  if (goc === '') return null

  const so = goc.replace(/\D/g, '')
  const { chuan } = chuanHoaSdt(goc)

  if (sdtChuanMuc(goc)) {
    // Quy đổi được về 10 số hợp lệ, nhưng người dùng gõ dạng khác (`84…`, thiếu
    // số 0 đầu). CEO nói rõ không được bắt đầu bằng 84 hay 9 -> vẫn phải nhắc,
    // kèm luôn dạng đúng để họ chỉ việc chép lại.
    return so === chuan ? null : `Nên ghi thành ${chuan} — SĐT chuẩn là 10 số bắt đầu bằng 0.`
  }
  return 'SĐT chuẩn là 10 số bắt đầu bằng 0. Vẫn lưu được, nhưng nên sửa lại.'
}
