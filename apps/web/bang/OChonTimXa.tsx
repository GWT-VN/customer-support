'use client'

import { useEffect, useRef, useState } from 'react'
import type { MucChon } from './OChonGoiY'

/**
 * Ô CHỌN GÕ-ĐỂ-TÌM, danh sách lấy TỪ SERVER.
 *
 * Khác `OChonGoiY` ở đúng một chỗ: `OChonGoiY` lọc một danh sách đã nạp sẵn ở
 * client (tỉnh, mã sản phẩm — vài chục mục, biết trước). Ô này dành cho tập
 * KHÔNG nạp trước được: khách (hàng trăm và còn tăng), ticket, đơn. Nạp hết về
 * trình duyệt để lọc là vừa nặng vừa cũ.
 *
 * Vẫn tuân luật CEO chốt 22/08: quá 10 mục thì phải gõ để tìm.
 *
 * Hai cái bẫy của tìm-xa mà ô này đã xử:
 *  1. Câu trả lời về TRỄ ghi đè câu mới hơn — gõ "ngu" rồi "nguyen", kết quả của
 *     "ngu" về sau thì màn hình hiện sai. Mỗi lượt tìm mang một số thứ tự, về
 *     muộn thì bỏ.
 *  2. Gõ tới đâu gọi tới đó là spam server. Chờ 250ms im phím mới gọi.
 */

/** Dưới ngần này ký tự thì không gọi server — phải khớp với RPC phía dưới. */
export const TOI_THIEU_KY_TU = 2

export function OChonTimXa({
  tim,
  onChon,
  choTrong = 'Gõ để tìm…',
  tuDongMo = false,
}: {
  /** Gọi server. Trả tối đa vài mục; ném lỗi thì ô hiện câu lỗi, không im lặng. */
  tim: (tuKhoa: string) => Promise<MucChon[]>
  onChon: (m: MucChon) => void
  choTrong?: string
  tuDongMo?: boolean
}) {
  const [q, setQ] = useState('')
  const [ds, setDs] = useState<MucChon[]>([])
  const [dangTim, setDangTim] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const oRef = useRef<HTMLInputElement>(null)
  const luot = useRef(0)

  useEffect(() => { if (tuDongMo) oRef.current?.focus() }, [tuDongMo])

  useEffect(() => {
    const s = q.trim()
    if (s.length < TOI_THIEU_KY_TU) { setDs([]); setDangTim(false); setLoi(null); return }

    const cua = ++luot.current
    setDangTim(true)
    const hen = setTimeout(async () => {
      try {
        const kq = await tim(s)
        if (cua !== luot.current) return   // câu trả lời cũ về muộn — bỏ
        setDs(kq); setLoi(null)
      } catch (e) {
        if (cua !== luot.current) return
        setDs([]); setLoi(e instanceof Error ? e.message : 'Không tìm được')
      } finally {
        if (cua === luot.current) setDangTim(false)
      }
    }, 250)
    return () => clearTimeout(hen)
  }, [q, tim])

  const s = q.trim()

  return (
    <div className="relative">
      <input
        ref={oRef}
        value={q}
        placeholder={choTrong}
        onChange={(e) => setQ(e.target.value)}
        className="w-full rounded-lg border px-2.5 py-1.5"
        style={{
          fontSize: 13, background: 'var(--surface)',
          borderColor: 'var(--border)', color: 'var(--ink)',
        }}
      />
      {s.length >= TOI_THIEU_KY_TU && (
        <div
          className="absolute z-30 mt-1 max-h-64 w-full min-w-[260px] overflow-auto rounded-lg"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
        >
          {loi ? (
            <div className="px-3 py-2.5" style={{ fontSize: 12.5, color: 'var(--danger, #e11d48)' }}>{loi}</div>
          ) : dangTim ? (
            <div className="px-3 py-2.5" style={{ fontSize: 12.5, color: 'var(--faint)' }}>Đang tìm…</div>
          ) : ds.length === 0 ? (
            <div className="px-3 py-2.5" style={{ fontSize: 12.5, color: 'var(--faint)' }}>Không có mục nào khớp.</div>
          ) : (
            ds.map((m) => (
              <button
                key={m.gt}
                type="button"
                onClick={() => { onChon(m); setQ(''); setDs([]) }}
                className="block w-full px-3 py-2 text-left hover:opacity-80"
                style={{ fontSize: 13, color: 'var(--ink)' }}
              >
                <span style={{ fontWeight: 550 }}>{m.nhan}</span>
                {m.phu && <span className="ml-2" style={{ fontSize: 11.5, color: 'var(--faint)' }}>{m.phu}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
