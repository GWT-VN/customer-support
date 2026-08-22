/**
 * Hàm THUẦN cho khuyến mãi + chiết khấu đại lý. Không đụng DB, không React — test được.
 *
 * Ba khái niệm tách bạch, đừng trộn:
 *  · CHIẾT KHẤU ĐẠI LÝ — theo BẬC của đối tác (NPP / Đại lý / Giới thiệu), theo mã SP,
 *    có hiệu lực theo thời gian.
 *  · KHUYẾN MÃI KHÁCH LẺ — theo KÊNH của đơn, theo khoảng ngày.
 *  · Khách đã có bậc thì KHÔNG ăn khuyến mãi khách lẻ (CEO chốt 21/08/2026).
 */

export type KieuGiam = 'PCT' | 'TIEN' | 'CON'
export type Bac = 'NPP' | 'DAI_LY' | 'GIOI_THIEU'

/**
 * Giá bán sau khi áp một mức giảm.
 *  · PCT  — giảm phần trăm; `giamToiDa` là TRẦN cho số tiền giảm (chỉ có nghĩa ở kiểu này).
 *  · TIEN — trừ thẳng số tiền.
 *  · CON  — "giảm còn": `muc` CHÍNH LÀ giá bán, không phụ thuộc giá niêm yết.
 *
 * Không bao giờ trả số âm. `muc` rỗng/không hợp lệ -> giữ nguyên giá niêm yết,
 * KHÔNG đoán là giảm 0 hay giảm 100%.
 */
export function giaSauGiam(
  kieu: KieuGiam,
  niemYet: number | null | undefined,
  muc: number | null | undefined,
  giamToiDa?: number | null
): number {
  const ny = Math.round(Number(niemYet) || 0)
  if (muc == null || !Number.isFinite(Number(muc))) return ny
  const m = Number(muc)
  if (kieu === 'CON') return Math.max(0, Math.round(m))
  if (kieu === 'TIEN') return Math.max(0, ny - Math.round(m))
  // PCT
  let giam = Math.round((ny * m) / 100)
  const tran = giamToiDa == null ? null : Number(giamToiDa)
  if (tran != null && Number.isFinite(tran) && giam > tran) giam = Math.round(tran)
  return Math.max(0, ny - giam)
}

/** Mức áp cho một mã: mức RIÊNG của mã thắng mức chung. `null` cả hai -> không giảm. */
export function mucApDung(
  mucRieng: number | null | undefined,
  mucChung: number | null | undefined
): number | null {
  if (mucRieng != null && Number.isFinite(Number(mucRieng))) return Number(mucRieng)
  if (mucChung != null && Number.isFinite(Number(mucChung))) return Number(mucChung)
  return null
}

/** Một khoảng ngày có bao ngày `ngay` không. `den` rỗng = vô thời hạn. */
export function conHieuLuc(ngay: string, tu: string, den: string | null | undefined): boolean {
  if (!ngay || !tu) return false
  if (ngay < tu) return false
  if (den && ngay > den) return false
  return true
}

export type Ctkm = {
  id: string
  ten: string
  tu_ngay: string
  den_ngay: string | null
  kieu_giam: KieuGiam
  muc_chung: number | null
  giam_toi_da: number | null
  trang_thai: string
  /** channel_id được hưởng. Rỗng = không kênh nào -> chương trình không áp cho ai. */
  kenh: number[]
}

/**
 * Chương trình áp cho một đơn: đúng ngày, đúng kênh, và ĐÃ BAN HÀNH.
 *
 * Bản nháp KHÔNG bao giờ áp — đó là lý do có trạng thái nháp.
 * Nhiều chương trình cùng khớp thì lấy cái GIẢM SÂU NHẤT cho khách, và trả về cả danh
 * sách còn lại để giao diện nói rõ "còn N chương trình khác cũng khớp" thay vì im lặng.
 */
