'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { dataClient } from '@/lib/nen-tang/db'
import { coTheVaoSales } from '@/lib/nen-tang/gac-cong'
import { requireNhanSu } from '@/lib/nen-tang/phien'
import { coQuyen } from '@/lib/nen-tang/kiem-quyen'
import type { Bac } from '../_ctkm'

const KHONG_DU_QUYEN = 'Bạn không có quyền làm việc này.'

async function chanXem() {
  await requireNhanSu()
  if (!(await coTheVaoSales())) redirect('/?loi=khong_du_quyen')
  if (!(await coQuyen('sales.ctkm.xem', 'NHANVIEN'))) redirect('/?loi=khong_du_quyen')
}

export type DongGia = {
  ma: string
  ten: string
  gia_vat: number
  vat_pct: number | null
  vat_loai: string | null
}

/** Bảng giá niêm yết — gương từ Masterdata, khu Sales chỉ ĐỌC. */
export async function bangGiaNiemYet(): Promise<DongGia[]> {
  await chanXem()
  const db = dataClient()
  const [gia, cat] = await Promise.all([
    db.from('product_price').select('internal_code, gia_vat, vat_pct').eq('kenh', 'NIEM_YET'),
    db.from('catalog_item').select('"Mã nội bộ","Tên ngắn gọn (đề xuất)",vat_loai'),
  ])
  const meta = new Map<string, { ten: string; loai: string | null }>()
  for (const r of ((cat.data ?? []) as Array<Record<string, unknown>>)) {
    const ma = String(r['Mã nội bộ'] ?? '').trim()
    if (ma) meta.set(ma, { ten: String(r['Tên ngắn gọn (đề xuất)'] ?? ma).trim(), loai: (r.vat_loai as string) ?? null })
  }
  return ((gia.data ?? []) as Array<Record<string, unknown>>)
    .map((g) => {
      const ma = g.internal_code as string
      const m = meta.get(ma)
      return {
        ma,
        ten: m?.ten ?? ma,
        gia_vat: Number(g.gia_vat) || 0,
        vat_pct: g.vat_pct == null ? null : Number(g.vat_pct),
        vat_loai: m?.loai ?? null,
      }
    })
    .sort((a, b) => b.gia_vat - a.gia_vat)
}

export type DongChinhSach = {
  ma: string
  ten: string
  niem_yet: number
  /** Theo bậc: { giam_pct, gia_ban, nhap_theo } — null nghĩa là chưa có chính sách. */
  bac: Record<Bac, { giam_pct: number | null; gia_ban: number | null; nhap_theo: 'PCT' | 'GIA' } | null>
}

/** Chính sách giá 3 bậc, gộp theo mã sản phẩm để hiện thành một bảng. */
export async function chinhSachGia(): Promise<DongChinhSach[]> {
  await chanXem()
  const db = dataClient()
  const [gia, cs] = await Promise.all([
    bangGiaNiemYet(),
    db.from('sales_chinh_sach_gia').select('*').neq('trang_thai', 'thay_the'),
  ])
  const theoMa = new Map<string, DongChinhSach>()
  for (const g of gia) {
    theoMa.set(g.ma, {
      ma: g.ma, ten: g.ten, niem_yet: g.gia_vat,
      bac: { NPP: null, DAI_LY: null, GIOI_THIEU: null },
    })
  }
  for (const r of ((cs.data ?? []) as Array<Record<string, unknown>>)) {
    const ma = r.internal_code as string
    const dong = theoMa.get(ma)
    if (!dong) continue // mã không còn giá niêm yết -> không hiện, tránh bảng có dòng chết
    dong.bac[r.bac as Bac] = {
      giam_pct: r.giam_pct == null ? null : Number(r.giam_pct),
      gia_ban: r.gia_ban == null ? null : Number(r.gia_ban),
      nhap_theo: (r.nhap_theo as 'PCT' | 'GIA') ?? 'PCT',
    }
  }
  return [...theoMa.values()]
}

type Kq = { ok: true } | { ok: false; error: string }

/**
 * Lưu một ô chính sách. Ghi CẢ `giam_pct` LẪN `gia_ban` + `nhap_theo` — xem lý do
 * trong migration: giữ đúng con số người nhập thấy, khỏi lệch vài đồng do làm tròn.
 */
