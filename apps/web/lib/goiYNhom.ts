/**
 * Gợi ý gom nhóm lỗi từ các ticket CHƯA vào nhóm nào — thuần, không phụ thuộc DB.
 *
 * Ý tưởng (minh bạch, không cần AI ngoài): một lỗi mới xuất hiện lẻ tẻ, chưa đáng
 * lập nhóm; khi CÙNG một từ/cụm-từ triệu chứng lặp lại ở ≥N ticket khác nhau thì
 * đó là tín hiệu "nên tạo nhóm". Ta đếm số TICKET (không phải số lần) chứa mỗi từ
 * khoá / cụm 2 từ, bỏ từ thừa (stopword), rồi đề xuất cụm đủ ngưỡng.
 *
 * Ưu tiên CỤM 2 TỪ (vd "màn hình", "rò rỉ") vì cụ thể hơn từ đơn; loại bớt từ đơn
 * đã được một cụm cụ thể giải thích để danh sách đỡ nhiễu.
 *
 * Mỗi cụm trả về `tu` dùng thẳng làm mẫu regex `mau_mo_ta` (Postgres ~* coi như
 * khớp-chứa, không phân biệt hoa thường) khi tạo nhóm mới.
 */

export type TicketMoTa = { ticket_code: string; description: string | null }
export type CumGoiY = { tu: string; so: number; tickets: string[] }

/** Từ nhiễu trong mô tả lỗi máy lọc nước — không mang triệu chứng riêng. */
const STOPWORD = new Set([
  'máy', 'nước', 'lỗi', 'khách', 'hàng', 'bị', 'không', 'ko', 'và', 'có', 'đã',
  'thì', 'là', 'cho', 'của', 'khi', 'với', 'ở', 'các', 'một', 'này', 'đó', 'kia',
  'được', 'ra', 'vào', 'lại', 'nên', 'mà', 'sản', 'phẩm', 'dùng', 'sử', 'gọi',
  'báo', 'yêu', 'cầu', 'cần', 'đang', 'sau', 'trước', 'do', 'vì', 'tại', 'trên',
  'dưới', 'đến', 'bởi', 'nhưng', 'hoặc', 'rồi', 'còn', 'cứ', 'vẫn', 'sẽ', 'đi',
  'làm', 'thấy', 'nhà', 'anh', 'chị', 'em', 'ạ', 'à', 'nhé', 'dạ', 'em', 'mình',
  'thông', 'tin', 'sp', 'kh', 'ah', 'nay', 'hôm', 'giờ', 'rất', 'hơi', 'quá',
])

/** Tách mô tả thành danh sách từ đã chuẩn hoá (thường, chỉ giữ chữ/số). */
export function tachTu(mo_ta: string): string[] {
  return mo_ta
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2)
}

/** true nếu là từ nhiễu (stopword) hoặc thuần số. */
function nhieu(w: string): boolean {
  return STOPWORD.has(w) || /^\d+$/.test(w)
}

/**
 * Sinh danh sách cụm gợi ý. Mỗi cụm: từ khoá + số ticket + mã ticket.
 *  - toiThieu: số ticket tối thiểu để đề xuất (mặc định 3).
 *  - Cụm 2 từ được ưu tiên; từ đơn bị bỏ nếu đã có cụm cụ thể phủ ≥70% ticket của nó.
 */
export function goiYGomTu(dsTicket: TicketMoTa[], toiThieu = 3): CumGoiY[] {
  // tu -> tập ticket (dùng Set để đếm theo TICKET, không nhân đôi khi 1 ticket
  // lặp từ nhiều lần).
  const theoTu = new Map<string, Set<string>>()
  const themVao = (tu: string, ma: string) => {
    let s = theoTu.get(tu)
    if (!s) { s = new Set(); theoTu.set(tu, s) }
    s.add(ma)
  }

  for (const t of dsTicket) {
    if (!t.description) continue
    const tu = tachTu(t.description)
    const daThemUni = new Set<string>()
    for (let i = 0; i < tu.length; i++) {
      const w = tu[i]
      if (!nhieu(w) && !daThemUni.has(w)) { themVao(w, t.ticket_code); daThemUni.add(w) }
      // cụm 2 từ: chỉ cần ÍT NHẤT một từ không nhiễu (giữ "màn hình" dù "hình" hiếm)
      if (i + 1 < tu.length) {
        const w2 = tu[i + 1]
        if (!(nhieu(w) && nhieu(w2))) {
          const cum = `${w} ${w2}`
          themVao(cum, t.ticket_code)
        }
      }
    }
  }

  const ungVien = [...theoTu.entries()]
    .map(([tu, set]) => ({ tu, so: set.size, tickets: [...set].sort() }))
    .filter((c) => c.so >= toiThieu)

  // Ưu tiên cụm 2 từ, rồi số ticket giảm dần, rồi alphabet cho ổn định (test được).
  const laCum = (t: string) => t.includes(' ')
  ungVien.sort((a, b) =>
    Number(laCum(b.tu)) - Number(laCum(a.tu)) || b.so - a.so || a.tu.localeCompare(b.tu)
  )

  // Bỏ ứng viên trùng lặp: nếu một cụm đã nhận phủ ≥70% ticket của ứng viên này.
  const nhan: CumGoiY[] = []
  for (const c of ungVien) {
    const tapC = new Set(c.tickets)
    const trung = nhan.some((a) => {
      const giao = a.tickets.filter((x) => tapC.has(x)).length
      return giao / c.so >= 0.7
    })
    if (!trung) nhan.push(c)
  }
  return nhan
}