export function ctkmChoDon(
  ds: Ctkm[],
  ngay: string,
  channelId: number | null | undefined,
  niemYetThamChieu = 10_000_000
): { chon: Ctkm | null; khac: Ctkm[] } {
  const khop = ds.filter(
    (c) =>
      c.trang_thai === 'ban_hanh' &&
      conHieuLuc(ngay, c.tu_ngay, c.den_ngay) &&
      channelId != null &&
      c.kenh.includes(channelId)
  )
  if (khop.length === 0) return { chon: null, khac: [] }
  const xep = [...khop].sort(
    (a, b) =>
      giaSauGiam(a.kieu_giam, niemYetThamChieu, a.muc_chung, a.giam_toi_da) -
      giaSauGiam(b.kieu_giam, niemYetThamChieu, b.muc_chung, b.giam_toi_da)
  )
  return { chon: xep[0], khac: xep.slice(1) }
}

export type ChinhSachGia = {
  bac: Bac
  internal_code: string
  giam_pct: number | null
  gia_ban: number | null
  nhap_theo: 'PCT' | 'GIA'
  hieu_luc_tu: string
  hieu_luc_den: string | null
  trang_thai: string
}

/**
 * Giá cho một mã theo bậc đối tác, tại một ngày.
 *
 * Ưu tiên `gia_ban` khi người nhập gõ theo GIÁ — giữ đúng con số đã duyệt, không tính
 * lại từ % rồi lệch vài đồng do làm tròn. Gõ theo % thì tính từ giá niêm yết.
 * Không có chính sách khớp -> `null` (gọi bên ngoài tự quyết dùng giá niêm yết).
 */
export function giaTheoBac(
  ds: ChinhSachGia[],
  bac: Bac,
  internalCode: string,
  niemYet: number | null | undefined,
  ngay: string
): number | null {
  const khop = ds
    .filter(
      (c) =>
        c.bac === bac &&
        c.internal_code === internalCode &&
        c.trang_thai === 'ban_hanh' &&
        conHieuLuc(ngay, c.hieu_luc_tu, c.hieu_luc_den)
    )
    // Nhiều bản cùng hiệu lực -> lấy bản MỚI NHẤT.
    .sort((a, b) => b.hieu_luc_tu.localeCompare(a.hieu_luc_tu))
  const c = khop[0]
  if (!c) return null
  if (c.nhap_theo === 'GIA' && c.gia_ban != null) return Math.max(0, Math.round(c.gia_ban))
  if (c.giam_pct != null) return giaSauGiam('PCT', niemYet, c.giam_pct)
  if (c.gia_ban != null) return Math.max(0, Math.round(c.gia_ban))
  return null
}

/** Cặp %/₫ cho ô nhập: gõ ô nào thì tính ô kia. Trả về cặp đã làm tròn để hiển thị. */
export function capGiaVaPct(
  niemYet: number | null | undefined,
  nhapTheo: 'PCT' | 'GIA',
  giaTri: number | null | undefined
): { pct: number | null; gia: number | null } {
  const ny = Math.round(Number(niemYet) || 0)
  if (giaTri == null || !Number.isFinite(Number(giaTri)) || ny <= 0) return { pct: null, gia: null }
  const v = Number(giaTri)
  if (nhapTheo === 'PCT') return { pct: v, gia: Math.round(ny * (1 - v / 100)) }
  // Làm tròn 1 chữ số thập phân: 179.950.000 -> 112.000.000 ra 37,8% chứ không phải 37,76537…
  return { pct: Math.round((1 - v / ny) * 1000) / 10, gia: Math.round(v) }
}

const vndCt = new Intl.NumberFormat('vi-VN')

/** Nhãn mức giảm cho danh sách: "Giảm 12%" · "Giảm 5.000.000 ₫" · "Giá còn 29.900.000 ₫". */
export function nhanKieuGiam(kieu: KieuGiam, muc: number | null | undefined): string {
  if (muc == null || !Number.isFinite(Number(muc))) return 'Chưa đặt mức giảm'
  const m = Number(muc)
  if (kieu === 'PCT') return `Giảm ${m}%`
  if (kieu === 'TIEN') return `Giảm ${vndCt.format(Math.round(m))} ₫`
  return `Giá còn ${vndCt.format(Math.round(m))} ₫`
}

