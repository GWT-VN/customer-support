'use client'

import { useEffect, useRef, useState } from 'react'
import { listMedia, xoaMedia, type MediaItem } from '@/app/actions'
import { kiemTraFileMedia, kichThuocNen, nenDuoc, type MediaEntityType } from '@/lib/media'

/**
 * Đính kèm ảnh/video dùng chung cho ticket + bảo trì.
 * Ảnh nén ngay tại trình duyệt (cạnh dài ≤1600px, JPEG 0.8) trước khi up —
 * file lưu trên Drive đã là bản nhỏ. Xem qua proxy /api/media/{id}: chỉ NV
 * đăng nhập thấy, không có link công khai.
 */

/** Nén một ảnh bằng canvas. Nén không được (ảnh hỏng, GIF, video) -> trả file gốc. */
async function nenAnh(file: File): Promise<File> {
  if (!nenDuoc(file.type)) return file
  try {
    const bmp = await createImageBitmap(file)
    const { w, h } = kichThuocNen(bmp.width, bmp.height)
    if (!w || !h) return file
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
    bmp.close()
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.8))
    if (!blob) return file
    // Hãn hữu bản nén to hơn gốc (ảnh vốn đã tối ưu) thì giữ gốc.
    if (blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

/** Upload qua XHR để có % tiến độ (fetch chưa cho theo dõi upload). */
function upXHR(
  form: FormData,
  onTienDo: (pt: number) => void
): Promise<{ ok: boolean; body: MediaItem | { error?: string } }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/media/upload')
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onTienDo(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => {
      let body: MediaItem | { error?: string }
      try { body = JSON.parse(xhr.responseText) } catch { body = { error: 'Máy chủ trả dữ liệu lạ.' } }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, body })
    }
    xhr.onerror = () => resolve({ ok: false, body: { error: 'Mất kết nối khi upload.' } })
    xhr.send(form)
  })
}

type DangUp = { key: string; ten: string; pt: number }

export function DinhKemMedia({
  entityType,
  entityId,
  items,
  choSua,
}: {
  entityType: MediaEntityType
  entityId: string
  /** Server component đã có sẵn thì truyền vào; bỏ trống -> tự nạp khi hiện (chỗ nhúng trong form client như BaoTriDoneButton). */
  items?: MediaItem[]
  choSua: boolean
}) {
  const [list, setList] = useState<MediaItem[]>(items ?? [])
  const [dangUp, setDangUp] = useState<DangUp[]>([])
  const [err, setErr] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const tuNap = items === undefined
  useEffect(() => {
    if (!tuNap) return
    let dung = false
    listMedia(entityType, entityId)
      .then((r) => { if (!dung) setList(r) })
      .catch(() => { if (!dung) setErr('Không tải được danh sách ảnh.') })
    return () => { dung = true }
  }, [tuNap, entityType, entityId])

  async function chonFile(files: FileList | null) {
    if (!files?.length) return
    setErr(null)
    for (const goc of Array.from(files)) {
      const file = await nenAnh(goc)
      const kt = kiemTraFileMedia(file.type, file.size)
      if (!kt.ok) { setErr(`${goc.name}: ${kt.error}`); continue }

      const key = `${Date.now()}-${goc.name}`
      setDangUp((c) => [...c, { key, ten: goc.name, pt: 0 }])
      const form = new FormData()
      form.set('entity_type', entityType)
      form.set('entity_id', entityId)
      form.set('file', file)
      const r = await upXHR(form, (pt) => setDangUp((c) => c.map((u) => (u.key === key ? { ...u, pt } : u))))
      setDangUp((c) => c.filter((u) => u.key !== key))
      if (r.ok) setList((c) => [...c, r.body as MediaItem])
      else setErr(`${goc.name}: ${(r.body as { error?: string }).error ?? 'Upload thất bại.'}`)
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  async function xoa(m: MediaItem) {
    if (!confirm(`Xoá "${m.filename ?? 'file'}"? File trên Drive cũng bị xoá.`)) return
    const r = await xoaMedia(m.id)
    if (!r.ok) { setErr(r.error); return }
    setList((c) => c.filter((x) => x.id !== m.id))
  }

  const laAnh = (m: MediaItem) => (m.mime ?? '').startsWith('image/')

  return (
    <div className="space-y-2">
      {list.length === 0 && dangUp.length === 0 && (
        <p className="text-sm text-slate-400">Chưa có ảnh/video nào.</p>
      )}

      {(list.length > 0 || dangUp.length > 0) && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {list.map((m) => (
            <figure key={m.id} className="relative group rounded-lg border overflow-hidden bg-slate-100">
              <a href={`/api/media/${m.id}`} target="_blank" rel="noreferrer" title={m.filename ?? undefined}>
                {laAnh(m) ? (
                  // eslint-disable-next-line @next/next/no-img-element -- ảnh qua proxy động, không dùng next/image
                  <img src={`/api/media/${m.id}?thumb`} alt={m.filename ?? ''} loading="lazy"
                    className="h-24 w-full object-cover" />
                ) : (
                  <span className="h-24 w-full flex flex-col items-center justify-center text-slate-500 text-xs gap-1 px-1">
                    <span className="text-xl">🎬</span>
                    <span className="truncate max-w-full">{m.filename ?? 'video'}</span>
                  </span>
                )}
              </a>
              {choSua && (
                <button onClick={() => xoa(m)} title="Xoá"
                  className="absolute top-1 right-1 rounded bg-black/50 text-white text-xs px-1.5 py-0.5 opacity-0 group-hover:opacity-100">
                  ✕
                </button>
              )}
            </figure>
          ))}
          {dangUp.map((u) => (
            <div key={u.key} className="h-24 rounded-lg border border-dashed flex flex-col items-center justify-center text-xs text-slate-500 gap-1 px-1">
              <span className="truncate max-w-full">{u.ten}</span>
              <span>{u.pt}%</span>
              <div className="w-4/5 h-1 bg-slate-200 rounded">
                <div className="h-1 bg-sky-500 rounded" style={{ width: `${u.pt}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {choSua && (
        <div className="flex items-center gap-2">
          <input ref={inputRef} type="file" multiple accept="image/*,video/*"
            onChange={(e) => chonFile(e.target.files)} className="hidden" id={`media-${entityType}-${entityId}`} />
          <label htmlFor={`media-${entityType}-${entityId}`}
            className="cursor-pointer rounded-lg border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            + Thêm ảnh / video
          </label>
          <span className="text-xs text-slate-400">Ảnh tự nén; video tối đa 4MB.</span>
        </div>
      )}

      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  )
}
