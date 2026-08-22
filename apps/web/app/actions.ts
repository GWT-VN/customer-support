'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { dataClient } from '@/lib/nen-tang/db'
import { layNhanVien, requireStaff } from '@/lib/nen-tang/phien'
import { chuanHoaVaiTro } from '@/lib/nen-tang/vai-tro'
import { KHONG_DU_QUYEN } from '@/lib/nen-tang/nhan-su-luat'
import { currentStaff } from '@/lib/nen-tang/nhan-su'
import { ghiAudit } from '@/lib/nen-tang/nhat-ky'
import { themSdtPhu, themDiaChiPhu, xoaDiaChiPhu, suaDiaChiPhu, suaSdtPhu } from '@/lib/khach-lien-he'
import { coQuyen, doQuyen } from '@/lib/nen-tang/kiem-quyen'
import { antoanChoOr, chuanHoaTuKhoa, mauDauTu, sapXepHopLe, gomKhoa } from '@/bang'
import type { KetQuaTrang, TuyChonDanhSach, ThamSoLoc } from '@/bang'
import { goiYGomTu, type CumGoiY } from '@/lib/goiYNhom'
import { sinhLichBaoTri, vungTheoTinh, type Vung } from '@/lib/lichBaoTri'
import { traKhachTheoSdt, type KetQuaTraKhach } from '@/lib/tra-khach'
import { xepGoiY, type GoiYKhach, type KhachUngVien } from '@/lib/khopPlanKhach'
import { kiemTraGop, moTaGop, type KhachGon, type KhachDayDu } from '@/lib/gopKhach'
import type { PChon } from '@/lib/gopKhachChon'
import { capNghiTrung, type CapNghiTrung } from '@/lib/nghiTrung'
import {
  MOI_TRANG, MOI_TRANG_LOI, COT_MAY, COT_TICKET, COT_LOI, COT_KHACH, COT_BAO_TRI,
  TINH_TRANG_BH, TOI_DA_CHON, XUAT_KHACH_COT, XUAT_TICKET_COT, SUA_HL_BANG,
  XUAT_MAY_COT, XUAT_BAOTRI_COT, XUAT_LOI_COT, MA_COMBO, docLocNgay, doChacHopLe, NHAN_LOAI_DIA_CHI,
  type TinhTrangBH, type DongNhapSerial, type DoChacNgayLap,
} from '@/lib/danhSach'



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
  ngay_lap_do_chac: DoChacNgayLap | null
  ghi_chu: string | null
}

/** Tra máy theo serial / tên khách / SĐT / địa chỉ (không dấu). Rỗng -> máy lắp gần nhất. */
export async function searchMachines(
  q: string,
  tuyChon: TuyChonDanhSach & { maSanPham?: string; tinhTrangBH?: string; ngtu?: string; ngden?: string } = {}
): Promise<KetQuaTrang<Machine>> {
  await requireStaff()
  await doQuyen('cs.may.xem')
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

  // Lọc theo ngày lắp (install_date) — 2 tham số ngtu/ngden, xem docLocNgay.
  const { tu: ngTu, den: ngDen } = docLocNgay(tuyChon)
  if (ngTu) truyVan = truyVan.gte('install_date', ngTu)
  if (ngDen) truyVan = truyVan.lte('install_date', ngDen)

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
  await doQuyen('cs.may.xem')
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
  await doQuyen('cs.may.xem')
  const { data, error } = await dataClient()
    .from('v_installed_base').select('*').eq('serial', serial).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Machine) ?? null
}

/** Kích hoạt bảo hành. RPC tự tính full_end/core_end từ product_warranty. */
export async function activateWarranty(serial: string, startDate: string) {
  await requireStaff()
  await doQuyen('cs.may.kich_hoat_bh')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { ok: false as const, error: 'Ngày không hợp lệ.' }
  }
  const db = dataClient()
  const { error } = await db.rpc('activate_warranty', { p_serial: serial, p_start: startDate })
  if (error) return { ok: false as const, error: error.message }
  // Ngày lắp = ngày bắt đầu BH (một mốc duy nhất) -> đồng bộ install_date.
  await db.from('installed_base').update({ install_date: startDate }).eq('serial', serial)
  await ghiAudit('kich_hoat_bh', `serial:${serial}`, { start: startDate })
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
  /** Giờ gọi được, số của ai… — có ở CẢ màn tạo lẫn màn sửa (CEO chốt 22/08: hai bên y hệt nhau). */
  ghi_chu: string | null
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
  channel_id: number | null
  /** Thông tin công ty để xuất hoá đơn / làm hợp đồng (migration 50). */
  ten_cty: string | null
  mst: string | null
  dia_chi_cty: string | null
  sdt_cty: string | null
  email_cty: string | null
  nguoi_dai_dien: string | null
  chuc_vu_dai_dien: string | null
}

export async function getCustomer(id: string) {
  await requireStaff()
  await doQuyen('cs.khach.xem')
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
  await doQuyen('cs.khach.sua')
  const sdt = patch.primary_phone || null
  // Chống trùng SĐT khi SỬA: nếu 9 số cuối khớp khách KHÁC (chưa xoá) -> chặn.
  if (sdt) {
    const { cuoi9, hopLe } = chuanHoaSdt(sdt)
    if (hopLe) {
      const { data: trung } = await dataClient().from('cs_customers')
        .select('id').neq('trang_thai', 'da_xoa').neq('id', id)
        .ilike('primary_phone', `%${cuoi9}`).limit(1)
      if (trung && trung.length) {
        return { ok: false as const, error: 'SĐT này đã thuộc khách khác — không thể trùng.' }
      }
    }
  }
  const payload: Record<string, unknown> = {
    full_name: patch.full_name,
    primary_phone: sdt,
    province: patch.province || null,
    address: patch.address || null,
    ten_cty: patch.ten_cty || null,
    mst: patch.mst || null,
    dia_chi_cty: patch.dia_chi_cty || null,
    sdt_cty: patch.sdt_cty || null,
    email_cty: patch.email_cty || null,
    nguoi_dai_dien: patch.nguoi_dai_dien || null,
    chuc_vu_dai_dien: patch.chuc_vu_dai_dien || null,
  }
  // Sửa được SĐT hợp lệ -> hạ cờ needs_phone + xoá ghi chú lỗi
  if (sdt && /^0\d{9,10}$/.test(sdt)) { payload.needs_phone = false; payload.notes = null }
  // Sửa thông tin khách CẦN ADMIN DUYỆT: admin áp ngay, CS -> hàng chờ.
  return guiYeuCauThayDoi({ doi_tuong: 'cs_customers', ban_ghi_id: id, loai: 'sua', payload })
}

export async function addContact(customerId: string, c: Omit<Contact, 'id'>) {
  await requireStaff()
  await doQuyen('cs.khach.sua')
  // Phần ghi nằm ở `lib/khach-lien-he.ts` — dùng chung với Sales để `role`/`is_primary`/
  // nhật ký không mỗi khu một kiểu. Rào quyền vẫn ở ĐÂY: khu nào gác bằng quyền khu ấy.
  const kq = await themSdtPhu({
    customer_id: customerId,
    phone: c.phone, contact_name: c.contact_name, role: c.role,
    is_primary: c.is_primary, zalo_ok: c.zalo_ok, ghi_chu: c.ghi_chu,
    nguon: 'cskh',
  })
  if (!kq.ok) return { ok: false as const, error: kq.error }
  revalidatePath(`/khach/${customerId}`)
  return { ok: true as const }
}

export async function deleteContact(id: string, customerId: string) {
  await requireStaff()
  await doQuyen('cs.khach.sua')
  // Xoá SĐT phụ CẦN ADMIN DUYỆT: admin xoá ngay, CS -> hàng chờ.
  return guiYeuCauThayDoi({
    doi_tuong: 'customer_contacts', ban_ghi_id: id, loai: 'xoa',
    ly_do: `SĐT phụ của khách ${customerId}`,
  })
}

// ── Đề xuất SỬA/XOÁ cần admin duyệt (yeu_cau_thay_doi) ─────────────────────
type DoiTuong = 'cs_customers' | 'filter_replacement' | 'customer_contacts' | 'installed_base'
type LoaiTD = 'sua' | 'xoa' | 'doi_serial' | 'gop'
const COT_CHO_PHEP: Record<DoiTuong, string[]> = {
  cs_customers: [
    'full_name', 'primary_phone', 'address', 'province', 'notes', 'needs_phone',
    // Thông tin công ty (mig 50) — thiếu ở đây thì CS sửa xong, admin duyệt, mà
    // trường vẫn không đổi: vòng duyệt lọc payload đúng theo danh sách này.
    'ten_cty', 'mst', 'dia_chi_cty', 'sdt_cty', 'email_cty', 'nguoi_dai_dien', 'chuc_vu_dai_dien',
  ],
  filter_replacement: ['filter_code', 'replaced_at', 'note'],
  customer_contacts: ['phone', 'contact_name', 'role', 'zalo_ok'],
  installed_base: ['customer_id', 'install_date', 'install_address'],
}

/**
 * Chặn xoá/đổi serial nếu còn tham chiếu NO ACTION (tickets/maintenance_plan/máy con).
 * (warranty + filter_replacement là ON DELETE CASCADE nên tự gỡ, không cần chặn.)
 */
async function conThamChieuMay(
  db: ReturnType<typeof dataClient>, serial: string
): Promise<string | null> {
  const [t, m, con] = await Promise.all([
    db.from('tickets').select('ticket_code', { count: 'exact', head: true }).eq('serial', serial),
    db.from('maintenance_plan').select('id', { count: 'exact', head: true }).eq('serial', serial),
    db.from('installed_base').select('serial', { count: 'exact', head: true }).eq('parent_serial', serial),
  ])
  const p: string[] = []
  if ((t.count ?? 0) > 0) p.push(`${t.count} ticket`)
  if ((m.count ?? 0) > 0) p.push(`${m.count} lịch bảo trì`)
  if ((con.count ?? 0) > 0) p.push(`${con.count} máy con`)
  return p.length ? `Serial còn ${p.join(', ')} — xử lý trước khi xoá/đổi.` : null
}

/** Áp thay đổi cho MÁY ĐÃ LẮP (khoá theo serial, không phải id). */
async function apDungMay(
  db: ReturnType<typeof dataClient>, serial: string, loai: LoaiTD, payload?: Record<string, unknown> | null
): Promise<{ error: { message: string } | null }> {
  if (loai === 'xoa') {
    const chan = await conThamChieuMay(db, serial)
    if (chan) return { error: { message: chan } }
    // Xoá bản ghi lắp -> warranty + filter_replacement TỰ xoá theo (CASCADE). Serial về kho.
    const kq = await db.from('installed_base').delete().eq('serial', serial)
    if (!kq.error) await ghiSuDung(db, { serial, su_kien: 'tra_kho', tu: 'da_lap', den: 'ton_kho', ghi_chu: 'Xoá máy đã lắp' })
    return kq
  }
  if (loai === 'doi_serial') {
    const serialMoi = String(payload?.serial_moi ?? '').trim()
    if (!serialMoi) return { error: { message: 'Thiếu serial mới.' } }
    const chan = await conThamChieuMay(db, serial)
    if (chan) return { error: { message: chan } }
    const { data: daCo } = await db.from('installed_base').select('serial').eq('serial', serialMoi).maybeSingle()
    if (daCo) return { error: { message: 'Serial mới đã được lắp cho máy khác.' } }
    const { data: cu } = await db.from('installed_base').select('*').eq('serial', serial).maybeSingle()
    if (!cu) return { error: { message: 'Không thấy máy cũ.' } }
    const c = cu as { customer_id: string | null; install_date: string | null; install_address: string | null; internal_code: string | null; model_freetext: string | null }
    const { data: bhCu } = await db.from('warranty').select('start_date').eq('serial', serial).maybeSingle()
    const { data: sr } = await db.from('serial_registry').select('internal_code, model').eq('serial', serialMoi).maybeSingle()
    const s = sr as { internal_code: string | null; model: string | null } | null
    // Tạo bản ghi mới TRƯỚC (nếu lỗi thì máy cũ còn nguyên), rồi mới xoá cũ.
    const { error: e1 } = await db.from('installed_base').insert({
      serial: serialMoi,
      internal_code: s?.internal_code ?? c.internal_code,
      model_freetext: s?.model ?? c.model_freetext,
      customer_id: c.customer_id, install_date: c.install_date, install_address: c.install_address,
      channel_source: 'Đổi serial (sửa nhầm)', status: 'active',
    })
    if (e1) return { error: e1 }
    const start = (bhCu as { start_date: string | null } | null)?.start_date ?? c.install_date
    if (start) {
      const { error: e2 } = await db.rpc('activate_warranty', { p_serial: serialMoi, p_start: start })
      if (e2) return { error: e2 }
    }
    const kqDoi = await db.from('installed_base').delete().eq('serial', serial)  // CASCADE gỡ warranty/filter cũ
    if (!kqDoi.error) {
      // Serial CŨ (gõ nhầm) nhả ra -> Tồn kho; serial MỚI -> Đã lắp.
      await ghiSuDung(db, { serial, su_kien: 'doi_serial_nha', tu: 'da_lap', den: 'ton_kho', ghi_chu: `Đổi serial nhầm sang ${serialMoi}` })
      await ghiSuDung(db, { serial: serialMoi, su_kien: 'doi_serial_nhan', tu: 'ton_kho', den: 'da_lap', customer_id: c.customer_id, ghi_chu: `Thay serial cũ ${serial}` })
    }
    return kqDoi
  }
  // sua: đổi khách/ngày/địa chỉ
  const patch: Record<string, unknown> = {}
  for (const k of COT_CHO_PHEP.installed_base) {
    if (payload && Object.prototype.hasOwnProperty.call(payload, k)) patch[k] = payload[k]
  }
  return db.from('installed_base').update(patch).eq('serial', serial)
}

/** Áp 1 thay đổi thật xuống DB (dùng cho admin-áp-ngay lẫn khi duyệt). */
async function apDungThayDoi(
  db: ReturnType<typeof dataClient>, doiTuong: DoiTuong, banGhiId: string,
  loai: LoaiTD, payload?: Record<string, unknown> | null
) {
  if (doiTuong === 'installed_base') return apDungMay(db, banGhiId, loai, payload)
  // Gộp khách: ban_ghi_id = bản GIỮ LẠI, payload.gop_id = bản bị gộp.
  // Gọi RPC để 5 bảng tham chiếu + trộn trường + ẩn mềm nằm trong 1 transaction.
  if (loai === 'gop') {
    if (doiTuong !== 'cs_customers') return { error: { message: 'Chỉ gộp được hồ sơ khách.' } }
    const gopId = payload?.gop_id
    if (typeof gopId !== 'string' || !gopId) return { error: { message: 'Thiếu khách bị gộp.' } }
    // `chon` chỉ có ở yêu cầu tạo từ màn /khach/gop. Yêu cầu cũ (payload chỉ có
    // gop_id) truyền p_chon = null -> RPC chạy đúng luật trước migration 49.
    const chon = payload?.chon ?? null
    const { error } = await db.rpc('gop_khach', {
      p_giu: banGhiId, p_gop: gopId, p_chon: chon,
    })
    return { error: error ? { message: error.message } : null }
  }
  if (loai === 'xoa') {
    // Khách: ẩn mềm (giữ máy/ticket). SĐT phụ + lịch thay lõi: xoá cứng (bảng lá).
    if (doiTuong === 'cs_customers') {
      return db.from('cs_customers').update({ trang_thai: 'da_xoa' }).eq('id', banGhiId)
    }
    return db.from(doiTuong).delete().eq('id', banGhiId)
  }
  const patch: Record<string, unknown> = {}
  for (const k of COT_CHO_PHEP[doiTuong]) {
    if (payload && Object.prototype.hasOwnProperty.call(payload, k)) patch[k] = payload[k]
  }
  return db.from(doiTuong).update(patch).eq('id', banGhiId)
}

function revalidateThayDoi(doiTuong: DoiTuong, banGhiId: string, loai?: LoaiTD) {
  if (doiTuong === 'cs_customers') {
    revalidatePath('/khach'); revalidatePath(`/khach/${banGhiId}`)
    // GỘP khách KHÔNG revalidate '/'. Trang "Máy đã lắp" là trang ĐỘNG (dựng lại
    // mỗi lần truy cập) nên revalidate chẳng giúp gì, nhưng lại bắt server dựng
    // lại cả bảng 2.400 máy NGAY TRONG lượt gọi server action — nút "Gộp" đứng
    // mãi ở "Đang xử lý…" dù DB đã xong từ lâu. CEO gặp đúng ca này 20/08/2026:
    // audit ghi ok lúc 15:19:07, giao diện không bao giờ báo xong.
    if (loai !== 'gop') revalidatePath('/')
  } else if (doiTuong === 'customer_contacts') {
    revalidatePath('/khach')
  } else {
    revalidatePath('/loi')
  }
}

/** Admin -> áp NGAY (+audit). CS -> vào hàng chờ yeu_cau_thay_doi. */
export async function guiYeuCauThayDoi(input: {
  doi_tuong: DoiTuong; ban_ghi_id: string; loai: LoaiTD
  payload?: Record<string, unknown>; ly_do?: string
}): Promise<{ ok: true; applied: boolean } | { ok: false; error: string }> {
  const nv = await layNhanVien()
  const db = dataClient()
  // XOÁ thông tin khách phải qua ADMIN duyệt. Cấp quản lý (cs_manager) áp trực tiếp
  // các thay đổi KHÁC; riêng xoá khách của họ vẫn vào hàng chờ để admin duyệt.
  // XOÁ hoặc GỘP hồ sơ khách đều phải qua ADMIN duyệt: cả hai đều làm biến mất
  // một hồ sơ khách khỏi danh sách, sai thì rất khó phát hiện. (Ca `gop` do main
  // thêm; giữ nguyên, chỉ đổi cách hỏi quyền sang ma trận.)
  const laXoaKhach = input.doi_tuong === 'cs_customers' && (input.loai === 'xoa' || input.loai === 'gop')
  const apTrucTiep = laXoaKhach
    ? await coQuyen('cs.khach.duyet_xoa', 'ADMIN')
    : await coQuyen('cs.yeu_cau.ap_thang', 'QUANLY')
  if (apTrucTiep) {
    const { error } = await apDungThayDoi(db, input.doi_tuong, input.ban_ghi_id, input.loai, input.payload)
    if (error) return { ok: false, error: error.message }
    await ghiAudit(`${input.loai}_${input.doi_tuong}`, `${input.doi_tuong}:${input.ban_ghi_id}`, input.payload)
    revalidateThayDoi(input.doi_tuong, input.ban_ghi_id, input.loai)
    return { ok: true, applied: true }
  }
  const { error } = await db.from('yeu_cau_thay_doi').insert({
    doi_tuong: input.doi_tuong, ban_ghi_id: input.ban_ghi_id, loai: input.loai,
    payload: input.payload ?? null, ly_do: input.ly_do ?? null, nguoi_gui: nv?.email ?? null,
  })
  if (error) return { ok: false, error: error.message }
  await ghiAudit('gui_yeu_cau', `${input.doi_tuong}:${input.ban_ghi_id}`, { loai: input.loai })
  revalidatePath('/duyet')
  return { ok: true, applied: false }
}

/** Đề xuất XOÁ khách (ẩn mềm khi được duyệt). */
export async function xoaKhach(id: string, lyDo?: string) {
  await requireStaff()
  await doQuyen('cs.khach.xin_xoa')
  return guiYeuCauThayDoi({ doi_tuong: 'cs_customers', ban_ghi_id: id, loai: 'xoa', ly_do: lyDo })
}

/** Hồ sơ khách rút gọn + số lượng dữ liệu đính kèm — để cân nhắc chiều gộp. */
export async function khachGon(id: string): Promise<KhachGon | null> {
  await requireStaff()
  // Hàm từ `main` sang, chưa nối vào ma trận (lưới an toàn cong-quyen.test.ts bắt
  // được). Nối bằng ĐÚNG quyền các hàm cùng loại đang dùng: đọc hồ sơ khách là
  // cs.khach.xem, sửa/xoá dữ liệu khách là cs.khach.sua.
  await doQuyen('cs.khach.xem')
  const db = dataClient()
  const [{ data: k }, may, ticket, plan] = await Promise.all([
    db.from('cs_customers').select('id, full_name, primary_phone, address').eq('id', id).maybeSingle(),
    db.from('installed_base').select('serial', { count: 'exact', head: true }).eq('customer_id', id),
    db.from('tickets').select('ticket_code', { count: 'exact', head: true }).eq('customer_id', id),
    db.from('maintenance_plan').select('id', { count: 'exact', head: true }).eq('customer_id', id),
  ])
  if (!k) return null
  const r = k as { id: string; full_name: string; primary_phone: string | null; address: string | null }
  return {
    ...r, so_may: may.count ?? 0, so_ticket: ticket.count ?? 0, so_plan: plan.count ?? 0,
  }
}

/**
 * Hồ sơ khách ĐỦ TRƯỜNG cho màn so sánh trước khi gộp (/khach/gop).
 *
 * Khác `khachGon` ở chỗ trả thêm tỉnh, mã KH, kênh, nguồn, ghi chú — bản cũ chỉ
 * có tên + SĐT, mà rất nhiều khách không có SĐT nên CS không có gì để phân biệt
 * hai hồ sơ trùng tên.
 */