export const NHAN_NHOM_KHACH: Record<string, string> = {
  TAT_CA: 'Tất cả khách lẻ',
  MOI: 'Chỉ khách mới',
  DA_MUA: 'Chỉ khách đã mua',
  CHI_DINH: 'Danh sách chỉ định',
}
export function nhanNhomKhach(ma: string): string {
  return NHAN_NHOM_KHACH[ma] ?? ma
}

// ── Giá gợi ý khi lên đơn ──────────────────────────────────────────────────

/** Mọi thứ cần để tính giá cho một khách, gom sẵn ở server để client khỏi gọi lại từng dòng. */
export type BoiCanhGia = {
  /** Bậc đối tác đang hiệu lực. `null` = khách lẻ. */
  bac: Bac | null
  /** Kênh của khách — khách lẻ hưởng khuyến mãi theo kênh này. */
  channel_id: number | null
  chinhSach: ChinhSachGia[]
  /** Chương trình khuyến mãi đã chọn (giảm sâu nhất) cho kênh của khách. */
  ctkm: (Ctkm & { sp: Record<string, number> }) | null
  /** Số chương trình khác cũng khớp — để giao diện nói ra thay vì im lặng. */
  soCtkmKhac: number
  /** Giá niêm yết theo mã. */
  niemYet: Record<string, number>
}

export type NguonGia = 'BAC' | 'CTKM' | 'NIEM_YET' | 'KHONG_RO'

export type GiaGoiY = {
  gia: number | null
  nguon: NguonGia
  nhan: string
  niemYet: number | null
}

/**
 * Giá gợi ý cho MỘT mã hàng, theo bối cảnh khách.
 *
 * Thứ tự ưu tiên — CEO chốt 22/08: **bậc đại lý thắng khuyến mãi bán lẻ**. Đại lý đã hưởng
 * giá sỉ theo hợp đồng thì không cộng dồn thêm chương trình bán lẻ, nếu không cùng một máy
 * bán cho đại lý lại rẻ hơn giá vốn.
 *
 * Không có gì khớp -> giá niêm yết. Không có cả giá niêm yết -> `null`, giao diện để trống
 * cho người nhập tự gõ (đừng bịa số 0 — 0 đồng trông như hàng tặng).
 */
export function giaGoiY(bc: BoiCanhGia, internalCode: string, ngay: string): GiaGoiY {
  const ny = bc.niemYet[internalCode] ?? null

  if (bc.bac) {
    const g = giaTheoBac(bc.chinhSach, bc.bac, internalCode, ny, ngay)
    if (g != null) return { gia: g, nguon: 'BAC', nhan: `Giá ${nhanBac(bc.bac)}`, niemYet: ny }
  }

  if (bc.ctkm && ny != null) {
    // Mức riêng của mã này thắng mức chung; 0 riêng vẫn thắng (miễn phí là một mức thật).
    const muc = mucApDung(bc.ctkm.sp[internalCode], bc.ctkm.muc_chung)
    // Chương trình có liệt kê sản phẩm mà mã này KHÔNG nằm trong đó -> không áp.
    const coDanhSach = Object.keys(bc.ctkm.sp).length > 0
    const trongDanhSach = internalCode in bc.ctkm.sp
    if (muc != null && (!coDanhSach || trongDanhSach)) {
      const g = giaSauGiam(bc.ctkm.kieu_giam, ny, muc, bc.ctkm.giam_toi_da)
      return { gia: g, nguon: 'CTKM', nhan: bc.ctkm.ten, niemYet: ny }
    }
  }

  if (ny != null) return { gia: ny, nguon: 'NIEM_YET', nhan: 'Giá niêm yết', niemYet: ny }
  return { gia: null, nguon: 'KHONG_RO', nhan: 'Mã này chưa có giá niêm yết', niemYet: null }
}

export function nhanBac(b: Bac): string {
  return b === 'NPP' ? 'Cấp 1 · NPP' : b === 'DAI_LY' ? 'Cấp 2 · Đại lý' : 'Cấp 3 · Giới thiệu'
}
