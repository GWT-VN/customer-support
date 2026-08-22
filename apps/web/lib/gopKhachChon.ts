/**
 * Lựa chọn của CS khi gộp 2 hồ sơ khách — hàm thuần, không đụng DB.
 *
 * Bản đầu để RPC tự quyết: trường nào cả hai đều có thì bản GIỮ thắng. Đo trên
 * production thì 12/14 nhóm khách trùng tên có cả hai đều có SĐT và 12/14 có hai
 * địa chỉ khác nhau — nên luật đó vứt mất một SĐT và một địa chỉ gần như mọi lần.
 *
 * CEO chỉ đúng bản chất: hai SĐT của một người KHÔNG phải xung đột, đó là số chính
 * + số công ty/giúp việc; hai địa chỉ là nhà + công ty. Nên mặc định ở đây là
 * GIỮ LẠI CẢ HAI (số kia thành SĐT phụ, địa chỉ kia thành địa chỉ phụ), CS chỉ
 * việc chọn cái nào làm chính.
 */
import type { KhachDayDu } from './gopKhach'

export type ChonBen = 'giu' | 'gop'
export type LoaiDiaChi = 'nha' | 'cty' | 'lap_dat' | 'khac'

/** Các trường đem ra cho CS chọn. Thứ tự này cũng là thứ tự hiện trên bảng so sánh. */
export const TRUONG_GOP = [
  { khoa: 'full_name', nhan: 'Tên' },
  { khoa: 'primary_phone', nhan: 'SĐT chính' },
  { khoa: 'address', nhan: 'Địa chỉ chính' },
  { khoa: 'province', nhan: 'Tỉnh/TP' },
  { khoa: 'customer_code', nhan: 'Mã KH (nối Sales)' },
  { khoa: 'channel_id', nhan: 'Kênh / đối tác' },
  { khoa: 'source', nhan: 'Nguồn' },
  { khoa: 'partner_ref', nhan: 'Mã đối tác' },
  // Thông tin công ty (mig 50) — hồ sơ khách lẻ và hồ sơ khách công ty của cùng
  // một người hay nằm tách nhau, gộp lại thì phần công ty phải theo sang.
  { khoa: 'ten_cty', nhan: 'Tên công ty' },
  { khoa: 'mst', nhan: 'Mã số thuế' },
  { khoa: 'dia_chi_cty', nhan: 'Địa chỉ công ty' },
  { khoa: 'sdt_cty', nhan: 'SĐT công ty' },
  { khoa: 'email_cty', nhan: 'Email công ty' },
  { khoa: 'notes', nhan: 'Ghi chú' },
] as const

export type KhoaTruong = (typeof TRUONG_GOP)[number]['khoa']

export type LuaChon = {
  truong: Record<string, ChonBen>
  /** SĐT không được chọn làm chính -> lưu thành số phụ? */
  sdtPhuGiuLai: boolean
  /** Địa chỉ không được chọn làm chính -> lưu thành địa chỉ phụ loại gì, hoặc bỏ hẳn. */
  diaChiThem: LoaiDiaChi | 'bo'
}

export type PChon = {
  truong: Record<string, string | number>
  sdt_phu: { phone: string; contact_name?: string; role?: string }[]
  dia_chi_them: { dia_chi: string; loai: string; ghi_chu?: string; tinh?: string }[]
}

/** Giá trị hiển thị/so sánh của một trường, đã bỏ khoảng trắng thừa. */
export function giaTriTruong(k: KhachDayDu, khoa: string): string {
  if (khoa === 'channel_id') return k.channel_id == null ? '' : String(k.channel_id)
  const v = (k as unknown as Record<string, unknown>)[khoa]
  return v === null || v === undefined ? '' : String(v).trim()
}

/**
 * Mặc định an toàn: bản giữ trống thì lấy bản gộp, cả hai có thì giữ nguyên bản
 * giữ (không tự ghi đè), còn SĐT/địa chỉ dư thì MẶC ĐỊNH GIỮ LẠI chứ không bỏ.
 */
