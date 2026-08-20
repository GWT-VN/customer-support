/**
 * Luật gộp khách — HÀM THUẦN, không đụng DB, để test được.
 *
 * Phép gộp thật nằm trong RPC `gop_khach` (migration 46). Ở đây chỉ lo hai việc
 * mà con người dễ làm sai: chọn nhầm chiều gộp (giữ bản nghèo, bỏ bản giàu) và
 * không hình dung được mình sắp làm gì trước khi bấm.
 */
export type KhachGon = {
  id: string; full_name: string; primary_phone: string | null; address: string | null
  so_may: number; so_ticket: number; so_plan: number
}

const tongDuLieu = (k: KhachGon) => k.so_may + k.so_ticket + k.so_plan

/** Chặn các ca gộp chắc chắn sai TRƯỚC khi vào hàng chờ duyệt. */
export function kiemTraGop(giu: KhachGon, gop: KhachGon): { ok: true } | { ok: false; lyDo: string } {
  if (giu.id === gop.id) return { ok: false, lyDo: 'Không thể gộp một khách với chính nó.' }
  if (tongDuLieu(gop) > tongDuLieu(giu)) {
    return {
      ok: false,
      lyDo: `Bản bị gộp (${gop.full_name}) đang có nhiều dữ liệu hơn bản giữ lại — đảo chiều gộp cho đúng.`,
    }
  }
  return { ok: true }
}

/** Câu mô tả cho người duyệt đọc: chuyển gì đi, lấp thêm gì. */
export function moTaGop(giu: KhachGon, gop: KhachGon): string {
  const chuyen: string[] = []
  if (gop.so_may) chuyen.push(`${gop.so_may} máy`)
  if (gop.so_ticket) chuyen.push(`${gop.so_ticket} ticket`)
  if (gop.so_plan) chuyen.push(`${gop.so_plan} lịch bảo trì`)

  const lapThem: string[] = []
  if (!giu.primary_phone && gop.primary_phone) lapThem.push('SĐT')
  if (!giu.address && gop.address) lapThem.push('địa chỉ')

  const ve = chuyen.length ? `chuyển ${chuyen.join(', ')}` : 'không có máy/ticket/lịch nào phải chuyển'
  const them = lapThem.length ? `, lấp thêm ${lapThem.join(' + ')}` : ''
  return `Gộp "${gop.full_name}" vào "${giu.full_name}": ${ve}${them}. Thông tin còn lại của bản bị gộp được ghi vào ghi chú.`
}

// ─────────────────────────────────────────────────────────────────────────────
// So sánh 2 hồ sơ trước khi gộp (màn /khach/gop)
//
// Vì sao cần: bản đầu chỉ hiện TÊN + SĐT. Rất nhiều khách không có SĐT nên CS
// không có gì để phân biệt "Anh Ánh" này với "Anh Ánh" kia — phải mở từng hồ sơ
// ra xem rồi nhớ trong đầu. Gộp nhầm thì một hồ sơ bị ẩn đi.
// ─────────────────────────────────────────────────────────────────────────────

/** Hồ sơ khách đủ trường để CS nhìn là biết có đúng người không. */
export type KhachDayDu = KhachGon & {
  province: string | null
  customer_code: string | null
  ten_kenh: string | null
  source: string | null
  partner_ref: string | null
  notes: string | null
  so_lien_he: number
  created_at: string | null
}

/**
 * Hồ sơ này từ đâu ra. Suy từ dữ liệu ĐANG CÓ, không đọc cột `source` — cột đó
 * là chữ tự do người nhập gõ, không tin được.
 */
export function nguonKhach(k: KhachDayDu): string[] {
  const ra: string[] = []
  if (k.so_may > 0) ra.push('CS')
  if (k.customer_code) ra.push('Sales')
  if (k.so_plan > 0) ra.push('Bảo trì')
  if (k.so_ticket > 0) ra.push('Ticket')
  return ra.length ? ra : ['Chưa có dữ liệu']
}

export type DongSoSanh = {
  nhan: string
  giu: string
  gop: string
  khac: boolean
  /** Giá trị bên GỘP sẽ đi đâu sau khi gộp. */
  ketCuc: 'lap-cho-trong' | 'ghi-vao-ghi-chu' | 'o-lai-ho-so-an' | 'giong-nhau'
}

const hienThi = (v: string | number | null | undefined): string => {
  const s = v === null || v === undefined ? '' : String(v).trim()
  return s === '' ? '—' : s
}

/**
 * Bốn trường này được RPC gop_khach ghi NGUYÊN VĂN vào ghi chú của bản giữ, nên
 * dù không lên được cột thì vẫn đọc lại được ngay trên hồ sơ.
 */
const GHI_VAO_GHI_CHU = new Set(['Tên', 'SĐT', 'Địa chỉ', 'Ghi chú'])

/**
 * Bảng so sánh từng dòng. `ketCuc` trả lời đúng câu CS hay hỏi:
 * "bấm xong thì giá trị bên phải đi đâu?".
 */
export function soSanhKhach(giu: KhachDayDu, gop: KhachDayDu): DongSoSanh[] {
  const cap: [string, string, string][] = [
    ['Tên', hienThi(giu.full_name), hienThi(gop.full_name)],
    ['SĐT', hienThi(giu.primary_phone), hienThi(gop.primary_phone)],
    ['Địa chỉ', hienThi(giu.address), hienThi(gop.address)],
    ['Tỉnh/TP', hienThi(giu.province), hienThi(gop.province)],
    ['Mã KH (nối Sales)', hienThi(giu.customer_code), hienThi(gop.customer_code)],
    ['Kênh / đối tác', hienThi(giu.ten_kenh), hienThi(gop.ten_kenh)],
    ['Nguồn', hienThi(giu.source), hienThi(gop.source)],
    ['Mã đối tác', hienThi(giu.partner_ref), hienThi(gop.partner_ref)],
    ['Ghi chú', hienThi(giu.notes), hienThi(gop.notes)],
  ]

  return cap.map(([nhan, a, b]) => {
    const khac = a !== b
    let ketCuc: DongSoSanh['ketCuc']
    if (!khac || b === '—') ketCuc = 'giong-nhau'
    else if (a === '—') ketCuc = 'lap-cho-trong'
    else if (GHI_VAO_GHI_CHU.has(nhan)) ketCuc = 'ghi-vao-ghi-chu'
    else ketCuc = 'o-lai-ho-so-an'
    return { nhan, giu: a, gop: b, khac, ketCuc }
  })
}

/**
 * Trường có giá trị ở bản GỘP nhưng KHÔNG lên được bản giữ và cũng không được ghi
 * vào ghi chú — nằm lại trên hồ sơ đã ẩn, muốn lấy phải chạy SQL. Đây là danh sách
 * phải chìa ra trước mặt CS TRƯỚC khi bấm.
 */
export function truongOLai(giu: KhachDayDu, gop: KhachDayDu): string[] {
  return soSanhKhach(giu, gop).filter((d) => d.ketCuc === 'o-lai-ho-so-an').map((d) => d.nhan)
}
