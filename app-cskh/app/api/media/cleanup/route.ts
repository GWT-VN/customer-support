import { NextResponse, type NextRequest } from 'next/server'
import { dataClient } from '@/lib/supabase'
import { xoaDrive } from '@/lib/drive'

export const runtime = 'nodejs'
// Chạy bởi pg_cron (không có session người dùng) — xác thực bằng secret riêng.
// proxy.ts đã cho đường này qua không cần đăng nhập.

const LA_404 = (e: unknown) => e instanceof Error && /404|not\s*found/i.test(e.message)

/**
 * Thu dọn định kỳ (Đợt 2 của kho media):
 *  1. Media của ticket đã đóng (Done/Cancel) quá `?thang` tháng (mặc định 12)
 *     → xoá file Drive + set deleted_at. Mỗi lần chạy tối đa `?gioi_han` file
 *     (mặc định 200) để không treo cron — còn dư thì lần chạy sau dọn tiếp.
 *  2. Row đã soft-delete quá 90 ngày → xoá hẳn khỏi bảng (file Drive đã xoá
 *     từ lúc soft-delete).
 * Log rõ vào audit_log, trả tóm tắt — không xoá lén.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.MEDIA_CLEANUP_SECRET
  if (!secret) return NextResponse.json({ error: 'Chưa cấu hình MEDIA_CLEANUP_SECRET.' }, { status: 503 })
  if (request.headers.get('x-media-cleanup-secret') !== secret) {
    return NextResponse.json({ error: 'Sai secret.' }, { status: 401 })
  }

  const sp = request.nextUrl.searchParams
  const thang = Math.max(1, Number(sp.get('thang')) || 12)
  const gioiHan = Math.min(1000, Math.max(1, Number(sp.get('gioi_han')) || 200))

  const db = dataClient()
  const mocDong = new Date()
  mocDong.setMonth(mocDong.getMonth() - thang)

  // 1) Ticket đã đóng đủ lâu (updated_at là lần đụng cuối — ticket Done/Cancel
  //    không ai sửa nữa nên chính là thời điểm đóng).
  const { data: dong, error: e1 } = await db
    .from('tickets')
    .select('ticket_code')
    .in('state', ['Done', 'Cancel'])
    .lt('updated_at', mocDong.toISOString())
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  const maDong = (dong ?? []).map((r) => r.ticket_code as string)

  let soXoa = 0
  let byteXoa = 0
  let loi = 0
  // .in() chunk 200 mã/lượt cho URL query không phình quá cỡ.
  for (let i = 0; i < maDong.length && soXoa < gioiHan; i += 200) {
    const { data: media, error } = await db
      .from('media')
      .select('id, drive_file_id, size_bytes')
      .eq('entity_type', 'ticket')
      .in('entity_id', maDong.slice(i, i + 200))
      .is('deleted_at', null)
      .limit(gioiHan - soXoa)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    for (const m of media ?? []) {
      try {
        await xoaDrive(m.drive_file_id)
      } catch (e) {
        if (!LA_404(e)) { loi++; continue }   // file đã mất trên Drive thì cứ dọn row
      }
      await db.from('media').update({ deleted_at: new Date().toISOString() }).eq('id', m.id)
      soXoa++
      byteXoa += m.size_bytes ?? 0
    }
  }

  // 2) Dọn hẳn row soft-delete cũ (>90 ngày) — giữ 90 ngày để còn tra audit chéo.
  const mocPurge = new Date()
  mocPurge.setDate(mocPurge.getDate() - 90)
  const { count: soPurge, error: e2 } = await db
    .from('media')
    .delete({ count: 'exact' })
    .lt('deleted_at', mocPurge.toISOString())
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

  const tomTat = {
    thang,
    ticket_dong: maDong.length,
    file_xoa: soXoa,
    byte_xoa: byteXoa,
    row_purge: soPurge ?? 0,
    loi_drive: loi,
  }
  try {
    await db.from('audit_log').insert({
      actor: 'cron',
      hanh_dong: 'media_cleanup',
      doi_tuong: 'media',
      chi_tiet: tomTat,
      ket_qua: loi ? 'co_loi' : 'ok',
    })
  } catch {}

  return NextResponse.json(tomTat)
}
