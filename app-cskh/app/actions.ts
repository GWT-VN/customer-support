'use server'

import { revalidatePath } from 'next/cache'
import { dataClient, laAdmin, layNhanVien, requireStaff } from '@/lib/supabase'
import { kiemTraSuaNhanVien, laVaiTroHopLe, type VaiTro } from '@/lib/quyen'
import { antoanChoOr, chuanHoaTuKhoa, mauDauTu, sapXepHopLe, gomKhoa } from '@/bang'
import type { KetQuaTrang, TuyChonDanhSach, ThamSoLoc } from '@/bang'
import {
  MOI_TRANG, MOI_TRANG_LOI, COT_MAY, COT_TICKET, COT_LOI, COT_KHACH, COT_BAO_TRI,
  TINH_TRANG_BH, TOI_DA_CHON, type TinhTrangBH,
} from '@/lib/danhSach'

/** Câu từ chối dùng chung cho các action chỉ dành cho admin. */
const KHONG_DU_QUYEN = 'Chỉ quản trị mới làm được việc này.'

// ⚠️ KHÔNG re-export kiểu từ file 'use server': Turbopack coi mỗi export là một
// server action và build vỡ với "Export KetQuaTrang doesn't exist in target module".
// Trang nào cần KetQuaTrang/TuyChonDanhSach thì import thẳng từ '@/bang'.

export type Machine = {
  serial: string
  internal_code: string | null
  product_name: string | null
  category_l2: string | null
  customer_id: string | null
  customer_name: string | null
  primary_phone: string | null
  needs_phone: boolean | null
  install_date: string | null
  status: string
  warranty_activated: boolean
  warranty_start: string | null
  warranty_full_end: string | null
  warranty_core_end: string | null
  con_han_may: boolean | null
  con_han_loi: boolean | null
  co_chinh_sach_bh: boolean
}

/** Tra máy theo serial / tên khách / SĐT / địa chỉ (không dấu). Rỗng -> máy lắp gần nhất. */
export async function searchMachines(
  q: string,
  tuyChon: TuyChonDanhSach & { maSanPham?: string; tinhTrangBH?: string } = {}
): Promise<KetQuaTrang<Machine>> {
  await requireStaff()
  const sx = sapXepHopLe(tuyChon.cot, tuyChon.chieu, COT_MAY, {
    cot: 'install_date', tang: false,
  })
  const trang = Math.max(1, tuyChon.trang ?? 1)
  const moi = tuyChon.moiTrang ?? MOI_TRANG
  const tu = (trang - 1) * moi

  let truyVan = dataClient()
    .from('v_installed_base')
    .select('*', { count: 'exact' })

  const kw = antoanChoOr(chuanHoaTuKhoa(q))
  if (kw) {
    // TÊN khách khớp theo ĐẦU TỪ (imatch + \m), xem mauDauTu(): gõ "huong" không
    // còn ra Phương/Thương nữa. Serial và SĐT vẫn ilike %...% — ở đó người dùng cố
    // ý gõ một MẨU GIỮA chuỗi (4 số cuối điện thoại, đuôi serial), khớp đầu từ sẽ
    // làm hỏng đúng thao tác thường dùng nhất.
    //
    // ĐỊA CHỈ đã dùng lại được. Trước đây phải bỏ ra vì "Phường" bỏ dấu thành
    // "phuong", chứa chuỗi con "huong" -> gõ "huong" ngập 296/472 dòng, 257 dòng
    // trúng CHỈ vì địa chỉ có chữ "Phường". Khớp đầu từ diệt đúng cái đó: `\mhuong`
    // không khớp "phuong" nữa, đo lại còn 4 dòng — đều là đường/phố tên Hương thật.
    truyVan = truyVan.or(
      `ten_kd.imatch.${mauDauTu(kw)},dia_chi_kd.imatch.${mauDauTu(kw)},` +
        `serial.ilike.%${kw}%,primary_phone.ilike.%${kw}%`
    )
  }

  if (tuyChon.maSanPham) truyVan = truyVan.eq('internal_code', tuyChon.maSanPham)

  // 4 nhánh PHẢI khớp Y HỆT WarrantyBadge (components/Badge.tsx) — whitelist qua
  // TINH_TRANG_BH nên giá trị lạ trên URL bị bỏ qua thay vì lặng lẽ .eq() sai cột.
  if (tuyChon.tinhTrangBH && TINH_TRANG_BH.includes(tuyChon.tinhTrangBH as TinhTrangBH)) {
    switch (tuyChon.tinhTrangBH as TinhTrangBH) {
      case 'chua_kich_hoat':
        truyVan = truyVan.eq('warranty_activated', false)
        break
      case 'con_han_may':
        truyVan = truyVan
          .eq('warranty_activated', true).eq('co_chinh_sach_bh', true).eq('con_han_may', true)
        break
      case 'het_may_con_loi':
        truyVan = truyVan
          .eq('warranty_activated', true).eq('co_chinh_sach_bh', true)
          .eq('con_han_may', false).eq('con_han_loi', true)
        break
      case 'het_ca_hai':
        truyVan = truyVan
          .eq('warranty_activated', true).eq('co_chinh_sach_bh', true)
          .eq('con_han_may', false).eq('con_han_loi', false)
        break
    }
  }

  // serial là khoá chính của v_installed_base -> khoá phụ đủ để .range() không
  // nhảy/lặp dòng giữa các trang khi cột sắp xếp chính có nhiều dòng bằng nhau
  // (vd install_date trùng nhau tới 10 dòng — Postgres không tự đảm bảo thứ tự đó).
  const { data, error, count } = await truyVan
    .order(sx.cot, { ascending: sx.tang, nullsFirst: false })
    .order('serial', { ascending: true })
    .range(tu, tu + moi - 1)
  if (error) throw new Error(error.message)

  const tong = count ?? 0
  return {
    rows: (data ?? []) as Machine[],
    tong,
    trang,
    soTrang: Math.max(1, Math.ceil(tong / moi)),
    sapXep: sx,
  }
}

/** Model máy đã lắp — nguồn cho ô lọc "Sản phẩm/model" ở "/". Sinh từ DB thật
 *  (không hardcode): mỗi internal_code xuất hiện đúng 1 lần, nhãn = product_name. */
export async function machineModels(): Promise<{ internal_code: string; product_name: string | null }[]> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('v_installed_base')
    .select('internal_code, product_name')
    .not('internal_code', 'is', null)
  if (error) throw new Error(error.message)

  const theo = new Map<string, string | null>()
  for (const r of (data ?? []) as { internal_code: string; product_name: string | null }[]) {
    if (!theo.has(r.internal_code)) theo.set(r.internal_code, r.product_name)
  }
  return [...theo.entries()]
    .map(([internal_code, product_name]) => ({ internal_code, product_name }))
    .sort((a, b) => (a.product_name ?? a.internal_code).localeCompare(b.product_name ?? b.internal_code, 'vi'))
}

export async function getMachine(serial: string): Promise<Machine | null> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('v_installed_base').select('*').eq('serial', serial).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Machine) ?? null
}

/** Kích hoạt bảo hành. RPC tự tính full_end/core_end từ product_warranty. */
export async function activateWarranty(serial: string, startDate: string) {
  await requireStaff()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { ok: false as const, error: 'Ngày không hợp lệ.' }
  }
  const { error } = await dataClient().rpc('activate_warranty', {
    p_serial: serial,
    p_start: startDate,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/')
  revalidatePath(`/may/${encodeURIComponent(serial)}`)
  return { ok: true as const }
}

export type Contact = {
  id: string
  phone: string | null
  contact_name: string | null
  role: string | null
  is_primary: boolean
  zalo_ok: boolean
}

export type Customer = {
  id: string
  full_name: string
  primary_phone: string | null
  source: string | null
  province: string | null
  address: string | null
  needs_phone: boolean
  notes: string | null
}

export async function getCustomer(id: string) {
  await requireStaff()
  const db = dataClient()
  const [{ data: c, error: e1 }, { data: contacts, error: e2 }] = await Promise.all([
    db.from('cs_customers').select('*').eq('id', id).maybeSingle(),
    db.from('customer_contacts').select('*').eq('customer_id', id).order('is_primary', { ascending: false }),
  ])
  if (e1) throw new Error(e1.message)
  if (e2) throw new Error(e2.message)
  return { customer: (c as Customer) ?? null, contacts: (contacts ?? []) as Contact[] }
}

export async function updateCustomer(id: string, patch: Partial<Customer>) {
  await requireStaff()
  const allowed = {
    full_name: patch.full_name,
    primary_phone: patch.primary_phone || null,
    province: patch.province || null,
    address: patch.address || null,
  }
  // Sửa được SĐT hợp lệ -> hạ cờ needs_phone + xoá ghi chú lỗi
  const { error } = await dataClient()
    .from('cs_customers')
    .update(
      allowed.primary_phone && /^0\d{9,10}$/.test(allowed.primary_phone)
        ? { ...allowed, needs_phone: false, notes: null }
        : allowed
    )
    .eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/khach/${id}`)
  revalidatePath('/')
  return { ok: true as const }
}

export async function addContact(customerId: string, c: Omit<Contact, 'id'>) {
  await requireStaff()
  const { error } = await dataClient().from('customer_contacts').insert({
    customer_id: customerId,
    phone: c.phone || null,
    contact_name: c.contact_name || null,
    role: c.role || null,
    is_primary: c.is_primary,
    zalo_ok: c.zalo_ok,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/khach/${customerId}`)
  return { ok: true as const }
}

