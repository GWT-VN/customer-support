import { Readable } from 'node:stream'
import { NextResponse, type NextRequest } from 'next/server'
import { dataClient, requireStaff } from '@/lib/supabase'
import { layThumbDrive, taiVeDrive } from '@/lib/drive'

export const runtime = 'nodejs'

/**
 * Proxy stream file từ Drive — ảnh RIÊNG TƯ (nhà khách/khuôn mặt), chỉ NV đã
 * đăng nhập xem được, không bao giờ lộ link Drive công khai.
 * `?thumb` trả ảnh thu nhỏ Drive dựng sẵn (fallback file gốc nếu chưa có).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireStaff()
  const { id } = await params

  const { data: row, error } = await dataClient()
    .from('media')
    .select('drive_file_id, mime, filename')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!row) return NextResponse.json({ error: 'Không có file này.' }, { status: 404 })

  // File bất biến sau khi up (sửa = xoá + up lại) nên cho cache riêng tư 1 giờ.
  const headers: Record<string, string> = { 'Cache-Control': 'private, max-age=3600' }

  try {
    if (request.nextUrl.searchParams.has('thumb')) {
      const thumb = await layThumbDrive(row.drive_file_id)
      if (thumb?.body) {
        return new NextResponse(thumb.body, {
          headers: { ...headers, 'Content-Type': thumb.headers.get('content-type') ?? 'image/png' },
        })
      }
      // chưa có thumbnail (video đang dựng, định dạng lạ) -> rơi xuống file gốc
    }
    const { stream, mime } = await taiVeDrive(row.drive_file_id)
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        ...headers,
        'Content-Type': mime ?? row.mime ?? 'application/octet-stream',
        'Content-Disposition': `inline; filename="${encodeURIComponent(row.filename ?? id)}"`,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Không đọc được file từ Drive.' },
      { status: 502 }
    )
  }
}
