import Link from 'next/link'
import { Suspense } from 'react'
import { searchTickets, ticketTypes, khoaTatCaTicket, listBangView, type Ticket } from '@/app/actions'
import { currentStaff } from '@/lib/nen-tang/nhan-su'
import type { KetQuaTrang } from '@/bang'
import { ExportTicketButton } from '@/components/ExportTicketButton'
import { BangTicket } from '@/components/BangTicket'
import { laQuanLy } from '@/lib/nen-tang/gac-cong'
import { OTimKiem } from '@/bang'
import { ThanhDangLoc } from '@/bang'
import { PhanTrang } from '@/bang'
import { BoLocChon } from '@/bang'
import { LocNgay } from '@/bang'
import { docLocNgay, moTaLocNgay } from '@/lib/danhSach'
import { KhungChon, ThanhDaChon } from '@/bang'

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string; state?: string; khan?: string; mine?: string; trang?: string
    cot?: string; chieu?: string; loai?: string; ngtu?: string; ngden?: string
  }>
}) {
  const { q = '', state = '', khan = '', mine = '', trang: trangRaw, cot, chieu, loai = '', ngtu, ngden } = await searchParams
  const onlyKhan = khan === '1'
  const isMine = mine === '1'
  const trang = Math.max(1, Number(trangRaw) || 1)
  const me = isMine ? await currentStaff() : null
  // Gõ nguyên hình dạng KetQuaTrang<Ticket> (kể cả `trang`) cho nhánh rỗng — thiếu field
  // không lộ lỗi build ngay bây giờ (chưa ai đọc `trang`) nhưng Task 4 destructure vào là vỡ.
  const [ketQua, loaiList, admin] = await Promise.all([
    (isMine && !me
      ? Promise.resolve<KetQuaTrang<Ticket>>({
          rows: [], tong: 0, trang: 1, soTrang: 1,
          // Phải khớp mặc định của searchTickets, nếu không nhánh rỗng sẽ khoe
          // sai cột đang sắp ở ChipSapXep.
          sapXep: { cot: 'created_at', tang: false, macDinh: true },
        })
      : searchTickets(q, onlyKhan ? undefined : state || undefined, onlyKhan, me?.id, {
          trang, cot, chieu, loaiTicket: loai || undefined, ngtu, ngden,
        })),
    ticketTypes(),
    laQuanLy(),
  ])
  const views = await listBangView('tickets')
  const { rows: tickets, tong, soTrang, sapXep } = ketQua

  const tabs = [
    { key: '', label: 'Tất cả' },
    { key: 'Open', label: 'Đang mở' },
    { key: 'Done', label: 'Đã xong' },
    { key: 'Cancel', label: 'Đã huỷ' },
  ]

  // Link bỏ RIÊNG một điều kiện, giữ nguyên điều kiện khác (kể cả cột/chiều đang sắp).
  // state/khan/mine là tab điều hướng riêng (không phải chip ở ThanhDangLoc) nên vẫn
  // giữ nguyên — bỏ "Từ khoá" hay "Loại lỗi" không có nghĩa là rời khỏi tab đang chọn.
  function hrefBoDieuKien(bo: 'q' | 'loai' | 'ngay') {
    const params = new URLSearchParams()
    if (q && bo !== 'q') params.set('q', q)
    if (state) params.set('state', state)
    if (khan) params.set('khan', khan)
    if (mine) params.set('mine', mine)
    if (loai && bo !== 'loai') params.set('loai', loai)
    if (ngtu && bo !== 'ngay') params.set('ngtu', ngtu)
    if (ngden && bo !== 'ngay') params.set('ngden', ngden)
    if (cot) params.set('cot', cot)
    if (chieu) params.set('chieu', chieu)
    const qs = params.toString()
    return qs ? `/ticket?${qs}` : '/ticket'
  }

  const { tu: ngTuOk, den: ngDenOk } = docLocNgay({ ngtu, ngden })
  const moTaNgay = moTaLocNgay(ngTuOk, ngDenOk, 'Ngày tạo')

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900">Ticket CSKH</h1>
            <Link href="/tao-ticket"
              className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm font-medium">+ Tạo ticket</Link>
          </div>
        </header>

        <Suspense>
          <OTimKiem placeholder="Gõ mã ticket, serial, tên khách, SĐT hoặc nội dung lỗi…" />
        </Suspense>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={`/ticket?${new URLSearchParams({ ...(q && { q }), ...(t.key && { state: t.key }) })}`}
                className={`px-3 py-1.5 rounded-lg text-sm border ${
                  !onlyKhan && !isMine && state === t.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'
                }`}
              >
                {t.label}
              </Link>
            ))}
            <Link
              href={`/ticket?${new URLSearchParams({ ...(q && { q }), khan: '1' })}`}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                onlyKhan ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-600 border-red-200'
              }`}
            >
              🔴 Khẩn
            </Link>
            <Link
              href={`/ticket?${new URLSearchParams({ ...(q && { q }), mine: '1' })}`}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                isMine ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'
              }`}
            >
              Việc của tôi
            </Link>
            <Suspense>
              {/* Danh sách chọn sinh từ ticketTypes() — chỉ liệt kê loại ĐANG thực sự có
                  trong cột ticket_type, không hardcode. */}
              <BoLocChon param="loai" nhan="Loại lỗi" tuyChon={loaiList.map((l) => ({ giaTri: l, nhan: l }))} />
            </Suspense>
            <Suspense>
              <LocNgay nhan="Ngày tạo" />
            </Suspense>
          </div>
        </div>

        <ThanhDangLoc
          dieuKien={[
            ...(q ? [{ nhan: 'Từ khoá', giaTri: q, href: hrefBoDieuKien('q') }] : []),
            ...(loai ? [{ nhan: 'Loại lỗi', giaTri: loai, href: hrefBoDieuKien('loai') }] : []),
            ...(moTaNgay ? [{ nhan: 'Ngày tạo', giaTri: moTaNgay.replace(/^Ngày tạo\s*[:=]?\s*/, ''), href: hrefBoDieuKien('ngay') }] : []),
          ]}
          hienThi={tickets.length}
          tong={tong}
          nhan="ticket"
          // Câu lệnh luôn .order('khan') TRƯỚC cột người dùng chọn -> phải nói ra,
          // không thì bấm "Ngày" thấy ticket cũ nằm trên ticket mới lại tưởng hỏng.
          sapXep={{ ...sapXep, ghiChu: 'Khẩn luôn lên đầu' }}
        />

        {/* Chỉ CHỌN dòng, chưa có hành động — chỗ cắm hành động ở children của
            <ThanhDaChon>, xem hướng dẫn trong components/ChonDong.tsx. */}
        <KhungChon
          khoaTrang={tickets.map((t) => t.ticket_code)}
          tong={tong}
          bat={admin}
          thamSo={{ q, state, khan, mine, loai, cot, chieu, ngtu, ngden }}
          layTatCaKhoa={khoaTatCaTicket}
        >
        <ThanhDaChon nhan="ticket" />
        <BangTicket rows={tickets} admin={admin} views={views}
          congCu={admin && <ExportTicketButton q={q} state={onlyKhan || isMine ? undefined : state || undefined} khan={onlyKhan} mine={isMine} ngtu={ngtu} ngden={ngden} />} />
        </KhungChon>

        <Suspense>
          <PhanTrang trang={trang} soTrang={soTrang} />
        </Suspense>
      </div>
    </main>
  )
}