export async function deleteContact(id: string, customerId: string) {
  await requireStaff()
  const { error } = await dataClient().from('customer_contacts').delete().eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/khach/${customerId}`)
  return { ok: true as const }
}

// ── Lịch thay lõi (Phase 3) ─────────────────────────────────────────────────
export type CoreDue = {
  serial: string
  internal_code: string | null
  product_name: string | null
  filter_code: string
  filter_name: string | null
  chu_ky_raw: string | null
  thang_min: number
  thang_max: number
  install_date: string | null
  lan_thay_gan_nhat: string | null
  moc_tinh: string | null
  han_som: string | null
  han_muon: string | null
  con_bao_nhieu_ngay: number | null
  tinh_trang: string
  customer_id: string | null
  customer_name: string | null
  primary_phone: string | null
  needs_phone: boolean | null
}

/**
 * Lịch thay lõi. Mặc định "sắp đến hạn" — đó là danh sách gọi được ngay.
 *
 * ⚠️ "QUÁ HẠN" KHÔNG chắc khách cần thay: filter_replacement mới bắt đầu ghi, nên máy cũ
 * nào chưa từng log đều hiện quá hạn dù thực tế GWT đã thay rồi. Dùng làm danh sách XÁC MINH.
 */
export async function coreForecast(
  tinhTrang: string,
  q: string,
  tuyChon: TuyChonDanhSach & { tatPhanTrang?: boolean } = {}
): Promise<KetQuaTrang<CoreDue>> {
  await requireStaff()
  const sx = sapXepHopLe(tuyChon.cot, tuyChon.chieu, COT_LOI, {
    cot: 'han_som', tang: true,
  })
  const trang = Math.max(1, tuyChon.trang ?? 1)
  const moi = tuyChon.moiTrang ?? MOI_TRANG_LOI
  const tu = (trang - 1) * moi

  let truyVan = dataClient().from('v_core_forecast').select('*', { count: 'exact' })

  if (tinhTrang) truyVan = truyVan.eq('tinh_trang', tinhTrang)
  const term = q.trim()
  if (term) {
    // v_core_forecast KHÔNG có ten_kd/dia_chi_kd (Task 1 chỉ thêm cho v_installed_base
    // và v_tickets) -> customer_name/product_name vẫn còn dấu trong DB, KHÔNG được bỏ
    // dấu từ khoá ở đây kẻo mất khớp. Chỉ chặn ký tự phá cú pháp .or().
    const safe = antoanChoOr(term)
    truyVan = truyVan.or(
      `serial.ilike.%${safe}%,customer_name.ilike.%${safe}%,primary_phone.ilike.%${safe}%,` +
        `filter_code.ilike.%${safe}%,product_name.ilike.%${safe}%`
    )
  }

  // Một máy có NHIỀU lõi -> khoá phụ chỉ mình serial chưa đủ để định danh 1 dòng,
  // phải thêm filter_code -> (serial, filter_code) mới duy nhất, .range() mới ổn định.
  let cauLenh = truyVan
    .order(sx.cot, { ascending: sx.tang, nullsFirst: false })
    .order('serial', { ascending: true })
    .order('filter_code', { ascending: true })
  // LoiCuaMay.tsx cần TOÀN BỘ lõi của 1 máy (không phân trang) rồi tự lọc theo serial.
  if (!tuyChon.tatPhanTrang) cauLenh = cauLenh.range(tu, tu + moi - 1)

  const { data, error, count } = await cauLenh
  if (error) throw new Error(error.message)

  const tong = count ?? 0
  return {
    rows: (data ?? []) as CoreDue[],
    tong,
    trang,
    soTrang: Math.max(1, Math.ceil(tong / moi)),
    sapXep: sx,
  }
}

export async function coreCounts() {
  await requireStaff()
  const db = dataClient()
  const keys = ['QUÁ HẠN', 'sắp đến hạn (≤30 ngày)', 'còn hạn']
  const out: Record<string, number> = {}
  await Promise.all(
    keys.map(async (k) => {
      const { count } = await db
        .from('v_core_forecast').select('*', { count: 'exact', head: true }).eq('tinh_trang', k)
      out[k] = count ?? 0
    })
  )
  return out
}

// ── Lịch bảo trì đến hạn (v_maintenance_due) ────────────────────────────────
export type MaintenanceDue = {
  visit_id: string
  lan_thu: number | null
  tong_lan: number | null
  due_date: string | null
  completed_at: string | null
  loai_goi: string | null
  bo_may: string | null
  section: string | null
  customer_name: string | null
  primary_phone: string | null
  chua_khop_khach: boolean | null
  tinh_trang: string
}

export async function maintenanceDue(
  tinhTrang: string,
  q: string,
  tuyChon: TuyChonDanhSach = {}
): Promise<KetQuaTrang<MaintenanceDue>> {
  await requireStaff()
  const sx = sapXepHopLe(tuyChon.cot, tuyChon.chieu, COT_BAO_TRI, {
    cot: 'due_date', tang: true,
  })
  const trang = Math.max(1, tuyChon.trang ?? 1)
  const moi = tuyChon.moiTrang ?? MOI_TRANG
  const tu = (trang - 1) * moi
  let query = dataClient().from('v_maintenance_due').select('*', { count: 'exact' })

  if (tinhTrang) query = query.eq('tinh_trang', tinhTrang)
  const kw = antoanChoOr(chuanHoaTuKhoa(q))
  if (kw) {
    // Trước migration 07 trang này so NGUYÊN VĂN: gõ "nguyen" ra ĐÚNG 0 dòng dù có
    // 18 lượt của khách họ Nguyễn. Nay tra trên cột bỏ dấu (ten_kd/section_kd/bo_may_kd).
    //
    // Tên khách và tên công trình khớp theo ĐẦU TỪ (như trang Máy) để không dính
    // Phương/Thương; bộ máy và SĐT vẫn khớp chuỗi con vì đó là MÃ — gõ "15a" phải
    // ra "WH15A ECO", mà "15a" nằm giữa chữ nên khớp đầu từ sẽ trượt.
    query = query.or(
      `ten_kd.imatch.${mauDauTu(kw)},section_kd.imatch.${mauDauTu(kw)},` +
        `primary_phone.ilike.%${kw}%,bo_may_kd.ilike.%${kw}%`
    )
  }
  // visit_id là khoá chính -> khoá phụ đủ để 100 dòng lấy ra luôn cùng một thứ tự
  // giữa hai lần tải (due_date trùng nhau rất nhiều: cả cụm cùng đến hạn một ngày).
  const { data, error, count } = await query
    .order(sx.cot, { ascending: sx.tang, nullsFirst: false })
    .order('visit_id', { ascending: true })
    .range(tu, tu + moi - 1)
  if (error) throw new Error(error.message)

  const tong = count ?? 0
  return {
    rows: (data ?? []) as MaintenanceDue[],
    tong,
    trang,
    soTrang: Math.max(1, Math.ceil(tong / moi)),
    sapXep: sx,
  }
}

export async function maintenanceCounts() {
  await requireStaff()
  const db = dataClient()
  const keys = ['QUÁ HẠN', 'sắp đến hạn (≤30 ngày)', 'còn hạn']
  const out: Record<string, number> = {}
  await Promise.all(
    keys.map(async (k) => {
      const { count } = await db
        .from('v_maintenance_due').select('*', { count: 'exact', head: true }).eq('tinh_trang', k)
      out[k] = count ?? 0
    })
  )
  return out
}

/** Đánh dấu 1 lượt bảo trì đã làm (ghi completed_at). */
export async function markMaintenanceDone(visitId: string, date: string) {
  await requireStaff()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false as const, error: 'Ngày không hợp lệ.' }
  const { error } = await dataClient()
    .from('maintenance_visit').update({ completed_at: date }).eq('id', visitId)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/bao-tri')
  return { ok: true as const }
}

/** Bỏ đánh dấu (ghi nhầm). */
export async function unmarkMaintenanceDone(visitId: string) {
  await requireStaff()
  const { error } = await dataClient()
    .from('maintenance_visit').update({ completed_at: null }).eq('id', visitId)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/bao-tri')
  return { ok: true as const }
}

/** Lịch sử thay lõi của 1 máy — hiện ở trang chi tiết máy. */
export async function replacementsOfSerial(serial: string) {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('filter_replacement').select('*').eq('serial', serial)
    .order('replaced_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as { id: string; filter_code: string; replaced_at: string; note: string | null }[]
}

/** Ghi 1 lần thay lõi. Đây là thứ làm v_core_forecast chính xác dần lên. */
export async function logReplacement(input: {
  serial: string
  filter_code: string
  replaced_at: string
  note?: string
}) {
  await requireStaff()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.replaced_at)) {
    return { ok: false as const, error: 'Ngày không hợp lệ.' }
  }
  if (input.replaced_at > new Date().toISOString().slice(0, 10)) {
    return { ok: false as const, error: 'Không ghi được ngày thay ở tương lai.' }
  }
  const { error } = await dataClient().from('filter_replacement').insert({
    serial: input.serial,
    filter_code: input.filter_code,
    replaced_at: input.replaced_at,
    note: input.note || null,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/loi')
  revalidatePath(`/may/${encodeURIComponent(input.serial)}`)
  return { ok: true as const }
}

export async function deleteReplacement(id: string, serial: string) {
  await requireStaff()
  const { error } = await dataClient().from('filter_replacement').delete().eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/loi')
  revalidatePath(`/may/${encodeURIComponent(serial)}`)
  return { ok: true as const }
}

// ── Tickets (Phase 1) ───────────────────────────────────────────────────────
export type Ticket = {
  ticket_code: string
  state: 'Open' | 'Done' | 'Cancel'
  ticket_type: string | null
  description: string | null
  last_note: string | null
  khan: boolean
  province: string | null
  created_at: string
  serial: string | null
  source_serial: string | null
  product_name: string | null
  internal_code: string | null
  may_khong_trong_he_thong: boolean
  customer_id: string | null
  customer_name: string | null
  primary_phone: string | null
  warranty_activated: boolean | null
  warranty_full_end: string | null
  con_han_may: boolean | null
  con_han_loi: boolean | null
  cs_phu_trach: string | null
  ky_thuat: string | null
  cs_ten: string | null
  ky_thuat_ten: string | null
}

/** Tra ticket theo mã / serial / tên khách / SĐT / nội dung. Rỗng -> 50 ticket mới nhất.
 *  onlyKhan=true -> chỉ ticket đánh dấu Khẩn (khách khó chịu / cần gấp). */
export async function searchTickets(
  q: string,
  state?: string,
  onlyKhan?: boolean,
  mineStaffId?: string,
  tuyChon: TuyChonDanhSach & { loaiTicket?: string } = {}
): Promise<KetQuaTrang<Ticket>> {
  await requireStaff()
  const sx = sapXepHopLe(tuyChon.cot, tuyChon.chieu, COT_TICKET, {
    cot: 'created_at', tang: false,
  })
  const trang = Math.max(1, tuyChon.trang ?? 1)
  const moi = tuyChon.moiTrang ?? MOI_TRANG
  const tu = (trang - 1) * moi

  let truyVan = dataClient().from('v_tickets').select('*', { count: 'exact' })

  const term = q.trim()
  if (term) {
    // ticket_code/source_serial/mô tả/loại ticket vẫn còn dấu trong DB (không có cột
    // bỏ dấu riêng) -> giữ nguyên có dấu, chỉ chặn ký tự phá .or(). Riêng tên khách
    // đổi sang ten_kd (đã bỏ dấu sẵn, coalesce đúng khuôn customer_name — migration 06).
    const safe = antoanChoOr(term)
    const kw = antoanChoOr(chuanHoaTuKhoa(q))
    // ten_kd khớp theo ĐẦU TỪ như trang Máy (mauDauTu). Các cột còn lại giữ ilike:
    // mô tả là văn xuôi, người dùng gõ mẩu giữa câu là chuyện thường.
    truyVan = truyVan.or(
      `ticket_code.ilike.%${safe}%,source_serial.ilike.%${safe}%,ten_kd.imatch.${mauDauTu(kw)},` +
        `primary_phone.ilike.%${safe}%,description.ilike.%${safe}%,ticket_type.ilike.%${safe}%`
    )
  }
  if (state) truyVan = truyVan.eq('state', state)
  if (onlyKhan) truyVan = truyVan.eq('khan', true)
  if (mineStaffId) truyVan = truyVan.or(`cs_phu_trach.eq.${mineStaffId},ky_thuat.eq.${mineStaffId}`)
  // Danh sách chọn ở giao diện sinh từ ticketTypes() (dữ liệu thật) nên giá trị luôn
  // hợp lệ; vẫn .eq() thẳng (không whitelist tĩnh) vì loại ticket là dữ liệu mở, không
  // cố định như cột sắp xếp.
  if (tuyChon.loaiTicket) truyVan = truyVan.eq('ticket_type', tuyChon.loaiTicket)

  // Khẩn lên đầu, rồi theo cột sắp xếp đã kiểm tra, rồi ticket_code (khoá chính,
  // duy nhất) làm khoá phụ -> .range() không nhảy/lặp dòng giữa các trang.
  const { data, error, count } = await truyVan
    .order('khan', { ascending: false })
    .order(sx.cot, { ascending: sx.tang, nullsFirst: false })
    .order('ticket_code', { ascending: true })
    .range(tu, tu + moi - 1)
  if (error) throw new Error(error.message)

  const tong = count ?? 0
  return {
    rows: (data ?? []) as Ticket[],
    tong,
    trang,
    soTrang: Math.max(1, Math.ceil(tong / moi)),
    sapXep: sx,
  }
}

/** Ticket của 1 máy — dùng ở trang chi tiết máy. */
export async function ticketsOfSerial(serial: string): Promise<Ticket[]> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('v_tickets').select('*').eq('serial', serial)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Ticket[]
}

/** Ticket của 1 khách — dùng ở trang khách. */
export async function ticketsOfCustomer(customerId: string): Promise<Ticket[]> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('v_tickets').select('*').eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Ticket[]
}

export async function getTicket(code: string): Promise<Ticket | null> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('v_tickets').select('*').eq('ticket_code', code).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Ticket) ?? null
}

/** Đổi trạng thái / cờ Khẩn / ghi chú tóm tắt / người phụ trách. */
export async function updateTicket(
  code: string,
  patch: {
    state?: string; last_note?: string; khan?: boolean
    cs_phu_trach?: string | null; ky_thuat?: string | null
  }
) {
  await requireStaff()
  if (patch.state && !['Open', 'Done', 'Cancel'].includes(patch.state)) {
    return { ok: false as const, error: 'Trạng thái không hợp lệ.' }
  }
  const { error } = await dataClient().from('tickets').update(patch).eq('ticket_code', code)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/ticket')
  revalidatePath(`/ticket/${code}`)
  return { ok: true as const }
}

// ── Nhật ký ghi chú ticket (Đợt 1) ──────────────────────────────────────────
export type TicketNote = {
  id: string
  noi_dung: string
  tac_gia: string | null
  created_at: string
}

/** Các ghi chú của 1 ticket, mới nhất trước. */
export async function listTicketNotes(code: string): Promise<TicketNote[]> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('ticket_note').select('id, noi_dung, tac_gia, created_at')
    .eq('ticket_code', code)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as TicketNote[]
}

/** Thêm 1 dòng nhật ký. Người ghi = email đăng nhập. `khi` (ISO) trống -> giờ hiện tại. */
export async function addTicketNote(code: string, noiDung: string, khi?: string) {
  const user = await requireStaff()
  const text = noiDung.trim()
  if (!text) return { ok: false as const, error: 'Nhập nội dung ghi chú.' }
  const row: Record<string, unknown> = { ticket_code: code, noi_dung: text, tac_gia: user.email ?? null }
  if (khi && khi.trim()) row.created_at = new Date(khi).toISOString()
  const { error } = await dataClient().from('ticket_note').insert(row)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/ticket/${code}`)
  return { ok: true as const }
}

