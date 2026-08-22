/**
 * SĐT PHỤ và ĐỊA CHỈ PHỤ của khách — đường ghi DÙNG CHUNG cho mọi khu.
 *
 * Vì sao có file này (CEO chốt 21/08/2026):
 * Sales muốn khách có ô "SĐT phụ" nên đề xuất thêm cột phẳng `customers.phone2`. CS đã có
 * sẵn hai bảng 1-N là `customer_contacts` và `customer_addresses` — chính là chỗ màn Gộp
 * khách trùng đổ SĐT/địa chỉ thừa vào. Thêm `phone2` sẽ đẻ ra NGUỒN SỰ THẬT THỨ HAI cho
 * cùng một dữ kiện, sớm muộn hai chỗ lệch nhau. CEO chốt: **Sales làm giống CS, bỏ `phone2`**.
 *
 * Nhưng "dùng chung bảng" chưa đủ. Nếu mỗi khu tự viết câu `insert` của mình thì `role`,
 * `loai`, `is_primary` mỗi bên đặt một kiểu và nhật ký mỗi bên ghi một tên — dùng chung
 * bảng mà vẫn lệch. File này là chỗ DUY NHẤT chuẩn hoá + ghi, để hai khu ra cùng một dạng.
 *
 * KHÔNG đánh dấu `'use server'`: đây là hàm thường, chỉ gọi từ code chạy trên server. Đánh
 * dấu là biến mỗi hàm thành một endpoint ai cũng gọi được (đúng lý do `nhat-ky.ts` nêu).
 *
 * ⚠️ File này KHÔNG kiểm quyền. Cố ý: mỗi khu gác bằng quyền của khu mình
 * (CS dùng `cs.khach.sua`, Sales dùng quyền Sales) rồi mới gọi vào đây. Người gọi có
 * trách nhiệm `requireStaff()` + kiểm quyền TRƯỚC.
 */

import { dataClient } from './nen-tang/db'
import { ghiAudit } from './nen-tang/nhat-ky'
import { chuanHoaSdt } from './sdt'

/** Khu nào ghi — để nhật ký phân biệt được, và để soi khi hai khu lệch nhau. */
export type NguonGhi = 'cskh' | 'sales'

export type KetQuaGhi = { ok: true; id: string } | { ok: false; error: string }

/**
 * Ghi nhật ký khi GHI HỎNG, rồi trả lỗi cho người gọi.
 *
 * Bài học trả giá 22/08/2026: mọi hàm ở đây chỉ ghi nhật ký SAU khi insert thành công. Khi DB
 * chối giá trị app gửi (`role = 'khac'` không nằm trong CHECK), tính năng SĐT phụ hỏng suốt một
 * thời gian dài mà **không để lại một dấu vết nào** — 0 dòng dữ liệu, 0 dòng nhật ký, im lặng
 * tuyệt đối. Phải suy gián tiếp qua "đã có 3 lượt gộp khách chạy" mới dựng được bằng chứng.
 *
 * Có dòng "đã thử, lỗi X" thì phép kiểm *"bảng đáng lẽ có dòng mà đếm ra 0"* tự có đối chứng,
 * không phải đi tìm. Rẻ lúc viết, đắt lúc điều tra ngược.
 */
async function ghiHong(
  hanhDong: string, doiTuong: string, loi: string, chiTiet: Record<string, unknown> = {},
): Promise<{ ok: false; error: string }> {
  await ghiAudit(hanhDong, doiTuong, { ...chiTiet, loi }, 'loi')
  return { ok: false, error: loi }
}

/**
 * KHOÁ của hai bảng vệ tinh là `ma_kh`, không phải `customer_id` (migration 22/08/2026).
 *
 * Vì sao: khách chỉ có bên Sales KHÔNG có hồ sơ CS nên không có `customer_id` nào để gắn —
 * 294/421 khách Sales rơi vào ca đó. `ma_kh` thì cả hai bảng khách đều có đủ 100%.
 * `customer_id` giữ lại làm di sản cho dòng cũ, bỏ hẳn ở chặng B.
 */
export async function maKhCuaKhachCS(customerId: string): Promise<string | null> {
  const { data } = await dataClient()
    .from('cs_customers').select('ma_kh').eq('id', customerId).maybeSingle()
  return (data as { ma_kh: string | null } | null)?.ma_kh ?? null
}

/**
 * Điều kiện lọc dòng vệ tinh của một khách CS.
 *
 * Bắt CẢ hai khoá là cố ý: đi mỗi `ma_kh` thì sót dòng cũ chưa kịp đổ mã, đi mỗi `customer_id`
 * thì **không thấy dòng do Sales ghi** — mà đó đúng là thứ việc này sinh ra để sửa. Sót kiểu sau
 * không có lỗi nào để lần: tra ra rỗng, màn hình trống, không ai biết.
 */
