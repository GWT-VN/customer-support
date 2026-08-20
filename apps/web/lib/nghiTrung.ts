/**
 * Đề xuất các cặp hồ sơ khách NGHI TRÙNG — hàm thuần, không đụng DB.
 *
 * CEO 20/08/2026: "có thể đề xuất các khách cần gộp được ko … thay vì tôi phải gõ
 * tay vì hiện ko biết có khách nào ko".
 *
 * CEO đoán danh sách đó là "khách Sales mà không có bên CS tương ứng". Đo trên
 * production thì cách đó ra 287/411 khách Sales — nhưng chúng KHÔNG phải hồ sơ
 * trùng: đó là khách Sales chưa từng được tạo hồ sơ CSKH, việc cần làm là TẠO chứ
 * không phải GỘP. Gộp là chuyện của hai dòng cùng nằm trong `cs_customers`.
 *
 * Tín hiệu thật, đo trên production:
 *   · trùng SĐT      -> 0 cặp. `primary_phone` có ràng buộc UNIQUE nên không bao
 *                       giờ có hai hồ sơ cùng số. Đừng phí công dò theo SĐT.
 *   · trùng TÊN      -> 14 nhóm.
 *   · tên này là phần ĐẦU của tên kia -> 29 cặp. Đây là dạng hay gặp nhất, và
 *     đúng ca thật: "Anh Ánh" vs "Anh Ánh/ Anh Ng (Bác Toản)".
 */

export type KhachTenGon = {
  id: string
  full_name: string
  primary_phone: string | null
  province: string | null
  customer_code: string | null
  so_may: number
  so_ticket: number
  so_plan: number
}

export type CapNghiTrung = {
  giu: KhachTenGon
  gop: KhachTenGon
  do_chac: 'cao' | 'vua'
  ly_do: string[]
}

/** Bỏ dấu câu + gom khoảng trắng: "Anh Ánh/ Anh Ng" và "Anh Ánh - Anh Ng" về một. */
export function chuanHoaTen(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/[/\-–—_,.()[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const tongDuLieu = (k: KhachTenGon) => k.so_may + k.so_ticket + k.so_plan

// Dưới 6 ký tự thì "anh a" khớp nửa danh bạ — ghép theo phần đầu chỉ gây nhiễu.
const TOI_THIEU_DE_GHEP_DAU = 6

function lyDoCho(a: KhachTenGon, b: KhachTenGon, trungHet: boolean): string[] {
  const ra = [trungHet ? 'trùng tên' : 'tên này nằm trong tên kia']
  if (!!a.customer_code !== !!b.customer_code) ra.push('một bên có mã KH Sales, bên kia không')
  if (a.province && b.province && a.province === b.province) ra.push(`cùng tỉnh ${a.province}`)
  if (a.primary_phone && b.primary_phone && a.primary_phone !== b.primary_phone) {
    ra.push('hai SĐT khác nhau — có thể là số chính và số phụ của cùng người')
  }
  return ra
}

/**
 * Ghép cặp. Mỗi hồ sơ chỉ nằm trong MỘT cặp: gộp xong một cặp là dữ liệu đã đổi,
 * các cặp còn lại chứa hồ sơ đó đều hết nghĩa — hiện ra chỉ khiến CS bấm nhầm.
 * Vế `giu` luôn là hồ sơ nhiều dữ liệu hơn, để CS khỏi phải tự nghĩ chiều gộp.
 */
export function capNghiTrung(ds: KhachTenGon[]): CapNghiTrung[] {
  const ten = new Map<string, string>()
  for (const k of ds) ten.set(k.id, chuanHoaTen(k.full_name))

  const cap: CapNghiTrung[] = []
  for (let i = 0; i < ds.length; i++) {
    for (let j = i + 1; j < ds.length; j++) {
      const a = ds[i], b = ds[j]
      const ta = ten.get(a.id)!, tb = ten.get(b.id)!
      if (!ta || !tb) continue

      const trungHet = ta === tb
      const longNhau =
        !trungHet &&
        ta.length >= TOI_THIEU_DE_GHEP_DAU && tb.length >= TOI_THIEU_DE_GHEP_DAU &&
        (tb.startsWith(ta + ' ') || ta.startsWith(tb + ' '))

      if (!trungHet && !longNhau) continue

      const [giu, gop] = tongDuLieu(a) >= tongDuLieu(b) ? [a, b] : [b, a]
      cap.push({
        giu, gop,
        do_chac: trungHet ? 'cao' : 'vua',
        ly_do: lyDoCho(giu, gop, trungHet),
      })
    }
  }

  // Chắc chắn trước, rồi tới hồ sơ nhiều dữ liệu (gộp cái đó lợi nhất).
  cap.sort((x, y) =>
    x.do_chac === y.do_chac
      ? tongDuLieu(y.giu) + tongDuLieu(y.gop) - (tongDuLieu(x.giu) + tongDuLieu(x.gop))
      : x.do_chac === 'cao' ? -1 : 1,
  )

  const daDung = new Set<string>()
  return cap.filter((c) => {
    if (daDung.has(c.giu.id) || daDung.has(c.gop.id)) return false
    daDung.add(c.giu.id); daDung.add(c.gop.id)
    return true
  })
}