/** Sửa nội dung / thời gian 1 ghi chú. */
export async function updateTicketNote(id: string, code: string, patch: { noi_dung?: string; khi?: string }) {
  await requireStaff()
  const upd: Record<string, unknown> = {}
  if (patch.noi_dung !== undefined) {
    const t = patch.noi_dung.trim()
    if (!t) return { ok: false as const, error: 'Nội dung không được để trống.' }
    upd.noi_dung = t
  }
  if (patch.khi && patch.khi.trim()) upd.created_at = new Date(patch.khi).toISOString()
  if (!Object.keys(upd).length) return { ok: true as const }
  const { error } = await dataClient().from('ticket_note').update(upd).eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/ticket/${code}`)
  return { ok: true as const }
}

/** Xoá 1 ghi chú. */
export async function deleteTicketNote(id: string, code: string) {
  await requireStaff()
  const { error } = await dataClient().from('ticket_note').delete().eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/ticket/${code}`)
  return { ok: true as const }
}

/** Doanh số CSKH (chỉ hạng mục có thu phí) — theo tháng × mã nội bộ. */
export type DoanhSo = {
  thang: string; catalog_code: string | null; ten_hang_muc: string | null
  danh_muc: string | null; so_luot: number; tong_so_luong: number | null; tong_tien: number | null
}
export async function doanhSoCskh(): Promise<DoanhSo[]> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('v_doanh_so_cskh').select('*').order('thang', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as DoanhSo[]
}