export function locVeTinh(maKh: string | null, customerId: string): string {
  return maKh ? `ma_kh.eq.${maKh},customer_id.eq.${customerId}` : `customer_id.eq.${customerId}`
}

// ── Địa chỉ phụ ────────────────────────────────────────────────────────────

/** Phân loại địa chỉ phụ. `khac` là chốt chặn cho giá trị lạ, không phải để dùng thường. */
export const LOAI_DIA_CHI = ['nha', 'cty', 'lap_dat', 'khac'] as const
export type LoaiDiaChi = (typeof LOAI_DIA_CHI)[number]

/** Giá trị lạ -> `khac` thay vì ném lỗi: thà xếp nhầm nhóm còn hơn mất địa chỉ khách. */
export function chuanHoaLoaiDiaChi(v: string | null | undefined): LoaiDiaChi {
  const s = (v ?? '').trim()
  return (LOAI_DIA_CHI as readonly string[]).includes(s) ? (s as LoaiDiaChi) : 'khac'
}

export async function themDiaChiPhu(input: {
  customer_id: string
  /** Khoá thật của dòng. Sales truyền thẳng vào (không có `customer_id` để tra). */
  ma_kh?: string | null
  dia_chi: string
  loai?: string | null
  /** Tỉnh/TP của địa chỉ này — ô RIÊNG, không gõ lẫn vào ô địa chỉ (CEO chốt, giống màn tạo khách). */
  tinh?: string | null
  ghi_chu?: string | null
  nguon: NguonGhi
}): Promise<KetQuaGhi> {
  const dia_chi = (input.dia_chi ?? '').trim()
  if (!dia_chi) return { ok: false, error: 'Nhập địa chỉ đã.' }

  const loai = chuanHoaLoaiDiaChi(input.loai)
  const { data, error } = await dataClient()
    .from('customer_addresses')
    .insert({
      customer_id: input.customer_id,
      ma_kh: input.ma_kh ?? (await maKhCuaKhachCS(input.customer_id)),
      dia_chi,
      loai,
      tinh: (input.tinh ?? '').trim() || null,
      ghi_chu: (input.ghi_chu ?? '').trim() || null,
    })
    .select('id')
    .single()
  if (error) return ghiHong('them_dia_chi_khach', `khach:${input.customer_id}`, error.message, { loai, nguon: input.nguon })

  await ghiAudit('them_dia_chi_khach', `khach:${input.customer_id}`, { loai, nguon: input.nguon })
  return { ok: true, id: (data as { id: string }).id }
}