export function macDinhLuaChon(giu: KhachDayDu, gop: KhachDayDu): LuaChon {
  const truong: Record<string, ChonBen> = {}
  for (const t of TRUONG_GOP) {
    const a = giaTriTruong(giu, t.khoa)
    const b = giaTriTruong(gop, t.khoa)
    truong[t.khoa] = a === '' && b !== '' ? 'gop' : 'giu'
  }

  const sdtA = giaTriTruong(giu, 'primary_phone')
  const sdtB = giaTriTruong(gop, 'primary_phone')
  const dcA = giaTriTruong(giu, 'address')
  const dcB = giaTriTruong(gop, 'address')

  return {
    truong,
    // Chỉ có gì để giữ khi CẢ HAI đều có số và hai số khác nhau.
    sdtPhuGiuLai: sdtA !== '' && sdtB !== '' && sdtA !== sdtB,
    // 'khac' = giữ lại nhưng CS chưa nói là nhà hay công ty — vẫn hơn là mất.
    diaChiThem: dcA !== '' && dcB !== '' && dcA !== dcB ? 'khac' : 'bo',
  }
}

/**
 * Dựng payload cho RPC `gop_khach(p_giu, p_gop, p_chon)`.
 *
 * Trường nào CS chọn bên GIỮ thì KHÔNG nhét vào payload — để RPC chạy đúng luật
 * coalesce cũ, khỏi phải chép lại luật đó ở hai nơi rồi lệch nhau.
 */
export function dungPChon(giu: KhachDayDu, gop: KhachDayDu, lc: LuaChon): PChon {
  const truong: Record<string, string | number> = {}
  for (const t of TRUONG_GOP) {
    if (lc.truong[t.khoa] !== 'gop') continue
    const v = giaTriTruong(gop, t.khoa)
    if (v === '') continue
    truong[t.khoa] = t.khoa === 'channel_id' ? Number(v) : v
  }

  // Bên KHÔNG được chọn làm số chính mới là bên đi xuống số phụ.
  const sdt_phu: PChon['sdt_phu'] = []
  if (lc.sdtPhuGiuLai) {
    const benPhu = lc.truong.primary_phone === 'gop' ? giu : gop
    const so = giaTriTruong(benPhu, 'primary_phone')
    if (so !== '') // 'other' chứ không phải 'khac': DB chỉ nhận 5 vai trò tiếng Anh, gửi 'khac' là
    // cả lệnh gộp ném lỗi và KHÔNG kéo được số phụ nào sang. Xem VAI_TRO_LIEN_HE.
    sdt_phu.push({ phone: so, contact_name: benPhu.full_name, role: 'other' })
  }

  const dia_chi_them: PChon['dia_chi_them'] = []
  if (lc.diaChiThem !== 'bo') {
    const benPhu = lc.truong.address === 'gop' ? giu : gop
    const dc = giaTriTruong(benPhu, 'address')
    if (dc !== '') dia_chi_them.push({ dia_chi: dc, loai: lc.diaChiThem })
  }

  return { truong, sdt_phu, dia_chi_them }
}

/**
 * Trường mà giá trị KHÔNG được chọn sẽ chẳng có chỗ nào chứa — nằm lại hồ sơ bị
 * ẩn, muốn lấy phải nhờ kỹ thuật. Phải chìa danh sách này ra trước khi CS bấm.
 *
 * Bốn trường vắng mặt ở đây vì đã có nhà: `primary_phone` xuống SĐT phụ, `address`
 * xuống địa chỉ phụ, `full_name` và `notes` được RPC ghi nguyên văn vào ghi chú.
 */
const CO_CHO_CHUA = new Set<string>(['full_name', 'primary_phone', 'address', 'notes'])

export function truongKhongCoChoChua(giu: KhachDayDu, gop: KhachDayDu): string[] {
  return TRUONG_GOP.filter((t) => {
    if (CO_CHO_CHUA.has(t.khoa)) return false
    const a = giaTriTruong(giu, t.khoa)
    const b = giaTriTruong(gop, t.khoa)
    // Chỉ mất khi CẢ HAI đều có và khác nhau — một bên trống thì bên kia lấp vào.
    return a !== '' && b !== '' && a !== b
  }).map((t) => t.nhan)
}