/** Máy 1 khách đã lắp — dùng ở trang khách. */
export async function machinesOfCustomer(customerId: string): Promise<Machine[]> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('v_installed_base').select('*').eq('customer_id', customerId)
    .order('install_date', { ascending: false, nullsFirst: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Machine[]
}

// ── Hệ serial: kho serial + hàng chờ duyệt ──────────────────────────────────
export type SerialRow = {
  serial: string; code: string | null; model: string | null
  internal_code: string | null; ma_quoc_te: string | null; ten_noi_bo: string | null; po: string | null
}
export type SerialPending = {
  id: string; serial: string; internal_code: string | null; model: string | null
  ma_quoc_te: string | null; ten_noi_bo: string | null; ghi_chu: string | null
  nguoi_tao: string | null; trang_thai: string; ly_do_tu_choi: string | null; created_at: string
}

/**
 * Một chỗ DUY NHẤT dựng truy vấn kho serial. searchSerials() và
 * searchSerialsCoDem() cùng gọi hàm này -> bộ lọc không bao giờ tách làm hai bản
 * rồi lệch nhau (xem chú thích ở TuyChonDanhSach.moiTrang).
 * Không export nên không bị luật "'use server' chỉ export async function" đụng tới.
 */
async function truyVanSerial(q: string, limit: number, tu = 0) {
  await requireStaff()
  let query = dataClient()
    .from('serial_registry')
    .select('serial, code, model, internal_code, ma_quoc_te, ten_noi_bo, po', { count: 'exact' })
  const term = q.trim()
  if (term) {
    const safe = term.replace(/[%_]/g, (c) => '\\' + c)
    query = query.or(
      `serial.ilike.%${safe}%,internal_code.ilike.%${safe}%,model.ilike.%${safe}%,` +
        `ma_quoc_te.ilike.%${safe}%,ten_noi_bo.ilike.%${safe}%`
    )
  }
  const { data, error, count } = await query.order('serial').range(tu, tu + limit - 1)
  if (error) throw new Error(error.message)
  return { rows: (data ?? []) as SerialRow[], tong: count ?? 0 }
}

/** Tra serial trong kho (serial_registry). Dùng cho ô chọn serial + trang /serial. */
export async function searchSerials(q: string, limit = 50): Promise<SerialRow[]> {
  return (await truyVanSerial(q, limit)).rows
}

/**
 * Bản CÓ PHÂN TRANG cho trang /serial.
 *
 * Trước đây trang này chỉ `.limit(50)` trên 1.891 serial và KHÔNG có nút chuyển
 * trang — tức 1.841 dòng vĩnh viễn không xem tới được, trong khi giao diện lại
 * mời "chọn tất cả 1891". Chọn thứ không nhìn thấy được là sai; sửa gốc là cho
 * xem tới, chứ không phải bỏ nút chọn.
 */
export async function searchSerialsTrang(
  q: string,
  tuyChon: TuyChonDanhSach = {}
): Promise<KetQuaTrang<SerialRow>> {
  const trang = Math.max(1, tuyChon.trang ?? 1)
  const moi = tuyChon.moiTrang ?? MOI_TRANG
  const { rows, tong } = await truyVanSerial(q, moi, (trang - 1) * moi)
  return {
    rows,
    tong,
    trang,
    soTrang: Math.max(1, Math.ceil(tong / moi)),
    // Kho serial luôn sắp theo serial tăng dần, chưa cho bấm đổi cột.
    sapXep: { cot: 'serial', tang: true, macDinh: true },
  }
}

export type SerialKho = {
  serial: string; ma_noi_bo: string | null; ten_noi_bo: string | null; ma_goc: string | null; po: string | null
  trang_thai: string; bh_kich_hoat: boolean | null
  ten_khach: string | null; sdt_khach: string | null; ngay_lap: string | null; bh_het_han: string | null
}
/** Kho serial + trạng thái kích hoạt (view v_serial_kho của DB). */
export async function serialKho(q: string, trangThai?: string, limit = 100): Promise<SerialKho[]> {
  await requireStaff()
  let query = dataClient().from('v_serial_kho')
    .select('serial, ma_noi_bo, ten_noi_bo, ma_goc, po, trang_thai, bh_kich_hoat, ten_khach, sdt_khach, ngay_lap, bh_het_han')
  if (trangThai) query = query.eq('trang_thai', trangThai)
  const term = q.trim()
  if (term) {
    const safe = term.replace(/[%_]/g, (c) => '\\' + c)
    query = query.or(
      `serial.ilike.%${safe}%,ma_noi_bo.ilike.%${safe}%,ten_noi_bo.ilike.%${safe}%,` +
        `ten_khach.ilike.%${safe}%,sdt_khach.ilike.%${safe}%`
    )
  }
  const { data, error } = await query.order('serial').limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as SerialKho[]
}

export async function listSerialPending(trangThai = 'cho_duyet'): Promise<SerialPending[]> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('serial_pending')
    .select('id, serial, internal_code, model, ma_quoc_te, ten_noi_bo, ghi_chu, nguoi_tao, trang_thai, ly_do_tu_choi, created_at')
    .eq('trang_thai', trangThai)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as SerialPending[]
}

