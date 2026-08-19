'use client'

/**
 * "Việc của tôi" — dải thống kê + các nhóm theo hạn, bám mockup GWT Work.
 * Logic gộp nằm ở lib/work.ts (có test); component chỉ lo hiển thị.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { doiTrangThai, type ViecRow, type NenTang } from '@/app/work/actions'
import { gomTheoHan, nhomTheoHan } from '@/lib/work'
import { DongViec } from './DongViec'
import { FormTaoViec } from './FormTaoViec'
import { ChiTietViec } from './ChiTietViec'
import { ThanhHangLoat } from './ThanhHangLoat'
import { TieuDeNhom, OThongKe } from './ui'

export function ViecCuaToi({ rowsBanDau, nenTang }: { rowsBanDau: ViecRow[]; nenTang: NenTang }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [mo, setMo] = useState<number | null>(null)
  const [loi, setLoi] = useState<string | null>(null)
  const [chon, setChon] = useState<Set<number>>(new Set())
  const [thongBao, setThongBao] = useState<string | null>(null)

  function doiChon(id: number, c: boolean) {
    setChon((cu) => {
      const moi = new Set(cu)
      if (c) moi.add(id); else moi.delete(id)
      return moi
    })
  }
  /** Tick ở đầu nhóm: chọn/bỏ cả nhóm một lần. */
  function chonCaNhom(ids: number[], c: boolean) {
    setChon((cu) => {
      const moi = new Set(cu)
      ids.forEach((i) => (c ? moi.add(i) : moi.delete(i)))
      return moi
    })
  }

  const nhom = gomTheoHan(rowsBanDau)

  // Thống kê tính ngay từ danh sách đang có — không gọi thêm DB.
  const soQuaHan = rowsBanDau.filter((v) => nhomTheoHan(v.due_at) === 'qua_han').length
  const soHomNay = rowsBanDau.filter((v) => nhomTheoHan(v.due_at) === 'hom_nay').length
  const soTuanNay = rowsBanDau.filter((v) => nhomTheoHan(v.due_at) === 'tuan_nay').length
  const soChoDuyet = rowsBanDau.filter((v) => v.my_role === 'reviewer' && v.status === 'review').length
  const soP1HomNay = rowsBanDau.filter((v) => nhomTheoHan(v.due_at) === 'hom_nay' && v.priority === 1).length

  function doi(id: number, status: string) {
    start(async () => {
      try {
        await doiTrangThai(id, status)
        setLoi(null)
        router.refresh()
      } catch (e) {
        setLoi(e instanceof Error ? e.message : 'Không đổi được trạng thái')
      }
    })
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <OThongKe
          nhan="Quá hạn" so={soQuaHan} phu={soQuaHan ? 'cần xử lý ngay' : 'không có việc trễ'}
          mauCham="var(--red)" mauSo={soQuaHan ? 'var(--red)' : undefined}
        />
        <OThongKe
          nhan="Hôm nay" so={soHomNay} phu={soP1HomNay ? `${soP1HomNay} việc P1` : 'không có việc P1'}
          mauCham="var(--amber)" noiBat
        />
        <OThongKe
          nhan="Tuần này" so={soTuanNay} phu="trong 7 ngày tới" mauCham="var(--accent)"
        />
        <OThongKe
          nhan="Chờ tôi nghiệm thu" so={soChoDuyet} phu="việc người khác làm xong" mauCham="var(--green)"
        />
      </div>

      <FormTaoViec nenTang={nenTang} onXong={() => router.refresh()} />

      {loi && (
        <p
          className="text-sm px-3 py-2 rounded-lg"
          style={{ color: 'var(--red)', background: 'var(--red-wash)', border: '1px solid var(--red)' }}
        >{loi}</p>
      )}
      {thongBao && (
        <p
          className="text-sm px-3 py-2 rounded-lg"
          style={{ color: 'var(--green)', background: 'var(--green-wash)', border: '1px solid var(--green)' }}
        >{thongBao}</p>
      )}

      {nhom.length === 0 ? (
        <div
          className="p-8 text-center"
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 11, boxShadow: 'var(--shadow)', color: 'var(--muted)', fontSize: 13.5,
          }}
        >
          Chưa có việc nào. Thêm việc đầu tiên ở trên.
        </div>
      ) : (
        nhom.map((g) => (
          <section key={g.nhom}>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={g.viec.every((v) => chon.has(v.id))}
                onChange={(e) => chonCaNhom(g.viec.map((v) => v.id), e.target.checked)}
                aria-label={`Chọn cả nhóm ${g.nhan}`}
                style={{ width: 14, height: 14, accentColor: 'var(--accent)' }}
              />
              <div className="flex-1">
                <TieuDeNhom nhan={g.nhan} so={g.viec.length} khan={g.nhom === 'qua_han'} />
              </div>
            </div>
            <ul
              className="overflow-hidden list-none p-0 m-0"
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 11, boxShadow: 'var(--shadow)',
              }}
            >
              {g.viec.map((v, i) => (
                <DongViec
                  key={v.id} v={v} pending={pending}
                  onDoiTrangThai={doi} onMo={setMo}
                  cuoi={i === g.viec.length - 1}
                  dangChon={chon.has(v.id)} onChon={doiChon}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      {pending && <p style={{ fontSize: 12, color: 'var(--faint)' }}>Đang lưu…</p>}

      {chon.size > 0 && (
        <ThanhHangLoat
          ids={[...chon]}
          nenTang={nenTang}
          onBoChon={() => setChon(new Set())}
          onXong={(tb) => { setThongBao(tb); setChon(new Set()); router.refresh() }}
        />
      )}
      {/* chừa chỗ để thanh hàng loạt không che dòng cuối */}
      {chon.size > 0 && <div style={{ height: 72 }} aria-hidden />}

      {mo !== null && (
        <ChiTietViec
          taskId={mo}
          nenTang={nenTang}
          onDong={() => setMo(null)}
          onDoi={() => router.refresh()}
        />
      )}
    </div>
  )
}