export async function khachDayDu(id: string): Promise<KhachDayDu | null> {
  await requireStaff()
  await doQuyen('cs.khach.xem')
  const db = dataClient()
  const [{ data: k }, may, ticket, plan, lienHe, diaChiPhu] = await Promise.all([
    db.from('cs_customers')
      .select('id, full_name, primary_phone, address, province, customer_code, channel_id, source, partner_ref, notes, created_at, ten_cty, mst, dia_chi_cty, sdt_cty, email_cty, address_truoc_sap_nhap, province_truoc_sap_nhap')
      .eq('id', id).maybeSingle(),
    db.from('installed_base').select('serial', { count: 'exact', head: true }).eq('customer_id', id),
    db.from('tickets').select('ticket_code', { count: 'exact', head: true }).eq('customer_id', id),
    db.from('maintenance_plan').select('id', { count: 'exact', head: true }).eq('customer_id', id),
    // Lấy CẢ NỘI DUNG chứ không chỉ đếm: gộp xong hai bộ SĐT phụ / địa chỉ phụ
    // nhập vào nhau, CS phải nhìn được chúng TRƯỚC khi bấm.
    db.from('customer_contacts').select('phone, contact_name, role').eq('customer_id', id),
    db.from('customer_addresses').select('dia_chi, loai').eq('customer_id', id),
  ])
  if (!k) return null
  const r = k as Record<string, unknown>

  // Tên kênh nằm ở bảng của Sales — chỉ tra khi khách thật sự có kênh.
  let tenKenh: string | null = null
  if (r.channel_id != null) {
    const { data: ch } = await db.from('dim_channel')
      .select('channel_l1, channel_l2').eq('id', r.channel_id).maybeSingle()
    const c = ch as { channel_l1: string | null; channel_l2: string | null } | null
    if (c) tenKenh = [c.channel_l1, c.channel_l2].filter(Boolean).join(' · ') || null
  }

  return {
    id: r.id as string,
    full_name: r.full_name as string,
    primary_phone: (r.primary_phone as string | null) ?? null,
    address: (r.address as string | null) ?? null,
    province: (r.province as string | null) ?? null,
    customer_code: (r.customer_code as string | null) ?? null,
    channel_id: (r.channel_id as number | null) ?? null,
    ten_kenh: tenKenh,
    source: (r.source as string | null) ?? null,
    partner_ref: (r.partner_ref as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    ten_cty: (r.ten_cty as string | null) ?? null,
    mst: (r.mst as string | null) ?? null,
    dia_chi_cty: (r.dia_chi_cty as string | null) ?? null,
    sdt_cty: (r.sdt_cty as string | null) ?? null,
    email_cty: (r.email_cty as string | null) ?? null,
    address_truoc_sap_nhap: (r.address_truoc_sap_nhap as string | null) ?? null,
    province_truoc_sap_nhap: (r.province_truoc_sap_nhap as string | null) ?? null,
    created_at: (r.created_at as string | null) ?? null,
    so_may: may.count ?? 0,
    so_ticket: ticket.count ?? 0,
    so_plan: plan.count ?? 0,
    sdt_phu: ((lienHe.data ?? []) as { phone: string | null; contact_name: string | null; role: string | null }[])
      .map((x) => [x.phone, x.contact_name].filter(Boolean).join(' · '))
      .filter(Boolean),
    dia_chi_phu: ((diaChiPhu.data ?? []) as { dia_chi: string; loai: string }[])
      .map((x) => `${x.dia_chi} [${NHAN_LOAI_DIA_CHI[x.loai] ?? x.loai}]`),
    so_lien_he: (lienHe.data ?? []).length,
  }
}

export type DiaChiKhach = {
  id: string; dia_chi: string; loai: string; tinh: string | null; ghi_chu: string | null; created_at: string
}

/** Địa chỉ phụ của khách (migration 48) — nhà / công ty / lắp đặt. */
export async function diaChiCuaKhach(customerId: string): Promise<DiaChiKhach[]> {
  await requireStaff()
  await doQuyen('cs.khach.xem')
  const { data, error } = await dataClient().from('customer_addresses')
    .select('id, dia_chi, loai, tinh, ghi_chu, created_at')
    .eq('customer_id', customerId).order('created_at')
  if (error) throw new Error(error.message)
  return (data ?? []) as DiaChiKhach[]
}

export async function themDiaChiKhach(
  customerId: string, dia_chi: string, loai: string, ghi_chu?: string, tinh?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff()
  await doQuyen('cs.khach.sua')
  const kq = await themDiaChiPhu({
    customer_id: customerId, dia_chi, loai, tinh, ghi_chu, nguon: 'cskh',
  })
  if (!kq.ok) return { ok: false, error: kq.error }
  revalidatePath(`/khach/${customerId}`)
  return { ok: true }
}

/** Sửa một địa chỉ phụ. CEO chốt 22/08: địa chỉ phụ và SĐT phụ phải SỬA được, không chỉ thêm/xoá. */
export async function suaDiaChiKhachAction(
  id: string, customerId: string,
  patch: { dia_chi: string; loai: string; tinh?: string; ghi_chu?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff()
  await doQuyen('cs.khach.sua')
  const kq = await suaDiaChiPhu({ id, customer_id: customerId, ...patch, nguon: 'cskh' })
  if (!kq.ok) return { ok: false, error: kq.error }
  revalidatePath(`/khach/${customerId}`)
  return { ok: true }
}

/** Sửa một SĐT phụ / người liên hệ. */
export async function suaLienHe(
  id: string, customerId: string,
  patch: { phone?: string; contact_name?: string; role?: string; zalo_ok?: boolean; ghi_chu?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff()
  await doQuyen('cs.khach.sua')
  const kq = await suaSdtPhu({ id, customer_id: customerId, ...patch, nguon: 'cskh' })
  if (!kq.ok) return { ok: false, error: kq.error }
  revalidatePath(`/khach/${customerId}`)
  return { ok: true }
}

export async function xoaDiaChiKhach(
  id: string, customerId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff()
  await doQuyen('cs.khach.sua')
  const kq = await xoaDiaChiPhu({ id, customer_id: customerId, nguon: 'cskh' })
  if (!kq.ok) return { ok: false, error: kq.error }
  revalidatePath(`/khach/${customerId}`)
  return { ok: true }
}

/**
 * Danh sách cặp hồ sơ NGHI TRÙNG để CS khỏi phải tự mò.
 *
 * Quét toàn bộ khách chưa xoá (vài trăm dòng — rẻ, không cần index riêng) rồi ghép
 * cặp bằng hàm thuần `capNghiTrung`. Cố ý KHÔNG dò theo SĐT: `primary_phone` có
 * ràng buộc UNIQUE nên không bao giờ có hai hồ sơ cùng số (đo prod: 0 cặp).
 */
export async function capKhachNghiTrung(): Promise<CapNghiTrung[]> {
  await requireStaff()
  // Chỉ ĐỌC danh sách khách để gợi ý cặp trùng -> quyền xem khách là đủ.
  // Phép GỘP thật vẫn gác riêng ở chỗ gọi RPC `gop_khach`.
  await doQuyen('cs.khach.xem')
  const db = dataClient()
  const { data, error } = await db.from('cs_customers')
    .select('id, full_name, primary_phone, province, customer_code')
    .neq('trang_thai', 'da_xoa')
  if (error) throw new Error(error.message)
  const ds = (data ?? []) as { id: string; full_name: string; primary_phone: string | null; province: string | null; customer_code: string | null }[]

  // Đếm dữ liệu đính kèm cho TẤT CẢ trong 3 truy vấn, không phải 3 truy vấn/khách.
  const [may, ticket, plan] = await Promise.all([
    db.from('installed_base').select('customer_id').not('customer_id', 'is', null),
    db.from('tickets').select('customer_id').not('customer_id', 'is', null),
    db.from('maintenance_plan').select('customer_id').not('customer_id', 'is', null),
  ])
  const dem = (r: { data: unknown }) => {
    const m = new Map<string, number>()
    for (const x of (r.data ?? []) as { customer_id: string }[]) {
      m.set(x.customer_id, (m.get(x.customer_id) ?? 0) + 1)
    }
    return m
  }
  const dMay = dem(may), dTicket = dem(ticket), dPlan = dem(plan)

  return capNghiTrung(ds.map((k) => ({
    ...k,
    so_may: dMay.get(k.id) ?? 0,
    so_ticket: dTicket.get(k.id) ?? 0,
    so_plan: dPlan.get(k.id) ?? 0,
  })))
}

/**
 * Đề xuất GỘP 2 hồ sơ khách trùng. NV bấm -> vào hàng chờ; admin bấm -> áp ngay.
 * `giuId` là bản giữ lại, `gopId` là bản bị gộp (sẽ bị ẩn mềm).
 */
export async function deXuatGopKhach(
  giuId: string, gopId: string, chon?: PChon | null, lyDo?: string
): Promise<{ ok: true; applied: boolean } | { ok: false; error: string }> {
  await requireStaff()
  if (!giuId || !gopId) return { ok: false, error: 'Chọn đủ 2 khách.' }
  const [giu, gop] = await Promise.all([khachGon(giuId), khachGon(gopId)])
  if (!giu || !gop) return { ok: false, error: 'Không thấy một trong hai hồ sơ khách.' }
  const kt = kiemTraGop(giu, gop)
  if (!kt.ok) return { ok: false, error: kt.lyDo }
  return guiYeuCauThayDoi({
    doi_tuong: 'cs_customers', ban_ghi_id: giuId, loai: 'gop',
    // `chon` đi kèm vào hàng chờ: nhân viên chọn trường nào thì lúc admin duyệt
    // (có thể vài ngày sau) phải áp đúng lựa chọn đó, không phải luật mặc định.
    payload: { gop_id: gopId, ...(chon ? { chon } : {}) },
    ly_do: lyDo?.trim() || moTaGop(giu, gop),
  })
}

/** Xoá máy đã lắp -> trả serial về tồn kho (gỡ BH + lịch thay lõi). Qua admin duyệt. */
export async function xoaMayDaLap(serial: string) {
  await requireStaff()
  await doQuyen('cs.khach.xin_xoa')
  return guiYeuCauThayDoi({
    doi_tuong: 'installed_base', ban_ghi_id: serial, loai: 'xoa',
    ly_do: `Trả serial ${serial} về tồn kho`,
  })
}

/** Đổi khách của máy (cùng serial, sang khách khác). Qua admin duyệt. */
export async function doiKhachMay(serial: string, customerId: string) {
  await requireStaff()
  await doQuyen('cs.khach.xin_xoa')
  if (!customerId) return { ok: false as const, error: 'Chọn khách.' }
  return guiYeuCauThayDoi({
    doi_tuong: 'installed_base', ban_ghi_id: serial, loai: 'sua',
    payload: { customer_id: customerId }, ly_do: `Đổi khách cho serial ${serial}`,
  })
}

/** Đổi serial (giữ khách, nhầm serial). Chuyển bản ghi + BH sang serial mới. Qua admin duyệt. */
export async function doiSerialMay(serialCu: string, serialMoi: string) {
  await requireStaff()
  await doQuyen('cs.khach.xin_xoa')
  const sm = serialMoi.trim()
  if (!sm) return { ok: false as const, error: 'Chọn serial mới.' }
  if (sm === serialCu) return { ok: false as const, error: 'Serial mới trùng serial cũ.' }
  return guiYeuCauThayDoi({
    doi_tuong: 'installed_base', ban_ghi_id: serialCu, loai: 'doi_serial',
    payload: { serial_moi: sm }, ly_do: `Đổi ${serialCu} -> ${sm}`,
  })
}

export type YeuCauThayDoi = {
  id: string; doi_tuong: string; ban_ghi_id: string; loai: string
  payload: Record<string, unknown> | null; ly_do: string | null; nguoi_gui: string | null; created_at: string
}

/** Hàng chờ duyệt yêu cầu sửa/xoá (CHỈ ADMIN). */
export async function listYeuCauThayDoi(): Promise<YeuCauThayDoi[]> {
  await requireStaff()
  if (!(await coQuyen('cs.yeu_cau.xem', 'QUANLY'))) throw new Error(KHONG_DU_QUYEN)
  const { data, error } = await dataClient().from('yeu_cau_thay_doi')
    .select('id, doi_tuong, ban_ghi_id, loai, payload, ly_do, nguoi_gui, created_at')
    .eq('trang_thai', 'cho_duyet').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as YeuCauThayDoi[]
}

/** Duyệt 1 yêu cầu -> áp thật (CHỈ ADMIN). */
export async function duyetYeuCau(id: string) {
  const user = await requireStaff()
  if (!(await coQuyen('cs.yeu_cau.duyet', 'QUANLY'))) return { ok: false as const, error: KHONG_DU_QUYEN }
  const db = dataClient()
  const { data: yc, error: e0 } = await db.from('yeu_cau_thay_doi')
    .select('doi_tuong, ban_ghi_id, loai, payload, trang_thai').eq('id', id).maybeSingle()
  if (e0) return { ok: false as const, error: e0.message }
  const y = yc as { doi_tuong: DoiTuong; ban_ghi_id: string; loai: LoaiTD; payload: Record<string, unknown> | null; trang_thai: string } | null
  if (!y || y.trang_thai !== 'cho_duyet') return { ok: false as const, error: 'Yêu cầu không tồn tại hoặc đã xử lý.' }
  // Duyệt XOÁ hoặc GỘP hồ sơ khách chỉ dành cho admin (memory: xoá/gộp khách cần admin).
  // Không kiểm lại ở đây thì NV cấp quản lý (đã qua rào phía trên) có thể tự duyệt
  // yêu cầu gộp do chính mình gửi -> leo quyền ngay trên hàng chờ.
  if (
    y.doi_tuong === 'cs_customers' && (y.loai === 'xoa' || y.loai === 'gop')
    && !(await coQuyen('cs.khach.duyet_xoa', 'ADMIN'))
  ) {
    return { ok: false as const, error: 'Duyệt xoá/gộp thông tin khách cần quyền quản trị (admin).' }
  }
  const { error } = await apDungThayDoi(db, y.doi_tuong, y.ban_ghi_id, y.loai, y.payload)
  if (error) return { ok: false as const, error: error.message }
  await db.from('yeu_cau_thay_doi')
    .update({ trang_thai: 'da_duyet', duyet_boi: user.email ?? '', duyet_luc: new Date().toISOString() }).eq('id', id)
  await ghiAudit('duyet_yeu_cau', `${y.doi_tuong}:${y.ban_ghi_id}`, { loai: y.loai })
  revalidateThayDoi(y.doi_tuong, y.ban_ghi_id)
  revalidatePath('/duyet')
  return { ok: true as const }
}

/**
 * Duyệt NHIỀU yêu cầu một lượt. Chạy TUẦN TỰ chứ không Promise.all: các yêu cầu
 * có thể đụng cùng một hồ sơ khách (gộp A→B rồi gộp B→C), chạy song song sẽ
 * giẫm chân nhau. Một yêu cầu hỏng không được chặn các yêu cầu còn lại.
 * Quyền hạn (quản lý / admin theo loại) do duyetYeuCau tự kiểm cho từng mục,
 * hàm này không nới quyền gì thêm.
 */
export async function duyetNhieuYeuCau(ids: string[]): Promise<{ ok: true; da_duyet: number; loi: string[] }> {
  await requireStaff()
  let daDuyet = 0
  const loi: string[] = []
  for (const id of ids) {
    const r = await duyetYeuCau(id)
    if (r.ok) daDuyet++
    else loi.push(r.error)
  }
  revalidatePath('/duyet')
  return { ok: true, da_duyet: daDuyet, loi }
}

/** Từ chối 1 yêu cầu (CHỈ ADMIN). */
export async function tuChoiYeuCau(id: string, lyDo?: string) {
  const user = await requireStaff()
  if (!(await coQuyen('cs.yeu_cau.duyet', 'QUANLY'))) return { ok: false as const, error: KHONG_DU_QUYEN }
  const { error } = await dataClient().from('yeu_cau_thay_doi')
    .update({ trang_thai: 'tu_choi', ly_do_tu_choi: lyDo?.trim() || null, duyet_boi: user.email ?? '', duyet_luc: new Date().toISOString() })
    .eq('id', id).eq('trang_thai', 'cho_duyet')
  if (error) return { ok: false as const, error: error.message }
  await ghiAudit('tu_choi_yeu_cau', `yeu-cau:${id}`, lyDo?.trim() ? { ly_do: lyDo.trim() } : undefined)
  revalidatePath('/duyet')
  return { ok: true as const }
}

// ── Export danh sách khách + duyệt PII (Đợt A) ─────────────────────────────
function oCsv(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
type KhachXuat = {
  full_name: string; primary_phone: string | null; address: string | null; province: string | null
  customer_code: string | null; source: string | null; created_at: string | null
}

/** Lấy TẤT CẢ khách khớp bộ lọc để xuất (theo lô 1000, bỏ khách da_xoa). */
async function layKhachXuat(q: string): Promise<KhachXuat[]> {
  await requireStaff()
  await doQuyen('cs.khach.xin_xuat')
  const db = dataClient()
  const term = q.trim()
  const ra: KhachXuat[] = []
  for (let off = 0; off < 50000; off += 1000) {
    let query = db.from('cs_customers')
      .select('full_name, primary_phone, address, province, customer_code, source, created_at')
      .neq('trang_thai', 'da_xoa')
    if (term) {
      const safe = term.replace(/[%_]/g, (c) => '\\' + c)
      query = query.or(`full_name.ilike.%${safe}%,primary_phone.ilike.%${safe}%`)
    }
    const { data, error } = await query.order('full_name').range(off, off + 999)
    if (error) throw new Error(error.message)
    const lo = (data ?? []) as KhachXuat[]
    ra.push(...lo)
    if (lo.length < 1000) break
  }
  return ra
}

/** Nội dung CSV (dấu phẩy) cho các cột được chọn. KHÔNG kèm BOM — client mã hoá UTF-16LE. */
function noiDungXuatKhach(rows: KhachXuat[], cot: string[]): string {
  const cols = XUAT_KHACH_COT.filter((c) => cot.includes(c.key))
  const giaTri = (r: KhachXuat, key: string): string => {
    if (key === 'created_at') return r.created_at ? String(r.created_at).slice(0, 10) : ''
    const v = (r as unknown as Record<string, unknown>)[key]
    return v == null ? '' : String(v)
  }
  const lines = [cols.map((c) => oCsv(c.nhan)).join(',')]
  for (const r of rows) lines.push(cols.map((c) => oCsv(giaTri(r, c.key))).join(','))
  return lines.join('\r\n')
}

function coPiiTrong(cot: string[]): boolean {
  return XUAT_KHACH_COT.some((c) => c.pii && cot.includes(c.key))
}

/**
 * Xuất danh sách khách theo CÁC CỘT được chọn. Không có cột PII -> ai cũng xuất thẳng.
 * Có cột PII (SĐT/địa chỉ) -> admin xuất thẳng; CS -> yêu cầu chờ admin duyệt.
 */
export async function xuatKhach(q: string, cot: string[]): Promise<
  { ok: true; csv: string } | { ok: true; pending: true } | { ok: false; error: string }
> {
  await requireStaff()
  const cols = cot.filter((k) => XUAT_KHACH_COT.some((c) => c.key === k))
  if (cols.length === 0) return { ok: false, error: 'Chọn ít nhất 1 trường để xuất.' }
  if (!coPiiTrong(cols)) {
    const rows = await layKhachXuat(q)
    await ghiAudit('export_khach', 'cs_customers', { q, cot: cols, so_dong: rows.length })
    return { ok: true, csv: noiDungXuatKhach(rows, cols) }
  }
  if (await coQuyen('cs.khach.duyet_xuat', 'QUANLY')) {
    const rows = await layKhachXuat(q)
    await ghiAudit('export_khach_pii', 'cs_customers', { q, cot: cols, so_dong: rows.length })
    return { ok: true, csv: noiDungXuatKhach(rows, cols) }
  }
  const nv = await layNhanVien()
  const { error } = await dataClient().from('yeu_cau_export')
    .insert({ bang: 'cs_customers', tieu_chi: { q, cot: cols }, co_pii: true, nguoi_gui: nv?.email ?? null })
  if (error) return { ok: false, error: error.message }
  await ghiAudit('gui_yeu_cau_export', 'cs_customers', { q, cot: cols })
  revalidatePath('/khach-hang'); revalidatePath('/duyet')
  return { ok: true, pending: true }
}

export type YeuCauExport = {
  id: string; tieu_chi: Record<string, unknown> | null; nguoi_gui: string | null; created_at: string; trang_thai: string
}

/** Yêu cầu export PII chờ duyệt (admin). */
export async function listYeuCauExport(): Promise<YeuCauExport[]> {
  await requireStaff()
  if (!(await coQuyen('cs.khach.duyet_xuat', 'QUANLY'))) throw new Error(KHONG_DU_QUYEN)
  const { data, error } = await dataClient().from('yeu_cau_export')
    .select('id, tieu_chi, nguoi_gui, created_at, trang_thai')
    .eq('trang_thai', 'cho_duyet').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as YeuCauExport[]
}

export async function duyetExport(id: string) {
  const u = await requireStaff()
  if (!(await coQuyen('cs.khach.duyet_xuat', 'QUANLY'))) return { ok: false as const, error: KHONG_DU_QUYEN }
  const { error } = await dataClient().from('yeu_cau_export')
    .update({ trang_thai: 'da_duyet', duyet_boi: u.email ?? '', duyet_luc: new Date().toISOString() })
    .eq('id', id).eq('trang_thai', 'cho_duyet')
  if (error) return { ok: false as const, error: error.message }
  await ghiAudit('duyet_export', `export:${id}`)
  revalidatePath('/duyet'); revalidatePath('/khach')
  return { ok: true as const }
}

export async function tuChoiExport(id: string) {
  const u = await requireStaff()
  if (!(await coQuyen('cs.khach.duyet_xuat', 'QUANLY'))) return { ok: false as const, error: KHONG_DU_QUYEN }
  const { error } = await dataClient().from('yeu_cau_export')
    .update({ trang_thai: 'tu_choi', duyet_boi: u.email ?? '', duyet_luc: new Date().toISOString() })
    .eq('id', id).eq('trang_thai', 'cho_duyet')
  if (error) return { ok: false as const, error: error.message }
  await ghiAudit('tu_choi_export', `export:${id}`)
  revalidatePath('/duyet')
  return { ok: true as const }
}

/** Yêu cầu export đã duyệt của TÔI (chưa tải) — để hiện nút tải. */
export async function exportCuaToi(): Promise<YeuCauExport[]> {
  const u = await requireStaff()
  await doQuyen('cs.khach.xin_xuat')
  const { data, error } = await dataClient().from('yeu_cau_export')
    .select('id, tieu_chi, nguoi_gui, created_at, trang_thai')
    .eq('nguoi_gui', u.email ?? '').eq('trang_thai', 'da_duyet').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as YeuCauExport[]
}

/** Tải CSV cho 1 yêu cầu ĐÃ DUYỆT (tái sinh từ dữ liệu hiện tại) + đánh dấu da_tai. */
export async function taiExportDaDuyet(id: string): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  const u = await requireStaff()
  const db = dataClient()
  const { data: yc, error: e0 } = await db.from('yeu_cau_export')
    .select('tieu_chi, nguoi_gui, trang_thai').eq('id', id).maybeSingle()
  if (e0) return { ok: false, error: e0.message }
  const y = yc as { tieu_chi: { q?: string; cot?: string[] } | null; nguoi_gui: string | null; trang_thai: string } | null
  if (!y || y.trang_thai !== 'da_duyet') return { ok: false, error: 'Yêu cầu chưa được duyệt hoặc đã tải.' }
  if (!(await coQuyen('cs.khach.duyet_xuat', 'QUANLY')) && y.nguoi_gui !== (u.email ?? '')) return { ok: false, error: KHONG_DU_QUYEN }
  const cot = Array.isArray(y.tieu_chi?.cot) && y.tieu_chi.cot.length
    ? y.tieu_chi.cot : XUAT_KHACH_COT.map((c) => c.key)
  const rows = await layKhachXuat(y.tieu_chi?.q ?? '')
  await db.from('yeu_cau_export').update({ trang_thai: 'da_tai' }).eq('id', id)
  await ghiAudit('tai_export_pii', `export:${id}`, { so_dong: rows.length })
  revalidatePath('/khach-hang')
  return { ok: true, csv: noiDungXuatKhach(rows, cot) }
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
  tuyChon: TuyChonDanhSach & { tatPhanTrang?: boolean; ngtu?: string; ngden?: string } = {}
): Promise<KetQuaTrang<CoreDue>> {
  await requireStaff()
  await doQuyen('cs.may.thay_loi')
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
  // Lọc theo ngày đến hạn sớm nhất (han_som là date).
  const { tu: loiTu, den: loiDen } = docLocNgay(tuyChon)
  if (loiTu) truyVan = truyVan.gte('han_som', loiTu)
  if (loiDen) truyVan = truyVan.lte('han_som', loiDen)

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
  await doQuyen('cs.may.thay_loi')
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
  tuyChon: TuyChonDanhSach & { ngtu?: string; ngden?: string } = {}
): Promise<KetQuaTrang<MaintenanceDue>> {
  await requireStaff()
  await doQuyen('cs.bao_tri.xem')
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
  // Lọc theo ngày đến hạn bảo trì (due_date là date).
  const { tu: btTu, den: btDen } = docLocNgay(tuyChon)
  if (btTu) query = query.gte('due_date', btTu)
  if (btDen) query = query.lte('due_date', btDen)

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
  await doQuyen('cs.bao_tri.xem')
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
  await doQuyen('cs.bao_tri.ghi_ket_qua')
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
  await doQuyen('cs.bao_tri.ghi_ket_qua')
  const { error } = await dataClient()
    .from('maintenance_visit').update({ completed_at: null }).eq('id', visitId)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/bao-tri')
  return { ok: true as const }
}

export type KetQuaDo = {
  ngay: string; ghi_chu?: string
  tds_truoc?: number; tds_sau?: number; ph_truoc?: number; ph_sau?: number
  do_cung_truoc?: number; do_cung_sau?: number; clo_truoc?: number; clo_sau?: number
}

/**
 * Ghi KẾT QUẢ ĐO khi bảo trì (TDS/pH/độ cứng/Clo dư trước-sau lọc) + đánh dấu xong theo NGÀY
 * THỰC, rồi DỜI LỊCH DÂY CHUYỀN: các lượt sau (chưa làm) tính lại từ ngày thực (né cuối tuần).
 * VD lịch 1/8 nhưng làm 10/8 -> lượt sau thành 10/11 thay vì 1/11.
 */
export async function ghiKetQuaBaoTri(visitId: string, kq: KetQuaDo): Promise<{ ok: true; doi: number } | { ok: false; error: string }> {
  await requireStaff()
  await doQuyen('cs.bao_tri.ghi_ket_qua')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(kq.ngay)) return { ok: false, error: 'Ngày không hợp lệ.' }
  const db = dataClient()
  const num = (x?: number) => (typeof x === 'number' && !Number.isNaN(x) ? x : null)
  const { data: v } = await db.from('maintenance_visit').select('plan_id, lan_thu').eq('id', visitId).maybeSingle()
  const vv = v as { plan_id: string | null; lan_thu: number | null } | null
  if (!vv) return { ok: false, error: 'Không thấy lượt bảo trì.' }
  const { error } = await db.from('maintenance_visit').update({
    completed_at: kq.ngay, ket_qua_ghi_chu: kq.ghi_chu?.trim() || null,
    tds_truoc: num(kq.tds_truoc), tds_sau: num(kq.tds_sau), ph_truoc: num(kq.ph_truoc), ph_sau: num(kq.ph_sau),
    do_cung_truoc: num(kq.do_cung_truoc), do_cung_sau: num(kq.do_cung_sau), clo_truoc: num(kq.clo_truoc), clo_sau: num(kq.clo_sau),
  }).eq('id', visitId)
  if (error) return { ok: false, error: error.message }
  // Dời lịch dây chuyền cho các lượt SAU chưa làm.
  let doi = 0
  if (vv.plan_id && vv.lan_thu != null) {
    const { data: plan } = await db.from('maintenance_plan').select('customer_id, chu_ky_thang, vung').eq('id', vv.plan_id).maybeSingle()
    const p = plan as { customer_id: string | null; chu_ky_thang: number | null; vung: Vung | null } | null
    const chuKy = p?.chu_ky_thang ?? 0
    if (p && chuKy > 0) {
      const { data: sau } = await db.from('maintenance_visit').select('id')
        .eq('plan_id', vv.plan_id).is('completed_at', null).gt('lan_thu', vv.lan_thu).order('lan_thu')
      const ds = (sau ?? []) as { id: string }[]
      if (ds.length) {
        const { data: kh } = await db.from('cs_customers').select('province').eq('id', p.customer_id ?? '').maybeSingle()
        const vung: Vung = p.vung ?? vungTheoTinh((kh as { province: string | null } | null)?.province ?? null)
        const ngayMoi = sinhLichBaoTri(kq.ngay, chuKy, ds.length + 1, vung).slice(1)  // mốc sau ngày thực
        for (let i = 0; i < ds.length && i < ngayMoi.length; i++) {
          await db.from('maintenance_visit').update({ due_date: ngayMoi[i] }).eq('id', ds[i].id); doi++
        }
      }
    }
  }
  await ghiAudit('ghi_ket_qua_bao_tri', `visit:${visitId}`, { ngay: kq.ngay, doi_lich: doi })
  revalidatePath('/bao-tri')
  return { ok: true, doi }
}

// ── Đợt 1: nền lịch bảo trì tự động + map khách bảo trì với khách kích hoạt máy ──

export type PlanChuaMap = {
  id: string; bo_may: string | null; loai_goi: string | null
  tong_lan: number | null; chu_ky_thang: number | null
  source_customer_name: string | null; source_phone: string | null
  /** Tối đa 3 khách khớp nhất, kèm lý do để CS tự kiểm chứng trước khi bấm gán. */
  goi_y: GoiYKhach[]
}

/**
 * Plan bảo trì CHƯA map khách + gợi ý khách khớp.
 *
 * Trước đây chỉ dò SĐT nên 23/48 plan không có gợi ý nào (plan Asana phần lớn
 * thiếu SĐT). Nay dò thêm tỉnh + ngày lắp đọc từ tên thư mục — xem lib/khopPlanKhach.
 */
export async function baoTriChuaMap(): Promise<PlanChuaMap[]> {
  await requireStaff()
  await doQuyen('cs.bao_tri.xem')
  const db = dataClient()
  const [{ data: plans }, { data: khach }, { data: may }] = await Promise.all([
    db.from('maintenance_plan')
      .select('id, bo_may, loai_goi, tong_lan, chu_ky_thang, source_customer_name, source_phone')
      .is('customer_id', null).order('source_customer_name'),
    db.from('cs_customers').select('id, full_name, primary_phone, province').neq('trang_thai', 'da_xoa'),
    db.from('installed_base').select('customer_id, install_date').eq('status', 'active'),
  ])

  // Ngày lắp SỚM NHẤT của mỗi khách — mốc để so với ngày trong tên plan.
  const somNhat = new Map<string, string>()
  for (const m of (may ?? []) as { customer_id: string | null; install_date: string | null }[]) {
    if (!m.customer_id || !m.install_date) continue
    const cu = somNhat.get(m.customer_id)
    if (!cu || m.install_date < cu) somNhat.set(m.customer_id, m.install_date)
  }

  const ungVien: KhachUngVien[] = ((khach ?? []) as {
    id: string; full_name: string; primary_phone: string | null; province: string | null
  }[]).map((k) => ({
    id: k.id, ten: k.full_name, sdt: k.primary_phone, tinh: k.province,
    ngayLapSomNhat: somNhat.get(k.id) ?? null,
  }))

  type PlanRow = Omit<PlanChuaMap, 'goi_y'>
  return ((plans ?? []) as PlanRow[]).map((p) => ({ ...p, goi_y: xepGoiY(p, ungVien) }))
}

/** Gán khách cho 1 plan bảo trì (map với khách kích hoạt máy). CHỈ QUẢN LÝ. */
/**
 * `sdtChinh` quyết SỐ NÀO thành số chính của khách khi lịch và hồ sơ ghi hai số:
 *   'khach' — giữ số đang có, số trên lịch xuống SĐT phụ (mặc định)
 *   'plan'  — lấy số trên lịch làm chính, số cũ của khách xuống SĐT phụ
 *   'bo'    — bỏ số trên lịch, không lưu đâu cả
 */
export async function ganKhachBaoTri(
  planId: string, customerId: string, sdtChinh: 'khach' | 'plan' | 'bo' = 'khach',
): Promise<{ ok: true; themSdtPhu: boolean } | { ok: false; error: string }> {
  await requireStaff()
  if (!(await coQuyen('cs.bao_tri.tao_plan', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  if (!customerId) return { ok: false, error: 'Chọn khách.' }
  const db = dataClient()

  // SĐT trên lịch (từ Asana) thường KHÁC SĐT trong hồ sơ khách — cùng một người
  // nhưng hai số (số cá nhân vs số ghi lúc ký hợp đồng). Gán xong mà không giữ
  // thì số trên lịch mất hẳn, không còn chỗ nào lưu.
  let themSdtPhu = false
  if (sdtChinh !== 'bo') {
    const [{ data: pl }, { data: kh }] = await Promise.all([
      db.from('maintenance_plan').select('source_phone, source_customer_name').eq('id', planId).maybeSingle(),
      db.from('cs_customers').select('primary_phone').eq('id', customerId).maybeSingle(),
    ])
    const soPlan = chuanHoaSdt((pl as { source_phone: string | null } | null)?.source_phone ?? '')
    const soKhach = chuanHoaSdt((kh as { primary_phone: string | null } | null)?.primary_phone ?? '')

    if (soPlan.hopLe && soPlan.cuoi9 !== soKhach.cuoi9) {
      // Số nào KHÔNG được chọn làm chính thì xuống số phụ — không vứt cái nào.
      const soPhu = sdtChinh === 'plan' ? soKhach : soPlan
      const soMoiLamChinh = sdtChinh === 'plan' ? soPlan : null

      if (soMoiLamChinh) {
        // Đổi số chính: giải phóng số cũ TRƯỚC (primary_phone có ràng buộc UNIQUE
        // toàn bảng, gán trùng là vỡ) — nhưng chỉ khi số mới chưa thuộc khách khác.
        const { data: aiDangGiu } = await db.from('cs_customers')
          .select('id').neq('trang_thai', 'da_xoa').neq('id', customerId)
          .ilike('primary_phone', `%${soMoiLamChinh.cuoi9}`).limit(1)
        if (aiDangGiu && aiDangGiu.length) {
          return { ok: false, error: 'SĐT trên lịch đang là số chính của một khách khác — không lấy làm số chính được. Chọn giữ số cũ, hoặc kiểm tra lại đúng người chưa.' }
        }
        await db.from('cs_customers')
          .update({ primary_phone: soMoiLamChinh.chuan, needs_phone: false, updated_at: new Date().toISOString() })
          .eq('id', customerId)
      }

      if (soPhu.hopLe) {
        const { data: daCo } = await db.from('customer_contacts')
          .select('id').eq('customer_id', customerId).ilike('phone', `%${soPhu.cuoi9}`).limit(1)
        if (!daCo || daCo.length === 0) {
          await db.from('customer_contacts').insert({
            customer_id: customerId, phone: soPhu.chuan,
            contact_name: (pl as { source_customer_name: string | null } | null)?.source_customer_name ?? null,
            role: 'khac', is_primary: false, zalo_ok: true,
            ghi_chu: sdtChinh === 'plan' ? 'Số cũ trong hồ sơ' : 'Số ghi trên lịch bảo trì',
          })
          themSdtPhu = true
        }
      }
    }
  }

  const { error } = await db.from('maintenance_plan')
    .update({ customer_id: customerId, updated_at: new Date().toISOString() }).eq('id', planId)
  if (error) return { ok: false, error: error.message }
  await ghiAudit('gan_khach_bao_tri', `plan:${planId}`, { customer_id: customerId, sdt_chinh: sdtChinh, them_sdt_phu: themSdtPhu })
  revalidatePath('/bao-tri')
  revalidatePath(`/khach/${customerId}`)
  return { ok: true, themSdtPhu }
}

/**
 * Gỡ khách khỏi plan — đường HOÀN TÁC cho lỡ gán nhầm.
 *
 * Trước đây gán là một chiều: bấm nhầm một cái là plan dính vào khách sai, muốn
 * sửa phải nhờ kỹ thuật chạy SQL. Gán chỉ là đặt `customer_id`, gỡ ra rẻ như gán
 * vào, nên không có lý do gì bắt người dùng sống chung với cái nhầm.
 * Lượt bảo trì đã sinh KHÔNG bị đụng — chúng treo theo plan, không theo khách.
 */
export async function goGanKhachBaoTri(planId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff()
  // Cùng quyền với ganKhachBaoTri() ngay phía trên — gán và gỡ là hai chiều của
  // một việc. Hàm này từ `main` sang, còn gác bằng laQuanLy() thô nên VÔ HÌNH
  // với ma trận; nối vào đây để tick/bỏ tick có tác dụng thật với nó.
  if (!(await coQuyen('cs.bao_tri.tao_plan', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  const db = dataClient()
  const { data: cu } = await db.from('maintenance_plan')
    .select('customer_id').eq('id', planId).maybeSingle()
  const { error } = await db.from('maintenance_plan')
    .update({ customer_id: null, updated_at: new Date().toISOString() }).eq('id', planId)
  if (error) return { ok: false, error: error.message }
  await ghiAudit('go_gan_khach_bao_tri', `plan:${planId}`, {
    customer_id_cu: (cu as { customer_id: string | null } | null)?.customer_id ?? null,
  })
  revalidatePath('/bao-tri')
  return { ok: true }
}

export type PlanDaMap = {
  id: string; customer_id: string; ten_khach: string | null; province: string | null
  bo_may: string | null; loai_goi: string | null; tong_lan: number | null
  chu_ky_thang: number | null; ngay_bat_dau: string | null; vung: string | null
  so_visit: number; so_xong: number; ngay_kich_hoat: string | null; so_may: number
}

/** Plan bảo trì ĐÃ map khách + số lượt + ngày kích hoạt (ngày lắp sớm nhất) để lên lịch. */
export async function baoTriDaMap(): Promise<PlanDaMap[]> {
  await requireStaff()
  await doQuyen('cs.bao_tri.xem')
  const db = dataClient()
  const { data: plans } = await db.from('maintenance_plan')
    .select('id, customer_id, bo_may, loai_goi, tong_lan, chu_ky_thang, ngay_bat_dau, vung')
    .not('customer_id', 'is', null).order('updated_at', { ascending: false })
  const ds = (plans ?? []) as Omit<PlanDaMap, 'ten_khach' | 'province' | 'so_visit' | 'so_xong' | 'ngay_kich_hoat' | 'so_may'>[]
  if (!ds.length) return []
  const ids = ds.map((p) => p.id)
  const cusIds = [...new Set(ds.map((p) => p.customer_id))]
  const [{ data: visits }, { data: khach }, { data: may }] = await Promise.all([
    db.from('maintenance_visit').select('plan_id, completed_at').in('plan_id', ids),
    db.from('cs_customers').select('id, full_name, province').in('id', cusIds),
    db.from('installed_base').select('customer_id, install_date').in('customer_id', cusIds).eq('status', 'active'),
  ])
  const dem = new Map<string, { visit: number; xong: number }>()
  for (const v of (visits ?? []) as { plan_id: string; completed_at: string | null }[]) {
    const c = dem.get(v.plan_id) ?? { visit: 0, xong: 0 }
    c.visit++; if (v.completed_at) c.xong++
    dem.set(v.plan_id, c)
  }
  // Ngày kích hoạt = ngày lắp SỚM NHẤT + đếm số máy đã lắp (gate "đã kích hoạt BH").
  const kichHoat = new Map<string, { ngay: string | null; so: number }>()
  for (const m of (may ?? []) as { customer_id: string; install_date: string | null }[]) {
    const cur = kichHoat.get(m.customer_id) ?? { ngay: null, so: 0 }
    cur.so++
    if (m.install_date && (!cur.ngay || m.install_date < cur.ngay)) cur.ngay = m.install_date
    kichHoat.set(m.customer_id, cur)
  }
  const kh = new Map((((khach ?? []) as { id: string; full_name: string; province: string | null }[])).map((k) => [k.id, k]))
  return ds.map((p) => {
    const c = dem.get(p.id) ?? { visit: 0, xong: 0 }
    const k = kh.get(p.customer_id)
    const kt = kichHoat.get(p.customer_id) ?? { ngay: null, so: 0 }
    return {
      ...p, ten_khach: k?.full_name ?? null, province: k?.province ?? null,
      so_visit: c.visit, so_xong: c.xong, ngay_kich_hoat: kt.ngay, so_may: kt.so,
    }
  })
}

export type LuotThang = {
  visit_id: string; due_date: string; lan_thu: number | null; tong_lan: number | null
  bo_may: string | null; customer_name: string | null; primary_phone: string | null
  completed_at: string | null; tinh_trang: string; chua_khop_khach: boolean | null
}

/** Các lượt bảo trì có due_date trong 1 THÁNG (calendar view). thang = 'YYYY-MM'. */
export async function baoTriTheoThang(thang: string): Promise<LuotThang[]> {
  await requireStaff()
  await doQuyen('cs.bao_tri.xem')
  const m = /^(\d{4})-(\d{2})$/.exec(thang)
  if (!m) return []
  const y = +m[1], mo = +m[2]
  const dau = `${thang}-01`
  const sauNam = mo === 12 ? y + 1 : y
  const sauThang = mo === 12 ? 1 : mo + 1
  const sau = `${sauNam}-${String(sauThang).padStart(2, '0')}-01`
  const { data, error } = await dataClient()
    .from('v_maintenance_due')
    .select('visit_id, due_date, lan_thu, tong_lan, bo_may, customer_name, primary_phone, completed_at, tinh_trang, chua_khop_khach')
    .gte('due_date', dau).lt('due_date', sau).order('due_date')
  if (error) throw new Error(error.message)
  return (data ?? []) as LuotThang[]
}

export type LuotKhach = {
  visit_id: string; due_date: string | null; lan_thu: number | null; tong_lan: number | null
  bo_may: string | null; loai_goi: string | null; completed_at: string | null
  tds_truoc: number | null; tds_sau: number | null; ph_truoc: number | null; ph_sau: number | null
  do_cung_truoc: number | null; do_cung_sau: number | null; clo_truoc: number | null; clo_sau: number | null
  ket_qua_ghi_chu: string | null
}

/** Lịch bảo trì của 1 KHÁCH (mọi plan đã map khách) + kết quả đo — hiện ở trang khách. */
export async function baoTriCuaKhach(customerId: string): Promise<LuotKhach[]> {
  await requireStaff()
  await doQuyen('cs.bao_tri.xem')
  const db = dataClient()
  const { data: plans } = await db.from('maintenance_plan')
    .select('id, bo_may, loai_goi').eq('customer_id', customerId)
  const ps = (plans ?? []) as { id: string; bo_may: string | null; loai_goi: string | null }[]
  if (!ps.length) return []
  const meta = new Map(ps.map((p) => [p.id, p]))
  const { data: visits } = await db.from('maintenance_visit')
    .select('id, plan_id, lan_thu, due_date, completed_at, tds_truoc, tds_sau, ph_truoc, ph_sau, do_cung_truoc, do_cung_sau, clo_truoc, clo_sau, ket_qua_ghi_chu')
    .in('plan_id', ps.map((p) => p.id))
    .order('due_date', { ascending: true, nullsFirst: false })
  type VRow = { id: string; plan_id: string; lan_thu: number | null; due_date: string | null; completed_at: string | null } & Omit<LuotKhach, 'visit_id' | 'due_date' | 'lan_thu' | 'tong_lan' | 'bo_may' | 'loai_goi' | 'completed_at'>
  return ((visits ?? []) as VRow[]).map((v) => {
    const p = meta.get(v.plan_id)
    return {
      visit_id: v.id, due_date: v.due_date, lan_thu: v.lan_thu, tong_lan: null,
      bo_may: p?.bo_may ?? null, loai_goi: p?.loai_goi ?? null, completed_at: v.completed_at,
      tds_truoc: v.tds_truoc, tds_sau: v.tds_sau, ph_truoc: v.ph_truoc, ph_sau: v.ph_sau,
      do_cung_truoc: v.do_cung_truoc, do_cung_sau: v.do_cung_sau, clo_truoc: v.clo_truoc, clo_sau: v.clo_sau,
      ket_qua_ghi_chu: v.ket_qua_ghi_chu,
    }
  })
}

export type LenLichInput = { ngayBatDau?: string; chuKyThang: number | null; tongLan: number; vung?: Vung }

/** Sinh lịch bảo trì tự động cho 1 plan. Bắt buộc đã map khách + khách có máy đã lắp (BH). CHỈ QUẢN LÝ. */
export async function lenLichBaoTri(
  planId: string, input: LenLichInput
): Promise<{ ok: true; so_lan: number } | { ok: false; error: string }> {
  await requireStaff()
  if (!(await coQuyen('cs.bao_tri.tao_plan', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  const db = dataClient()
  const { data: plan } = await db.from('maintenance_plan')
    .select('customer_id, ngay_bat_dau, chu_ky_thang, tong_lan, vung').eq('id', planId).maybeSingle()
  const p = plan as { customer_id: string | null; ngay_bat_dau: string | null; chu_ky_thang: number | null; tong_lan: number | null; vung: Vung | null } | null
  if (!p) return { ok: false, error: 'Không thấy plan.' }
  if (!p.customer_id) return { ok: false, error: 'Chưa map khách — gán khách trước khi lên lịch.' }
  // Bộ CŨ (plan sẵn có, nhập từ Asana) không chặn BH — vẫn lên lịch được.
  // Chặn "kích hoạt BH trước" chỉ áp cho plan MỚI tạo trên CS (taoPlanBaoTri).
  const { data: kh } = await db.from('cs_customers').select('province').eq('id', p.customer_id).maybeSingle()
  const vung: Vung = input.vung ?? p.vung ?? vungTheoTinh((kh as { province: string | null } | null)?.province ?? null)
  // Ngày bắt đầu: input > plan.ngay_bat_dau > ngày lắp máy sớm nhất > hôm nay.
  let batDau = input.ngayBatDau?.trim() || p.ngay_bat_dau || null
  if (!batDau) {
    const { data: ib } = await db.from('installed_base').select('install_date')
      .eq('customer_id', p.customer_id).eq('status', 'active').not('install_date', 'is', null)
      .order('install_date').limit(1).maybeSingle()
    batDau = (ib as { install_date: string | null } | null)?.install_date ?? new Date().toISOString().slice(0, 10)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(batDau)) return { ok: false, error: 'Ngày bắt đầu không hợp lệ (YYYY-MM-DD).' }
  const chuKy = input.chuKyThang ?? p.chu_ky_thang ?? 3
  const tongLan = Math.max(1, input.tongLan || p.tong_lan || 1)
  const ngayList = sinhLichBaoTri(batDau, chuKy, tongLan, vung)

  // Giữ lượt ĐÃ LÀM; chỉ thay lượt chưa làm.
  const { count: daXong } = await db.from('maintenance_visit')
    .select('id', { count: 'exact', head: true }).eq('plan_id', planId).not('completed_at', 'is', null)
  const soDaXong = daXong ?? 0
  await db.from('maintenance_visit').delete().eq('plan_id', planId).is('completed_at', null)
  const rows = ngayList
    .map((d, i) => ({ plan_id: planId, lan_thu: i + 1, due_date: d, ten_task: `Bảo trì lần ${i + 1}` }))
    .filter((r) => r.lan_thu > soDaXong)
  if (rows.length) {
    const { error } = await db.from('maintenance_visit').insert(rows)
    if (error) return { ok: false, error: error.message }
  }
  await db.from('maintenance_plan')
    .update({ ngay_bat_dau: batDau, chu_ky_thang: chuKy, tong_lan: tongLan, vung, updated_at: new Date().toISOString() })
    .eq('id', planId)
  await ghiAudit('len_lich_bao_tri', `plan:${planId}`, { bat_dau: batDau, chu_ky: chuKy, tong_lan: tongLan, vung, so_lan: rows.length })
  revalidatePath('/bao-tri')
  return { ok: true, so_lan: rows.length }
}

/**
 * Tạo LỊCH BẢO TRÌ MỚI cho khách (tặng thêm / không qua Sales / gói mua trực tiếp trên CS).
 * Plan MỚI -> BẮT BUỘC khách đã có máy kích hoạt BH (chặn khách mới chưa kích hoạt). CHỈ QUẢN LÝ.
 */
export async function taoPlanBaoTri(
  customerId: string,
  input: { boMay?: string; chuKyThang: number | null; tongLan: number; ngayBatDau: string; vung?: Vung; loaiGoi?: string; ngayList?: string[] }
): Promise<{ ok: true; plan_id: string; so_lan: number } | { ok: false; error: string }> {
  await requireStaff()
  if (!(await coQuyen('cs.bao_tri.tao_plan', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  if (!customerId) return { ok: false, error: 'Chọn khách.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.ngayBatDau)) return { ok: false, error: 'Ngày bắt đầu không hợp lệ.' }
  // Mốc do CS sửa tay (nếu có) — ưu tiên dùng thẳng, không sinh lại.
  const ngayTay = (input.ngayList ?? []).map((d) => d.trim()).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
  const tongLan = Math.max(1, Math.floor(input.tongLan) || 1)
  const db = dataClient()
  // Plan MỚI trên CS -> gate BH: khách phải có ≥1 máy đã lắp/kích hoạt.
  const { count: soMay } = await db.from('installed_base')
    .select('serial', { count: 'exact', head: true }).eq('customer_id', customerId).eq('status', 'active')
  if (!soMay) return { ok: false, error: 'Khách chưa có máy kích hoạt bảo hành — kích hoạt BH trước khi tạo lịch bảo trì.' }
  const { data: kh } = await db.from('cs_customers').select('province').eq('id', customerId).maybeSingle()
  const vung: Vung = input.vung ?? vungTheoTinh((kh as { province: string | null } | null)?.province ?? null)
  const { data: created, error: e0 } = await db.from('maintenance_plan').insert({
    customer_id: customerId, bo_may: input.boMay?.trim() || null,
    loai_goi: input.loaiGoi === 'hop_dong' ? 'hop_dong' : 'tang_noi_bo',
    chu_ky_thang: input.chuKyThang, tong_lan: tongLan, ngay_bat_dau: input.ngayBatDau, vung,
    trang_thai: 'dang_hoat_dong',
  }).select('id').single()
  if (e0) return { ok: false, error: e0.message }
  const planId = (created as { id: string }).id
  const ngayList = ngayTay.length ? ngayTay : sinhLichBaoTri(input.ngayBatDau, input.chuKyThang, tongLan, vung)
  const rows = ngayList.map((d, i) => ({ plan_id: planId, lan_thu: i + 1, due_date: d, ten_task: `Bảo trì lần ${i + 1}` }))
  if (rows.length) {
    const { error } = await db.from('maintenance_visit').insert(rows)
    if (error) return { ok: false, error: error.message }
  }
  await ghiAudit('tao_plan_bao_tri', `plan:${planId}`, { customer_id: customerId, tong_lan: tongLan, so_lan: rows.length })
  revalidatePath('/bao-tri'); revalidatePath(`/khach/${customerId}`)
  return { ok: true, plan_id: planId, so_lan: rows.length }
}

export type SapHetGoi = {
  plan_id: string; customer_id: string; ten_khach: string | null; primary_phone: string | null
  bo_may: string | null; tong_lan: number | null; so_xong: number; con_lai: number; luot_cuoi: string | null
}

/** Plan bảo trì SẮP HẾT (đã lên lịch + còn ≤1 lượt chưa làm) — nhắc CS chào gói mới. */
export async function baoTriSapHet(): Promise<SapHetGoi[]> {
  await requireStaff()
  await doQuyen('cs.bao_tri.xem')
  const db = dataClient()
  const { data: plans } = await db.from('maintenance_plan')
    .select('id, customer_id, bo_may, tong_lan').not('customer_id', 'is', null).eq('trang_thai', 'dang_hoat_dong')
  const ps = (plans ?? []) as { id: string; customer_id: string; bo_may: string | null; tong_lan: number | null }[]
  if (!ps.length) return []
  const ids = ps.map((p) => p.id)
  const cus = [...new Set(ps.map((p) => p.customer_id))]
  const [{ data: visits }, { data: khach }] = await Promise.all([
    db.from('maintenance_visit').select('plan_id, completed_at, due_date').in('plan_id', ids),
    db.from('cs_customers').select('id, full_name, primary_phone').in('id', cus),
  ])
  const stat = new Map<string, { xong: number; chua: number; cuoi: string | null }>()
  for (const v of (visits ?? []) as { plan_id: string; completed_at: string | null; due_date: string | null }[]) {
    const s = stat.get(v.plan_id) ?? { xong: 0, chua: 0, cuoi: null }
    if (v.completed_at) s.xong++; else s.chua++
    if (v.due_date && (!s.cuoi || v.due_date > s.cuoi)) s.cuoi = v.due_date
    stat.set(v.plan_id, s)
  }
  const kh = new Map(((khach ?? []) as { id: string; full_name: string; primary_phone: string | null }[]).map((k) => [k.id, k]))
  return ps.map((p) => {
    const s = stat.get(p.id) ?? { xong: 0, chua: 0, cuoi: null }
    const k = kh.get(p.customer_id)
    return {
      plan_id: p.id, customer_id: p.customer_id, ten_khach: k?.full_name ?? null, primary_phone: k?.primary_phone ?? null,
      bo_may: p.bo_may, tong_lan: p.tong_lan, so_xong: s.xong, con_lai: s.chua, luot_cuoi: s.cuoi,
    }
  }).filter((r) => r.so_xong + r.con_lai > 0 && r.con_lai <= 1).sort((a, b) => a.con_lai - b.con_lai)
}

// ── Đợt 3a: lịch kỹ thuật — gán việc cho kỹ thuật, 1 chuyến đi nhiều việc ─────
export type KyThuat = { id: string; ten: string; sdt: string | null; vung: string | null; email: string | null; la_ctv: boolean; hoat_dong: boolean }
export type KyThuatInput = { ten: string; sdt?: string; vung?: string; email?: string; la_ctv?: boolean; hoat_dong?: boolean }

/** Danh sách kỹ thuật (nhân viên + cộng tác viên). */
export async function dsKyThuat(chiHoatDong = false): Promise<KyThuat[]> {
  await requireStaff()
  await doQuyen('cs.ky_thuat.ho_so')
  let q = dataClient().from('ky_thuat').select('id, ten, sdt, vung, email, la_ctv, hoat_dong').order('ten')
  if (chiHoatDong) q = q.eq('hoat_dong', true)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as KyThuat[]
}

/** Hồ sơ kỹ thuật của NGƯỜI ĐANG ĐĂNG NHẬP (khớp theo email). null nếu không phải KT. */
export async function kyThuatCuaToi(): Promise<KyThuat | null> {
  await requireStaff()
  await doQuyen('cs.ky_thuat.lich_cua_toi')
  const nv = await layNhanVien()
  const email = (nv?.email ?? '').trim().toLowerCase()
  if (!email) return null
  const { data } = await dataClient().from('ky_thuat')
    .select('id, ten, sdt, vung, email, la_ctv, hoat_dong').eq('email', email).maybeSingle()
  return (data as KyThuat) ?? null
}

export async function taoKyThuat(input: KyThuatInput): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff(); if (!(await coQuyen('cs.ky_thuat.ho_so', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  if (!input.ten.trim()) return { ok: false, error: 'Thiếu tên kỹ thuật.' }
  const { error } = await dataClient().from('ky_thuat').insert({
    ten: input.ten.trim(), sdt: input.sdt?.trim() || null, vung: input.vung?.trim() || null,
    email: input.email?.trim() || null, la_ctv: !!input.la_ctv,
  })
  if (error) return { ok: false, error: error.message }
  await ghiAudit('tao_ky_thuat', 'ky-thuat', { ten: input.ten.trim() })
  revalidatePath('/ky-thuat'); return { ok: true }
}

export async function suaKyThuat(id: string, input: KyThuatInput): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff(); if (!(await coQuyen('cs.ky_thuat.ho_so', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  if (!input.ten.trim()) return { ok: false, error: 'Thiếu tên kỹ thuật.' }
  const { error } = await dataClient().from('ky_thuat').update({
    ten: input.ten.trim(), sdt: input.sdt?.trim() || null, vung: input.vung?.trim() || null,
    email: input.email?.trim() || null, la_ctv: !!input.la_ctv, hoat_dong: input.hoat_dong ?? true,
  }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  await ghiAudit('sua_ky_thuat', `ky-thuat:${id}`); revalidatePath('/ky-thuat'); return { ok: true }
}

export async function xoaKyThuat(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff(); if (!(await coQuyen('cs.ky_thuat.ho_so', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  const { error } = await dataClient().from('ky_thuat').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  await ghiAudit('xoa_ky_thuat', `ky-thuat:${id}`); revalidatePath('/ky-thuat'); return { ok: true }
}

// ── Cấp tài khoản đăng nhập cho kỹ thuật (email ngoài) — CHỈ ADMIN ────────────
// Kỹ thuật đăng nhập app nhưng CHỈ thấy lịch chuyến của mình. Cấp quyền = tạo
// auth user (mật khẩu tạm hiện 1 lần cho admin chuyển đi) + staff row có role
// ky_thuat, bật hoạt động. Link theo email: ky_thuat.email == staff.email.
// Thu quyền = gỡ role ky_thuat; nếu không còn role nào thì khoá luôn.

export type TrangThaiTaiKhoanKT = { co_login: boolean; hoat_dong: boolean }

/** Map email(kỹ thuật) -> trạng thái tài khoản đăng nhập, để roster hiển thị. */
export async function trangThaiTaiKhoanKT(): Promise<Record<string, TrangThaiTaiKhoanKT>> {
  await requireStaff()
  await doQuyen('cs.ky_thuat.ho_so')
  const db = dataClient()
  const { data: kt } = await db.from('ky_thuat').select('email').not('email', 'is', null)
  const emails = [...new Set(((kt ?? []) as { email: string | null }[])
    .map((k) => (k.email ?? '').trim().toLowerCase()).filter(Boolean))]
  if (!emails.length) return {}
  const { data: st } = await db.from('staff').select('email, hoat_dong').in('email', emails)
  const map: Record<string, TrangThaiTaiKhoanKT> = {}
  for (const s of (st ?? []) as { email: string; hoat_dong: boolean }[]) {
    map[s.email.toLowerCase()] = { co_login: true, hoat_dong: s.hoat_dong }
  }
  return map
}

/** Cấp quyền đăng nhập cho 1 kỹ thuật (theo email của họ). CHỈ ADMIN. */
export async function capTaiKhoanKyThuat(
  kyThuatId: string,
): Promise<{ ok: true; mat_khau_tam: string | null; da_co_auth: boolean } | { ok: false; error: string }> {
  await requireStaff(); if (!(await coQuyen('cs.ky_thuat.tai_khoan', 'ADMIN'))) return { ok: false, error: KHONG_DU_QUYEN }
  const db = dataClient()
  const { data: kt } = await db.from('ky_thuat').select('id, ten, email').eq('id', kyThuatId).maybeSingle()
  const row = kt as { id: string; ten: string; email: string | null } | null
  if (!row) return { ok: false, error: 'Không tìm thấy kỹ thuật.' }
  const email = (row.email ?? '').trim().toLowerCase()
  if (!email) return { ok: false, error: 'Kỹ thuật chưa có email — thêm email trước khi cấp đăng nhập.' }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Email không hợp lệ.' }

  // 1) Tạo auth user (nếu chưa có). Mật khẩu tạm chỉ hiện 1 lần cho admin chuyển đi.
  let matKhauTam: string | null = randomBytes(9).toString('base64url')
  let daCoAuth = false
  const { error: eAuth } = await db.auth.admin.createUser({ email, password: matKhauTam, email_confirm: true })
  if (eAuth) {
    // Đã có auth user (đăng nhập Google, hoặc cấp trước đó) -> không đổi mật khẩu, không lộ.
    if (!/already|registered|exists|duplicate/i.test(eAuth.message)) {
      return { ok: false, error: `Tạo tài khoản đăng nhập lỗi: ${eAuth.message}` }
    }
    daCoAuth = true; matKhauTam = null
  }

  // 2) Upsert staff row: thêm role ky_thuat + bật hoạt động, KHÔNG ghi đè role khác.
  const { data: st } = await db.from('staff').select('id, vai_tro').eq('email', email).maybeSingle()
  const cu = st as { id: string; vai_tro: string[] | string | null } | null
  const roles = new Set(chuanHoaVaiTro(cu?.vai_tro)); roles.add('ky_thuat')
  const err = cu
    ? (await db.from('staff').update({ vai_tro: [...roles], hoat_dong: true }).eq('id', cu.id)).error
    : (await db.from('staff').insert({ ten: row.ten, email, vai_tro: [...roles], hoat_dong: true })).error
  if (err) return { ok: false, error: err.message }

  await ghiAudit('cap_tai_khoan_kt', `ky-thuat:${kyThuatId}`, { email })
  revalidatePath('/ky-thuat'); revalidatePath('/nhan-vien')
  return { ok: true, mat_khau_tam: matKhauTam, da_co_auth: daCoAuth }
}

/** Thu quyền đăng nhập của 1 kỹ thuật: gỡ role ky_thuat; hết role thì khoá. CHỈ ADMIN. */
export async function thuTaiKhoanKyThuat(kyThuatId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff(); if (!(await coQuyen('cs.ky_thuat.tai_khoan', 'ADMIN'))) return { ok: false, error: KHONG_DU_QUYEN }
  const db = dataClient()
  const { data: kt } = await db.from('ky_thuat').select('email').eq('id', kyThuatId).maybeSingle()
  const email = ((kt as { email: string | null } | null)?.email ?? '').trim().toLowerCase()
  if (!email) return { ok: false, error: 'Kỹ thuật chưa có email.' }
  const { data: st } = await db.from('staff').select('id, vai_tro').eq('email', email).maybeSingle()
  const cu = st as { id: string; vai_tro: string[] | string | null } | null
  if (!cu) return { ok: true }
  const conLai = chuanHoaVaiTro(cu.vai_tro).filter((r) => r !== 'ky_thuat')
  // Còn vai trò khác (kiêm CS) -> chỉ gỡ ky_thuat, vẫn đăng nhập được. Hết -> khoá.
  const capNhat = conLai.length ? { vai_tro: conLai } : { vai_tro: [] as string[], hoat_dong: false }
  const { error } = await db.from('staff').update(capNhat).eq('id', cu.id)
  if (error) return { ok: false, error: error.message }
  await ghiAudit('thu_tai_khoan_kt', `ky-thuat:${kyThuatId}`, { email })
  revalidatePath('/ky-thuat'); revalidatePath('/nhan-vien')
  return { ok: true }
}

export type ViecInput = { loai_viec: string; mo_ta?: string; ref?: string; so_tien?: number }

export type BoiCanhKhach = {
  dia_chi: string | null
  tinh: string | null
  plans: { id: string; nhan: string }[]
  visits: { id: string; nhan: string }[]
  machines: { serial: string; nhan: string; dia_chi: string | null; loi: { code: string; ten: string | null }[] }[]
  tickets: { code: string; nhan: string }[]
}

/** Ngữ cảnh 1 khách để gán việc kỹ thuật: địa chỉ + tỉnh + bộ + máy (kèm địa chỉ + LÕI của từng máy) + ticket. */
export async function boiCanhKhach(customerId: string): Promise<BoiCanhKhach> {
  await requireStaff()
  await doQuyen('cs.khach.xem')
  const db = dataClient()
  const [{ data: ib }, { data: plans }, { data: tks }, { data: kh }] = await Promise.all([
    db.from('installed_base').select('serial, internal_code, model_freetext, install_address').eq('customer_id', customerId).eq('status', 'active'),
    db.from('maintenance_plan').select('id, bo_may').eq('customer_id', customerId),
    db.from('tickets').select('ticket_code, description').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(30),
    db.from('cs_customers').select('address, province').eq('id', customerId).maybeSingle(),
  ])
  const machines = (ib ?? []) as { serial: string; internal_code: string | null; model_freetext: string | null; install_address: string | null }[]
  const c = kh as { address: string | null; province: string | null } | null
  const planRows = (plans ?? []) as { id: string; bo_may: string | null }[]
  // Lượt bảo trì CHƯA làm của khách (để gán "bảo trì" đúng lượt/lịch).
  const boMayPlan = new Map(planRows.map((p) => [p.id, p.bo_may]))
  let visits: { id: string; nhan: string }[] = []
  if (planRows.length) {
    const { data: vs } = await db.from('maintenance_visit')
      .select('id, plan_id, lan_thu, due_date').in('plan_id', planRows.map((p) => p.id))
      .is('completed_at', null).order('due_date', { ascending: true, nullsFirst: false }).limit(40)
    visits = ((vs ?? []) as { id: string; plan_id: string; lan_thu: number | null; due_date: string | null }[])
      .map((v) => ({ id: v.id, nhan: `${boMayPlan.get(v.plan_id) ?? 'Bảo trì'} · lần ${v.lan_thu ?? '?'}${v.due_date ? ` · ${v.due_date}` : ''}` }))
  }
  // Lõi theo model (v_machine_filter: internal_code -> filter_code/name).
  const ics = [...new Set(machines.map((m) => m.internal_code).filter(Boolean))] as string[]
  const loiTheoIc = new Map<string, { code: string; ten: string | null }[]>()
  if (ics.length) {
    const { data: mf } = await db.from('v_machine_filter').select('internal_code, filter_code, filter_name').in('internal_code', ics)
    for (const f of (mf ?? []) as { internal_code: string; filter_code: string; filter_name: string | null }[]) {
      const a = loiTheoIc.get(f.internal_code) ?? []; a.push({ code: f.filter_code, ten: f.filter_name }); loiTheoIc.set(f.internal_code, a)
    }
  }
  return {
    dia_chi: machines.find((m) => m.install_address)?.install_address ?? c?.address ?? null,  // máy -> khách -> null
    tinh: c?.province ?? null,
    plans: planRows.map((p) => ({ id: p.id, nhan: p.bo_may ?? 'Gói bảo trì' })),
    visits,
    machines: machines.map((m) => ({
      serial: m.serial, nhan: `${m.model_freetext ?? m.internal_code ?? ''} · ${m.serial}`.trim(), dia_chi: m.install_address,
      loi: m.internal_code ? loiTheoIc.get(m.internal_code) ?? [] : [],
    })),
    tickets: ((tks ?? []) as { ticket_code: string; description: string | null }[]).map((t) => ({ code: t.ticket_code, nhan: `${t.ticket_code}${t.description ? ` · ${t.description.slice(0, 40)}` : ''}` })),
  }
}

/** Cập nhật địa chỉ lắp cho MỌI máy đang active của khách (khi khách chuyển địa chỉ mới). CHỈ QUẢN LÝ. */
export async function capNhatDiaChiMay(customerId: string, diaChi: string): Promise<{ ok: true; so: number } | { ok: false; error: string }> {
  await requireStaff(); if (!(await coQuyen('cs.may.lap_thu_doi', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  const d = diaChi.trim()
  if (!d) return { ok: false, error: 'Địa chỉ trống.' }
  const { error, count } = await dataClient().from('installed_base')
    .update({ install_address: d, updated_at: new Date().toISOString() }, { count: 'exact' })
    .eq('customer_id', customerId).eq('status', 'active')
  if (error) return { ok: false, error: error.message }
  await ghiAudit('cap_nhat_dia_chi_may', `khach:${customerId}`, { dia_chi: d })
  revalidatePath(`/khach/${customerId}`)
  return { ok: true, so: count ?? 0 }
}

/** Tạo 1 CHUYẾN ĐI cho kỹ thuật (nhiều việc). "khac" cần mô tả, "thu_tien" cần số tiền. CHỈ QUẢN LÝ. */
export async function taoLichKyThuat(input: {
  kyThuatId: string; ngay: string; customerId?: string; diaChi?: string; tinh?: string; ghiChu?: string; viec: ViecInput[]
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireStaff(); if (!(await coQuyen('cs.ky_thuat.xep_lich', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  if (!input.kyThuatId) return { ok: false, error: 'Chọn kỹ thuật.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.ngay)) return { ok: false, error: 'Ngày không hợp lệ.' }
  const viec = input.viec.filter((v) => v.loai_viec)
  if (!viec.length) return { ok: false, error: 'Thêm ít nhất 1 việc.' }
  for (const v of viec) {
    if (v.loai_viec === 'khac' && !v.mo_ta?.trim()) return { ok: false, error: 'Việc "Khác" cần ghi cụ thể.' }
    if (v.loai_viec === 'thu_tien' && !(v.so_tien && v.so_tien > 0)) return { ok: false, error: 'Việc "Cần thu tiền" cần nhập số tiền.' }
  }
  const db = dataClient()
  const { data: created, error } = await db.from('lich_ky_thuat').insert({
    ky_thuat_id: input.kyThuatId, ngay: input.ngay, customer_id: input.customerId || null,
    dia_chi: input.diaChi?.trim() || null, tinh: input.tinh?.trim() || null, ghi_chu: input.ghiChu?.trim() || null,
  }).select('id').single()
  if (error) return { ok: false, error: error.message }
  const lichId = (created as { id: string }).id
  const { error: e2 } = await db.from('lich_ky_thuat_viec').insert(
    viec.map((v) => ({ lich_id: lichId, loai_viec: v.loai_viec, mo_ta: v.mo_ta?.trim() || null, ref: v.ref?.trim() || null, so_tien: v.so_tien ?? null }))
  )
  if (e2) return { ok: false, error: e2.message }
  await ghiAudit('tao_lich_ky_thuat', `lich:${lichId}`, { ky_thuat: input.kyThuatId, ngay: input.ngay, so_viec: viec.length })
  revalidatePath('/ky-thuat'); return { ok: true, id: lichId }
}

/**
 * Đổi trạng thái chuyến. Khi XONG -> cascade cập nhật việc thật đã gán:
 *  bảo trì (ref=visit) -> đánh dấu lượt xong theo ngày chuyến;
 *  thay lõi (ref=serial, mã lõi trong mô tả) -> ghi 1 dòng lịch sử thay lõi;
 *  ticket (ref=mã) -> chuyển state='Done'.
 */
export async function datTrangThaiLichKT(id: string, trangThai: 'hen' | 'xong' | 'huy'): Promise<{ ok: true; cap_nhat: number } | { ok: false; error: string }> {
  await requireStaff()
  const db = dataClient()
  // Quản lý làm được mọi trạng thái. Kỹ thuật CHỈ được đổi chuyến CỦA MÌNH sang
  // xong/hẹn-lại (không tự huỷ chuyến — đó là quyết định của quản lý).
  if (!(await coQuyen('cs.ky_thuat.xep_lich', 'QUANLY'))) {
    const me = await kyThuatCuaToi()
    const { data: owner } = await db.from('lich_ky_thuat').select('ky_thuat_id').eq('id', id).maybeSingle()
    const chuChuyen = !!me && (owner as { ky_thuat_id: string | null } | null)?.ky_thuat_id === me.id
    if (!chuChuyen || trangThai === 'huy') return { ok: false, error: KHONG_DU_QUYEN }
  }
  const { error } = await db.from('lich_ky_thuat').update({ trang_thai: trangThai, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  let capNhat = 0
  if (trangThai === 'xong') {
    const { data: lich } = await db.from('lich_ky_thuat').select('ngay').eq('id', id).maybeSingle()
    const ngay = (lich as { ngay: string } | null)?.ngay ?? new Date().toISOString().slice(0, 10)
    const { data: viec } = await db.from('lich_ky_thuat_viec').select('loai_viec, ref, mo_ta').eq('lich_id', id)
    // Gom lỗi thay vì nuốt: ghi hỏng mà vẫn báo "đã hoàn thành" là đúng vết lỗi #11 cũ
    // (tạo lịch thất bại IM LẶNG). Chuyến vẫn được đánh dấu xong — việc đó đã ghi ở trên và
    // đúng ý kỹ thuật — nhưng người bấm phải BIẾT có phần nào không cập nhật được.
    const loi: string[] = []
    for (const v of (viec ?? []) as { loai_viec: string; ref: string | null; mo_ta: string | null }[]) {
      if (v.loai_viec === 'bao_tri' && v.ref) {
        // `count` = số dòng THẬT SỰ đổi. Rào `.is('completed_at', null)` khiến lượt đã xong
        // rồi thì không đổi gì — trước đây vẫn cộng vào "đã cập nhật N việc" nên câu báo sai.
        const { error: e, count } = await db.from('maintenance_visit')
          .update({ completed_at: ngay }, { count: 'exact' })
          .eq('id', v.ref).is('completed_at', null)
        if (e) loi.push(`lượt bảo trì: ${e.message}`); else capNhat += count ?? 0
      } else if (v.loai_viec === 'thay_loi' && v.ref) {
        const code = v.mo_ta?.match(/\(([^)]+)\)\s*$/)?.[1] ?? v.mo_ta ?? 'lõi'
        // CHỐNG TRÙNG: hai nhánh kia có rào sẵn nên bấm lại vô hại, riêng nhánh này là insert
        // trần. Giao diện có nút "mở lại" ngay cạnh nút hoàn thành ⇒ xong → mở lại → xong chỉ
        // là hai cú bấm, mỗi vòng đẻ thêm một dòng lịch sử thay lõi ma. Bảng cũng không có
        // ràng buộc duy nhất nào chặn (đo prod 21/08: chỉ có khoá chính).
        const { data: daCo, error: eTra } = await db.from('filter_replacement')
          .select('id').eq('serial', v.ref).eq('filter_code', code).eq('replaced_at', ngay).limit(1)
        if (eTra) { loi.push(`thay lõi: ${eTra.message}`); continue }
        if (daCo && daCo.length) continue   // đã ghi rồi -> bỏ qua, KHÔNG cộng vào số cập nhật
        const { error: e } = await db.from('filter_replacement')
          .insert({ serial: v.ref, filter_code: code, replaced_at: ngay, note: 'Kỹ thuật thay khi đi hiện trường' })
        if (e) loi.push(`thay lõi: ${e.message}`); else capNhat++
      } else if (v.loai_viec === 'ticket' && v.ref) {
        const { error: e, count } = await db.from('tickets')
          .update({ state: 'Done' }, { count: 'exact' })
          .eq('ticket_code', v.ref).eq('state', 'Open')
        if (e) loi.push(`ticket ${v.ref}: ${e.message}`); else capNhat += count ?? 0
      }
    }
    revalidatePath('/bao-tri'); revalidatePath('/ticket'); revalidatePath('/loi')
    await ghiAudit('hoan_thanh_lich_kt', `lich:${id}`, { ngay, cap_nhat: capNhat, loi }, loi.length ? 'loi' : 'ok')
    if (loi.length) {
      revalidatePath('/ky-thuat')
      return { ok: false, error: `Chuyến đã đánh dấu xong, nhưng ${loi.length} việc không cập nhật được: ${loi.join(' · ')}` }
    }
  }
  revalidatePath('/ky-thuat'); return { ok: true, cap_nhat: capNhat }
}

export async function xoaLichKyThuat(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff(); if (!(await coQuyen('cs.ky_thuat.xep_lich', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  const { error } = await dataClient().from('lich_ky_thuat').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/ky-thuat'); return { ok: true }
}

/** Loại máy để chọn chỉ tiêu đo: POU (máy uống → TDS/pH), POE (lọc tổng → độ cứng/Clo). */
export type LoaiMay = 'POU' | 'POE' | null

export type ViecLich = {
  loai_viec: string; mo_ta: string | null; ref: string | null; so_tien: number | null
  /** Chỉ set cho việc bảo trì: loại máy của lượt (suy từ serial → catalog cấp 2). */
  mmloai?: LoaiMay
}

export type LichKyThuatRow = {
  id: string; ngay: string; ky_thuat_id: string | null; ten_ky_thuat: string | null; trang_thai: string
  customer_id: string | null; ten_khach: string | null; dia_chi: string | null; tinh: string | null; ghi_chu: string | null
  viec: ViecLich[]
}

/**
 * Phân loại POU/POE cho các lượt bảo trì (visitId): plan.serial → serial_registry
 * .internal_code → catalog_item "Danh mục cấp 2". Trả map visitId -> LoaiMay.
 * Không suy ra được (thiếu serial / không khớp catalog) -> null (form hiện đủ 4 chỉ số).
 */
async function phanLoaiVisit(visitIds: string[]): Promise<Map<string, LoaiMay>> {
  await requireStaff()
  await doQuyen('cs.bao_tri.xem')
  const out = new Map<string, LoaiMay>()
  const ids = [...new Set(visitIds.filter(Boolean))]
  if (!ids.length) return out
  const db = dataClient()
  const { data: vs } = await db.from('maintenance_visit').select('id, plan_id').in('id', ids)
  const visits = (vs ?? []) as { id: string; plan_id: string | null }[]
  const planIds = [...new Set(visits.map((v) => v.plan_id).filter(Boolean))] as string[]
  if (!planIds.length) return out
  const { data: ps } = await db.from('maintenance_plan').select('id, serial').in('id', planIds)
  const plans = (ps ?? []) as { id: string; serial: string | null }[]
  const planSerial = new Map(plans.map((p) => [p.id, (p.serial ?? '').trim()]))

  // Đường CHÍNH: serial -> kho serial -> danh mục cấp 2. Chính xác nhất vì bám đúng con máy.
  const serials = [...new Set([...planSerial.values()].filter(Boolean))]
  const serialIc = new Map<string, string | null>()
  const icLoai = new Map<string, string | null>()
  if (serials.length) {
    const { data: sr } = await db.from('serial_registry').select('serial, internal_code').in('serial', serials)
    for (const s of (sr ?? []) as { serial: string; internal_code: string | null }[]) serialIc.set(s.serial, s.internal_code)
    const ics = [...new Set([...serialIc.values()].filter(Boolean))] as string[]
    if (ics.length) {
      const { data: ci } = await db.from('catalog_item').select('"Mã nội bộ", "Danh mục cấp 2"').in('Mã nội bộ', ics)
      for (const c of (ci ?? []) as Record<string, string | null>[]) icLoai.set(c['Mã nội bộ'] as string, c['Danh mục cấp 2'])
    }
  }

  const chuan = (x: string | null | undefined): LoaiMay => (x === 'POU' ? 'POU' : x === 'POE' ? 'POE' : null)
  for (const v of visits) {
    const serial = v.plan_id ? planSerial.get(v.plan_id) : ''
    const ic = serial ? serialIc.get(serial) : null
    // CHỈ suy từ SERIAL. KHÔNG suy từ `plan.bo_may` — CEO chốt 21/08/2026 sau khi thử thật:
    // tên bộ máy trong lịch bảo trì (WH15A/WH30A) chỉ nói về HỆ LỌC TỔNG mà khách lắp. Nó KHÔNG
    // cho biết khách có thêm máy lọc nước UỐNG hay không. Suy ra POE rồi ẩn TDS/pH là **giấu mất
    // chỉ tiêu kỹ thuật cần ghi** cho những khách có cả hai loại máy.
    // ⇒ Chưa map được lượt bảo trì tới đúng con máy thì HIỆN ĐỦ 4 CHỈ SỐ. Thà hỏi thừa còn hơn
    // thiếu. Chỉ bật phân loại lại khi `plan.serial` được điền (đo 21/08: 0/79 plan có serial).
    out.set(v.id, chuan(ic ? icLoai.get(ic) : null))
  }
  return out
}

/** Lịch kỹ thuật trong khoảng ngày (tuỳ chọn lọc 1 kỹ thuật). */
export async function dsLichKyThuat(tu: string, den: string, kyThuatId?: string): Promise<LichKyThuatRow[]> {
  await requireStaff()
  await doQuyen('cs.ky_thuat.xep_lich')
  const db = dataClient()
  let q = db.from('lich_ky_thuat')
    .select('id, ngay, ky_thuat_id, trang_thai, customer_id, dia_chi, tinh, ghi_chu')
    .gte('ngay', tu).lte('ngay', den).order('ngay')
  if (kyThuatId) q = q.eq('ky_thuat_id', kyThuatId)
  const { data: lich } = await q
  const ls = (lich ?? []) as { id: string; ngay: string; ky_thuat_id: string | null; trang_thai: string; customer_id: string | null; dia_chi: string | null; tinh: string | null; ghi_chu: string | null }[]
  if (!ls.length) return []
  const ids = ls.map((l) => l.id)
  const ktIds = [...new Set(ls.map((l) => l.ky_thuat_id).filter(Boolean))] as string[]
  const cusIds = [...new Set(ls.map((l) => l.customer_id).filter(Boolean))] as string[]
  const [{ data: viec }, { data: kt }, { data: kh }] = await Promise.all([
    db.from('lich_ky_thuat_viec').select('lich_id, loai_viec, mo_ta, ref, so_tien').in('lich_id', ids),
    ktIds.length ? db.from('ky_thuat').select('id, ten').in('id', ktIds) : Promise.resolve({ data: [] as { id: string; ten: string }[] }),
    cusIds.length ? db.from('cs_customers').select('id, full_name').in('id', cusIds) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ])
  const vMap = new Map<string, { loai_viec: string; mo_ta: string | null; ref: string | null; so_tien: number | null }[]>()
  for (const v of (viec ?? []) as { lich_id: string; loai_viec: string; mo_ta: string | null; ref: string | null; so_tien: number | null }[]) {
    const a = vMap.get(v.lich_id) ?? []; a.push({ loai_viec: v.loai_viec, mo_ta: v.mo_ta, ref: v.ref, so_tien: v.so_tien }); vMap.set(v.lich_id, a)
  }
  const ktMap = new Map(((kt ?? []) as { id: string; ten: string }[]).map((k) => [k.id, k.ten]))
  const khMap = new Map(((kh ?? []) as { id: string; full_name: string }[]).map((k) => [k.id, k.full_name]))
  return ls.map((l) => ({
    id: l.id, ngay: l.ngay, ky_thuat_id: l.ky_thuat_id, ten_ky_thuat: l.ky_thuat_id ? ktMap.get(l.ky_thuat_id) ?? null : null,
    trang_thai: l.trang_thai, customer_id: l.customer_id, ten_khach: l.customer_id ? khMap.get(l.customer_id) ?? null : null,
    dia_chi: l.dia_chi, tinh: l.tinh, ghi_chu: l.ghi_chu, viec: vMap.get(l.id) ?? [],
  }))
}

/**
 * Lịch CỦA CHÍNH kỹ thuật đang đăng nhập trong khoảng ngày. Trả {kt, rows}.
 * kt=null nghĩa là người này không phải kỹ thuật (không có hồ sơ ky_thuat khớp email).
 */
export async function lichCuaToi(tu: string, den: string): Promise<{ kt: KyThuat | null; rows: LichKyThuatRow[] }> {
  await requireStaff()
  await doQuyen('cs.ky_thuat.lich_cua_toi')
  const kt = await kyThuatCuaToi()
  if (!kt) return { kt: null, rows: [] }
  const rows = await dsLichKyThuat(tu, den, kt.id)
  // Gắn loại máy (POU/POE) cho từng việc bảo trì -> form đo hiện đúng chỉ tiêu.
  const refs = rows.flatMap((r) => r.viec.filter((v) => v.loai_viec === 'bao_tri' && v.ref).map((v) => v.ref!))
  const loaiMap = await phanLoaiVisit(refs)
  for (const r of rows) {
    for (const v of r.viec) {
      if (v.loai_viec === 'bao_tri' && v.ref) v.mmloai = loaiMap.get(v.ref) ?? null
    }
  }
  return { kt, rows }
}

export type NghiKyThuat = { id: string; ngay: string; ly_do: string | null }

/** Báo nghỉ phép cho kỹ thuật 1 ngày. CHỈ QUẢN LÝ. */
export async function taoNghiKyThuat(kyThuatId: string, ngay: string, lyDo?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff(); if (!(await coQuyen('cs.ky_thuat.xep_lich', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  if (!kyThuatId) return { ok: false, error: 'Chọn kỹ thuật.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) return { ok: false, error: 'Ngày không hợp lệ.' }
  const { error } = await dataClient().from('ky_thuat_nghi')
    .upsert({ ky_thuat_id: kyThuatId, ngay, ly_do: lyDo?.trim() || null }, { onConflict: 'ky_thuat_id,ngay' })
  if (error) return { ok: false, error: error.message }
  await ghiAudit('nghi_ky_thuat', `ky-thuat:${kyThuatId}`, { ngay })
  revalidatePath('/ky-thuat'); return { ok: true }
}

export async function xoaNghiKyThuat(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff(); if (!(await coQuyen('cs.ky_thuat.xep_lich', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  const { error } = await dataClient().from('ky_thuat_nghi').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/ky-thuat'); return { ok: true }
}

export type TuanKyThuat = { chuyen: LichKyThuatRow[]; nghi: NghiKyThuat[]; tu: string; den: string }

/** Lịch TUẦN (T2-CN chứa `ngay`) của 1 kỹ thuật: chuyến + nghỉ phép — để tránh gán trùng. */
export async function lichTuanKyThuat(kyThuatId: string, ngay: string): Promise<TuanKyThuat> {
  await requireStaff()
  await doQuyen('cs.ky_thuat.xep_lich')
  if (!kyThuatId || !/^\d{4}-\d{2}-\d{2}$/.test(ngay)) return { chuyen: [], nghi: [], tu: ngay, den: ngay }
  const d = new Date(ngay + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7  // Thứ 2 = 0
  const tu = new Date(d.getTime() - dow * 86400000).toISOString().slice(0, 10)
  const den = new Date(new Date(tu + 'T00:00:00Z').getTime() + 6 * 86400000).toISOString().slice(0, 10)
  const chuyen = await dsLichKyThuat(tu, den, kyThuatId)
  const { data: nghi } = await dataClient().from('ky_thuat_nghi')
    .select('id, ngay, ly_do').eq('ky_thuat_id', kyThuatId).gte('ngay', tu).lte('ngay', den).order('ngay')
  return { chuyen, nghi: (nghi ?? []) as NghiKyThuat[], tu, den }
}

/** Lịch sử thay lõi của 1 máy — hiện ở trang chi tiết máy. */
export async function replacementsOfSerial(serial: string) {
  await requireStaff()
  await doQuyen('cs.may.thay_loi')
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
  await doQuyen('cs.may.thay_loi')
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
  await doQuyen('cs.may.thay_loi')
  // Xoá lịch thay lõi CẦN ADMIN DUYỆT: admin xoá ngay, CS -> hàng chờ.
  return guiYeuCauThayDoi({
    doi_tuong: 'filter_replacement', ban_ghi_id: id, loai: 'xoa',
    ly_do: `Lịch thay lõi của máy ${serial}`,
  })
}

/** Sửa 1 dòng lịch thay lõi — CẦN ADMIN DUYỆT (admin sửa ngay, CS -> hàng chờ). */
export async function suaReplacement(
  id: string, patch: { filter_code?: string; replaced_at?: string; note?: string }
) {
  await requireStaff()
  await doQuyen('cs.may.thay_loi')
  if (patch.replaced_at && !/^\d{4}-\d{2}-\d{2}$/.test(patch.replaced_at)) {
    return { ok: false as const, error: 'Ngày không hợp lệ.' }
  }
  return guiYeuCauThayDoi({ doi_tuong: 'filter_replacement', ban_ghi_id: id, loai: 'sua', payload: { ...patch } })
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
  tuyChon: TuyChonDanhSach & { loaiTicket?: string; ngtu?: string; ngden?: string } = {}
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
  // Miền phụ trách: NV thường chỉ thấy ticket CỦA MÌNH + ticket CHƯA gán (để nhận
  // việc). Quản lý/admin thấy hết. (mineStaffId ở trên là bộ lọc opt-in, độc lập.)
  if (!(await coQuyen('cs.ticket.xem_tat_ca', 'QUANLY'))) {
    const me = await layNhanVien()
    const id = me?.id ?? '00000000-0000-0000-0000-000000000000'
    truyVan = truyVan.or(`cs_phu_trach.is.null,cs_phu_trach.eq.${id},ky_thuat.eq.${id}`)
  }
  // Danh sách chọn ở giao diện sinh từ ticketTypes() (dữ liệu thật) nên giá trị luôn
  // hợp lệ; vẫn .eq() thẳng (không whitelist tĩnh) vì loại ticket là dữ liệu mở, không
  // cố định như cột sắp xếp.
  if (tuyChon.loaiTicket) truyVan = truyVan.eq('ticket_type', tuyChon.loaiTicket)
  // Lọc theo ngày tạo (created_at là timestamp → 'đến ngày' phải ôm hết trong ngày).
  const { tu: tkTu, den: tkDen } = docLocNgay(tuyChon)
  if (tkTu) truyVan = truyVan.gte('created_at', tkTu)
  if (tkDen) truyVan = truyVan.lte('created_at', tkDen + 'T23:59:59.999')

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
  await doQuyen('cs.ticket.xem')
  const { data, error } = await dataClient()
    .from('v_tickets').select('*').eq('serial', serial)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Ticket[]
}

/** Ticket của 1 khách — dùng ở trang khách. */
export async function ticketsOfCustomer(customerId: string): Promise<Ticket[]> {
  await requireStaff()
  await doQuyen('cs.khach.xem')
  const { data, error } = await dataClient()
    .from('v_tickets').select('*').eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Ticket[]
}

export async function getTicket(code: string): Promise<Ticket | null> {
  await requireStaff()
  await doQuyen('cs.ticket.xem')
  const { data, error } = await dataClient()
    .from('v_tickets').select('*').eq('ticket_code', code).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Ticket) ?? null
}

/**
 * "Nhận việc": gán ticket CHƯA có người cho chính mình (cs_phu_trach = tôi).
 * Chỉ nhận ticket đang trống hoặc đã là của mình — không giành ticket người khác
 * (muốn đổi người thì dùng ô Phụ trách trong ticket, hoặc quản lý phân công).
 */
export async function nhanTicket(code: string) {
  await requireStaff()
  await doQuyen('cs.ticket.tao_sua')
  const me = await layNhanVien()
  if (!me) return { ok: false as const, error: KHONG_DU_QUYEN }
  const db = dataClient()
  const { data: t, error: e0 } = await db.from('tickets').select('cs_phu_trach').eq('ticket_code', code).maybeSingle()
  if (e0) return { ok: false as const, error: e0.message }
  if (!t) return { ok: false as const, error: 'Không thấy ticket.' }
  const cur = (t as { cs_phu_trach: string | null }).cs_phu_trach
  if (cur && cur !== me.id) return { ok: false as const, error: 'Ticket đã có người khác phụ trách.' }
  const { error } = await db.from('tickets').update({ cs_phu_trach: me.id }).eq('ticket_code', code)
  if (error) return { ok: false as const, error: error.message }
  await ghiAudit('nhan_ticket', `ticket:${code}`)
  revalidatePath(`/ticket/${code}`); revalidatePath('/ticket')
  return { ok: true as const }
}

/** Đổi trạng thái / cờ Khẩn / ghi chú tóm tắt / người phụ trách. */
export async function updateTicket(
  code: string,
  patch: {
    state?: string; last_note?: string; khan?: boolean
    cs_phu_trach?: string | null; ky_thuat?: string | null
    ticket_type?: string; description?: string
  }
) {
  await requireStaff()
  await doQuyen('cs.ticket.tao_sua')
  if (patch.state && !['Open', 'Done', 'Cancel'].includes(patch.state)) {
    return { ok: false as const, error: 'Trạng thái không hợp lệ.' }
  }
  if (patch.ticket_type !== undefined && !patch.ticket_type.trim()) {
    return { ok: false as const, error: 'Phân loại không được trống.' }
  }
  if (patch.description !== undefined && !patch.description.trim()) {
    return { ok: false as const, error: 'Mô tả không được trống.' }
  }
  const p = { ...patch }
  if (p.ticket_type !== undefined) p.ticket_type = p.ticket_type.trim()
  if (p.description !== undefined) p.description = p.description.trim()
  const { error } = await dataClient().from('tickets').update(p).eq('ticket_code', code)
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
  await doQuyen('cs.ticket.xem')
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
  await doQuyen('cs.ticket.tao_sua')
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
  await doQuyen('cs.ticket.tao_sua')
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
  await doQuyen('cs.ticket.tao_sua')
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
  await doQuyen('cs.bao_cao.doanh_so')
  const { data, error } = await dataClient()
    .from('v_doanh_so_cskh').select('*').order('thang', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as DoanhSo[]
}

/** Máy 1 khách đã lắp — dùng ở trang khách. */
export async function machinesOfCustomer(customerId: string): Promise<Machine[]> {
  await requireStaff()
  await doQuyen('cs.khach.xem')
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
  trang_thai: string | null
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
async function truyVanSerial(q: string, limit: number, tu = 0, tt?: string) {
  await requireStaff()
  await doQuyen('cs.may.xem')
  let query = dataClient()
    .from('serial_registry')
    .select('serial, code, model, internal_code, ma_quoc_te, ten_noi_bo, po, trang_thai', { count: 'exact' })
  const term = q.trim()
  if (term) {
    const safe = term.replace(/[%_]/g, (c) => '\\' + c)
    query = query.or(
      `serial.ilike.%${safe}%,internal_code.ilike.%${safe}%,model.ilike.%${safe}%,` +
        `ma_quoc_te.ilike.%${safe}%,ten_noi_bo.ilike.%${safe}%`
    )
  }
  if (tt && tt.trim()) query = query.eq('trang_thai', tt.trim())
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
  tuyChon: TuyChonDanhSach = {},
  tt?: string
): Promise<KetQuaTrang<SerialRow>> {
  const trang = Math.max(1, tuyChon.trang ?? 1)
  const moi = tuyChon.moiTrang ?? MOI_TRANG
  const { rows, tong } = await truyVanSerial(q, moi, (trang - 1) * moi, tt)
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
  await doQuyen('cs.may.xem')
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
  await doQuyen('cs.serial.duyet')
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
  await doQuyen('cs.serial.kho')
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
  if (!(await coQuyen('cs.serial.duyet', 'QUANLY'))) return { ok: false as const, error: KHONG_DU_QUYEN }
  const { error } = await dataClient().rpc('duyet_serial_pending', { p_id: id, p_admin: user.email ?? '' })
  if (error) return { ok: false as const, error: error.message }
  await ghiAudit('duyet_serial', `serial-pending:${id}`)
  revalidatePath('/serial')
  return { ok: true as const }
}

/** Từ chối serial pending (CHỈ ADMIN). */
export async function rejectSerial(id: string, lyDo?: string) {
  await requireStaff()
  if (!(await coQuyen('cs.serial.duyet', 'QUANLY'))) return { ok: false as const, error: KHONG_DU_QUYEN }
  const { error } = await dataClient().from('serial_pending')
    .update({ trang_thai: 'tu_choi', ly_do_tu_choi: lyDo?.trim() || null }).eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  await ghiAudit('tu_choi_serial', `serial-pending:${id}`, lyDo?.trim() ? { ly_do: lyDo.trim() } : undefined)
  revalidatePath('/serial')
  return { ok: true as const }
}

/** Xoá hẳn 1 serial pending (CHỈ ADMIN — theo quy tắc xoá cần quyền cao). */
export async function deleteSerialPending(id: string) {
  await requireStaff()
  if (!(await coQuyen('cs.serial.duyet', 'QUANLY'))) return { ok: false as const, error: KHONG_DU_QUYEN }
  const { error } = await dataClient().from('serial_pending').delete().eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  await ghiAudit('xoa_serial_pending', `serial-pending:${id}`)
  revalidatePath('/serial')
  return { ok: true as const }
}

// ── Nhập kho serial: tạo thẳng + import lô (CHỈ ADMIN) ───────────────────────
export type CatalogChon = { internal_code: string; ten: string | null; danh_muc: string | null }

/** Danh mục sản phẩm (catalog_item) cho ô chọn khi tạo/nhập serial. */
export async function catalogChon(): Promise<CatalogChon[]> {
  await requireStaff()
  await doQuyen('cs.may.xem')
  const { data, error } = await dataClient()
    .from('catalog_item')
    .select('"Mã nội bộ","Tên ngắn gọn (đề xuất)","Danh mục cấp 2"')
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Record<string, string | null>[]
  const theo = new Map<string, CatalogChon>()
  for (const r of rows) {
    const ic = (r['Mã nội bộ'] ?? '').trim()
    if (!ic || theo.has(ic)) continue
    theo.set(ic, { internal_code: ic, ten: r['Tên ngắn gọn (đề xuất)'], danh_muc: r['Danh mục cấp 2'] })
  }
  return [...theo.values()].sort((a, b) =>
    (a.ten ?? a.internal_code).localeCompare(b.ten ?? b.internal_code, 'vi'))
}

/** Thông tin phụ của 1 mã nội bộ để điền kèm khi ghi serial_registry. */
async function thongTinCatalog(internalCode: string): Promise<{ ten: string | null } | null> {
  await requireStaff()
  await doQuyen('cs.may.xem')
  if (!internalCode) return null
  const { data } = await dataClient()
    .from('catalog_item')
    .select('"Tên ngắn gọn (đề xuất)"')
    .eq('Mã nội bộ', internalCode)
    .limit(1)
    .maybeSingle()
  if (!data) return null
  return { ten: (data as Record<string, string | null>)['Tên ngắn gọn (đề xuất)'] }
}

/** Tạo THẲNG 1 serial vào kho (CHỈ ADMIN) — không qua hàng chờ. */
export async function themSerialKho(input: {
  serial: string; internal_code: string; ma_quoc_te?: string; model?: string; ghi_chu?: string
}) {
  await requireStaff()
  if (!(await coQuyen('cs.serial.kho', 'QUANLY'))) return { ok: false as const, error: KHONG_DU_QUYEN }
  const serial = input.serial?.trim()
  const ic = input.internal_code?.trim()
  if (!serial) return { ok: false as const, error: 'Nhập serial.' }
  if (!ic) return { ok: false as const, error: 'Chọn sản phẩm (mã nội bộ).' }
  const db = dataClient()
  const { data: co } = await db.from('serial_registry').select('serial').eq('serial', serial).maybeSingle()
  if (co) return { ok: false as const, error: 'Serial này đã có trong kho.' }
  const tt = await thongTinCatalog(ic)
  const { error } = await db.from('serial_registry').insert({
    serial,
    code: ic,
    internal_code: ic,
    ten_noi_bo: tt?.ten ?? null,
    ma_quoc_te: input.ma_quoc_te?.trim() || null,
    model: input.model?.trim() || null,
    po: 'CSKH-app',
    source_file: 'CSKH-app-tao',
    imported_at: new Date().toISOString(),
  })
  if (error) return { ok: false as const, error: error.message }
  await ghiAudit('them_serial_kho', `serial:${serial}`, { internal_code: ic })
  revalidatePath('/serial')
  return { ok: true as const }
}

export type KetQuaNhapLo = {
  tong: number
  them: number
  boQua: { serial: string; ly_do: string }[]
}

/**
 * Import LÔ serial vào kho (CHỈ ADMIN). Nhận bảng dòng {serial, po?, ngay?} (dán từ
 * Excel) + 1 mã nội bộ chung. PO -> cột po; ngay -> imported_at (thiếu thì lấy nay).
 * Chỉ nhận mã MỚI: bỏ qua trùng-kho / trùng-chờ-duyệt / trùng-trong-lô. Trả về số
 * thành công + danh sách bỏ qua kèm lý do.
 */
export async function nhapSerialBang(input: {
  dong: DongNhapSerial[]; internal_code: string; ma_quoc_te?: string
}): Promise<{ ok: true; kq: KetQuaNhapLo } | { ok: false; error: string }> {
  await requireStaff()
  if (!(await coQuyen('cs.serial.kho', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  const ic = input.internal_code?.trim()
  if (!ic) return { ok: false, error: 'Chọn sản phẩm (mã nội bộ) cho cả lô.' }

  const boQua: { serial: string; ly_do: string }[] = []
  const daGap = new Set<string>()
  const sach: DongNhapSerial[] = []
  let tong = 0
  for (const d of input.dong ?? []) {
    const s = (d.serial ?? '').trim()
    if (!s) continue
    tong++
    if (daGap.has(s)) { boQua.push({ serial: s, ly_do: 'trùng trong danh sách' }); continue }
    daGap.add(s)
    sach.push({ serial: s, po: d.po?.trim() || null, ngay: d.ngay || null })
  }
  if (!sach.length) return { ok: false, error: 'Không có serial hợp lệ trong danh sách.' }

  const db = dataClient()
  const serials = sach.map((d) => d.serial)
  // Đã có trong kho? (chia lô 200 cho .in an toàn)
  const daCo = new Set<string>()
  for (let i = 0; i < serials.length; i += 200) {
    const { data, error } = await db.from('serial_registry').select('serial').in('serial', serials.slice(i, i + 200))
    if (error) return { ok: false, error: error.message }
    for (const r of (data ?? []) as { serial: string }[]) daCo.add(r.serial)
  }
  // Đang chờ duyệt?
  const dangCho = new Set<string>()
  for (let i = 0; i < serials.length; i += 200) {
    const { data, error } = await db.from('serial_pending')
      .select('serial').eq('trang_thai', 'cho_duyet').in('serial', serials.slice(i, i + 200))
    if (error) return { ok: false, error: error.message }
    for (const r of (data ?? []) as { serial: string }[]) dangCho.add(r.serial)
  }

  const tt = await thongTinCatalog(ic)
  const nay = new Date().toISOString()
  const canThem = sach.filter((d) => {
    if (daCo.has(d.serial)) { boQua.push({ serial: d.serial, ly_do: 'đã có trong kho' }); return false }
    if (dangCho.has(d.serial)) { boQua.push({ serial: d.serial, ly_do: 'đang chờ duyệt' }); return false }
    return true
  })

  let them = 0
  for (let i = 0; i < canThem.length; i += 500) {
    const lo = canThem.slice(i, i + 500)
    const { error } = await db.from('serial_registry').insert(lo.map((d) => ({
      serial: d.serial, code: ic, internal_code: ic, ten_noi_bo: tt?.ten ?? null,
      ma_quoc_te: input.ma_quoc_te?.trim() || null,
      po: d.po ?? 'CSKH-app', source_file: 'CSKH-app-import',
      imported_at: d.ngay ? `${d.ngay}T00:00:00Z` : nay,
    })))
    if (error) return { ok: false, error: error.message }
    them += lo.length
  }
  await ghiAudit('nhap_serial_lo', 'serial_registry', { internal_code: ic, tong, them, bo_qua: boQua.length })
  revalidatePath('/serial')
  return { ok: true, kq: { tong, them, boQua } }
}

// ── Lắp bộ combo (E1): sinh mã bộ + mẹ/con + kích hoạt BH từng con ───────────
export type LinhKienCombo = { internal_code: string; ten: string | null; so_luong: number }

/** Danh sách combo cho ô chọn (đợt đầu chỉ WH15A/WH30A). */
export async function comboChon(): Promise<{ combo: string; ten: string | null }[]> {
  await requireStaff()
  await doQuyen('cs.may.xem')
  const { data } = await dataClient()
    .from('product_bundle')
    .select('"Mã thành phẩm","Tên thành phẩm"')
    .in('Mã thành phẩm', MA_COMBO as unknown as string[])
  const rows = (data ?? []) as Record<string, string | null>[]
  const theo = new Map<string, string | null>()
  for (const r of rows) {
    const c = (r['Mã thành phẩm'] ?? '').trim()
    if (c && !theo.has(c)) theo.set(c, r['Tên thành phẩm'])
  }
  return (MA_COMBO as readonly string[])
    .filter((c) => theo.has(c))
    .map((combo) => ({ combo, ten: theo.get(combo) ?? null }))
}

/** Linh kiện THIẾT BỊ của 1 combo (bỏ lõi PP/PAC — không kích hoạt BH). Kèm số lượng
 *  (ECO có 2× UPF10 -> cần 2 serial). */
export async function linhKienCombo(combo: string): Promise<LinhKienCombo[]> {
  await requireStaff()
  await doQuyen('cs.may.xem')
  if (!(MA_COMBO as readonly string[]).includes(combo)) return []
  const { data, error } = await dataClient()
    .from('product_bundle')
    .select('"Mã thành phần","Tên thành phần","Số lượng"')
    .eq('Mã thành phẩm', combo)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Record<string, string | null>[]
  const theo = new Map<string, { ten: string | null; sl: number }>()
  for (const r of rows) {
    const ic = (r['Mã thành phần'] ?? '').trim()
    // Lõi PP/PAC (LX-PP-*, LX-PAC-*) là vật tư tiêu hao — không tạo dòng, không BH.
    if (!ic || /^LX-(PP|PAC)/i.test(ic)) continue
    const sl = Math.max(1, Math.round(Number(r['Số lượng']) || 1))
    const cu = theo.get(ic)
    if (cu) cu.sl += sl
    else theo.set(ic, { ten: r['Tên thành phần'], sl })
  }
  return [...theo.entries()].map(([internal_code, v]) => ({ internal_code, ten: v.ten, so_luong: v.sl }))
}

/**
 * Lắp bộ combo cho 1 khách. Quyền NGANG với lắp máy lẻ (dangKyBaoHanh): mọi
 * nhân viên CS làm được — lắp bộ chỉ là lắp nhiều máy một lượt, không phải
 * thao tác nhạy cảm. Gọi RPC nguyên tử lap_bo_combo: sinh mã bộ mới + tạo mẹ
 * (nhóm) và con (thiết bị) + kích hoạt BH TỪNG con.
 */
export async function lapBoCombo(input: {
  combo: string
  customer_id: string
  install_date: string
  install_address?: string
  serials: { internal_code: string; serial: string }[]
}): Promise<{ ok: true; ma_bo: string } | { ok: false; error: string }> {
  await requireStaff()
  await doQuyen('cs.may.kich_hoat_bh')
  if (!(MA_COMBO as readonly string[]).includes(input.combo))
    return { ok: false, error: 'Combo không hợp lệ.' }
  if (!input.customer_id) return { ok: false, error: 'Chọn khách.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.install_date)) return { ok: false, error: 'Ngày không hợp lệ.' }
  const dv = (input.serials ?? []).filter((s) => s.serial?.trim())
  if (!dv.length) return { ok: false, error: 'Chọn serial cho các thiết bị.' }
  const set = new Set(dv.map((s) => s.serial.trim()))
  if (set.size !== dv.length) return { ok: false, error: 'Serial thiết bị bị trùng nhau.' }

  const { data, error } = await dataClient().rpc('lap_bo_combo', {
    p_combo: input.combo,
    p_customer: input.customer_id,
    p_install_date: input.install_date,
    p_install_address: input.install_address?.trim() || null,
    p_serials: dv.map((s) => ({ internal_code: s.internal_code, serial: s.serial.trim() })),
  })
  if (error) return { ok: false, error: error.message }
  const maBo = data as string
  await ghiAudit('lap_bo_combo', `bo:${maBo}`, {
    combo: input.combo, customer_id: input.customer_id, so_thiet_bi: dv.length,
  })
  revalidatePath('/')
  revalidatePath(`/khach/${input.customer_id}`)
  return { ok: true, ma_bo: maBo }
}

// ── Kênh/đối tác (đại lý/KTS/KOL) — dùng dim_channel của Sales, CS chỉ ĐỌC + GÁN (D2) ──
export type Kenh = { id: number; channel_l1: string; channel_l2: string | null; so_khach?: number }

/** Danh sách kênh (dim_channel) + số khách CSKH đang gắn — cho trang /kenh. */
export async function listKenh(): Promise<Kenh[]> {
  await requireStaff()
  await doQuyen('he_thong.kenh')
  const db = dataClient()
  const { data, error } = await db.from('dim_channel')
    .select('id, channel_l1, channel_l2, sort_order').order('channel_l1').order('sort_order').order('channel_l2')
  if (error) throw new Error(error.message)
  const ds = (data ?? []) as (Kenh & { sort_order: number })[]
  const { data: kh } = await db.from('cs_customers').select('channel_id').not('channel_id', 'is', null)
  const dem = new Map<number, number>()
  for (const r of (kh ?? []) as { channel_id: number }[]) dem.set(r.channel_id, (dem.get(r.channel_id) ?? 0) + 1)
  return ds.map((d) => ({ id: d.id, channel_l1: d.channel_l1, channel_l2: d.channel_l2, so_khach: dem.get(d.id) ?? 0 }))
}

/** Danh sách kênh gọn cho ô chọn (gắn khách). */
export async function kenhChon(): Promise<Kenh[]> {
  await requireStaff()
  await doQuyen('he_thong.kenh')
  const { data, error } = await dataClient().from('dim_channel')
    .select('id, channel_l1, channel_l2, sort_order').order('channel_l1').order('sort_order').order('channel_l2')
  if (error) throw new Error(error.message)
  return (data ?? []).map((d) => {
    const r = d as { id: number; channel_l1: string; channel_l2: string | null }
    return { id: r.id, channel_l1: r.channel_l1, channel_l2: r.channel_l2 }
  })
}

/** Gắn / gỡ khách vào 1 kênh (nhân viên làm được). Taxonomy kênh do Sales quản. */
export async function ganKenh(customerId: string, channelId: number | null) {
  await requireStaff()
  await doQuyen('he_thong.kenh')
  if (!customerId) return { ok: false as const, error: 'Thiếu khách.' }
  const { error } = await dataClient().from('cs_customers')
    .update({ channel_id: channelId ?? null, updated_at: new Date().toISOString() }).eq('id', customerId)
  if (error) return { ok: false as const, error: error.message }
  await ghiAudit('gan_kenh', `khach:${customerId}`, { channel_id: channelId })
  revalidatePath('/kenh')
  revalidatePath(`/khach/${customerId}`)
  return { ok: true as const }
}

// ── Vòng đời máy (A): trạng thái serial + nhật ký sự kiện ────────────────────
export type SuDungSerial = {
  id: string; serial: string; su_kien: string; tu_trang_thai: string | null
  den_trang_thai: string | null; customer_id: string | null; ghi_chu: string | null
  boi: string | null; luc: string
}

/** Ghi 1 sự kiện vòng đời + (tuỳ) cập nhật serial_registry.trang_thai. Gọi SAU thao tác chính.
 *  `luc` (YYYY-MM-DD) cho phép ghi mốc ngày CŨ khi backfill dữ liệu; bỏ trống -> now(). */
async function ghiSuDung(
  db: ReturnType<typeof dataClient>,
  input: { serial: string; su_kien: string; tu?: string | null; den?: string | null; customer_id?: string | null; ghi_chu?: string | null; luc?: string | null }
) {
  await requireStaff()
  await doQuyen('cs.may.thay_loi')
  const nv = await layNhanVien()
  try {
    await db.from('serial_su_dung').insert({
      serial: input.serial, su_kien: input.su_kien,
      tu_trang_thai: input.tu ?? null, den_trang_thai: input.den ?? null,
      customer_id: input.customer_id ?? null, ghi_chu: input.ghi_chu ?? null, boi: nv?.email ?? null,
      ...(input.luc ? { luc: input.luc } : {}),
    })
    if (input.den) await db.from('serial_registry').update({ trang_thai: input.den }).eq('serial', input.serial)
  } catch {
    // nhật ký vòng đời hỏng không được chặn nghiệp vụ chính
  }
}

/** Trạng thái hiện tại + timeline vòng đời của 1 serial (cho trang máy). */
export async function lichSuSerial(serial: string): Promise<{ trang_thai: string | null; su_kien: SuDungSerial[] }> {
  await requireStaff()
  await doQuyen('cs.may.xem')
  const db = dataClient()
  const [{ data: sr }, { data: sk }] = await Promise.all([
    db.from('serial_registry').select('trang_thai').eq('serial', serial).maybeSingle(),
    db.from('serial_su_dung').select('*').eq('serial', serial).order('luc', { ascending: false }),
  ])
  return {
    trang_thai: (sr as { trang_thai: string } | null)?.trang_thai ?? null,
    su_kien: (sk ?? []) as SuDungSerial[],
  }
}

/** Đặt trạng thái KHO cho serial chưa gắn khách (trưng bày/mkt/bảo trì/thanh lý/về kho).
 *  CHỈ ADMIN. BẮT BUỘC mô tả hiện trạng máy (lưu vào nhật ký vòng đời). Trạng thái hợp lệ
 *  lấy từ bảng cấu hình serial_trang_thai (cho_dat_tay + hoat_dong). */
export async function datTrangThaiSerial(serial: string, den: string, ghiChu?: string, ngay?: string) {
  await requireStaff()
  if (!(await coQuyen('cs.serial.kho', 'QUANLY'))) return { ok: false as const, error: KHONG_DU_QUYEN }
  const moTa = ghiChu?.trim()
  if (!moTa) return { ok: false as const, error: 'Cần ghi mô tả hiện trạng máy khi đổi trạng thái.' }
  const luc = ngay?.trim()
  if (luc && !/^\d{4}-\d{2}-\d{2}$/.test(luc)) return { ok: false as const, error: 'Ngày không hợp lệ (YYYY-MM-DD).' }
  const db = dataClient()
  const { data: hopLe } = await db.from('serial_trang_thai').select('code')
    .eq('code', den).eq('cho_dat_tay', true).eq('hoat_dong', true).maybeSingle()
  if (!hopLe) return { ok: false as const, error: 'Trạng thái không hợp lệ hoặc đã ngừng dùng.' }
  const { data: sr } = await db.from('serial_registry').select('trang_thai').eq('serial', serial).maybeSingle()
  if (!sr) return { ok: false as const, error: 'Serial không có trong kho.' }
  const { data: ib } = await db.from('installed_base').select('serial').eq('serial', serial).eq('status', 'active').maybeSingle()
  if (ib) return { ok: false as const, error: 'Máy đang lắp cho khách — thu hồi trước khi đổi trạng thái kho.' }
  const cu = (sr as { trang_thai: string }).trang_thai
  await ghiSuDung(db, { serial, su_kien: `dat_${den}`, tu: cu, den, ghi_chu: moTa, luc: luc || null })
  await ghiAudit('dat_trang_thai_serial', `serial:${serial}`, { tu: cu, den, ngay: luc ?? 'nay' })
  revalidatePath(`/may/${encodeURIComponent(serial)}`)
  revalidatePath('/serial')
  return { ok: true as const }
}

/**
 * Lắp máy KHO cho khách (máy đang ở kho: trưng bày/thu hồi/tồn kho…) → gắn khách + thành
 * "Đã lắp", hiện ở "Máy đã lắp". `kichBH=false` cho ca LẮP NỘI BỘ (không kích hoạt bảo
 * hành). `ngay` cho phép backfill mốc lắp cũ. CHỈ ADMIN.
 */
export async function lapMayChoKhach(
  serial: string, customerId: string, ngay: string, kichBH: boolean, ghiChu?: string, diaChi?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff()
  if (!(await coQuyen('cs.may.lap_thu_doi', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  const s = serial?.trim()
  if (!s) return { ok: false, error: 'Thiếu serial.' }
  if (!customerId) return { ok: false, error: 'Chọn khách.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) return { ok: false, error: 'Ngày lắp không hợp lệ (YYYY-MM-DD).' }
  const db = dataClient()
  const { data: dangCo } = await db.from('installed_base').select('customer_id, status').eq('serial', s).maybeSingle()
  const chu = (dangCo as { customer_id: string | null; status: string | null } | null)
  if (chu?.customer_id && chu.customer_id !== customerId && chu.status === 'active')
    return { ok: false, error: 'Serial đang lắp cho khách khác — gỡ khỏi khách cũ trước.' }
  const { data: sr } = await db.from('serial_registry').select('internal_code, model, trang_thai').eq('serial', s).maybeSingle()
  const r = sr as { internal_code: string | null; model: string | null; trang_thai: string | null } | null
  if (!r) return { ok: false, error: `Serial ${s} không có trong kho.` }
  // Nếu kích BH: chỉ cho MÁY (giống dangKyBaoHanh).
  if (kichBH && r.internal_code) {
    const { data: cat } = await db.from('catalog_item').select('"Danh mục cấp 1"').eq('Mã nội bộ', r.internal_code).limit(1).maybeSingle()
    const dm1 = (cat as Record<string, string | null> | null)?.['Danh mục cấp 1']
    if (dm1 && dm1 !== 'Machines') return { ok: false, error: `Mã "${r.internal_code}" là lõi/vật tư — không kích hoạt BH. Bỏ tick BH nếu lắp nội bộ.` }
  }
  const { error: e1 } = await db.from('installed_base').upsert({
    serial: s, internal_code: r.internal_code, model_freetext: r.model,
    customer_id: customerId, install_date: ngay, install_address: diaChi?.trim() || null,
    channel_source: kichBH ? 'CSKH lắp' : 'CSKH lắp nội bộ', status: 'active',
  }, { onConflict: 'serial' })
  if (e1) return { ok: false, error: e1.message }
  if (kichBH) {
    const { error: e2 } = await db.rpc('activate_warranty', { p_serial: s, p_start: ngay })
    if (e2) return { ok: false, error: e2.message }
  }
  await ghiSuDung(db, {
    serial: s, su_kien: 'lap_dat', tu: r.trang_thai, den: 'da_lap', customer_id: customerId,
    ghi_chu: kichBH ? (ghiChu || 'Lắp cho khách') : `Lắp nội bộ (không BH). ${ghiChu ?? ''}`.trim(), luc: ngay,
  })
  await ghiAudit('lap_may_cho_khach', `serial:${s}`, { customer_id: customerId, ngay, kich_bh: kichBH })
  revalidatePath('/'); revalidatePath('/serial')
  revalidatePath(`/may/${encodeURIComponent(s)}`); revalidatePath(`/khach/${customerId}`)
  return { ok: true }
}

/**
 * Cập nhật SỐ LẦN bảo trì THỰC của 1 plan = tặng + mua thêm (không cứng theo hợp đồng gốc).
 * Nếu số lần MỚI > số lượt đang có -> tự NỐI THÊM lượt theo chu kỳ (tiếp mốc cuối, né cuối
 * tuần). Nếu nhỏ hơn -> chỉ đổi mẫu số (không xoá lượt đã có/đã làm). CHỈ QUẢN LÝ.
 */
export async function datSoLanBaoTri(
  planId: string, tongLan: number
): Promise<{ ok: true; them: number } | { ok: false; error: string }> {
  await requireStaff()
  if (!(await coQuyen('cs.bao_tri.tao_plan', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  const soMoi = Math.floor(tongLan)
  if (!soMoi || soMoi < 1) return { ok: false, error: 'Số lần phải ≥ 1.' }
  const db = dataClient()
  const { data: plan } = await db.from('maintenance_plan')
    .select('customer_id, chu_ky_thang, vung').eq('id', planId).maybeSingle()
  const p = plan as { customer_id: string | null; chu_ky_thang: number | null; vung: Vung | null } | null
  if (!p) return { ok: false, error: 'Không thấy plan.' }
  const { data: vs } = await db.from('maintenance_visit')
    .select('lan_thu, due_date').eq('plan_id', planId).order('lan_thu', { ascending: false })
  const visits = (vs ?? []) as { lan_thu: number | null; due_date: string | null }[]
  const lanMax = visits.reduce((m, v) => Math.max(m, v.lan_thu ?? 0), 0)
  const dueCuoi = visits.find((v) => v.due_date)?.due_date ?? null

  let them = 0
  if (soMoi > lanMax && dueCuoi && (p.chu_ky_thang ?? 0) > 0) {
    const { data: kh } = await db.from('cs_customers').select('province').eq('id', p.customer_id ?? '').maybeSingle()
    const vung: Vung = p.vung ?? vungTheoTinh((kh as { province: string | null } | null)?.province ?? null)
    // sinh (soMoi-lanMax) mốc TIẾP THEO dueCuoi (bỏ mốc đầu = dueCuoi).
    const dsNgay = sinhLichBaoTri(dueCuoi, p.chu_ky_thang, soMoi - lanMax + 1, vung).slice(1)
    const rows = dsNgay.map((d, i) => ({ plan_id: planId, lan_thu: lanMax + 1 + i, due_date: d, ten_task: `Bảo trì lần ${lanMax + 1 + i}` }))
    if (rows.length) {
      const { error } = await db.from('maintenance_visit').insert(rows)
      if (error) return { ok: false, error: error.message }
      them = rows.length
    }
  }
  const { error } = await db.from('maintenance_plan')
    .update({ tong_lan: soMoi, updated_at: new Date().toISOString() }).eq('id', planId)
  if (error) return { ok: false, error: error.message }
  await ghiAudit('dat_so_lan_bao_tri', `plan:${planId}`, { tong_lan: soMoi, them })
  revalidatePath('/bao-tri')
  return { ok: true, them }
}

/** Sửa MỐC NGÀY (và mô tả) của 1 sự kiện vòng đời đã ghi — để chỉnh mốc lịch sử. CHỈ ADMIN. */
export async function suaSuKien(id: string, ngay: string, ghiChu?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff()
  // Sửa NGÀY của một sự kiện vòng đời serial (serial_su_dung) — cùng họ với
  // datTrangThaiSerial, nên quyền phải là cs.serial.kho.
  //
  // Trước đây gán nhầm sang cs.bao_tri.tao_plan (di sản đợt phân loại bằng grep,
  // không đọc thân hàm). Hậu quả nếu để nguyên: người chỉ được "tạo plan bảo trì"
  // lại sửa được ngày vòng đời máy, còn người phụ trách kho serial thì không.
  // Luật cũ hai bên đều là QUANLY nên hành vi HÔM NAY không đổi.
  if (!(await coQuyen('cs.serial.kho', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) return { ok: false, error: 'Ngày không hợp lệ (YYYY-MM-DD).' }
  const db = dataClient()
  const { data: ev } = await db.from('serial_su_dung').select('serial').eq('id', id).maybeSingle()
  if (!ev) return { ok: false, error: 'Không thấy sự kiện.' }
  const patch: Record<string, string> = { luc: ngay }
  if (ghiChu !== undefined) patch.ghi_chu = ghiChu.trim()
  const { error } = await db.from('serial_su_dung').update(patch).eq('id', id)
  if (error) return { ok: false, error: error.message }
  await ghiAudit('sua_su_kien_vong_doi', `su-kien:${id}`, { ngay })
  revalidatePath(`/may/${encodeURIComponent((ev as { serial: string }).serial)}`)
  return { ok: true }
}

/**
 * Thu hồi máy khỏi khách (đổi máy mới cho khách): gỡ khách khỏi máy cũ, chuyển sang
 * trạng thái "bảo trì" (không xoá — giữ ticket/lịch sử). Sau đó đăng ký máy MỚI cho
 * khách qua luồng Đăng ký BH bình thường. CHỈ ADMIN.
 */
export async function thuHoiMay(serial: string, ghiChu?: string) {
  await requireStaff()
  if (!(await coQuyen('cs.may.lap_thu_doi', 'QUANLY'))) return { ok: false as const, error: KHONG_DU_QUYEN }
  const db = dataClient()
  const { data: ib } = await db.from('installed_base').select('customer_id, parent_serial').eq('serial', serial).maybeSingle()
  if (!ib) return { ok: false as const, error: 'Máy này không ở trạng thái đã lắp.' }
  // Không thu hồi máy đang là MẸ của một bộ (gỡ con trước).
  const { count } = await db.from('installed_base').select('serial', { count: 'exact', head: true }).eq('parent_serial', serial)
  if ((count ?? 0) > 0) return { ok: false as const, error: `Máy là bộ MẸ của ${count} thiết bị con — xử lý con trước.` }
  const khachCu = (ib as { customer_id: string | null }).customer_id
  const { error } = await db.from('installed_base')
    .update({ customer_id: null, status: 'thu_hoi', updated_at: new Date().toISOString() }).eq('serial', serial)
  if (error) return { ok: false as const, error: error.message }
  await ghiSuDung(db, { serial, su_kien: 'thu_hoi_bao_tri', tu: 'da_lap', den: 'bao_tri', customer_id: khachCu, ghi_chu: ghiChu })
  await ghiAudit('thu_hoi_may', `serial:${serial}`, { khach_cu: khachCu })
  revalidatePath(`/may/${encodeURIComponent(serial)}`)
  revalidatePath('/')
  if (khachCu) revalidatePath(`/khach/${khachCu}`)
  return { ok: true as const }
}

/**
 * Đổi máy khác cho khách (máy cũ lỗi): thu hồi máy CŨ về "Thu hồi BẢO HÀNH" (đổi do lỗi
 * BH, khác "Thu hồi bảo trì" của thuHoiMay) + lắp máy MỚI cho cùng khách, BH **kế thừa
 * mốc cũ** (đổi do lỗi, không mua mới). Một thao tác. CHỈ ADMIN.
 */
export async function doiMayChoKhach(serialCu: string, serialMoi: string, ghiChu?: string) {
  await requireStaff()
  if (!(await coQuyen('cs.may.lap_thu_doi', 'QUANLY'))) return { ok: false as const, error: KHONG_DU_QUYEN }
  const cu = serialCu?.trim(); const moi = serialMoi?.trim()
  if (!moi) return { ok: false as const, error: 'Chọn serial máy mới.' }
  if (moi === cu) return { ok: false as const, error: 'Serial mới trùng máy cũ.' }
  const db = dataClient()
  const { data: ib } = await db.from('installed_base')
    .select('customer_id, install_address, install_date, internal_code').eq('serial', cu).maybeSingle()
  const c = ib as { customer_id: string | null; install_address: string | null; install_date: string | null; internal_code: string | null } | null
  if (!c) return { ok: false as const, error: 'Không thấy máy cũ đã lắp.' }
  if (!c.customer_id) return { ok: false as const, error: 'Máy cũ chưa gắn khách — dùng "đặt trạng thái kho".' }
  const { count } = await db.from('installed_base').select('serial', { count: 'exact', head: true }).eq('parent_serial', cu)
  if ((count ?? 0) > 0) return { ok: false as const, error: `Máy cũ là bộ MẸ của ${count} thiết bị — xử lý con trước.` }
  const { data: reg } = await db.from('serial_registry').select('internal_code, model').eq('serial', moi).maybeSingle()
  const r = reg as { internal_code: string | null; model: string | null } | null
  if (!r) return { ok: false as const, error: `Serial ${moi} không có trong kho.` }
  const { data: daLap } = await db.from('installed_base').select('customer_id').eq('serial', moi).maybeSingle()
  if ((daLap as { customer_id: string | null } | null)?.customer_id) return { ok: false as const, error: `Serial ${moi} đã lắp cho khách khác.` }

  const { data: bhCu } = await db.from('warranty').select('start_date').eq('serial', cu).maybeSingle()
  const mocBH = (bhCu as { start_date: string | null } | null)?.start_date ?? c.install_date   // kế thừa mốc BH cũ
  const khach = c.customer_id

  // 1) Thu hồi máy cũ -> THU HỒI BẢO HÀNH (gỡ khách, KHÔNG xoá để giữ ticket/lịch sử)
  const { error: e1 } = await db.from('installed_base')
    .update({ customer_id: null, status: 'thu_hoi', updated_at: new Date().toISOString() }).eq('serial', cu)
  if (e1) return { ok: false as const, error: e1.message }
  await ghiSuDung(db, { serial: cu, su_kien: 'doi_may_thu_hoi', tu: 'da_lap', den: 'thu_hoi_bao_hanh', customer_id: khach, ghi_chu: `Đổi sang ${moi}. ${ghiChu ?? ''}`.trim() })

  // 2) Lắp máy mới cho khách, BH kế thừa mốc cũ
  const { error: e2 } = await db.from('installed_base').upsert({
    serial: moi, internal_code: r.internal_code, model_freetext: r.model,
    customer_id: khach, install_date: mocBH, install_address: c.install_address,
    channel_source: 'CSKH đổi máy', status: 'active',
  }, { onConflict: 'serial' })
  if (e2) return { ok: false as const, error: e2.message }
  if (mocBH) await db.rpc('activate_warranty', { p_serial: moi, p_start: mocBH })
  await ghiSuDung(db, { serial: moi, su_kien: 'doi_may_lap_moi', tu: 'ton_kho', den: 'da_lap', customer_id: khach, ghi_chu: `Thay cho ${cu}, kế thừa BH ${mocBH ?? '—'}` })
  await ghiAudit('doi_may', `serial:${cu}->${moi}`, { khach, moc_bh: mocBH })
  revalidatePath('/')
  revalidatePath(`/may/${encodeURIComponent(cu)}`)
  revalidatePath(`/may/${encodeURIComponent(moi)}`)
  revalidatePath(`/khach/${khach}`)
  return { ok: true as const, ma_moi: moi }
}

// ── Cấu hình danh mục trạng thái máy (admin sửa được, thay hằng số hardcode) ──
export type TrangThai = {
  code: string; nhan: string; mau: string; thu_tu: number
  he_thong: boolean; cho_dat_tay: boolean; hoat_dong: boolean
}
export type TrangThaiInput = { nhan: string; mau: string; thu_tu?: number; cho_dat_tay: boolean; hoat_dong?: boolean }

/** Danh mục trạng thái máy (ordered). chiDatTay=true -> chỉ trạng thái đặt-tay đang bật. */
export async function dsTrangThai(chiDatTay = false): Promise<TrangThai[]> {
  await requireStaff()
  await doQuyen('cs.may.xem')
  let q = dataClient().from('serial_trang_thai')
    .select('code, nhan, mau, thu_tu, he_thong, cho_dat_tay, hoat_dong').order('thu_tu')
  if (chiDatTay) q = q.eq('cho_dat_tay', true).eq('hoat_dong', true)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as TrangThai[]
}

/** Thêm trạng thái mới (không phải hệ thống). CHỈ ADMIN. */
export async function taoTrangThai(code: string, input: TrangThaiInput): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff()
  if (!(await coQuyen('cs.may.trang_thai', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  const ma = code.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
  if (ma.length < 2) return { ok: false, error: 'Mã trạng thái cần ≥2 ký tự (a-z, 0-9, gạch dưới).' }
  if (!input.nhan.trim()) return { ok: false, error: 'Thiếu tên hiển thị.' }
  const { error } = await dataClient().from('serial_trang_thai').insert({
    code: ma, nhan: input.nhan.trim(), mau: input.mau || 'slate',
    thu_tu: input.thu_tu ?? 100, cho_dat_tay: input.cho_dat_tay, hoat_dong: input.hoat_dong ?? true,
    he_thong: false,
  })
  if (error) {
    if (error.code === '23505') return { ok: false, error: `Mã "${ma}" đã tồn tại.` }
    return { ok: false, error: error.message }
  }
  await ghiAudit('tao_trang_thai', `trang-thai:${ma}`, { nhan: input.nhan.trim() })
  revalidatePath('/serial'); revalidatePath('/')
  return { ok: true }
}

/** Sửa trạng thái (nhãn/màu/thứ tự/đặt-tay/bật-tắt). Không đổi mã. CHỈ ADMIN. */
export async function suaTrangThai(code: string, input: TrangThaiInput): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff()
  if (!(await coQuyen('cs.may.trang_thai', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  if (!input.nhan.trim()) return { ok: false, error: 'Thiếu tên hiển thị.' }
  const { error, count } = await dataClient().from('serial_trang_thai').update({
    nhan: input.nhan.trim(), mau: input.mau || 'slate', thu_tu: input.thu_tu ?? 100,
    cho_dat_tay: input.cho_dat_tay, hoat_dong: input.hoat_dong ?? true, updated_at: new Date().toISOString(),
  }, { count: 'exact' }).eq('code', code)
  if (error) return { ok: false, error: error.message }
  if (!count) return { ok: false, error: 'Không thấy trạng thái để sửa.' }
  await ghiAudit('sua_trang_thai', `trang-thai:${code}`, { nhan: input.nhan.trim() })
  revalidatePath('/serial'); revalidatePath('/')
  return { ok: true }
}

/** Xoá trạng thái. Chặn nếu là hệ thống hoặc còn máy đang dùng. CHỈ ADMIN. */
export async function xoaTrangThai(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff()
  if (!(await coQuyen('cs.may.trang_thai', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  const db = dataClient()
  const { data: tt } = await db.from('serial_trang_thai').select('he_thong').eq('code', code).maybeSingle()
  if (!tt) return { ok: false, error: 'Không thấy trạng thái.' }
  if ((tt as { he_thong: boolean }).he_thong) return { ok: false, error: 'Trạng thái hệ thống — không xoá được (có thể "ngừng dùng").' }
  const { count } = await db.from('serial_registry').select('serial', { count: 'exact', head: true }).eq('trang_thai', code)
  if ((count ?? 0) > 0) return { ok: false, error: `Còn ${count} máy đang ở trạng thái này — đổi chúng trước khi xoá.` }
  const { error } = await db.from('serial_trang_thai').delete().eq('code', code)
  if (error) return { ok: false, error: error.message }
  await ghiAudit('xoa_trang_thai', `trang-thai:${code}`)
  revalidatePath('/serial')
  return { ok: true }
}

// ── Phần 4: Đăng ký bảo hành + khách (chờ duyệt) ────────────────────────────
export type KhachTom = {
  id: string; full_name: string; primary_phone: string | null; trang_thai: string
  address?: string | null; province?: string | null
}

/** Tìm khách (cho ô chọn khách khi đăng ký BH / tạo ticket). */
export async function searchCustomers(q: string, limit = 20): Promise<KhachTom[]> {
  await requireStaff()
  await doQuyen('cs.khach.xem')
  let query = dataClient().from('cs_customers')
    .select('id, full_name, primary_phone, trang_thai, address, province')
    .neq('trang_thai', 'da_xoa')   // ẩn khách đã xoá mềm
  const term = q.trim()
  if (term) {
    const safe = term.replace(/[%_]/g, (c) => '\\' + c)
    query = query.or(`full_name.ilike.%${safe}%,primary_phone.ilike.%${safe}%`)
  }
  const { data, error } = await query.order('full_name').limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as KhachTom[]
}

// ── Đăng ký BH (Đợt 1): chọn máy -> serial của máy, hoặc serial -> soi trạng thái ──
export type MayKho = { internal_code: string; ten_noi_bo: string | null; con_lai: number; tong: number }

/** Danh sách máy (có serial trong kho) cho ô chọn máy. Lọc bỏ lõi/vỏ (view v_may_kho). */
export async function dsMayCoSerial(): Promise<MayKho[]> {
  await requireStaff()
  await doQuyen('cs.may.xem')
  const { data, error } = await dataClient().from('v_may_kho')
    .select('internal_code, ten_noi_bo, con_lai, tong').order('ten_noi_bo')
  if (error) throw new Error(error.message)
  return (data ?? []) as MayKho[]
}

/** Serial của 1 máy (theo mã nội bộ) còn CHƯA kích hoạt BH — cho dropdown khi đã chọn máy. */
export async function serialsTheoMay(internalCode: string, limit = 500): Promise<SerialKho[]> {
  await requireStaff()
  await doQuyen('cs.may.xem')
  const { data, error } = await dataClient().from('v_serial_kho')
    .select('serial, ma_noi_bo, ten_noi_bo, ma_goc, po, trang_thai, bh_kich_hoat, ten_khach, sdt_khach, ngay_lap, bh_het_han')
    .eq('ma_noi_bo', internalCode).eq('bh_kich_hoat', false)
    .order('trang_thai').order('serial').limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as SerialKho[]
}

/** Soi 1 serial (đã có khách/kích hoạt chưa) — cho ca điền serial trước để kiểm tra lại. */
export async function serialInfo(serial: string): Promise<SerialKho | null> {
  await requireStaff()
  await doQuyen('cs.may.xem')
  const s = serial.trim()
  if (!s) return null
  const { data, error } = await dataClient().from('v_serial_kho')
    .select('serial, ma_noi_bo, ten_noi_bo, ma_goc, po, trang_thai, bh_kich_hoat, ten_khach, sdt_khach, ngay_lap, bh_het_han')
    .eq('serial', s).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as SerialKho) ?? null
}

/**
 * Chuẩn hoá SĐT về dạng 0 + 9 số cuối (SĐT VN 10 số). Nhận cả "84…", "+84…",
 * số dính khoảng trắng, hoặc thiếu số 0 đầu (nguồn Google Sheet của Sales).
 * `cuoi9` = 9 số cuối, khoá đối chiếu chung (khớp cách migration 26/12 đã map).
 */
function chuanHoaSdt(raw: string): { chuan: string; cuoi9: string; hopLe: boolean } {
  let so = (raw ?? '').replace(/\D/g, '')
  if (so.startsWith('84')) so = '0' + so.slice(2)
  else if (so.length === 9) so = '0' + so
  const hopLe = /^0\d{9,10}$/.test(so)
  const cuoi9 = so.length >= 9 ? so.slice(-9) : so
  return { chuan: so, cuoi9, hopLe }
}

/** Kết quả tra khách theo SĐT (cho form tạo khách: chống trùng + tái dùng khách Sales). */
export type KhachKhopSdt = {
  nguon: 'cs' | 'sales' | null
  id?: string                 // cs_customers.id khi nguon='cs' (để chọn luôn, không tạo trùng)
  full_name?: string
  primary_phone?: string | null
  address?: string | null
  province?: string | null
  customer_code?: string | null
  trang_thai?: string | null
}

/**
 * ⚠️ CŨ — chỉ còn dùng ở màn tạo khách bản cũ. Việc mới dùng `traKhachChung()` ngay dưới:
 * nó tra CẢ HAI bảng khách, cảnh báo khi một SĐT ra nhiều hồ sơ, và dùng chung với Sales.
 *
 * Tra khách theo SĐT (9 số cuối). Ưu tiên khách CS đã có (nguon='cs' -> chọn luôn,
 * không tạo trùng); không có thì soi khách chung với Sales (nguon='sales' -> trả
 * info để form tự điền, cho sửa lại địa chỉ). SĐT sai định dạng -> nguon=null.
 */
export async function timKhachTheoSdt(sdt: string): Promise<KhachKhopSdt> {
  await requireStaff()
  await doQuyen('cs.khach.xem')
  const { cuoi9, hopLe } = chuanHoaSdt(sdt)
  if (!hopLe || cuoi9.length < 9) return { nguon: null }
  const db = dataClient()

  // 1) Khách CS đã có (bỏ đã xoá) — khớp theo 9 số cuối của primary_phone.
  const { data: cs } = await db.from('cs_customers')
    .select('id, full_name, primary_phone, address, province, customer_code, trang_thai')
    .neq('trang_thai', 'da_xoa').ilike('primary_phone', `%${cuoi9}`).limit(1)
  if (cs && cs.length) {
    const k = cs[0] as Record<string, unknown>
    return {
      nguon: 'cs', id: k.id as string, full_name: k.full_name as string,
      primary_phone: (k.primary_phone as string) ?? null, address: (k.address as string) ?? null,
      province: (k.province as string) ?? null, customer_code: (k.customer_code as string) ?? null,
      trang_thai: (k.trang_thai as string) ?? null,
    }
  }

  // 2) Khách chung với Sales (bảng mirror `customers`) — khớp phone_no0 (9 số).
  //
  // Đọc `province`, KHÔNG đọc `province_moi` nữa (chốt với phiên Sales 21/08/2026, SYSTEM.md §8):
  //  · Sales sắp BỎ cột `province_moi`. Còn giữ nó trong `.select()` là hôm đó PostgREST ném
  //    lỗi và nút tra khách theo SĐT ở màn tạo khách chết.
  //  · Apps Script đã thôi ghi `province_moi` nên cột đó ĐÓNG BĂNG, còn `province` mới là cột
  //    được cập nhật. Code cũ ưu tiên cột đóng băng ⇒ sửa tỉnh một khách xong CS vẫn hiện giá
  //    trị cũ, không lỗi gì để lần ra.
  // Quy ước tỉnh nay lấy theo chuẩn CS: `province` = tỉnh MỚI, `province_truoc_sap_nhap` = tỉnh cũ.
  const { data: sa } = await db.from('customers')
    .select('name, phone_chuan, address, province, customer_code')
    .eq('phone_no0', cuoi9).limit(1)
  if (sa && sa.length) {
    const k = sa[0] as Record<string, unknown>
    return {
      nguon: 'sales', full_name: (k.name as string) ?? undefined,
      primary_phone: (k.phone_chuan as string) ?? null, address: (k.address as string) ?? null,
      province: (k.province as string) || null,
      customer_code: (k.customer_code as string) ?? null,
    }
  }

  return { nguon: null }
}

/**
 * Tra khách theo SĐT ở CẢ HAI bảng — CSKH và Sales. CEO chốt 21/08/2026: hai khu phải
 * "đọc cùng 1 chỗ", nhập SĐT mà đã có bên nào cũng là khách CŨ.
 *
 * Phần tra nằm ở `lib/tra-khach.ts` (dùng chung với Sales, cố ý KHÔNG kiểm quyền).
 * Rào quyền ở ĐÂY — mỗi khu gác bằng quyền của khu mình rồi mới gọi vào.
 */
export async function traKhachChung(sdt: string): Promise<KetQuaTraKhach> {
  await requireStaff()
  await doQuyen('cs.khach.xem')
  return traKhachTheoSdt(sdt)
}

/** Tạo khách mới TỪ CS -> trạng thái chờ admin duyệt (khách đại lý/Shopee đăng ký sau). */
export async function taoKhachChoDuyet(input: {
  full_name: string; primary_phone?: string; address?: string; province?: string
  /** Thông tin nâng cao — chỉ có khi tạo từ trang `/khach/moi`. */
  notes?: string; channel_id?: number | null
  ten_cty?: string; mst?: string; dia_chi_cty?: string; sdt_cty?: string; email_cty?: string
  nguoi_dai_dien?: string; chuc_vu_dai_dien?: string
  /** Tạo kèm luôn, khỏi phải mở lại hồ sơ để thêm. */
  sdt_phu?: { phone: string; contact_name?: string; role?: string; zalo_ok?: boolean; ghi_chu?: string }[]
  dia_chi_phu?: { dia_chi: string; loai: string; tinh?: string; ghi_chu?: string }[]
}): Promise<{ ok: true; id: string } | { ok: false; error: string; existingId?: string }> {
  await requireStaff()
  await doQuyen('cs.khach.sua')
  const ten = input.full_name?.trim()
  if (!ten) return { ok: false, error: 'Nhập tên khách.' }

  // SĐT BẮT BUỘC + đúng định dạng (khách mới). Rào thật ở server, không chỉ UI.
  const { chuan, cuoi9, hopLe } = chuanHoaSdt(input.primary_phone ?? '')
  if (!hopLe) return { ok: false, error: 'SĐT bắt buộc và phải đúng định dạng (vd 0xxxxxxxxx).' }

  const db = dataClient()
  // Chống trùng: SĐT đã có ở khách CS -> KHÔNG tạo bản mới, trả id để UI chọn luôn.
  const { data: trung } = await db.from('cs_customers')
    .select('id').neq('trang_thai', 'da_xoa').ilike('primary_phone', `%${cuoi9}`).limit(1)
  if (trung && trung.length) {
    return {
      ok: false, existingId: (trung[0] as { id: string }).id,
      error: 'SĐT này đã có khách trong hệ thống — dùng lại khách đã có, không tạo trùng.',
    }
  }

  // Khách chung với Sales? -> lấy customer_code để liên kết (tái dùng hồ sơ Sales).
  const { data: sa } = await db.from('customers')
    .select('customer_code').eq('phone_no0', cuoi9).limit(1)
  const customerCode = sa && sa.length ? (sa[0] as { customer_code: string | null }).customer_code : null

  const { data, error } = await db.from('cs_customers').insert({
    full_name: ten, primary_phone: chuan,
    address: input.address?.trim() || null, province: input.province?.trim() || null,
    customer_code: customerCode,
    // `source` là dấu vết HỆ THỐNG (đợt import / đường tạo), không phải kênh bán
    // — cố ý không cho người dùng gõ, kẻo lẫn với `channel_id`.
    source: customerCode ? 'Sales (khớp SĐT)' : 'CSKH đăng ký',
    channel_id: input.channel_id ?? null,
    // Tạo thẳng (đã duyệt): rác lớn nhất (SĐT sai/trùng) đã chặn ngay lúc tạo nên
    // không cần hàng chờ duyệt cho khách mới. Sửa/xoá khách vẫn qua duyệt như cũ.
    trang_thai: 'da_duyet', needs_phone: false,
    notes: input.notes?.trim() || null,
    ten_cty: input.ten_cty?.trim() || null,
    mst: input.mst?.trim() || null,
    dia_chi_cty: input.dia_chi_cty?.trim() || null,
    sdt_cty: input.sdt_cty?.trim() || null,
    email_cty: input.email_cty?.trim() || null,
    nguoi_dai_dien: input.nguoi_dai_dien?.trim() || null,
    chuc_vu_dai_dien: input.chuc_vu_dai_dien?.trim() || null,
  }).select('id').single()
  if (error) return { ok: false, error: error.message }
  const id = (data as { id: string }).id

  // SĐT phụ + địa chỉ phụ chèn SAU khi có id. Hỏng ở bước này KHÔNG huỷ khách vừa
  // tạo — khách đã có là thắng lợi chính, số phụ thiếu thì thêm tay ở hồ sơ.
  // Đi qua HÀM DÙNG CHUNG `lib/khach-lien-he.ts`, không tự viết insert riêng nữa.
  // Trước đây màn TẠO ghi thẳng còn màn SỬA gọi hàm chung ⇒ hai đường ghi khác nhau, và đúng
  // thế là lệch: màn tạo bỏ quên `ghi_chu` của địa chỉ phụ. CEO bắt được 22/08/2026.
  // Một đường ghi thì không có chỗ để lệch.
  const sdtPhu = (input.sdt_phu ?? []).filter((x) => x.phone?.trim())
  for (const x of sdtPhu) {
    await themSdtPhu({
      customer_id: id, phone: x.phone, contact_name: x.contact_name,
      role: x.role?.trim() || 'khac', zalo_ok: x.zalo_ok ?? true,
      ghi_chu: x.ghi_chu, nguon: 'cskh',
    })
  }
  const dcPhu = (input.dia_chi_phu ?? []).filter((x) => x.dia_chi?.trim())
  for (const x of dcPhu) {
    await themDiaChiPhu({
      customer_id: id, dia_chi: x.dia_chi, loai: x.loai,
      tinh: x.tinh, ghi_chu: x.ghi_chu, nguon: 'cskh',
    })
  }


  revalidatePath('/khach'); revalidatePath('/khach-hang')
  return { ok: true, id }
}

/** Đăng ký bảo hành: gắn máy (serial) cho khách + kích hoạt BH. */
export async function dangKyBaoHanh(input: {
  serial: string; customer_id: string; install_date: string; install_address?: string
  ngay_lap_do_chac?: DoChacNgayLap; ghi_chu?: string
}) {
  await requireStaff()
  await doQuyen('cs.may.kich_hoat_bh')
  const serial = input.serial?.trim()
  if (!serial) return { ok: false as const, error: 'Chọn serial.' }
  if (!input.customer_id) return { ok: false as const, error: 'Chọn khách.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.install_date)) return { ok: false as const, error: 'Ngày lắp không hợp lệ.' }
  const doChac = doChacHopLe(input.ngay_lap_do_chac)
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
  const ic = (sr as { internal_code: string | null } | null)?.internal_code ?? null
  // CHỈ đăng ký BH cho MÁY (catalog "Danh mục cấp 1" = Machines). Lõi/vật tư -> từ chối.
  if (ic) {
    const { data: cat } = await db.from('catalog_item')
      .select('"Danh mục cấp 1"').eq('Mã nội bộ', ic).limit(1).maybeSingle()
    const dm1 = (cat as Record<string, string | null> | null)?.['Danh mục cấp 1']
    if (dm1 && dm1 !== 'Machines') {
      return { ok: false as const, error: `Chỉ đăng ký bảo hành cho MÁY. Mã "${ic}" thuộc "${dm1}" (lõi/vật tư) — không kích hoạt BH.` }
    }
  }
  const { error: e1 } = await db.from('installed_base').upsert({
    serial,
    internal_code: ic,
    model_freetext: (sr as { model: string | null } | null)?.model ?? null,
    customer_id: input.customer_id,
    install_date: input.install_date,
    install_address: input.install_address?.trim() || null,
    ngay_lap_do_chac: doChac,
    ghi_chu: input.ghi_chu?.trim() || null,
    channel_source: 'CSKH đăng ký', status: 'active',
  }, { onConflict: 'serial' })
  if (e1) return { ok: false as const, error: e1.message }
  const { error: e2 } = await db.rpc('activate_warranty', { p_serial: serial, p_start: input.install_date })
  if (e2) return { ok: false as const, error: e2.message }
  await ghiAudit('kich_hoat_bh', `serial:${serial}`, { customer_id: input.customer_id, install_date: input.install_date })
  await ghiSuDung(db, { serial, su_kien: 'lap_dat', tu: chuHienTai ? 'da_lap' : 'ton_kho', den: 'da_lap', customer_id: input.customer_id, ghi_chu: 'Đăng ký bảo hành' })
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
  await doQuyen('cs.may.kich_hoat_bh')
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
  await doQuyen('cs.may.kich_hoat_bh')
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
  await doQuyen('cs.khach.duyet_cho')
  const { data, error } = await dataClient()
    .from('cs_customers').select('id, full_name, primary_phone, trang_thai')
    .eq('trang_thai', 'cho_duyet').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as KhachTom[]
}

/** Duyệt khách chờ (CHỈ ADMIN). */
export async function duyetKhach(id: string) {
  await requireStaff()
  if (!(await coQuyen('cs.khach.duyet_cho', 'QUANLY'))) return { ok: false as const, error: KHONG_DU_QUYEN }
  const { error } = await dataClient().from('cs_customers').update({ trang_thai: 'da_duyet' }).eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  await ghiAudit('duyet_khach', `khach:${id}`)
  revalidatePath('/khach')
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
  ngay_thu_phi: string | null
}

export async function listTicketItems(code: string): Promise<TicketMuc[]> {
  await requireStaff()
  await doQuyen('cs.ticket.chi_phi')
  const { data, error } = await dataClient()
    .from('ticket_muc').select('*').eq('ticket_code', code).order('created_at')
  if (error) throw new Error(error.message)
  return (data ?? []) as TicketMuc[]
}

/** Danh mục hạng mục (từ catalog_item) để chọn khi thu phí/vật tư. Services lên đầu. */
export type CatalogItem = { code: string; ten: string | null; danh_muc: string | null }
export async function listCatalogItems(): Promise<CatalogItem[]> {
  await requireStaff()
  await doQuyen('cs.ticket.chi_phi')
  // Bỏ mã `cp.*` — đó là DANH MỤC CHI PHÍ KẾ TOÁN nội bộ (cp.qc quảng cáo, cp.thuekho,
  // cp.bank phí ngân hàng, cp.tiepkhach…), không phải thứ thu tiền của khách. Trước đây
  // hàm này trả về TOÀN BỘ catalog_item nên 20 mã chi phí nằm lẫn trong ô chọn hạng mục
  // lúc CS thu phí/vật tư trên ticket — bấm nhầm là ghi một khoản chi phí công ty vào
  // hoá đơn của khách.
  //
  // Lọc theo TIỀN TỐ MÃ chứ không theo cột `"Trạng thái"`: `'Không KD'` nghe như "không
  // phải hàng" nhưng thực tế nghĩa là "hàng NGỪNG BÁN" — 45 mã mang trạng thái đó thì 25
  // là hàng thật (lõi lọc LLK20/LLK35, PIN18V, vỏ lọc, giá treo…) và đều có thuế suất 8%.
  // Phiên Sales đã lọc nhầm theo cột đó ngày 21/08/2026 và xoá mất thuế suất của 25 mã ấy.
  // Cùng một định nghĩa "mục chi phí" với Sales, để hai khu không lệch nhau (SYSTEM.md §8).
  const { data, error } = await dataClient()
    .from('catalog_item')
    .select('"Mã nội bộ","Tên ngắn gọn (đề xuất)","Danh mục cấp 1"')
    .not('Mã nội bộ', 'like', 'cp.%')
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
  serial_cu?: string; serial_moi?: string; ngay_thu_phi?: string | null
}) {
  const user = await requireStaff()
  if (!(await coQuyen('cs.ticket.chi_phi', 'QUANLY'))) return { ok: false as const, error: KHONG_DU_QUYEN }
  if (!['hang_muc', 'doi_may'].includes(input.loai)) {
    return { ok: false as const, error: 'Loại mục không hợp lệ.' }
  }
  // Hạng mục (thu phí/vật tư) BẮT BUỘC chọn từ catalog_item.
  if (input.loai === 'hang_muc' && !input.catalog_code) {
    return { ok: false as const, error: 'Chọn hạng mục từ danh mục (catalog_item).' }
  }
  // Phòng thủ số liệu (UI đã chặn ký tự lạ, đây là rào thật): thành tiền phải là
  // null hoặc số hữu hạn ≥ 0 (chặn NaN/Infinity/âm); SL là số nguyên ≥ 1.
  const soTien = input.so_tien ?? null
  if (soTien != null && (!Number.isFinite(soTien) || soTien < 0)) {
    return { ok: false as const, error: 'Thành tiền không hợp lệ (chỉ nhập số).' }
  }
  const soLuong = input.so_luong && input.so_luong >= 1 ? Math.floor(input.so_luong) : 1
  const tinhPhi = input.tinh_phi ?? false
  // Ngày thu phí chỉ lưu cho mục CÓ thu phí, và phải đúng dạng YYYY-MM-DD.
  const ngayThuPhi = tinhPhi && input.ngay_thu_phi && /^\d{4}-\d{2}-\d{2}$/.test(input.ngay_thu_phi)
    ? input.ngay_thu_phi : null

  const { error } = await dataClient().from('ticket_muc').insert({
    ticket_code: code,
    loai: input.loai,
    catalog_code: input.loai === 'hang_muc' ? input.catalog_code : null,
    so_luong: soLuong,
    mo_ta: input.mo_ta?.trim() || null,
    so_tien: soTien,
    tinh_phi: tinhPhi,
    serial_cu: input.serial_cu?.trim() || null,
    serial_moi: input.serial_moi?.trim() || null,
    tac_gia: user.email ?? null,
    ngay_thu_phi: ngayThuPhi,
  })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/ticket/${code}`)
  return { ok: true as const }
}

export async function deleteTicketItem(id: string, code: string) {
  await requireStaff()
  if (!(await coQuyen('cs.ticket.chi_phi', 'QUANLY'))) return { ok: false as const, error: KHONG_DU_QUYEN }
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
  if (!(await coQuyen('cs.bao_cao.xuat', 'QUANLY'))) throw new Error(KHONG_DU_QUYEN)
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

/** Xuất ticket theo CÁC CỘT được chọn (CHỈ ADMIN). Trả CSV (không BOM — client UTF-16LE). */
export async function xuatTicket(
  q: string, state: string | undefined, onlyKhan: boolean, mine: boolean, cot: string[], ngtu?: string, ngden?: string
): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  await requireStaff()
  if (!(await coQuyen('cs.bao_cao.xuat', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  const mineId = mine ? (await currentStaff())?.id : undefined
  const rows = await gomTatCa((trang, moiTrang) => searchTickets(q, state, onlyKhan, mineId, { trang, moiTrang, ngtu, ngden }))
  const cols = XUAT_TICKET_COT.filter((c) => cot.includes(c.key))
  const gt = (t: Record<string, unknown>, key: string): string => {
    if (key === 'created_at') return String(t.created_at ?? '').slice(0, 10)
    if (key === 'khan') return t.khan ? 'Khẩn' : ''
    if (key === 'serial') return String(t.serial ?? t.source_serial ?? '')
    const v = t[key]
    return v == null ? '' : String(v)
  }
  const lines = [cols.map((c) => oCsv(c.nhan)).join(',')]
  for (const t of rows) lines.push(cols.map((c) => oCsv(gt(t as unknown as Record<string, unknown>, c.key))).join(','))
  await ghiAudit('export_ticket', 'tickets', { q, cot: cols.map((c) => c.key), so_dong: rows.length })
  return { ok: true, csv: lines.join('\r\n') }
}

// ── Export chung cho Máy / Bảo trì / Lịch lõi (admin-only, dùng lại list action) ──
/** Gom TẤT CẢ dòng khớp bộ lọc bằng cách lặp chính hàm liệt kê (lô 1000). */
async function gomTatCa<T>(layLo: (trang: number, moiTrang: number) => Promise<{ rows: T[]; tong: number }>): Promise<T[]> {
  const ra: T[] = []
  for (let trang = 1; ra.length < 50000; trang++) {
    const { rows, tong } = await layLo(trang, 1000)
    ra.push(...rows)
    if (ra.length >= tong || rows.length < 1000) break
  }
  return ra
}
/** Giá trị 1 ô để xuất CSV: ISO timestamp -> cắt còn ngày; còn lại String. */
function giaTriBang(r: Record<string, unknown>, key: string): string {
  const v = r[key]
  if (v == null) return ''
  const s = String(v)
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? s.slice(0, 10) : s
}
function noiDungCsvBang(rows: Record<string, unknown>[], cols: readonly { key: string; nhan: string }[]): string {
  const lines = [cols.map((c) => oCsv(c.nhan)).join(',')]
  for (const r of rows) lines.push(cols.map((c) => oCsv(giaTriBang(r, c.key))).join(','))
  return lines.join('\r\n')
}

export async function xuatMay(q: string, sp: string | undefined, bh: string | undefined, cot: string[], ngtu?: string, ngden?: string): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  await requireStaff()
  if (!(await coQuyen('cs.bao_cao.xuat', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  const rows = await gomTatCa((trang, moiTrang) => searchMachines(q, { trang, moiTrang, maSanPham: sp, tinhTrangBH: bh, ngtu, ngden }))
  const cols = XUAT_MAY_COT.filter((c) => cot.includes(c.key))
  await ghiAudit('export_may', 'installed_base', { q, so_dong: rows.length })
  return { ok: true, csv: noiDungCsvBang(rows as unknown as Record<string, unknown>[], cols) }
}

export async function xuatBaoTri(tt: string | undefined, q: string, cot: string[], ngtu?: string, ngden?: string): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  await requireStaff()
  if (!(await coQuyen('cs.bao_cao.xuat', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  const rows = await gomTatCa((trang, moiTrang) => maintenanceDue(tt ?? '', q, { trang, moiTrang, ngtu, ngden }))
  const cols = XUAT_BAOTRI_COT.filter((c) => cot.includes(c.key))
  await ghiAudit('export_bao_tri', 'maintenance_visit', { q, so_dong: rows.length })
  return { ok: true, csv: noiDungCsvBang(rows as unknown as Record<string, unknown>[], cols) }
}

export async function xuatLoi(tt: string | undefined, q: string, cot: string[], ngtu?: string, ngden?: string): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  await requireStaff()
  if (!(await coQuyen('cs.bao_cao.xuat', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  const rows = await gomTatCa((trang, moiTrang) => coreForecast(tt ?? '', q, { trang, moiTrang, ngtu, ngden }))
  const cols = XUAT_LOI_COT.filter((c) => cot.includes(c.key))
  await ghiAudit('export_loi', 'filter_replacement', { q, so_dong: rows.length })
  return { ok: true, csv: noiDungCsvBang(rows as unknown as Record<string, unknown>[], cols) }
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
  await doQuyen('cs.ticket.tao_sua')
  const nguoiTao = await layNhanVien()
  if (!input.customer_id?.trim()) return { ok: false as const, error: 'Bắt buộc chọn khách.' }
  if (!input.serial?.trim()) return { ok: false as const, error: 'Bắt buộc chọn serial máy báo lỗi (máy của khách).' }
  if (!input.ticket_type?.trim()) return { ok: false as const, error: 'Chọn loại ticket.' }
  if (!input.description?.trim()) return { ok: false as const, error: 'Nhập mô tả sự cố.' }
  if (input.state && !['Open', 'Done', 'Cancel'].includes(input.state)) {
    return { ok: false as const, error: 'Trạng thái không hợp lệ.' }
  }

  const db = dataClient()
  // Mã MỚI: TK-YYMM-NNN (STT 3 số reset theo tháng). Mã cũ GWT-… giữ nguyên.
  // Dùng ngày tạo (ca backdate) để mã đúng tháng; parse chuỗi tránh lệch múi giờ.
  const isoNgay = input.created_at?.trim() ? input.created_at.trim().slice(0, 10) : new Date().toISOString().slice(0, 10)
  const [yFull, mm] = isoNgay.split('-')
  const prefix = `TK-${yFull.slice(2)}${mm}-`
  const { data: last, error: e1 } = await db
    .from('tickets').select('ticket_code')
    .like('ticket_code', `${prefix}%`)
    .order('ticket_code', { ascending: false }).limit(1)
  if (e1) return { ok: false as const, error: e1.message }

  const next = last?.length ? parseInt(last[0].ticket_code.slice(prefix.length), 10) + 1 : 1
  const code = `${prefix}${String(next).padStart(3, '0')}`

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
    // Bỏ trống người phụ trách -> auto gán người TẠO ticket (yêu cầu nghiệp vụ).
    cs_phu_trach: input.cs_phu_trach || nguoiTao?.id || null,
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
  await doQuyen('cs.ticket.xem')
  const { data, error } = await dataClient()
    .from('tickets').select('ticket_type').not('ticket_type', 'is', null)
  if (error) throw new Error(error.message)
  return [...new Set((data ?? []).map((r) => (r as { ticket_type: string }).ticket_type))].sort()
}

// ── Data cần dọn (gộp: ticket thiếu máy/khách · khách cần dọn · bộ thiếu con) ──
export type TicketThieu = {
  ticket_code: string; created_at: string; customer_id: string | null
  customer_name: string | null; serial: string | null; source_serial: string | null; thieu: string
}
export type BoThieuCon = { ma_bo: string; combo: string | null; customer_name: string | null; so_con: number }

/** Ticket thiếu MÁY (không serial trong hệ) hoặc thiếu KHÁCH — cần bổ sung. */
export async function ticketThieuData(limit = 300): Promise<TicketThieu[]> {
  await requireStaff()
  await doQuyen('cs.ticket.xem')
  const { data, error } = await dataClient()
    .from('v_tickets').select('ticket_code, created_at, customer_id, customer_name, serial, source_serial')
    .or('serial.is.null,customer_id.is.null')
    .order('created_at', { ascending: false }).limit(limit)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map((t) => ({
    ticket_code: t.ticket_code as string, created_at: t.created_at as string,
    customer_id: (t.customer_id as string) ?? null, customer_name: (t.customer_name as string) ?? null,
    serial: (t.serial as string) ?? null, source_serial: (t.source_serial as string) ?? null,
    thieu: [!t.customer_id ? 'khách' : null, !t.serial ? 'máy' : null].filter(Boolean).join(' + '),
  }))
}

/** Bộ combo (WH15A/WH30A/ECO) chưa đủ 3 thiết bị con — cần bổ sung serial thiết bị. */
export async function boComboThieuCon(): Promise<BoThieuCon[]> {
  await requireStaff()
  await doQuyen('cs.may.xem')
  const db = dataClient()
  const [{ data: ib }, { data: me }] = await Promise.all([
    db.from('installed_base').select('parent_serial'),
    db.from('v_installed_base').select('serial, internal_code, customer_name'),
  ])
  const demCon = new Map<string, number>()
  for (const r of (ib ?? []) as { parent_serial: string | null }[]) {
    if (r.parent_serial) demCon.set(r.parent_serial, (demCon.get(r.parent_serial) ?? 0) + 1)
  }
  return ((me ?? []) as { serial: string; internal_code: string | null; customer_name: string | null }[])
    .filter((m) => demCon.has(m.serial) && (demCon.get(m.serial) ?? 0) < 3)
    .map((m) => ({ ma_bo: m.serial, combo: m.internal_code, customer_name: m.customer_name, so_con: demCon.get(m.serial) ?? 0 }))
    .sort((a, b) => a.so_con - b.so_con)
}

/** Khách cần dọn: thiếu/lỗi SĐT HOẶC thiếu địa chỉ. Di trú Odoo không lấp được, phải sửa tay. */
export async function listToFix(
  q = '',
  tuyChon: TuyChonDanhSach = {}
): Promise<KetQuaTrang<Customer & { machines: number }>> {
  await requireStaff()
  await doQuyen('cs.ticket.xem')
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

/** Danh sách KHÁCH HÀNG tổng (tất cả khách, trừ da_xoa) — trang /khach-hang. */
export async function listKhachHang(
  q = '',
  tuyChon: TuyChonDanhSach = {}
): Promise<KetQuaTrang<Customer & { machines: number }>> {
  await requireStaff()
  await doQuyen('cs.khach.xem')
  const db = dataClient()
  const sx = sapXepHopLe(tuyChon.cot, tuyChon.chieu, COT_KHACH, { cot: 'full_name', tang: true })
  const trang = Math.max(1, tuyChon.trang ?? 1)
  const moi = tuyChon.moiTrang ?? MOI_TRANG
  const tu = (trang - 1) * moi

  let truyVan = db.from('cs_customers').select('*', { count: 'exact' }).neq('trang_thai', 'da_xoa')
  const kw = antoanChoOr(chuanHoaTuKhoa(q))
  if (kw) truyVan = truyVan.or(`ten_kd.imatch.${mauDauTu(kw)},primary_phone.ilike.%${kw}%`)

  const { data, error, count } = await truyVan
    .order(sx.cot, { ascending: sx.tang, nullsFirst: false }).order('id', { ascending: true })
    .range(tu, tu + moi - 1)
  if (error) throw new Error(error.message)
  const customers = (data ?? []) as Customer[]

  const { data: ibs, error: e2 } = await db
    .from('installed_base').select('customer_id').in('customer_id', customers.map((c) => c.id))
  if (e2) throw new Error(e2.message)
  const dem = new Map<string, number>()
  for (const r of ibs ?? []) {
    const id = (r as { customer_id: string }).customer_id
    dem.set(id, (dem.get(id) ?? 0) + 1)
  }

  const tong = count ?? 0
  return {
    rows: customers.map((c) => ({ ...c, machines: dem.get(c.id) ?? 0 })),
    tong, trang, soTrang: Math.max(1, Math.ceil(tong / moi)), sapXep: sx,
  }
}

export async function khoaTatCaKhachHang(t: ThamSoLoc): Promise<string[]> {
  return gomKhoa(
    (trang, moiTrang) => listKhachHang(t.q ?? '', { trang, moiTrang, cot: t.cot, chieu: t.chieu }),
    (r) => r.id,
    TOI_DA_CHON
  )
}

// ── Thao tác HÀNG LOẠT (Đợt B — CHỈ ADMIN, chia lô, audit) ──────────────────
function revalidateHangLoat(bang: string) {
  if (bang === 'cs_customers') { revalidatePath('/khach-hang'); revalidatePath('/khach'); revalidatePath('/') }
}

/** Cập nhật 1 trường cho NHIỀU dòng (CHỈ ADMIN). Whitelist trường theo SUA_HL_BANG, chia lô 200. */
export async function capNhatHangLoat(bang: string, ids: string[], truong: string, giaTri: string) {
  await requireStaff()
  if (!(await coQuyen('cs.hang_loat.cap_nhat', 'QUANLY'))) return { ok: false as const, error: KHONG_DU_QUYEN }
  const reg = SUA_HL_BANG[bang]
  if (!reg) return { ok: false as const, error: 'Bảng không hỗ trợ sửa hàng loạt.' }
  if (!reg.some((f) => f.key === truong)) return { ok: false as const, error: 'Trường không hợp lệ.' }
  if (!ids.length) return { ok: false as const, error: 'Chưa chọn dòng nào.' }
  const db = dataClient()
  const patch: Record<string, unknown> = { [truong]: giaTri === '' ? null : giaTri }
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await db.from(bang).update(patch).in('id', ids.slice(i, i + 200))
    if (error) return { ok: false as const, error: error.message }
  }
  await ghiAudit('sua_hang_loat', bang, { truong, gia_tri: giaTri, so_dong: ids.length })
  revalidateHangLoat(bang)
  return { ok: true as const, soDong: ids.length }
}

/** Xoá NHIỀU dòng (CHỈ ADMIN). Khách = ẩn mềm (da_xoa). Chia lô 200, audit. */
export async function xoaHangLoat(bang: string, ids: string[]) {
  await requireStaff()
  if (!(await coQuyen('cs.khach.xoa_hang_loat', 'ADMIN'))) return { ok: false as const, error: KHONG_DU_QUYEN }
  if (bang !== 'cs_customers') return { ok: false as const, error: 'Bảng không hỗ trợ xoá hàng loạt.' }
  if (!ids.length) return { ok: false as const, error: 'Chưa chọn dòng nào.' }
  const db = dataClient()
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await db.from('cs_customers').update({ trang_thai: 'da_xoa' }).in('id', ids.slice(i, i + 200))
    if (error) return { ok: false as const, error: error.message }
  }
  await ghiAudit('xoa_hang_loat', bang, { so_dong: ids.length })
  revalidateHangLoat(bang)
  return { ok: true as const, soDong: ids.length }
}

// ── Tuỳ chỉnh CỘT + lưu view (Đợt C — bang_view) ───────────────────────────
export type BangView = { id: string; ten: string; chu: string; cot: string[] }

/** Khoá bảng -> đường dẫn trang để revalidate cache khi đổi view. */
const DUONG_DAN_BANG: Record<string, string> = {
  cs_customers: '/khach-hang', installed_base: '/', tickets: '/ticket',
  maintenance: '/bao-tri', core: '/loi',
}

/** View của bảng: view CÁ NHÂN của mình + view CHUNG (mọi người). */
export async function listBangView(bang: string): Promise<BangView[]> {
  const u = await requireStaff()
  // ĐỌC danh sách view — mọi nhân sự. KHÔNG dùng he_thong.view_chung ở đây:
  // quyền đó là quyền GHI view dùng chung (mức Trưởng CSKH), mà hàm này được gọi
  // khi vẽ MỌI trang danh sách. Đòi quyền ghi để đọc = nhân viên thường mở trang
  // nào cũng bị đá về "không đủ quyền". Đã dính thật khi thử tay 21/08.
  await doQuyen('he_thong.view_xem')
  const email = u.email ?? ''
  const { data, error } = await dataClient().from('bang_view')
    .select('id, ten, chu, cot').eq('bang', bang)
    .or(`chu.eq.chung,chu.eq.${email}`).order('ten')
  if (error) throw new Error(error.message)
  return (data ?? []) as BangView[]
}

/** Lưu view. chung=true (mọi người thấy) chỉ ADMIN được lưu. */
export async function luuBangView(bang: string, ten: string, cot: string[], chung: boolean) {
  const u = await requireStaff()
  const t = ten.trim()
  if (!t) return { ok: false as const, error: 'Nhập tên view.' }
  if (!cot.length) return { ok: false as const, error: 'View phải có ít nhất 1 cột.' }
  if (chung && !(await coQuyen('he_thong.view_chung', 'QUANLY'))) return { ok: false as const, error: 'Chỉ quản lý/admin lưu view chung.' }
  const chu = chung ? 'chung' : (u.email ?? '')
  const { error } = await dataClient().from('bang_view')
    .insert({ bang, ten: t, chu, cot, tao_boi: u.email ?? null })
  if (error) return { ok: false as const, error: error.message }
  await ghiAudit('luu_bang_view', bang, { ten: t, chung })
  revalidatePath(DUONG_DAN_BANG[bang] ?? '/khach-hang')
  return { ok: true as const }
}

/** Xoá view — chủ view hoặc admin. */
export async function xoaBangView(id: string) {
  const u = await requireStaff()
  const db = dataClient()
  const { data } = await db.from('bang_view').select('chu, bang').eq('id', id).maybeSingle()
  const row = data as { chu: string; bang: string } | null
  if (row?.chu !== (u.email ?? '') && !(await coQuyen('he_thong.view_chung', 'QUANLY'))) return { ok: false as const, error: KHONG_DU_QUYEN }
  const { error } = await db.from('bang_view').delete().eq('id', id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(DUONG_DAN_BANG[row?.bang ?? ''] ?? '/khach-hang')
  return { ok: true as const }
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
  await doQuyen('cs.ticket.xem')
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
  await doQuyen('cs.ticket.xem')
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
  await doQuyen('cs.ticket.xem')
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
  await doQuyen('cs.ticket.xem')
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

// ── Q3: quản lý nhóm lỗi — tạo/sửa/xoá + gán tay ticket + gợi ý gom ──────────

export type NhomLoiChiTiet = {
  code: string; ten: string; mo_ta: string | null; muc_do: MucDo; bao_hang: boolean
  mau_mo_ta: string; mau_may: string | null; thu_tu: number | null
}
export type NhomLoiInput = {
  code: string; ten: string; mo_ta?: string; muc_do: MucDo; bao_hang: boolean
  mau_mo_ta: string; mau_may?: string; thu_tu?: number
}
export type NhomChon = { code: string; ten: string; muc_do: MucDo }

const MUC_DO_HOP_LE: readonly MucDo[] = ['an_toan', 'nghiem_trong', 'thuong', 'nhe', 'khong_loi']

/** 1 nhóm lỗi để sửa (đọc thẳng bảng issue_group, không qua view báo cáo). */
export async function nhomLoiChiTiet(code: string): Promise<NhomLoiChiTiet | null> {
  await requireStaff()
  await doQuyen('cs.ticket.xem')
  const { data, error } = await dataClient()
    .from('issue_group')
    .select('code, ten, mo_ta, muc_do, bao_hang, mau_mo_ta, mau_may, thu_tu')
    .eq('code', code).maybeSingle()
  if (error) throw new Error(error.message)
  return (data ?? null) as NhomLoiChiTiet | null
}

/** Danh sách nhóm lỗi để CHỌN (gán tay ticket). */
export async function nhomLoiChon(): Promise<NhomChon[]> {
  await requireStaff()
  await doQuyen('cs.ticket.xem')
  const { data, error } = await dataClient()
    .from('issue_group').select('code, ten, muc_do').order('thu_tu')
  if (error) throw new Error(error.message)
  return (data ?? []) as NhomChon[]
}

/**
 * Mẫu regex có biên dịch được trong Postgres không.
 * Chặn mẫu hỏng lưu vào issue_group -> nếu không, `van_ban ~* mau` ném lỗi làm
 * VỠ v_ticket_issue cho mọi người. Không dùng RegExp của JS được vì mẫu hiện có
 * xài cú pháp POSIX (\m \M) mà JS coi là sai.
 */
async function regexPgHopLe(db: ReturnType<typeof dataClient>, mau: string): Promise<boolean> {
  const { data, error } = await db.rpc('kiem_tra_regex_pg', { p: mau })
  if (error) throw new Error(error.message)
  return data === true
}

function chuanMaNhom(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
}

/** Tạo nhóm lỗi mới. CHỈ ADMIN. Validate mã + mức độ + mẫu regex. */
export async function taoNhomLoi(
  input: NhomLoiInput
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  await requireStaff()
  if (!(await coQuyen('cs.nhom_loi.cau_hinh', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  const code = chuanMaNhom(input.code)
  if (code.length < 2) return { ok: false, error: 'Mã nhóm cần ≥2 ký tự (A-Z, 0-9, gạch ngang).' }
  const ten = input.ten.trim()
  if (!ten) return { ok: false, error: 'Thiếu tên nhóm.' }
  if (!MUC_DO_HOP_LE.includes(input.muc_do)) return { ok: false, error: 'Mức độ không hợp lệ.' }
  const mau = input.mau_mo_ta.trim()
  const db = dataClient()
  if (!(await regexPgHopLe(db, mau))) return { ok: false, error: 'Mẫu mô tả (regex) rỗng hoặc sai cú pháp.' }
  const mauMay = input.mau_may?.trim()
  if (mauMay && !(await regexPgHopLe(db, mauMay))) return { ok: false, error: 'Mẫu model (regex) sai cú pháp.' }
  const { error } = await db.from('issue_group').insert({
    code, ten, mo_ta: input.mo_ta?.trim() || null, muc_do: input.muc_do,
    bao_hang: input.bao_hang, mau_mo_ta: mau, mau_may: mauMay || null,
    thu_tu: input.thu_tu ?? 100,
  })
  if (error) {
    if (error.code === '23505') return { ok: false, error: `Mã nhóm "${code}" đã tồn tại.` }
    return { ok: false, error: error.message }
  }
  await ghiAudit('tao_nhom_loi', `nhom:${code}`, { ten, muc_do: input.muc_do })
  revalidatePath('/nhom-loi')
  return { ok: true, code }
}

/** Sửa nhóm lỗi (KHÔNG đổi mã). CHỈ ADMIN. */
export async function suaNhomLoi(
  code: string, input: Omit<NhomLoiInput, 'code'>
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff()
  if (!(await coQuyen('cs.nhom_loi.cau_hinh', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  const ten = input.ten.trim()
  if (!ten) return { ok: false, error: 'Thiếu tên nhóm.' }
  if (!MUC_DO_HOP_LE.includes(input.muc_do)) return { ok: false, error: 'Mức độ không hợp lệ.' }
  const mau = input.mau_mo_ta.trim()
  const db = dataClient()
  if (!(await regexPgHopLe(db, mau))) return { ok: false, error: 'Mẫu mô tả (regex) rỗng hoặc sai cú pháp.' }
  const mauMay = input.mau_may?.trim()
  if (mauMay && !(await regexPgHopLe(db, mauMay))) return { ok: false, error: 'Mẫu model (regex) sai cú pháp.' }
  const { error, count } = await db.from('issue_group').update({
    ten, mo_ta: input.mo_ta?.trim() || null, muc_do: input.muc_do,
    bao_hang: input.bao_hang, mau_mo_ta: mau, mau_may: mauMay || null,
    thu_tu: input.thu_tu ?? 100, updated_at: new Date().toISOString(),
  }, { count: 'exact' }).eq('code', code)
  if (error) return { ok: false, error: error.message }
  if (!count) return { ok: false, error: 'Không tìm thấy nhóm để sửa.' }
  await ghiAudit('sua_nhom_loi', `nhom:${code}`, { ten })
  revalidatePath('/nhom-loi'); revalidatePath(`/nhom-loi/${code}`)
  return { ok: true }
}

/** Xoá nhóm lỗi (FK cascade tự xoá override của nhóm). CHỈ ADMIN. */
export async function xoaNhomLoi(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff()
  if (!(await coQuyen('cs.nhom_loi.cau_hinh', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  const { error } = await dataClient().from('issue_group').delete().eq('code', code)
  if (error) return { ok: false, error: error.message }
  await ghiAudit('xoa_nhom_loi', `nhom:${code}`)
  revalidatePath('/nhom-loi')
  return { ok: true }
}

/** Gán tay 1 ticket vào 1 nhóm (issue_override gan=true -> nguồn 'người'). CHỈ ADMIN. */
export async function ganTicketVaoNhom(
  ticketCode: string, groupCode: string, lyDo?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff()
  if (!(await coQuyen('cs.nhom_loi.gan_ticket', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  const nv = await layNhanVien()
  const { error } = await dataClient().from('issue_override').upsert({
    ticket_code: ticketCode, group_code: groupCode, gan: true,
    ly_do: lyDo?.trim() || null, nguoi_sua: nv?.email ?? nv?.ten ?? null,
  }, { onConflict: 'ticket_code,group_code' })
  if (error) return { ok: false, error: error.message }
  await ghiAudit('gan_nhom_loi', `ticket:${ticketCode}`, { nhom: groupCode })
  revalidatePath(`/ticket/${ticketCode}`); revalidatePath('/nhom-loi'); revalidatePath(`/nhom-loi/${groupCode}`)
  return { ok: true }
}

/** Bỏ gán tay (xoá dòng override). CHỈ ADMIN. */
export async function boGanNhom(
  ticketCode: string, groupCode: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff()
  if (!(await coQuyen('cs.nhom_loi.gan_ticket', 'QUANLY'))) return { ok: false, error: KHONG_DU_QUYEN }
  const { error } = await dataClient().from('issue_override').delete()
    .eq('ticket_code', ticketCode).eq('group_code', groupCode)
  if (error) return { ok: false, error: error.message }
  await ghiAudit('bo_gan_nhom_loi', `ticket:${ticketCode}`, { nhom: groupCode })
  revalidatePath(`/ticket/${ticketCode}`); revalidatePath('/nhom-loi'); revalidatePath(`/nhom-loi/${groupCode}`)
  return { ok: true }
}

/** Gợi ý gom nhóm từ ticket CHƯA phân nhóm (có mô tả). Rule-based, chỉ đọc. */
export async function goiYGomNhom(toiThieu = 3): Promise<CumGoiY[]> {
  await requireStaff()
  await doQuyen('cs.ticket.xem')
  const chua = await ticketsChuaPhanNhom('')
  const coMoTa = chua
    .filter((t) => t.description && !t.ly_do.startsWith('thiếu mô tả'))
    .map((t) => ({ ticket_code: t.ticket_code, description: t.description }))
  return goiYGomTu(coMoTa, toiThieu)
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
  await doQuyen('cs.khach.xem')
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
      ngtu: t.ngtu, ngden: t.ngden,
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
      { trang, moiTrang, cot: t.cot, chieu: t.chieu, loaiTicket: t.loai || undefined, ngtu: t.ngtu, ngden: t.ngden }
    ),
    (r) => r.ticket_code,
    TOI_DA_CHON
  )
}

export async function khoaTatCaLoi(t: ThamSoLoc): Promise<string[]> {
  return gomKhoa(
    (trang, moiTrang) => coreForecast(t.tt ?? '', t.q ?? '', { trang, moiTrang, cot: t.cot, chieu: t.chieu, ngtu: t.ngtu, ngden: t.ngden }),
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
    (trang, moiTrang) => maintenanceDue(t.tt ?? '', t.q ?? '', { trang, moiTrang, cot: t.cot, chieu: t.chieu, ngtu: t.ngtu, ngden: t.ngden }),
    (r) => r.visit_id,
    TOI_DA_CHON
  )
}

export async function khoaTatCaSerial(t: ThamSoLoc): Promise<string[]> {
  return gomKhoa(
    (trang, moiTrang) => searchSerialsTrang(t.q ?? '', { trang, moiTrang }, t.tt),
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
  if (!(await coQuyen('he_thong.catalog', 'ADMIN'))) return { ok: false as const, error: KHONG_DU_QUYEN }
  const { data, error } = await dataClient().rpc('sync_catalog')
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/dong-bo-catalog')
  return { ok: true as const, ket_qua: data as { ok: boolean; tables: Record<string, unknown>; msg: string | null } }
}

/** Nhật ký các lần đồng bộ gần nhất (admin xem). */
export async function catalogSyncLast(n = 10): Promise<CatalogSyncLog[]> {
  await requireStaff()
  if (!(await coQuyen('he_thong.catalog', 'ADMIN'))) throw new Error(KHONG_DU_QUYEN)
  const { data, error } = await dataClient()
    .from('catalog_sync_log').select('id, chay_luc, ok, chi_tiet, thong_bao, ms')
    .order('id', { ascending: false }).limit(n)
  if (error) throw new Error(error.message)
  return (data ?? []) as CatalogSyncLog[]
}

// ── Nhật ký thao tác (audit_log — Đợt A2) ───────────────────────────────────
export type AuditRow = {
  id: number
  luc: string
  actor: string | null
  hanh_dong: string
  doi_tuong: string | null
  chi_tiet: Record<string, unknown> | null
  ket_qua: string
}

/** Vết thao tác nhạy cảm gần nhất (CHỈ ADMIN xem). */
export async function auditLog(limit = 100, hanhDong?: string): Promise<AuditRow[]> {
  await requireStaff()
  if (!(await coQuyen('he_thong.nhat_ky', 'ADMIN'))) throw new Error(KHONG_DU_QUYEN)
  let q = dataClient()
    .from('audit_log').select('id, luc, actor, hanh_dong, doi_tuong, chi_tiet, ket_qua')
  if (hanhDong) q = q.eq('hanh_dong', hanhDong)
  const { data, error } = await q.order('id', { ascending: false }).limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as AuditRow[]
}