/** NV tạo serial mới -> hàng chờ duyệt (không đẩy thẳng lên kho). */
export async function createSerialPending(input: {
  serial: string; internal_code?: string; model?: string; ma_quoc_te?: string
  ten_noi_bo?: string; code?: string; ghi_chu?: string
}) {
  const user = await requireStaff()
  const serial = input.serial?.trim()
  if (!serial) return { ok: false as const, error: 'Nhập serial.' }
  const db = dataClient()
  // đã có trong kho?
  const { data: co } = await db.from('serial_registry').select('serial').eq('serial', serial).maybeSingle()
  if (co) return { ok: false as const, error: 'Serial này đã có trong kho — chọn từ danh sách.' }
  const { data: cho } = await db.from('serial_pending').select('id').eq('serial', serial).eq('trang_thai', 'cho_duyet').maybeSingle()
  if (cho) return { ok: false as const, error: 'Serial này đang chờ duyệt.' }
  const { error } = await db.from('serial_pending').insert({
    serial,
    code: input.code?.trim() || null,
    model: input.model?.trim() || null,
    internal_code: input.internal_code?.trim() || null,
    ma_quoc_te: input.ma_quoc_te?.trim() || null,
    ten_noi_bo: input.ten_noi_bo?.trim() || null,
    ghi_chu: input.ghi_chu?.trim() || null,
    nguoi_tao: user.email ?? null,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/serial')
  return { ok: true as const }
}

/** Duyệt serial pending (CHỈ ADMIN) — đẩy lên serial_registry qua RPC nguyên tử. */
export async function approveSerial(id: string) {
  const user = await requireStaff()
  if (!(await laAdmin())) return { ok: false as const, error: KHONG_DU_QUYEN }
  const { error } = await dataClient().rpc('duyet_serial_pending', { p_id: id, p_admin: user.email ?? '' })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/serial')
  return { ok: true as const }
}

/** Từ chối serial pending (CHỈ ADMIN). */
export async function rejectSerial(id: string, lyDo?: string) {
  await requireStaff()
  if (!(await laAdmin())) return { ok: false as const, error: KHONG_DU_QUYEN }
  const { error } = await dataClient().from('serial_pending')
    .update({ trang_thai: 'tu_choi', ly_do_tu_choi: lyDo?.trim() || null }).eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/serial')
  return { ok: true as const }
}

/** Xoá hẳn 1 serial pending (CHỈ ADMIN — theo quy tắc xoá cần quyền cao). */
export async function deleteSerialPending(id: string) {
  await requireStaff()
  if (!(await laAdmin())) return { ok: false as const, error: KHONG_DU_QUYEN }
  const { error } = await dataClient().from('serial_pending').delete().eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/serial')
  return { ok: true as const }
}

// ── Phần 4: Đăng ký bảo hành + khách (chờ duyệt) ────────────────────────────
export type KhachTom = { id: string; full_name: string; primary_phone: string | null; trang_thai: string }

/** Tìm khách (cho ô chọn khách khi đăng ký BH / tạo ticket). */
export async function searchCustomers(q: string, limit = 20): Promise<KhachTom[]> {
  await requireStaff()
  let query = dataClient().from('cs_customers').select('id, full_name, primary_phone, trang_thai')
  const term = q.trim()
  if (term) {
    const safe = term.replace(/[%_]/g, (c) => '\\' + c)
    query = query.or(`full_name.ilike.%${safe}%,primary_phone.ilike.%${safe}%`)
  }
  const { data, error } = await query.order('full_name').limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as KhachTom[]
}

/** Tạo khách mới TỪ CS -> trạng thái chờ admin duyệt (khách đại lý/Shopee đăng ký sau). */
export async function taoKhachChoDuyet(input: {
  full_name: string; primary_phone?: string; address?: string; province?: string
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireStaff()
  const ten = input.full_name?.trim()
  if (!ten) return { ok: false, error: 'Nhập tên khách.' }
  const sdt = input.primary_phone?.trim() || null
  const { data, error } = await dataClient().from('cs_customers').insert({
    full_name: ten, primary_phone: sdt,
    address: input.address?.trim() || null, province: input.province?.trim() || null,
    source: 'CSKH đăng ký', trang_thai: 'cho_duyet', needs_phone: !sdt,
  }).select('id').single()
  if (error) return { ok: false, error: error.message }
  revalidatePath('/khach')
  return { ok: true, id: (data as { id: string }).id }
}

/** Đăng ký bảo hành: gắn máy (serial) cho khách + kích hoạt BH. */
export async function dangKyBaoHanh(input: {
  serial: string; customer_id: string; install_date: string; install_address?: string
}) {
  await requireStaff()
  const serial = input.serial?.trim()
  if (!serial) return { ok: false as const, error: 'Chọn serial.' }
  if (!input.customer_id) return { ok: false as const, error: 'Chọn khách.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.install_date)) return { ok: false as const, error: 'Ngày lắp không hợp lệ.' }
  const db = dataClient()
  // Chặn GHI ĐÈ CHỦ MÁY: serial đã lắp cho khách KHÁC thì từ chối, không upsert đè.
  // NV gõ nhầm 1 ký tự serial không được phép đổi chủ máy của người khác.
  const { data: dangCo } = await db.from('installed_base')
    .select('customer_id').eq('serial', serial).maybeSingle()
  const chuHienTai = (dangCo as { customer_id: string | null } | null)?.customer_id
  if (chuHienTai && chuHienTai !== input.customer_id) {
    return {
      ok: false as const,
      error: 'Serial này đã gắn cho khách khác — kiểm tra lại serial (tránh ghi đè nhầm chủ máy). Nếu đúng là đổi chủ, gỡ khỏi khách cũ trước.',
    }
  }
  const { data: sr } = await db.from('serial_registry')
    .select('internal_code, model').eq('serial', serial).maybeSingle()
  const { error: e1 } = await db.from('installed_base').upsert({
    serial,
    internal_code: (sr as { internal_code: string | null } | null)?.internal_code ?? null,
    model_freetext: (sr as { model: string | null } | null)?.model ?? null,
    customer_id: input.customer_id,
    install_date: input.install_date,
    install_address: input.install_address?.trim() || null,
    channel_source: 'CSKH đăng ký', status: 'active',
  }, { onConflict: 'serial' })
  if (e1) return { ok: false as const, error: e1.message }
  const { error: e2 } = await db.rpc('activate_warranty', { p_serial: serial, p_start: input.install_date })
  if (e2) return { ok: false as const, error: e2.message }
  revalidatePath('/')
  revalidatePath('/bh-cho-kich-hoat')
  revalidatePath(`/may/${encodeURIComponent(serial)}`)
  return { ok: true as const }
}

// ── Hàng chờ kích hoạt bảo hành ─────────────────────────────────────────────
export type BHChoKichHoat = {
  nguon: string
  serial: string | null
  ma_noi_bo: string | null
  ten_noi_bo: string | null
  customer_id: string | null
  ten_khach: string | null
  sdt_khach: string | null
  dia_chi: string | null
  ngay_lap: string | null
  ngay_dat_hang: string | null
  ma_don: string | null
  so_luong: number | null
}

/**
 * Việc CSKH phải làm: máy đã bán/đã lắp mà bảo hành chưa kích hoạt.
 *
 * Đọc view `v_bh_cho_kich_hoat` — kích hoạt xong dòng TỰ biến mất, nên không
 * có bảng pending nào phải dọn.
 */
export async function bhChoKichHoat(q = '', nguon?: string, limit = 500): Promise<BHChoKichHoat[]> {
  await requireStaff()
  let query = dataClient().from('v_bh_cho_kich_hoat')
    .select('nguon, serial, ma_noi_bo, ten_noi_bo, customer_id, ten_khach, sdt_khach, dia_chi, ngay_lap, ngay_dat_hang, ma_don, so_luong')
  if (nguon) query = query.eq('nguon', nguon)
  const term = q.trim()
  if (term) {
    const safe = term.replace(/[%_]/g, (c) => '\\' + c)
    query = query.or(
      `serial.ilike.%${safe}%,ma_noi_bo.ilike.%${safe}%,ten_noi_bo.ilike.%${safe}%,` +
        `ten_khach.ilike.%${safe}%,sdt_khach.ilike.%${safe}%,ma_don.ilike.%${safe}%`
    )
  }
  const { data, error } = await query
    .order('nguon').order('ngay_dat_hang', { ascending: false, nullsFirst: false }).limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as BHChoKichHoat[]
}

/** Đếm theo nguồn — cho nhãn tab, khỏi tải cả danh sách. */
export async function bhChoKichHoatDem(): Promise<{ da_lap: number; don_sales: number }> {
  await requireStaff()
  const db = dataClient()
  const dem = async (nguon: string) => {
    const { count, error } = await db.from('v_bh_cho_kich_hoat')
      .select('nguon', { count: 'exact', head: true }).eq('nguon', nguon)
    if (error) throw new Error(error.message)
    return count ?? 0
  }
  const [da_lap, don_sales] = await Promise.all([
    dem('da_lap_chua_kich_hoat'), dem('don_sales_chua_gan_may'),
  ])
  return { da_lap, don_sales }
}

/**
 * Kích hoạt ngay từ hàng chờ: khách đã biết sẵn từ đơn/máy đã lắp, CSKH chỉ
 * điền thêm serial (dòng đơn sales) hoặc không phải điền gì (dòng đã lắp).
 */
export async function kichHoatNhanh(input: {
  serial: string; customer_id: string; install_date?: string; install_address?: string
}) {
  const ngay = input.install_date?.trim() || new Date().toISOString().slice(0, 10)
  const r = await dangKyBaoHanh({
    serial: input.serial, customer_id: input.customer_id,
    install_date: ngay, install_address: input.install_address,
  })
  if (r.ok) revalidatePath('/bh-cho-kich-hoat')
  return r
}

/** Khách đang chờ duyệt (admin xem/duyệt). */
export async function listKhachChoDuyet(): Promise<KhachTom[]> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('cs_customers').select('id, full_name, primary_phone, trang_thai')
    .eq('trang_thai', 'cho_duyet').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as KhachTom[]
}

/** Duyệt khách chờ (CHỈ ADMIN). */
export async function duyetKhach(id: string) {
  await requireStaff()
  if (!(await laAdmin())) return { ok: false as const, error: KHONG_DU_QUYEN }
  const { error } = await dataClient().from('cs_customers').update({ trang_thai: 'da_duyet' }).eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/khach')
  return { ok: true as const }
}

// ── Nhân viên phụ trách (Đợt 2) ─────────────────────────────────────────────
export type Staff = { id: string; ten: string; vai_tro: string; email: string | null }

/** Danh sách NV đang hoạt động — để chọn người phụ trách. */
export async function listStaff(): Promise<Staff[]> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('staff').select('id, ten, vai_tro, email').eq('hoat_dong', true).order('ten')
  if (error) throw new Error(error.message)
  return (data ?? []) as Staff[]
}

/** NV ứng với người đang đăng nhập (khớp email) — cho lọc "việc của tôi". */
export async function currentStaff(): Promise<Staff | null> {
  const user = await requireStaff()
  if (!user.email) return null
  const { data, error } = await dataClient()
    .from('staff').select('id, ten, vai_tro, email').eq('email', user.email).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Staff) ?? null
}

// ── Quản lý nhân viên (chỉ admin) ───────────────────────────────────────────

/** Toàn bộ NV kể cả đã khoá — cho màn /nhan-vien. Khác listStaff() vốn chỉ lấy NV đang hoạt động. */
export async function listAllStaff(): Promise<(Staff & { hoat_dong: boolean })[]> {
  await requireStaff()
  if (!(await laAdmin())) throw new Error(KHONG_DU_QUYEN)
  const { data, error } = await dataClient()
    .from('staff').select('id, ten, vai_tro, email, hoat_dong')
    .order('hoat_dong', { ascending: false }).order('vai_tro').order('ten')
  if (error) throw new Error(error.message)
  return (data ?? []) as (Staff & { hoat_dong: boolean })[]
}

/**
 * Đổi vai trò hoặc bật/tắt hoạt động của một nhân viên.
 *
 * Luật chống khoá chết hệ thống nằm ở lib/quyen.ts (có unit test): không tự
 * khoá mình, không tự hạ quyền mình, không hạ/khoá admin cuối cùng.
 */
export async function suaNhanVien(
  id: string,
  patch: { vai_tro?: string; hoat_dong?: boolean }
) {
  await requireStaff()
  const toi = await layNhanVien()
  if (!toi || !(await laAdmin())) return { ok: false as const, error: KHONG_DU_QUYEN }

  if (patch.vai_tro !== undefined && !laVaiTroHopLe(patch.vai_tro)) {
    return { ok: false as const, error: 'Vai trò không hợp lệ.' }
  }

  const db = dataClient()
  const { data: biSua, error: e1 } = await db
    .from('staff').select('id, vai_tro, hoat_dong').eq('id', id).maybeSingle()
  if (e1) return { ok: false as const, error: e1.message }
  if (!biSua) return { ok: false as const, error: 'Không tìm thấy nhân viên.' }

  const { count, error: e2 } = await db
    .from('staff').select('id', { count: 'exact', head: true })
    .eq('vai_tro', 'admin').eq('hoat_dong', true)
  if (e2) return { ok: false as const, error: e2.message }

  const kt = kiemTraSuaNhanVien({
    idNguoiSua: toi.id,
    idBiSua: id,
    vaiTroMoi: patch.vai_tro as VaiTro | undefined,
    hoatDongMoi: patch.hoat_dong,
    vaiTroHienTai: (biSua as { vai_tro: string }).vai_tro,
    soAdminDangHoatDong: count ?? 0,
  })
  if (!kt.ok) return { ok: false as const, error: kt.lyDo }

  const { error } = await db.from('staff').update(patch).eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/nhan-vien')
  return { ok: true as const }
}

/** Sửa tên hiển thị — người vào lần đầu chỉ có tên tạm lấy từ email. */
export async function doiTenNhanVien(id: string, ten: string) {
  await requireStaff()
  if (!(await laAdmin())) return { ok: false as const, error: KHONG_DU_QUYEN }
  const t = ten.trim()
  if (!t) return { ok: false as const, error: 'Tên không được để trống.' }
  const { error } = await dataClient().from('staff').update({ ten: t }).eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/nhan-vien')
  return { ok: true as const }
}

// ── Chi phí / vật tư / đổi máy của ticket (Đợt 2) ───────────────────────────
export type TicketMuc = {
  id: string
  loai: 'hang_muc' | 'doi_may'
  catalog_code: string | null
  so_luong: number | null
  mo_ta: string | null
  so_tien: number | null
  tinh_phi: boolean
  serial_cu: string | null
  serial_moi: string | null
  tac_gia: string | null
  created_at: string
}

export async function listTicketItems(code: string): Promise<TicketMuc[]> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('ticket_muc').select('*').eq('ticket_code', code).order('created_at')
  if (error) throw new Error(error.message)
  return (data ?? []) as TicketMuc[]
}