export async function luuOChinhSach(
  bac: Bac,
  internalCode: string,
  nhapTheo: 'PCT' | 'GIA',
  giaTri: number | null,
  niemYet: number
): Promise<Kq> {
  await chanXem()
  if (!(await coQuyen('sales.ctkm.soan', 'NHANVIEN'))) return { ok: false, error: KHONG_DU_QUYEN }
  const db = dataClient()

  // Xoá ô = xoá chính sách của mã đó ở bậc đó.
  if (giaTri == null || !Number.isFinite(giaTri)) {
    await db.from('sales_chinh_sach_gia').delete().eq('bac', bac).eq('internal_code', internalCode)
    revalidatePath('/sales/gia/chinh-sach')
    return { ok: true }
  }
  if (niemYet <= 0) return { ok: false, error: 'Mã này chưa có giá niêm yết nên không tính được.' }

  const pct = nhapTheo === 'PCT' ? giaTri : Math.round((1 - giaTri / niemYet) * 1000) / 10
  const gia = nhapTheo === 'PCT' ? Math.round(niemYet * (1 - giaTri / 100)) : Math.round(giaTri)
  if (gia < 0) return { ok: false, error: 'Giá bán ra số âm — kiểm lại mức giảm.' }

  const homNay = new Date()
  const iso = `${homNay.getFullYear()}-${String(homNay.getMonth() + 1).padStart(2, '0')}-${String(homNay.getDate()).padStart(2, '0')}`

  await db.from('sales_chinh_sach_gia').delete().eq('bac', bac).eq('internal_code', internalCode)
  const { error } = await db.from('sales_chinh_sach_gia').insert({
    bac, internal_code: internalCode,
    giam_pct: pct, gia_ban: gia, nhap_theo: nhapTheo,
    hieu_luc_tu: iso, trang_thai: 'ban_hanh',
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/sales/gia/chinh-sach')
  return { ok: true }
}

export type DoiTac = {
  id: string
  customer_code: string
  ten: string | null
  bac: Bac
  hieu_luc_tu: string
  ghi_chu: string | null
}

export async function danhSachDoiTac(): Promise<DoiTac[]> {
  await chanXem()
  const db = dataClient()
  const { data } = await db.from('sales_bac_khach').select('*').is('hieu_luc_den', null).order('bac')
  const ds = (data ?? []) as Array<Record<string, unknown>>
  if (!ds.length) return []
  const ma = [...new Set(ds.map((r) => r.customer_code as string))]
  const { data: kh } = await db.from('customers').select('customer_code, name').in('customer_code', ma)
  const ten = new Map(((kh ?? []) as Array<Record<string, unknown>>).map((k) => [k.customer_code as string, (k.name as string) ?? null]))
  return ds.map((r) => ({
    id: r.id as string,
    customer_code: r.customer_code as string,
    ten: ten.get(r.customer_code as string) ?? null,
    bac: r.bac as Bac,
    hieu_luc_tu: r.hieu_luc_tu as string,
    ghi_chu: (r.ghi_chu as string) ?? null,
  }))
}

/** Gợi ý khách cho ô gán bậc — gõ tên/SĐT/mã để tìm, không dropdown (luật số 2). */
export async function timKhachChoBac(q: string): Promise<{ gt: string; nhan: string; phu?: string }[]> {
  await chanXem()
  const s = q.replace(/[,%()\\*]/g, ' ').trim().slice(0, 60)
  if (s.length < 2) return []
  const { data } = await dataClient()
    .from('customers')
    .select('customer_code, name, phone_chuan, province')
    .or(`name.ilike.%${s}%,phone_chuan.ilike.%${s}%,customer_code.ilike.%${s}%`)
    .limit(20)
  return ((data ?? []) as Array<Record<string, unknown>>).map((k) => ({
    gt: k.customer_code as string,
    nhan: (k.name as string) ?? (k.customer_code as string),
    phu: [k.phone_chuan, k.province].filter(Boolean).join(' · ') || undefined,
  }))
}

export async function ganBac(customerCode: string, bac: Bac, ghiChu: string | null): Promise<Kq> {
  await chanXem()
  if (!(await coQuyen('sales.ctkm.soan', 'NHANVIEN'))) return { ok: false, error: KHONG_DU_QUYEN }
  if (!customerCode) return { ok: false, error: 'Chưa chọn khách.' }
  const db = dataClient()

  // Một khách chỉ có MỘT bậc đang hiệu lực. Gán bậc mới thì đóng bậc cũ lại thay vì
  // xoá — giữ lịch sử để tra được đơn cũ đã hưởng bậc nào.
  const homNay = new Date()
  const iso = `${homNay.getFullYear()}-${String(homNay.getMonth() + 1).padStart(2, '0')}-${String(homNay.getDate()).padStart(2, '0')}`
  await db.from('sales_bac_khach').update({ hieu_luc_den: iso }).eq('customer_code', customerCode).is('hieu_luc_den', null)

  const { error } = await db.from('sales_bac_khach').insert({
    customer_code: customerCode, bac, hieu_luc_tu: iso, ghi_chu: ghiChu,
    tao_boi: (await requireNhanSu()).email ?? null,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/sales/gia/doi-tac')
  return { ok: true }
}

/** Gỡ bậc = đóng lại từ hôm nay. Khách quay về KHÁCH LẺ, hưởng CTKM theo kênh. */
export async function goBac(customerCode: string): Promise<Kq> {
  await chanXem()
  if (!(await coQuyen('sales.ctkm.soan', 'NHANVIEN'))) return { ok: false, error: KHONG_DU_QUYEN }
  const homNay = new Date()
  const iso = `${homNay.getFullYear()}-${String(homNay.getMonth() + 1).padStart(2, '0')}-${String(homNay.getDate()).padStart(2, '0')}`
  const { error } = await dataClient()
    .from('sales_bac_khach')
    .update({ hieu_luc_den: iso })
    .eq('customer_code', customerCode)
    .is('hieu_luc_den', null)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/sales/gia/doi-tac')
  return { ok: true }
}
