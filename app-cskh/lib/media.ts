/**
 * Luật chung cho kho ảnh/video (ticket + bảo trì) — phần THUẦN, không đụng
 * Drive/DB nên client lẫn server đều import được, và unit test được.
 */

/** ≤ ~4MB/file — nằm dưới giới hạn body ~4.5MB của Vercel; ảnh đã nén client thường <1MB. */
export const MEDIA_MAX_BYTES = 4 * 1024 * 1024

/** Ảnh + video phổ biến từ điện thoại/máy ảnh. Ngoài danh sách này là chặn. */
export const MEDIA_MIME_HOP_LE = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
] as const

export const ENTITY_TYPES = ['ticket', 'bao_tri'] as const
export type MediaEntityType = (typeof ENTITY_TYPES)[number]

export function laEntityType(s: unknown): s is MediaEntityType {
  return typeof s === 'string' && (ENTITY_TYPES as readonly string[]).includes(s)
}

/** Kiểm mime + size một file trước khi upload (dùng ở CẢ client lẫn route). */
export function kiemTraFileMedia(
  mime: string,
  sizeBytes: number
): { ok: true } | { ok: false; error: string } {
  if (!(MEDIA_MIME_HOP_LE as readonly string[]).includes(mime)) {
    return { ok: false, error: `Không nhận định dạng "${mime}" — chỉ ảnh (JPEG/PNG/WebP/GIF) hoặc video (MP4/MOV/WebM).` }
  }
  if (sizeBytes <= 0) return { ok: false, error: 'File rỗng.' }
  if (sizeBytes > MEDIA_MAX_BYTES) {
    const mb = (sizeBytes / 1024 / 1024).toFixed(1)
    return { ok: false, error: `File ${mb}MB vượt mức ${MEDIA_MAX_BYTES / 1024 / 1024}MB. Video dài hãy quay ngắn lại; ảnh sẽ tự nén.` }
  }
  return { ok: true }
}

/** Ảnh nào thì nén được bằng canvas (GIF bỏ qua để không mất animation). */
export function nenDuoc(mime: string): boolean {
  return mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp'
}

/**
 * Kích thước sau khi thu về cạnh dài ≤ maxCanh, GIỮ tỉ lệ; ảnh đã nhỏ thì giữ nguyên.
 * Tách thuần để test — phần canvas ở DinhKemMedia chỉ việc vẽ theo con số này.
 */
export function kichThuocNen(
  w: number,
  h: number,
  maxCanh = 1600
): { w: number; h: number } {
  if (w <= 0 || h <= 0) return { w: 0, h: 0 }
  const canhDai = Math.max(w, h)
  if (canhDai <= maxCanh) return { w, h }
  const tiLe = maxCanh / canhDai
  return { w: Math.round(w * tiLe), h: Math.round(h * tiLe) }
}