/** Danh mục hạng mục (từ catalog_item) để chọn khi thu phí/vật tư. Services lên đầu. */
export type CatalogItem = { code: string; ten: string | null; danh_muc: string | null }
export async function listCatalogItems(): Promise<CatalogItem[]> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('catalog_item')
    .select('"Mã nội bộ","Tên ngắn gọn (đề xuất)","Danh mục cấp 1"')
  if (error) throw new Error(error.message)
  const rows = (data ?? []).map((r) => {
    const o = r as Record<string, string | null>
    return { code: o['Mã nội bộ'] as string, ten: o['Tên ngắn gọn (đề xuất)'], danh_muc: o['Danh mục cấp 1'] }
  })
  // Services (DVSC/DVLD/DVBT/DVVC…) lên đầu, rồi theo tên.
  return rows.sort((a, b) => {
    const sa = a.danh_muc === 'Services' ? 0 : 1
    const sb = b.danh_muc === 'Services' ? 0 : 1
    return sa - sb || (a.ten ?? a.code).localeCompare(b.ten ?? b.code, 'vi')
  })
}

export async function addTicketItem(code: string, input: {
  loai: string; catalog_code?: string; so_luong?: number
  mo_ta?: string; so_tien?: number | null; tinh_phi?: boolean
  serial_cu?: string; serial_moi?: string
}) {
  const user = await requireStaff()
  if (!(await laAdmin())) return { ok: false as const, error: KHONG_DU_QUYEN }
  if (!['hang_muc', 'doi_may'].includes(input.loai)) {
    return { ok: false as const, error: 'Loại mục không hợp lệ.' }
  }
  // Hạng mục (thu phí/vật tư) BẮT BUỘC chọn từ catalog_item.
  if (input.loai === 'hang_muc' && !input.catalog_code) {
    return { ok: false as const, error: 'Chọn hạng mục từ danh mục (catalog_item).' }
  }
  const { error } = await dataClient().from('ticket_muc').insert({
    ticket_code: code,
    loai: input.loai,
    catalog_code: input.loai === 'hang_muc' ? input.catalog_code : null,
    so_luong: input.so_luong && input.so_luong > 0 ? input.so_luong : 1,
    mo_ta: input.mo_ta?.trim() || null,
    so_tien: input.so_tien ?? null,
    tinh_phi: input.tinh_phi ?? false,
    serial_cu: input.serial_cu?.trim() || null,
    serial_moi: input.serial_moi?.trim() || null,
    tac_gia: user.email ?? null,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/ticket/${code}`)
  return { ok: true as const }
}

export async function deleteTicketItem(id: string, code: string) {
  await requireStaff()
  if (!(await laAdmin())) return { ok: false as const, error: KHONG_DU_QUYEN }
  const { error } = await dataClient().from('ticket_muc').delete().eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/ticket/${code}`)
  return { ok: true as const }
}

/** Xuất CSV danh sách ticket đang lọc (Excel mở trực tiếp). */
export async function ticketsCsv(
  q: string, state?: string, onlyKhan?: boolean, mine?: boolean
): Promise<string> {
  await requireStaff()
  // Nút export đã ẩn với vai trò cs, nhưng đây mới là rào thật.
  if (!(await laAdmin())) throw new Error(KHONG_DU_QUYEN)
  const mineId = mine ? (await currentStaff())?.id : undefined
  const { rows } = await searchTickets(q, state, onlyKhan, mineId)
  const head = ['Mã', 'Ngày', 'Trạng thái', 'Khẩn', 'Loại', 'Khách', 'SĐT', 'Serial',
    'Máy', 'CS', 'Kỹ thuật', 'Mô tả']
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = rows.map((t) => [
    t.ticket_code, (t.created_at ?? '').slice(0, 10), t.state, t.khan ? 'Khẩn' : '',
    t.ticket_type, t.customer_name, t.primary_phone, t.serial ?? t.source_serial,
    t.product_name, t.cs_ten, t.ky_thuat_ten, t.description,
  ].map(esc).join(','))
  return '﻿' + [head.join(','), ...lines].join('\n')  // BOM để Excel đọc đúng UTF-8
}

/** Tạo ticket mới. Mã tự sinh GWT-YYnnnn theo năm hiện tại. */
export async function createTicket(input: {
  serial?: string
  customer_id?: string
  ticket_type: string
  description: string
  created_at?: string          // ngày tạo (backdate ca cũ) — trống thì now()
  state?: string
  khan?: boolean
  last_note?: string
  cs_phu_trach?: string | null
  ky_thuat?: string | null
}) {
  await requireStaff()
  if (!input.ticket_type?.trim()) return { ok: false as const, error: 'Chọn loại ticket.' }
  if (!input.description?.trim()) return { ok: false as const, error: 'Nhập mô tả sự cố.' }
  if (input.state && !['Open', 'Done', 'Cancel'].includes(input.state)) {
    return { ok: false as const, error: 'Trạng thái không hợp lệ.' }
  }

  const db = dataClient()
  const yy = String(new Date().getFullYear()).slice(2)

  // lấy số lớn nhất của năm nay rồi +1 (mã GWT-YYnnnn)
  const { data: last, error: e1 } = await db
    .from('tickets').select('ticket_code')
    .like('ticket_code', `GWT-${yy}%`)
    .order('ticket_code', { ascending: false }).limit(1)
  if (e1) return { ok: false as const, error: e1.message }

  const next = last?.length ? parseInt(last[0].ticket_code.slice(-4), 10) + 1 : 1
  const code = `GWT-${yy}${String(next).padStart(4, '0')}`

  const row: Record<string, unknown> = {
    ticket_code: code,
    serial: input.serial || null,
    source_serial: input.serial || null,
    customer_id: input.customer_id || null,
    ticket_type: input.ticket_type.trim(),
    description: input.description.trim(),
    state: input.state || 'Open',
    khan: input.khan ?? false,
    last_note: input.last_note?.trim() || null,
    cs_phu_trach: input.cs_phu_trach || null,
    ky_thuat: input.ky_thuat || null,
  }
  if (input.created_at && input.created_at.trim()) row.created_at = new Date(input.created_at).toISOString()

  const { error } = await db.from('tickets').insert(row)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/ticket')
  return { ok: true as const, code }
}

/** Các loại ticket đã dùng — gợi ý cho form tạo mới (Odoo có 18 loại). */
export async function ticketTypes(): Promise<string[]> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('tickets').select('ticket_type').not('ticket_type', 'is', null)
  if (error) throw new Error(error.message)
  return [...new Set((data ?? []).map((r) => (r as { ticket_type: string }).ticket_type))].sort()
}

