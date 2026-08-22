'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { dataClient } from '@/lib/nen-tang/db'
import { coTheVaoSales } from '@/lib/nen-tang/gac-cong'
import { requireNhanSu } from '@/lib/nen-tang/phien'
import { coQuyen } from '@/lib/nen-tang/kiem-quyen'
import type { KieuGiam } from '../_ctkm'

const KHONG_DU_QUYEN = 'Bạn không có quyền làm việc này.'

/**
 * Gác khu Sales + quyền XEM khuyến mãi.
 *
 * Tham số thứ hai của coQuyen là LUẬT CŨ đang gác chỗ này, không phải mức quyền.
 * Đây là tính năng MỚI nên luật cũ = "ai vào được khu Sales" -> 'NHANVIEN'.
 * Riêng DUYỆT dùng 'ADMIN': cầu dao ma trận còn tắt thì chỉ Toàn quyền duyệt được,
 * là mặc định an toàn và đúng ý CEO (tài khoản CEO đang mang vai admin).
 */
async function chanXem() {
  await requireNhanSu()
  if (!(await coTheVaoSales())) redirect('/?loi=khong_du_quyen')
  if (!(await coQuyen('sales.ctkm.xem', 'NHANVIEN'))) redirect('/?loi=khong_du_quyen')
}

export type CtkmRow = {
  id: string
  ma: string | null
  ten: string
  tu_ngay: string
  den_ngay: string | null
  kieu_giam: KieuGiam
  muc_chung: number | null
  giam_toi_da: number | null
  nhom_khach: string
  trang_thai: string
  so_kenh: number
  so_sp: number
  so_qua: number
  /** Nhãn kênh gộp sẵn để bảng khỏi phải tra lại. */
  kenh_nhan: string[]
}

/** Bộ lọc danh sách khuyến mãi — tên tham số theo `docs/CHUAN-FILTER.md`. */
export type LocCtkm = {
  ngtu?: string
  ngden?: string
  /** Mã sản phẩm. Chương trình áp MỌI sản phẩm cũng khớp, vì nó bao gồm mã này. */
  sp?: string
  /** channel_id của dim_channel. */
  kenh?: string
  trang_thai?: string
}

/**
 * Danh sách chương trình.
 *
 * Lọc NGÀY theo phép GIAO NHAU hai khoảng, không phải "nằm gọn trong": chương trình
 * chạy vắt qua mốc lọc vẫn phải hiện, vì trong khoảng đó nó CÓ hiệu lực thật.
 */