export async function xoaDiaChiPhu(input: {
  id: string
  customer_id: string
  nguon: NguonGhi
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await dataClient().from('customer_addresses').delete().eq('id', input.id)
  if (error) return ghiHong('xoa_dia_chi_khach', `khach:${input.customer_id}`, error.message, { nguon: input.nguon })
  await ghiAudit('xoa_dia_chi_khach', `khach:${input.customer_id}`, {
    dia_chi_id: input.id, nguon: input.nguon,
  })
  return { ok: true }
}

// ── SĐT phụ ────────────────────────────────────────────────────────────────

/**
 * Dạng lưu của SĐT phụ. Tách riêng khỏi hàm ghi để test được không cần DB.
 *
 * Chuẩn hoá về cùng dạng với `cs_customers.primary_phone` (0xxxxxxxxx) để tra SĐT ra được
 * cả số phụ. Số KHÔNG hợp lệ (máy bàn, số nước ngoài, cách ghi khác) thì giữ NGUYÊN như
 * người dùng gõ — chặn hoặc bóp méo ở đây là mất liên hệ thật, đắt hơn là lưu lệch dạng.
 */
export function dangLuuSdtPhu(raw: string | null | undefined): string | null {
  const tho = (raw ?? '').trim()
  if (!tho) return null
  const { chuan, hopLe } = chuanHoaSdt(tho)
  return hopLe ? chuan : tho
}

/**
 * Vai trò người liên hệ. DB chỉ nhận đúng 5 giá trị TIẾNG ANH này
 * (`customer_contacts_role_check`) — khác với `loai` của địa chỉ vốn là tiếng Việt.
 *
 * Hai bảng hai thứ tiếng là chỗ rất dễ nhầm, và đã nhầm thật: app gửi `'khac'` cho vai trò,
 * DB chối, **mọi đường thêm SĐT phụ đều gãy** — đo prod 22/08: 0 dòng `customer_contacts`,
 * 0 lượt nhật ký `them_sdt_phu`, dù màn hình có nút từ lâu. Không ai báo vì lỗi nằm ở
 * tầng DB, giao diện chỉ hiện một dòng đỏ khó hiểu.
 */
export const VAI_TRO_LIEN_HE = ['owner', 'family', 'helper', 'manager', 'other'] as const
export type VaiTroLienHe = (typeof VAI_TRO_LIEN_HE)[number]

/** Giá trị lạ (kể cả `'khac'` cũ) -> `other`: thà xếp nhầm nhóm còn hơn mất số của khách. */
export function chuanHoaVaiTro(v: string | null | undefined): VaiTroLienHe | null {
  const t = (v ?? '').trim()
  if (!t) return null
  return (VAI_TRO_LIEN_HE as readonly string[]).includes(t) ? (t as VaiTroLienHe) : 'other'
}

export async function themSdtPhu(input: {
  customer_id: string
  /** Khoá thật của dòng — xem chú thích ở `themDiaChiPhu`. */
  ma_kh?: string | null
  phone?: string | null
  contact_name?: string | null
  role?: string | null
  is_primary?: boolean
  zalo_ok?: boolean
  /** Giờ gọi được, số của ai… — màn TẠO vốn có ô này, màn SỬA thì thiếu (CEO bắt được 22/08). */
  ghi_chu?: string | null
  nguon: NguonGhi
}): Promise<KetQuaGhi> {
  const tho = (input.phone ?? '').trim()
  const ten = (input.contact_name ?? '').trim()
  if (!tho && !ten) return { ok: false, error: 'Nhập số điện thoại hoặc tên người liên hệ.' }

  const phone = dangLuuSdtPhu(tho)
  const daChuanHoa = Boolean(tho) && phone !== tho

  const { data, error } = await dataClient()
    .from('customer_contacts')
    .insert({
      customer_id: input.customer_id,
      ma_kh: input.ma_kh ?? (await maKhCuaKhachCS(input.customer_id)),
      phone,
      contact_name: ten || null,
      role: chuanHoaVaiTro(input.role),
      is_primary: input.is_primary ?? false,
      zalo_ok: input.zalo_ok ?? false,
      ghi_chu: (input.ghi_chu ?? '').trim() || null,
    })
    .select('id')
    .single()
  if (error) return ghiHong('them_sdt_phu', `khach:${input.customer_id}`, error.message, { nguon: input.nguon })

  await ghiAudit('them_sdt_phu', `khach:${input.customer_id}`, {
    nguon: input.nguon, chuan_hoa_sdt: daChuanHoa,
  })
  return { ok: true, id: (data as { id: string }).id }
}

/**
 * SỬA một địa chỉ phụ. CEO chốt 22/08/2026: *"cho phép sửa SĐT phụ và địa chỉ phụ"* — trước đây
 * chỉ thêm được và xoá được, gõ sai một chữ là phải xoá rồi nhập lại từ đầu.
 */
export async function suaDiaChiPhu(input: {
  id: string
  customer_id: string
  dia_chi: string
  loai?: string | null
  tinh?: string | null
  ghi_chu?: string | null
  nguon: NguonGhi
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const dia_chi = (input.dia_chi ?? '').trim()
  if (!dia_chi) return { ok: false, error: 'Nhập địa chỉ đã.' }

  const loai = chuanHoaLoaiDiaChi(input.loai)
  const { error } = await dataClient()
    .from('customer_addresses')
    .update({
      dia_chi,
      loai,
      tinh: (input.tinh ?? '').trim() || null,
      ghi_chu: (input.ghi_chu ?? '').trim() || null,
    })
    .eq('id', input.id)
  if (error) return ghiHong('sua_dia_chi_khach', `khach:${input.customer_id}`, error.message, { nguon: input.nguon })

  await ghiAudit('sua_dia_chi_khach', `khach:${input.customer_id}`, {
    dia_chi_id: input.id, loai, nguon: input.nguon,
  })
  return { ok: true }
}

/** SỬA một SĐT phụ / người liên hệ. Cùng lý do với `suaDiaChiPhu`. */
export async function suaSdtPhu(input: {
  id: string
  customer_id: string
  phone?: string | null
  contact_name?: string | null
  role?: string | null
  zalo_ok?: boolean
  ghi_chu?: string | null
  nguon: NguonGhi
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const tho = (input.phone ?? '').trim()
  const ten = (input.contact_name ?? '').trim()
  if (!tho && !ten) return { ok: false, error: 'Nhập số điện thoại hoặc tên người liên hệ.' }

  const { error } = await dataClient()
    .from('customer_contacts')
    .update({
      phone: dangLuuSdtPhu(tho),
      contact_name: ten || null,
      role: chuanHoaVaiTro(input.role),
      zalo_ok: input.zalo_ok ?? false,
      ghi_chu: (input.ghi_chu ?? '').trim() || null,
    })
    .eq('id', input.id)
  if (error) return ghiHong('sua_sdt_phu', `khach:${input.customer_id}`, error.message, { nguon: input.nguon })

  await ghiAudit('sua_sdt_phu', `khach:${input.customer_id}`, {
    lien_he_id: input.id, nguon: input.nguon,
  })
  return { ok: true }
}