/** Khách cần dọn: thiếu/lỗi SĐT HOẶC thiếu địa chỉ. Di trú Odoo không lấp được, phải sửa tay. */
export async function listToFix(
  q = '',
  tuyChon: TuyChonDanhSach = {}
): Promise<KetQuaTrang<Customer & { machines: number }>> {
  await requireStaff()
  const db = dataClient()
  const sx = sapXepHopLe(tuyChon.cot, tuyChon.chieu, COT_KHACH, {
    cot: 'full_name', tang: true,
  })
  const trang = Math.max(1, tuyChon.trang ?? 1)
  const moi = tuyChon.moiTrang ?? MOI_TRANG
  const tu = (trang - 1) * moi

  // Điều kiện needs_phone/address CỐ ĐỊNH, không ghép từ khoá người dùng -> không cần
  // antoanChoOr cho nó. Từ khoá tìm chung nằm ở .or() RIÊNG bên dưới (2 lệnh .or() liên
  // tiếp AND với nhau), lọc trên ten_kd + primary_phone. KHÔNG thêm dia_chi_kd -> lỗi C1
  // đã sửa ở Task 3 ("Phường" bỏ dấu chứa chuỗi con "huong").
  let truyVan = db
    .from('cs_customers')
    .select('*', { count: 'exact' })
    .or('needs_phone.eq.true,address.is.null')

  const kw = antoanChoOr(chuanHoaTuKhoa(q))
  if (kw) {
    truyVan = truyVan.or(`ten_kd.imatch.${mauDauTu(kw)},primary_phone.ilike.%${kw}%`)
  }

  // id (khoá chính, duy nhất) làm khoá phụ -> .range() không nhảy/lặp dòng giữa các trang.
  const { data, error, count } = await truyVan
    .order(sx.cot, { ascending: sx.tang, nullsFirst: false })
    .order('id', { ascending: true })
    .range(tu, tu + moi - 1)
  if (error) throw new Error(error.message)
  const customers = (data ?? []) as Customer[]

  // đếm máy mỗi khách -> biết khách nào đáng ưu tiên
  const { data: ibs, error: e2 } = await db
    .from('installed_base')
    .select('customer_id')
    .in('customer_id', customers.map((c) => c.id))
  if (e2) throw new Error(e2.message)

  const dem = new Map<string, number>()
  for (const r of ibs ?? []) {
    const id = (r as { customer_id: string }).customer_id
    dem.set(id, (dem.get(id) ?? 0) + 1)
  }

  const tong = count ?? 0
  return {
    rows: customers.map((c) => ({ ...c, machines: dem.get(c.id) ?? 0 })),
    tong,
    trang,
    soTrang: Math.max(1, Math.ceil(tong / moi)),
    sapXep: sx,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — nhóm lỗi + báo cáo lãnh đạo / công ty mẹ
// ─────────────────────────────────────────────────────────────────────────────

export type MucDo = 'an_toan' | 'nghiem_trong' | 'thuong' | 'nhe' | 'khong_loi'

export type IssueReport = {
  code: string
  ten: string
  muc_do: MucDo
  bao_hang: boolean
  mo_ta: string | null
  thu_tu: number
  so_ticket: number
  dang_mo: number
  da_xong: number
  da_huy: number
  so_khach: number
  so_may: number
  so_model: number
  cac_model: string | null
  som_nhat: string | null
  gan_nhat: string | null
  trong_90_ngay: number
}

export type TicketIssue = {
  ticket_code: string
  group_code: string
  nguon: string
  nhom_ten: string
  muc_do: MucDo
  state: string
  ticket_type: string | null
  description: string | null
  created_at: string
  serial: string | null
  internal_code: string | null
  product_name: string | null
  customer_id: string | null
  customer_name: string | null
  primary_phone: string | null
}

/** Thứ tự ưu tiên đọc báo cáo: an toàn trước hết, "không lỗi" xuống cuối. */
const UU_TIEN: Record<MucDo, number> = {
  an_toan: 1, nghiem_trong: 2, thuong: 3, nhe: 4, khong_loi: 5,
}

/** Báo cáo nhóm lỗi. baoHangOnly=true -> chỉ nhóm gửi công ty mẹ.
 *  q lọc trên tên nhóm + mô tả. v_issue_report KHÔNG có cột bỏ dấu riêng (Task 1 chỉ thêm
 *  cho v_installed_base/v_tickets) -> giữ nguyên có dấu, chỉ chặn ký tự phá cú pháp .or(). */
export async function issueReport(baoHangOnly = false, q = ''): Promise<IssueReport[]> {
  await requireStaff()
  let truyVan = dataClient().from('v_issue_report').select('*').gt('so_ticket', 0)
  if (baoHangOnly) truyVan = truyVan.eq('bao_hang', true)
  const term = q.trim()
  if (term) {
    const safe = antoanChoOr(term)
    truyVan = truyVan.or(`ten.ilike.%${safe}%,mo_ta.ilike.%${safe}%`)
  }
  const { data, error } = await truyVan
  if (error) throw new Error(error.message)
  return ((data ?? []) as IssueReport[]).sort(
    (a, b) => UU_TIEN[a.muc_do] - UU_TIEN[b.muc_do] || b.so_ticket - a.so_ticket
  )
}

/** Ticket trong một nhóm lỗi — để soi bằng chứng, không tin số liệu suông. */
export async function ticketsInGroup(groupCode: string): Promise<TicketIssue[]> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('v_ticket_issue').select('*')
    .eq('group_code', groupCode)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as TicketIssue[]
}

/** Nhóm lỗi của MỘT ticket — nhúng vào trang chi tiết ticket. */
export async function groupsOfTicket(ticketCode: string): Promise<TicketIssue[]> {
  await requireStaff()
  const { data, error } = await dataClient()
    .from('v_ticket_issue').select('*').eq('ticket_code', ticketCode)
  if (error) throw new Error(error.message)
  return ((data ?? []) as TicketIssue[]).sort((a, b) => UU_TIEN[a.muc_do] - UU_TIEN[b.muc_do])
}

export type ChuaPhanNhom = {
  ticket_code: string
  state: string
  ticket_type: string | null
  description: string | null
  created_at: string
  serial: string | null
  ly_do: string
}

/** Ticket chưa vào nhóm nào — việc cần người làm, không gom mù được.
 *  q lọc trên mã ticket + mô tả. Không có cột bỏ dấu -> chỉ chặn ký tự phá cú pháp .or(). */
export async function ticketsChuaPhanNhom(q = ''): Promise<ChuaPhanNhom[]> {
  await requireStaff()
  let truyVan = dataClient().from('v_ticket_chua_phan_nhom').select('*')
  const term = q.trim()
  if (term) {
    const safe = antoanChoOr(term)
    truyVan = truyVan.or(`ticket_code.ilike.%${safe}%,description.ilike.%${safe}%`)
  }
  const { data, error } = await truyVan.order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as ChuaPhanNhom[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 5b — tìm kiếm gộp: tách kết quả theo máy / ticket / khách
// ─────────────────────────────────────────────────────────────────────────────

export type KetQuaTimGop = {
  may: Machine[]
  ticket: Ticket[]
  khach: Customer[]
  tongMay: number
  tongTicket: number
  tongKhach: number
}

/**
 * Tìm gộp — nhân viên nghe khách đọc SĐT thì không phải đoán trước vào trang Máy hay
 * Ticket. Mỗi nhóm lấy tối đa 5 dòng đầu KÈM tổng số thật (để hiện "xem tất cả N").
 * Gọi SONG SONG bằng Promise.all — DB ở Singapore, gọi tuần tự cộng dồn độ trễ.
 */
export async function timGop(q: string): Promise<KetQuaTimGop> {
  await requireStaff()
  const term = q.trim()
  if (!term) {
    return { may: [], ticket: [], khach: [], tongMay: 0, tongTicket: 0, tongKhach: 0 }
  }

  // Khách: tra trên ten_kd (bỏ dấu sẵn) + primary_phone, giống ô tìm chung ở trang Máy.
  // KHÔNG đưa dia_chi_kd vào -> lỗi C1 đã sửa ở Task 3.
  const kw = antoanChoOr(chuanHoaTuKhoa(term))

  const [mayRes, ticketRes, khachRes] = await Promise.all([
    searchMachines(term, { trang: 1 }),
    searchTickets(term),
    kw
      ? dataClient()
          .from('cs_customers')
          .select('*', { count: 'exact' })
          .or(`ten_kd.imatch.${mauDauTu(kw)},primary_phone.ilike.%${kw}%`)
          .order('full_name', { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [] as Customer[], count: 0, error: null }),
  ])

  if (khachRes.error) throw new Error(khachRes.error.message)

  return {
    may: mayRes.rows.slice(0, 5),
    ticket: ticketRes.rows.slice(0, 5),
    khach: (khachRes.data ?? []) as Customer[],
    tongMay: mayRes.tong,
    tongTicket: ticketRes.tong,
    tongKhach: khachRes.count ?? 0,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// "Chọn tất cả khớp bộ lọc" — lấy TOÀN BỘ khoá dòng, không chỉ 50 dòng đang xem
//
// Mỗi hàm ở đây gọi lại ĐÚNG hàm liệt kê của trang tương ứng với một trang thật
// to, rồi rút khoá. KHÔNG viết truy vấn lọc riêng: chép bộ lọc làm hai bản thì
// sớm muộn hai bản lệch nhau, và lúc đó màn hình ghi "91 ticket" nhưng bấm chọn
// tất cả lại ra 87 — không ai phát hiện cho tới khi sửa nhầm dữ liệu.
//
// Trần TOI_DA_CHON là chốt chặn cuối. Bảng lớn nhất hiện mới 472 dòng nên chưa
// bao giờ chạm; nếu chạm thì giao diện phải NÓI RA chứ không cắt lén.
//
// Tham số nhận nguyên khối searchParams của trang (chuỗi, tuần tự hoá được) để
// truyền thẳng từ Server Component xuống Client Component làm Server Action.
// ─────────────────────────────────────────────────────────────────────────────

export async function khoaTatCaMay(t: ThamSoLoc): Promise<string[]> {
  return gomKhoa(
    (trang, moiTrang) => searchMachines(t.q ?? '', {
      trang, moiTrang, cot: t.cot, chieu: t.chieu, maSanPham: t.sp, tinhTrangBH: t.bh,
    }),
    (r) => r.serial,
    TOI_DA_CHON
  )
}

export async function khoaTatCaTicket(t: ThamSoLoc): Promise<string[]> {
  const onlyKhan = t.khan === '1'
  const isMine = t.mine === '1'
  // Phải giải "việc của tôi" y hệt trang /ticket, nếu không chọn tất cả sẽ ôm
  // luôn ticket của người khác trong khi màn hình chỉ hiện việc của mình.
  const me = isMine ? await currentStaff() : null
  if (isMine && !me) return []
  return gomKhoa(
    (trang, moiTrang) => searchTickets(
      t.q ?? '',
      onlyKhan ? undefined : t.state || undefined,
      onlyKhan,
      me?.id,
      { trang, moiTrang, cot: t.cot, chieu: t.chieu, loaiTicket: t.loai || undefined }
    ),
    (r) => r.ticket_code,
    TOI_DA_CHON
  )
}

export async function khoaTatCaLoi(t: ThamSoLoc): Promise<string[]> {
  return gomKhoa(
    (trang, moiTrang) => coreForecast(t.tt ?? '', t.q ?? '', { trang, moiTrang, cot: t.cot, chieu: t.chieu }),
    // Khoá ghép: một máy có nhiều lõi nên riêng serial không định danh được 1 dòng.
    (r) => `${r.serial}-${r.filter_code}`,
    TOI_DA_CHON
  )
}

export async function khoaTatCaKhach(t: ThamSoLoc): Promise<string[]> {
  return gomKhoa(
    (trang, moiTrang) => listToFix(t.q ?? '', { trang, moiTrang, cot: t.cot, chieu: t.chieu }),
    (r) => r.id,
    TOI_DA_CHON
  )
}

export async function khoaTatCaBaoTri(t: ThamSoLoc): Promise<string[]> {
  return gomKhoa(
    (trang, moiTrang) => maintenanceDue(t.tt ?? '', t.q ?? '', { trang, moiTrang, cot: t.cot, chieu: t.chieu }),
    (r) => r.visit_id,
    TOI_DA_CHON
  )
}

export async function khoaTatCaSerial(t: ThamSoLoc): Promise<string[]> {
  return gomKhoa(
    (trang, moiTrang) => searchSerialsTrang(t.q ?? '', { trang, moiTrang }),
    (r) => r.serial,
    TOI_DA_CHON
  )
}

// ── Đồng bộ catalog gương từ Masterdata (#2) ────────────────────────────────
export type CatalogSyncLog = {
  id: number
  chay_luc: string
  ok: boolean
  chi_tiet: Record<string, unknown> | null
  thong_bao: string | null
  ms: number | null
}

/** Bấm tay chạy đồng bộ 6 bảng catalog ngay (CHỈ ADMIN). Cron vẫn tự chạy hàng ngày. */
export async function syncCatalogNow() {
  await requireStaff()
  if (!(await laAdmin())) return { ok: false as const, error: KHONG_DU_QUYEN }
  const { data, error } = await dataClient().rpc('sync_catalog')
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/dong-bo-catalog')
  return { ok: true as const, ket_qua: data as { ok: boolean; tables: Record<string, unknown>; msg: string | null } }
}

/** Nhật ký các lần đồng bộ gần nhất (admin xem). */
export async function catalogSyncLast(n = 10): Promise<CatalogSyncLog[]> {
  await requireStaff()
  if (!(await laAdmin())) throw new Error(KHONG_DU_QUYEN)
  const { data, error } = await dataClient()
    .from('catalog_sync_log').select('id, chay_luc, ok, chi_tiet, thong_bao, ms')
    .order('id', { ascending: false }).limit(n)
  if (error) throw new Error(error.message)
  return (data ?? []) as CatalogSyncLog[]
}