export async function danhSachCtkm(loc: LocCtkm = {}): Promise<CtkmRow[]> {
  await chanXem()
  const db = dataClient()

  let q = db.from('sales_ctkm').select('*').order('tu_ngay', { ascending: false })
  // Giao nhau: bắt đầu trước khi khoảng lọc kết thúc, và kết thúc sau khi khoảng lọc bắt đầu.
  if (loc.ngden) q = q.lte('tu_ngay', loc.ngden)
  if (loc.ngtu) q = q.or(`den_ngay.is.null,den_ngay.gte.${loc.ngtu}`)
  if (loc.trang_thai) q = q.eq('trang_thai', loc.trang_thai)

  if (loc.kenh) {
    const { data: k } = await db.from('sales_ctkm_kenh').select('ctkm_id').eq('channel_id', Number(loc.kenh))
    const ids = [...new Set(((k ?? []) as Array<{ ctkm_id: string }>).map((r) => r.ctkm_id))]
    q = q.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)
  let ds = (data ?? []) as Array<Record<string, unknown>>
  if (!ds.length) return []

  if (loc.sp) {
    // Chương trình KHÔNG khai sản phẩm nào = áp cho MỌI sản phẩm -> vẫn khớp.
    // Lọc kiểu `.in()` thuần sẽ loại mất nhóm đó, nên phải xử ở đây.
    const { data: rows } = await db
      .from('sales_ctkm_sp')
      .select('ctkm_id, internal_code')
      .in('ctkm_id', ds.map((r) => r.id as string))
    const coKhai = new Set(((rows ?? []) as Array<{ ctkm_id: string }>).map((r) => r.ctkm_id))
    const khopMa = new Set(
      ((rows ?? []) as Array<{ ctkm_id: string; internal_code: string }>)
        .filter((r) => r.internal_code === loc.sp)
        .map((r) => r.ctkm_id)
    )
    ds = ds.filter((r) => !coKhai.has(r.id as string) || khopMa.has(r.id as string))
    if (!ds.length) return []
  }

  const ids = ds.map((r) => r.id as string)
  const [kenh, sp, qua, dim] = await Promise.all([
    db.from('sales_ctkm_kenh').select('ctkm_id, channel_id').in('ctkm_id', ids),
    db.from('sales_ctkm_sp').select('ctkm_id').in('ctkm_id', ids),
    db.from('sales_ctkm_qua').select('ctkm_id').in('ctkm_id', ids),
    db.from('dim_channel').select('id, channel_l1, channel_l2'),
  ])
  const tenKenh = new Map<number, string>()
  for (const d of ((dim.data ?? []) as Array<Record<string, unknown>>)) {
    const l1 = String(d.channel_l1 ?? '').trim()
    const l2 = String(d.channel_l2 ?? '').trim()
    tenKenh.set(d.id as number, l2 ? `${l1} · ${l2}` : l1)
  }
  const dem = (rows: Array<Record<string, unknown>> | null, id: string) =>
    (rows ?? []).filter((r) => r.ctkm_id === id).length

  return ds.map((r) => {
    const id = r.id as string
    const cuaCT = ((kenh.data ?? []) as Array<Record<string, unknown>>).filter((k) => k.ctkm_id === id)
    return {
      id,
      ma: (r.ma as string) ?? null,
      ten: r.ten as string,
      tu_ngay: r.tu_ngay as string,
      den_ngay: (r.den_ngay as string) ?? null,
      kieu_giam: r.kieu_giam as KieuGiam,
      muc_chung: r.muc_chung == null ? null : Number(r.muc_chung),
      giam_toi_da: r.giam_toi_da == null ? null : Number(r.giam_toi_da),
      nhom_khach: r.nhom_khach as string,
      trang_thai: r.trang_thai as string,
      so_kenh: cuaCT.length,
      so_sp: dem(sp.data as Array<Record<string, unknown>>, id),
      so_qua: dem(qua.data as Array<Record<string, unknown>>, id),
      kenh_nhan: cuaCT.map((k) => tenKenh.get(k.channel_id as number) ?? `#${k.channel_id}`),
    }
  })
}

/** Bộ cờ quyền cho giao diện — trang gọi một lần, truyền xuống để ẩn/hiện nút. */
export async function quyenCtkm(): Promise<{ soan: boolean; duyet: boolean }> {
  await chanXem()
  return {
    soan: await coQuyen('sales.ctkm.soan', 'NHANVIEN'),
    duyet: await coQuyen('sales.ctkm.duyet', 'ADMIN'),
  }
}

type Kq = { ok: true; id?: string } | { ok: false; error: string }

/**
 * BAN HÀNH — chỉ người có quyền duyệt. CEO chốt 21/08: người soạn và người duyệt
 * là hai vai khác nhau, nên rào ở đây KHÁC rào của nút Lưu nháp.
 */
