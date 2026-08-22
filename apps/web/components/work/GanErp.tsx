'use client'

/**
 * "Gắn với" trong panel chi tiết việc — nối việc sang khách / ticket / đơn.
 *
 * Đây là thứ khiến khu Việc khác một app to-do: từ việc bấm thẳng sang hồ sơ
 * khách, không phải nhớ mã rồi đi tìm lại.
 *
 * Liên kết là SOFT REF (giữ mã, không FK cứng). Khách bị gộp/xoá thì chip vẫn
 * còn để không mất dấu, chỉ là không bấm đi đâu được — `duongDanLink` trả null
 * và ở đây render ra thẻ trơ thay vì thẻ <a>.
 */

import { useState } from 'react'
import Link from 'next/link'
import { OChonTimXa } from '@/bang'
import type { MucChon } from '@/bang'
import { timErp, ganErp, boErp, type KQ } from '@/app/work/actions'
import { NHAN_LOAI_LINK, duongDanLink, type LienKet, type LoaiLink } from '@/lib/work'

const LOAI: LoaiLink[] = ['khach', 'ticket', 'don']

const CHO_TRONG: Record<LoaiLink, string> = {
  khach: 'Gõ tên khách, mã hoặc số điện thoại…',
  ticket: 'Gõ mã ticket hoặc nội dung…',
  don: 'Gõ mã đơn hoặc tên khách…',
}

export function GanErp({
  taskId, links, coTheSua, chay, pending,
}: {
  taskId: number
  links: LienKet[]
  coTheSua: boolean
  /** Bọc thao tác ghi của panel: hiện lỗi tại chỗ, nạp lại, báo danh sách ngoài. */
  chay: (fn: () => Promise<KQ<unknown>>) => void
  pending: boolean
}) {
  const [dangThem, setDangThem] = useState<LoaiLink | null>(null)

  function ganRoiDong(loai: LoaiLink, ma: string) {
    setDangThem(null)
    chay(() => ganErp(taskId, loai, ma))
  }

  async function timTheoLoai(loai: LoaiLink, tuKhoa: string): Promise<MucChon[]> {
    const kq = await timErp(loai, tuKhoa)
    if (!kq.ok) throw new Error(kq.loi ?? 'Không tìm được')
    return kq.duLieu.map((g) => ({ gt: g.ma, nhan: g.nhan, phu: g.phu ?? undefined }))
  }

  return (
    <div className="flex flex-col gap-2">
      {links.length === 0 && !coTheSua && (
        <p className="m-0" style={{ fontSize: 12, color: 'var(--faint)' }}>Chưa gắn với gì.</p>
      )}

      {links.length > 0 && (
        <ul className="list-none p-0 m-0 flex flex-wrap gap-1.5">
          {links.map((l) => {
            const href = duongDanLink(l)
            const noiDung = (
              <>
                <span style={{ fontSize: 10.5, fontWeight: 700, opacity: .65, textTransform: 'uppercase' }}>
                  {NHAN_LOAI_LINK[l.loai]}
                </span>
                <span style={{ fontWeight: 550 }}>{l.nhan}</span>
              </>
            )
            return (
              <li key={l.id}>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full"
                  style={{
                    fontSize: 11.5, padding: '3px 4px 3px 9px',
                    border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--ink-2)',
                  }}
                >
                  {href ? (
                    <Link href={href} className="inline-flex items-center gap-1.5" style={{ color: 'var(--accent-ink)' }}>
                      {noiDung}
                    </Link>
                  ) : (
                    // Mã treo: giữ chip để không mất dấu, nhưng nói rõ vì sao không bấm được.
                    <span className="inline-flex items-center gap-1.5" title="Bản ghi này không còn trong hệ thống">
                      {noiDung}
                    </span>
                  )}
                  {coTheSua && (
                    <button
                      type="button"
                      aria-label={`Bỏ gắn ${NHAN_LOAI_LINK[l.loai]} ${l.nhan}`}
                      title="Bỏ gắn"
                      disabled={pending}
                      onClick={() => chay(() => boErp(l.id))}
                      className="rounded-full inline-flex items-center justify-center"
                      /*
                        Vùng bấm 24x24: bản đầu chỉ 16x12 và tôi bấm trượt ngay khi
                        tự thử. Nút xoá nhỏ hơn đầu ngón tay là lỗi, không phải gọn.
                      */
                      style={{ fontSize: 13, color: 'var(--faint)', lineHeight: 1, width: 24, height: 24 }}
                    >×</button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {coTheSua && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {LOAI.map((k) => (
              <button
                key={k}
                type="button"
                disabled={pending}
                onClick={() => setDangThem(dangThem === k ? null : k)}
                className="rounded-full px-2.5 py-1"
                style={{
                  fontSize: 11.5, fontWeight: 600,
                  border: '1px solid var(--border)',
                  background: dangThem === k ? 'var(--surface-3)' : 'transparent',
                  color: dangThem === k ? 'var(--ink)' : 'var(--muted)',
                }}
              >+ {NHAN_LOAI_LINK[k]}</button>
            ))}
          </div>

          {dangThem && (
            <OChonTimXa
              key={dangThem}
              tuDongMo
              choTrong={CHO_TRONG[dangThem]}
              tim={(tk) => timTheoLoai(dangThem, tk)}
              onChon={(m) => ganRoiDong(dangThem, m.gt)}
            />
          )}
        </div>
      )}
    </div>
  )
}
