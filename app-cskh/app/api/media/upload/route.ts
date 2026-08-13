import { NextResponse, type NextRequest } from 'next/server'
import { dataClient, layNhanVien, requireStaff } from '@/lib/supabase'
import { taiLenDrive } from '@/lib/drive'
import { kiemTraFileMedia, laEntityType } from '@/lib/media'

// Drive SDK + Buffer cần Node, không chạy trên edge.
export const runtime = 'nodejs'

/**
 * Nhận multipart (entity_type, entity_id, file) → đẩy lên Shared Drive → ghi
 * metadata vào bảng media. Ảnh đã nén ở client (DinhKemMedia) nên thường <1MB;
 * mức trần 4MB chặn nốt video to (v1 chưa transcode).
 */
export async function POST(request: NextRequest) {
  await requireStaff()

  const form = await request.formData()
  const entityType = form.get('entity_type')
  const entityId = form.get('entity_id')
  const file = form.get('file')

  if (!laEntityType(entityType) || typeof entityId !== 'string' || !entityId.trim()) {
    return NextResponse.json({ error: 'Thiếu hoặc sai entity_type / entity_id.' }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Thiếu file.' }, { status: 400 })
  }
  const kt = kiemTraFileMedia(file.type, file.size)
  if (!kt.ok) return NextResponse.json({ error: kt.error }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  let driveFileId: string
  try {
    driveFileId = await taiLenDrive({
      buffer,
      mime: file.type,
      filename: file.name || 'khong-ten',
      entityType,
      entityId: entityId.trim(),
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Upload Drive thất bại.' },
      { status: 502 }
    )
  }

  const nv = await layNhanVien()
  const db = dataClient()
  const { data, error } = await db
    .from('media')
    .insert({
      entity_type: entityType,
      entity_id: entityId.trim(),
      drive_file_id: driveFileId,
      filename: file.name || null,
      mime: file.type,
      size_bytes: file.size,
      uploaded_by: nv?.email ?? null,
    })
    .select('id, entity_type, entity_id, filename, mime, size_bytes, uploaded_by, created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit theo mẫu ghiAudit trong actions.ts: nuốt lỗi, không chặn nghiệp vụ.
  try {
    await db.from('audit_log').insert({
      actor: nv?.email ?? null,
      actor_id: nv?.id ?? null,
      hanh_dong: 'media_upload',
      doi_tuong: `${entityType}:${entityId}`,
      chi_tiet: { media_id: data.id, filename: file.name, size_bytes: file.size },
      ket_qua: 'ok',
    })
  } catch {}

  return NextResponse.json(data)
}