export async function banHanh(id: string): Promise<Kq> {
  await chanXem()
  if (!(await coQuyen('sales.ctkm.duyet', 'ADMIN'))) return { ok: false, error: KHONG_DU_QUYEN }
  const db = dataClient()

  const { data: ct } = await db.from('sales_ctkm').select('id, trang_thai, tu_ngay').eq('id', id).maybeSingle()
  if (!ct) return { ok: false, error: 'Không tìm thấy chương trình.' }
  if ((ct as { trang_thai: string }).trang_thai !== 'nhap')
    return { ok: false, error: 'Chỉ ban hành được bản nháp.' }

  // Chương trình phải có ít nhất một kênh, nếu không nó không áp cho đơn nào —
  // ban hành một thứ không bao giờ chạy là loại lỗi im lặng.
  const { count } = await db
    .from('sales_ctkm_kenh')
    .select('*', { count: 'exact', head: true })
    .eq('ctkm_id', id)
  if (!count) return { ok: false, error: 'Chưa chọn kênh nào — chương trình sẽ không áp cho đơn nào. Thêm kênh rồi ban hành.' }

  const { error } = await db
    .from('sales_ctkm')
    .update({ trang_thai: 'ban_hanh', cap_nhat_luc: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/sales/ctkm')
  return { ok: true }
}

/** Kết thúc sớm — dừng từ hôm nay, KHÔNG xoá, để đơn cũ vẫn tra lại được. */
export async function ketThucSom(id: string): Promise<Kq> {
  await chanXem()
  if (!(await coQuyen('sales.ctkm.duyet', 'ADMIN'))) return { ok: false, error: KHONG_DU_QUYEN }
  const homNay = new Date()
  const iso = `${homNay.getFullYear()}-${String(homNay.getMonth() + 1).padStart(2, '0')}-${String(homNay.getDate()).padStart(2, '0')}`
  const { error } = await dataClient()
    .from('sales_ctkm')
    .update({ trang_thai: 'ket_thuc', den_ngay: iso, cap_nhat_luc: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/sales/ctkm')
  return { ok: true }
}

/**
 * Nhân bản một chương trình thành BẢN NHÁP mới, dời ngày sang tháng chỉ định.
 * Chép cả kênh, sản phẩm và quà — CEO chốt: tháng sau thường giống tháng trước,
 * chỉ chỉnh một chút.
 */
export async function nhanBan(id: string, thangMoi: string): Promise<Kq> {
  await chanXem()
  if (!(await coQuyen('sales.ctkm.soan', 'NHANVIEN'))) return { ok: false, error: KHONG_DU_QUYEN }
  if (!/^\d{4}-\d{2}$/.test(thangMoi)) return { ok: false, error: 'Tháng không hợp lệ.' }
  const db = dataClient()

  const { data: goc } = await db.from('sales_ctkm').select('*').eq('id', id).maybeSingle()
  if (!goc) return { ok: false, error: 'Không tìm thấy chương trình gốc.' }
  const g = goc as Record<string, unknown>

  // Giữ NGÀY trong tháng, chỉ dời tháng — "deal 9.9" sang tháng 10 thành 9/10.
  const doiThang = (d: string | null): string | null => {
    if (!d) return null
    const ngay = d.slice(8, 10)
    const cuoiThang = new Date(Number(thangMoi.slice(0, 4)), Number(thangMoi.slice(5, 7)), 0).getDate()
    const dd = Math.min(Number(ngay), cuoiThang)
    return `${thangMoi}-${String(dd).padStart(2, '0')}`
  }

  const { data: moi, error } = await db
    .from('sales_ctkm')
    .insert({
      ten: `${g.ten as string} (bản sao)`,
      mo_ta_khach: g.mo_ta_khach, luu_y_noi_bo: g.luu_y_noi_bo,
      tu_ngay: doiThang(g.tu_ngay as string), den_ngay: doiThang((g.den_ngay as string) ?? null),
      nhom_khach: g.nhom_khach, kieu_giam: g.kieu_giam, muc_chung: g.muc_chung,
      giam_toi_da: g.giam_toi_da, don_toi_thieu: g.don_toi_thieu, sl_toi_thieu: g.sl_toi_thieu,
      trang_thai: 'nhap',
      tao_boi: (await requireNhanSu()).email ?? null,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  const idMoi = (moi as { id: string }).id

  const [kenh, sp, qua] = await Promise.all([
    db.from('sales_ctkm_kenh').select('channel_id').eq('ctkm_id', id),
    db.from('sales_ctkm_sp').select('internal_code, muc').eq('ctkm_id', id),
    db.from('sales_ctkm_qua').select('internal_code_qua, so_luong, gia_tri_quy_doi, dieu_kien').eq('ctkm_id', id),
  ])
  const chep = async (bang: string, rows: Array<Record<string, unknown>> | null) => {
    if (rows?.length) await db.from(bang).insert(rows.map((r) => ({ ...r, ctkm_id: idMoi })))
  }
  await chep('sales_ctkm_kenh', kenh.data as Array<Record<string, unknown>>)
  await chep('sales_ctkm_sp', sp.data as Array<Record<string, unknown>>)
  await chep('sales_ctkm_qua', qua.data as Array<Record<string, unknown>>)

  revalidatePath('/sales/ctkm')
  return { ok: true, id: idMoi }
}

export type CtkmInput = {
  id?: string
  ten: string
  mo_ta_khach: string | null
  luu_y_noi_bo: string | null
  tu_ngay: string
  den_ngay: string | null
  nhom_khach: string
  kieu_giam: KieuGiam
  muc_chung: number | null
  giam_toi_da: number | null
  don_toi_thieu: number
  sl_toi_thieu: number
  kenh: number[]
  sp: { internal_code: string; muc: number | null }[]
  qua: { internal_code_qua: string; so_luong: number; gia_tri_quy_doi: number | null; dieu_kien: string | null }[]
}

/** Nguồn cho form: danh mục kênh 2 cấp + sản phẩm có giá niêm yết. */
export async function nguonChoForm(): Promise<{
  kenh: { id: number; l1: string; l2: string }[]
  sp: { ma: string; ten: string; gia: number | null }[]
}> {
  await chanXem()
  const db = dataClient()
  const [dim, gia, cat] = await Promise.all([
    db.from('dim_channel').select('id, channel_l1, channel_l2').order('channel_l1').order('channel_l2'),
    db.from('product_price').select('internal_code, gia_vat').eq('kenh', 'NIEM_YET'),
    db.from('catalog_item').select('"Mã nội bộ","Tên ngắn gọn (đề xuất)"'),
  ])
  const ten = new Map<string, string>()
  for (const r of ((cat.data ?? []) as Array<Record<string, string | null>>)) {
    const ma = (r['Mã nội bộ'] ?? '').trim()
    if (ma) ten.set(ma, (r['Tên ngắn gọn (đề xuất)'] || ma).trim())
  }
  return {
    kenh: ((dim.data ?? []) as Array<Record<string, unknown>>).map((d) => ({
      id: d.id as number,
      l1: String(d.channel_l1 ?? '').trim(),
      l2: String(d.channel_l2 ?? '').trim(),
    })),
    // Chỉ sản phẩm CÓ giá niêm yết — không có giá thì không tính được mức giảm.
    sp: ((gia.data ?? []) as Array<Record<string, unknown>>)
      .map((g) => ({
        ma: g.internal_code as string,
        ten: ten.get(g.internal_code as string) ?? (g.internal_code as string),
        gia: g.gia_vat == null ? null : Number(g.gia_vat),
      }))
      .sort((a, b) => (b.gia ?? 0) - (a.gia ?? 0)),
  }
}

export async function chiTietCtkm(id: string): Promise<CtkmInput | null> {
  await chanXem()
  const db = dataClient()
  const { data } = await db.from('sales_ctkm').select('*').eq('id', id).maybeSingle()
  if (!data) return null
  const r = data as Record<string, unknown>
  const [kenh, sp, qua] = await Promise.all([
    db.from('sales_ctkm_kenh').select('channel_id').eq('ctkm_id', id),
    db.from('sales_ctkm_sp').select('internal_code, muc').eq('ctkm_id', id),
    db.from('sales_ctkm_qua').select('internal_code_qua, so_luong, gia_tri_quy_doi, dieu_kien').eq('ctkm_id', id),
  ])
  return {
    id,
    ten: r.ten as string,
    mo_ta_khach: (r.mo_ta_khach as string) ?? null,
    luu_y_noi_bo: (r.luu_y_noi_bo as string) ?? null,
    tu_ngay: (r.tu_ngay as string) ?? '',
    den_ngay: (r.den_ngay as string) ?? null,
    nhom_khach: r.nhom_khach as string,
    kieu_giam: r.kieu_giam as KieuGiam,
    muc_chung: r.muc_chung == null ? null : Number(r.muc_chung),
    giam_toi_da: r.giam_toi_da == null ? null : Number(r.giam_toi_da),
    don_toi_thieu: Number(r.don_toi_thieu) || 0,
    sl_toi_thieu: Number(r.sl_toi_thieu) || 1,
    kenh: ((kenh.data ?? []) as Array<{ channel_id: number }>).map((k) => k.channel_id),
    sp: ((sp.data ?? []) as Array<Record<string, unknown>>).map((s) => ({
      internal_code: s.internal_code as string,
      muc: s.muc == null ? null : Number(s.muc),
    })),
    qua: ((qua.data ?? []) as Array<Record<string, unknown>>).map((q) => ({
      internal_code_qua: q.internal_code_qua as string,
      so_luong: Number(q.so_luong) || 1,
      gia_tri_quy_doi: q.gia_tri_quy_doi == null ? null : Number(q.gia_tri_quy_doi),
      dieu_kien: (q.dieu_kien as string) ?? null,
    })),
  }
}

/**
 * Lưu NHÁP. Luôn về trạng thái `nhap` — sửa một chương trình đang chạy thì nó
 * quay lại nháp và phải duyệt lại. Người soạn không tự đẩy thay đổi lên production.
 */
export async function luuNhap(input: CtkmInput): Promise<Kq> {
  await chanXem()
  if (!(await coQuyen('sales.ctkm.soan', 'NHANVIEN'))) return { ok: false, error: KHONG_DU_QUYEN }
  if (!input.ten?.trim()) return { ok: false, error: 'Chưa đặt tên chương trình.' }
  if (!input.tu_ngay) return { ok: false, error: 'Chưa chọn ngày bắt đầu.' }
  if (input.den_ngay && input.den_ngay < input.tu_ngay)
    return { ok: false, error: 'Ngày kết thúc đang trước ngày bắt đầu.' }

  const db = dataClient()
  const than = {
    ten: input.ten.trim(),
    mo_ta_khach: input.mo_ta_khach?.trim() || null,
    luu_y_noi_bo: input.luu_y_noi_bo?.trim() || null,
    tu_ngay: input.tu_ngay,
    den_ngay: input.den_ngay || null,
    nhom_khach: input.nhom_khach,
    kieu_giam: input.kieu_giam,
    muc_chung: input.muc_chung,
    giam_toi_da: input.kieu_giam === 'PCT' ? input.giam_toi_da : null,
    don_toi_thieu: input.don_toi_thieu || 0,
    sl_toi_thieu: input.sl_toi_thieu || 1,
    trang_thai: 'nhap',
    cap_nhat_luc: new Date().toISOString(),
  }

  let id = input.id
  if (id) {
    const { error } = await db.from('sales_ctkm').update(than).eq('id', id)
    if (error) return { ok: false, error: error.message }
  } else {
    const { data, error } = await db
      .from('sales_ctkm')
      .insert({ ...than, tao_boi: (await requireNhanSu()).email ?? null })
      .select('id')
      .single()
    if (error) return { ok: false, error: error.message }
    id = (data as { id: string }).id
  }

  // Thay TOÀN BỘ ba bảng con: đơn giản và đúng, vì form luôn gửi trạng thái đầy đủ.
  await Promise.all([
    db.from('sales_ctkm_kenh').delete().eq('ctkm_id', id),
    db.from('sales_ctkm_sp').delete().eq('ctkm_id', id),
    db.from('sales_ctkm_qua').delete().eq('ctkm_id', id),
  ])
  const them = async (bang: string, rows: Record<string, unknown>[]) => {
    if (rows.length) {
      const { error } = await db.from(bang).insert(rows)
      if (error) throw new Error(error.message)
    }
  }
  try {
    await them('sales_ctkm_kenh', input.kenh.map((c) => ({ ctkm_id: id, channel_id: c })))
    await them('sales_ctkm_sp', input.sp.map((s) => ({ ctkm_id: id, ...s })))
    await them('sales_ctkm_qua', input.qua.map((q) => ({ ctkm_id: id, ...q })))
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  revalidatePath('/sales/ctkm')
  return { ok: true, id }
}
