import { describe, expect, it } from 'vitest'
import { MEDIA_MAX_BYTES, kiemTraFileMedia, kichThuocNen, laEntityType, nenDuoc } from './media'

describe('kiemTraFileMedia', () => {
  it('nhận ảnh/video hợp lệ trong mức dung lượng', () => {
    expect(kiemTraFileMedia('image/jpeg', 500_000)).toEqual({ ok: true })
    expect(kiemTraFileMedia('video/mp4', MEDIA_MAX_BYTES)).toEqual({ ok: true })
  })
  it('chặn mime lạ (pdf, exe, svg...)', () => {
    for (const mime of ['application/pdf', 'image/svg+xml', 'application/x-msdownload', '']) {
      const r = kiemTraFileMedia(mime, 1000)
      expect(r.ok).toBe(false)
    }
  })
  it('chặn file rỗng và file vượt 4MB', () => {
    expect(kiemTraFileMedia('image/jpeg', 0).ok).toBe(false)
    expect(kiemTraFileMedia('image/jpeg', MEDIA_MAX_BYTES + 1).ok).toBe(false)
  })
})

describe('kichThuocNen', () => {
  it('ảnh nhỏ hơn mức trần: giữ nguyên', () => {
    expect(kichThuocNen(800, 600)).toEqual({ w: 800, h: 600 })
    expect(kichThuocNen(1600, 900)).toEqual({ w: 1600, h: 900 })
  })
  it('ảnh ngang to: co cạnh dài về 1600, giữ tỉ lệ', () => {
    expect(kichThuocNen(4000, 3000)).toEqual({ w: 1600, h: 1200 })
  })
  it('ảnh dọc to: cạnh dài là chiều CAO', () => {
    expect(kichThuocNen(3000, 4000)).toEqual({ w: 1200, h: 1600 })
  })
  it('mức trần tuỳ biến', () => {
    expect(kichThuocNen(1000, 500, 100)).toEqual({ w: 100, h: 50 })
  })
  it('kích thước không hợp lệ: trả 0 (caller sẽ bỏ nén, up nguyên gốc)', () => {
    expect(kichThuocNen(0, 100)).toEqual({ w: 0, h: 0 })
  })
})

describe('laEntityType / nenDuoc', () => {
  it('chỉ nhận ticket | bao_tri', () => {
    expect(laEntityType('ticket')).toBe(true)
    expect(laEntityType('bao_tri')).toBe(true)
    expect(laEntityType('khach')).toBe(false)
    expect(laEntityType(null)).toBe(false)
  })
  it('GIF không nén (mất animation), JPEG/PNG/WebP nén', () => {
    expect(nenDuoc('image/gif')).toBe(false)
    expect(nenDuoc('image/jpeg')).toBe(true)
    expect(nenDuoc('video/mp4')).toBe(false)
  })
})
