import 'server-only'
import { Readable } from 'node:stream'
import { drive as driveClient, auth, type drive_v3 } from '@googleapis/drive'

/**
 * Kho file trên Google Drive (Shared Drive) — chỉ chạy server (route handler /
 * server action, sau requireStaff()). Cấu trúc thư mục trong Shared Drive:
 *   <GDRIVE_ROOT_FOLDER_ID>/tickets/<ticket_code>/...
 *   <GDRIVE_ROOT_FOLDER_ID>/bao-tri/<visit_id>/...
 *
 * Service account KHÔNG có quota riêng — file bắt buộc nằm trong Shared Drive
 * (dung lượng pool Workspace), nên mọi call đều kèm supportsAllDrives.
 */

const MIME_FOLDER = 'application/vnd.google-apps.folder'

type CauHinh = { sharedDriveId: string; rootFolderId: string; drive: drive_v3.Drive }

let cauHinh: CauHinh | null = null

/** Đọc env lazily + throw rõ ràng (mẫu dataClient() trong lib/supabase.ts). */
function layDrive(): CauHinh {
  if (cauHinh) return cauHinh
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  const sharedDriveId = process.env.GDRIVE_SHARED_DRIVE_ID
  const rootFolderId = process.env.GDRIVE_ROOT_FOLDER_ID
  if (!keyJson || !sharedDriveId || !rootFolderId) {
    throw new Error(
      'Thiếu cấu hình Google Drive (GOOGLE_SERVICE_ACCOUNT_KEY / GDRIVE_SHARED_DRIVE_ID / ' +
        'GDRIVE_ROOT_FOLDER_ID). Xem docs/huong-dan-kho-anh-google-drive.md.'
    )
  }
  let sa: { client_email: string; private_key: string }
  try {
    sa = JSON.parse(keyJson)
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY không phải JSON hợp lệ (dán nguyên nội dung file key).')
  }
  const jwt = new auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
  cauHinh = { sharedDriveId, rootFolderId, drive: driveClient({ version: 'v3', auth: jwt }) }
  return cauHinh
}

/** Escape cho chuỗi nằm trong query q của Drive API. */
const escQ = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

/** Tìm folder con theo tên, chưa có thì tạo — trả folderId. */
async function timHoacTaoFolder(tenCon: string, chaId: string): Promise<string> {
  const { drive, sharedDriveId } = layDrive()
  const { data } = await drive.files.list({
    q: `'${escQ(chaId)}' in parents and name = '${escQ(tenCon)}' and mimeType = '${MIME_FOLDER}' and trashed = false`,
    corpora: 'drive',
    driveId: sharedDriveId,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    fields: 'files(id)',
    pageSize: 1,
  })
  const co = data.files?.[0]?.id
  if (co) return co
  const { data: moi } = await drive.files.create({
    requestBody: { name: tenCon, mimeType: MIME_FOLDER, parents: [chaId] },
    supportsAllDrives: true,
    fields: 'id',
  })
  if (!moi.id) throw new Error('Không tạo được thư mục trên Drive.')
  return moi.id
}

const TEN_SCOPE = { ticket: 'tickets', bao_tri: 'bao-tri' } as const
export type EntityType = keyof typeof TEN_SCOPE

/** Tải file lên Shared Drive theo scope — trả drive fileId. */
export async function taiLenDrive(input: {
  buffer: Buffer
  mime: string
  filename: string
  entityType: EntityType
  entityId: string
}): Promise<string> {
  const { drive, rootFolderId } = layDrive()
  const scopeId = await timHoacTaoFolder(TEN_SCOPE[input.entityType], rootFolderId)
  const folderId = await timHoacTaoFolder(input.entityId, scopeId)
  const { data } = await drive.files.create({
    requestBody: { name: input.filename, parents: [folderId] },
    media: { mimeType: input.mime, body: Readable.from(input.buffer) },
    supportsAllDrives: true,
    fields: 'id',
  })
  if (!data.id) throw new Error('Upload Drive không trả về fileId.')
  return data.id
}

/** Stream nội dung file (proxy cho NV đã đăng nhập xem — không lộ link công khai). */
export async function taiVeDrive(fileId: string): Promise<{ stream: Readable; mime: string | null }> {
  const { drive } = layDrive()
  const meta = await drive.files.get({ fileId, supportsAllDrives: true, fields: 'mimeType' })
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  )
  return { stream: res.data as unknown as Readable, mime: meta.data.mimeType ?? null }
}

/**
 * Ảnh thu nhỏ do Drive dựng sẵn (thumbnailLink, đổi hậu tố =sNNN để chỉnh cỡ).
 * Link tạm + cần cookie? Không — thumbnailLink fetch được từ server trong ~vài giờ.
 * Không có (video chưa dựng xong, file lạ) -> trả null để caller fallback file gốc.
 */
export async function layThumbDrive(fileId: string, size = 400): Promise<Response | null> {
  const { drive } = layDrive()
  const { data } = await drive.files.get({ fileId, supportsAllDrives: true, fields: 'thumbnailLink' })
  if (!data.thumbnailLink) return null
  const url = data.thumbnailLink.replace(/=s\d+$/, `=s${size}`)
  const res = await fetch(url)
  return res.ok ? res : null
}

/** Xoá hẳn file trên Drive (đi kèm soft-delete row media). */
export async function xoaDrive(fileId: string): Promise<void> {
  const { drive } = layDrive()
  await drive.files.delete({ fileId, supportsAllDrives: true })
}
