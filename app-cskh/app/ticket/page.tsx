import Link from 'next/link'
import { Suspense } from 'react'
import { DieuHuong } from '@/components/DieuHuong'
import { searchTickets, currentStaff, ticketTypes, type KetQuaTrang, type Ticket } from '@/app/actions'
import { StateBadge, KhanBadge, MayThieuBadge, vnDateTime } from '@/components/TicketBadge'
import { ExportButton } from '@/components/ExportButton'
import { laAdmin } from '@/lib/supabase'
import { OTimKiem } from '@/components/OTimKiem'
import { ThanhDangLoc } from '@/components/ThanhDangLoc'
import { PhanTrang } from '@/components/PhanTrang'
import { TieuDeCotSapXep } from '@/components/TieuDeCotSapXep'
import { BoLocChon } from '@/components/BoLocChon'
import { KhungChon, OChonTatCa, OChonDong, ThanhDaChon } from '@/components/ChonDong'

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string; state?: string; khan?: string; mine?: string; trang?: string
    cot?: string; chieu?: string; loai?: string
  }>
}) {
  const { q = '', state = '', khan = '', mine = '', trang: trangRaw, cot, chieu, loai = '' } = await searchParams
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
          trang, cot, chieu, loaiTicket: loai || undefined,
        })),
    ticketTypes(),
    laAdmin(),
  ])
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
  function hrefBoDieuKien(bo: 'q' | 'loai') {
    const params = new URLSearchParams()
    if (q && bo !== 'q') params.set('q', q)
    if (state) params.set('state', state)
    if (khan) params.set('khan', khan)
    if (mine) params.set('mine', mine)
    if (loai && bo !== 'loai') params.set('loai', loai)
    if (cot) params.set('cot', cot)
    if (chieu) params.set('chieu', chieu)
    const qs = params.toString()
    return qs ? `/ticket?${qs}` : '/ticket'
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">Ticket CSKH</h1>
          <DieuHuong />
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
          </div>
          {admin && (
            <ExportButton q={q} state={onlyKhan || isMine ? undefined : state || undefined} khan={onlyKhan} mine={isMine} />
          )}
        </div>

        <ThanhDangLoc
          dieuKien={[
            ...(q ? [{ nhan: 'Từ khoá', giaTri: q, href: hrefBoDieuKien('q') }] : []),
            ...(loai ? [{ nhan: 'Loại lỗi', giaTri: loai, href: hrefBoDieuKien('loai') }] : []),
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
        <KhungChon khoaTrang={tickets.map((t) => t.ticket_code)} bat={admin}>
        <ThanhDaChon nhan="ticket" />
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <Suspense>
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <OChonTatCa nhan="ticket" />
                  <TieuDeCotSapXep cot="ticket_code" nhan="Mã" chieuMacDinh="asc" />
                  <TieuDeCotSapXep cot="created_at" nhan="Ngày" chieuMacDinh="desc" dangMacDinh />
                  <th className="text-left px-4 py-3 font-medium">Loại</th>
                  <TieuDeCotSapXep cot="customer_name" nhan="Khách" chieuMacDinh="asc" />
                  <th className="text-left px-4 py-3 font-medium">Máy</th>
                  <th className="text-left px-4 py-3 font-medium">Phụ trách</th>
                  <TieuDeCotSapXep cot="state" nhan="Trạng thái" chieuMacDinh="asc" />
                </tr>
              </thead>
            </Suspense>
            <tbody className="divide-y">
              {tickets.map((t) => (
                <tr key={t.ticket_code} className="hover:bg-slate-50 align-top">
                  <OChonDong khoa={t.ticket_code} moTa={`ticket ${t.ticket_code}`} />
                  <td className="px-4 py-3">
                    <Link href={`/ticket/${t.ticket_code}`} prefetch={false} className="font-mono text-xs text-slate-900 underline">
                      {t.ticket_code}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{vnDateTime(t.created_at)}</td>
                  <td className="px-4 py-3 text-slate-700 max-w-56">{t.ticket_type ?? '—'}</td>
                  <td className="px-4 py-3">
                    {t.customer_id ? (
                      <Link href={`/khach/${t.customer_id}`} prefetch={false} className="text-slate-900 underline">{t.customer_name}</Link>
                    ) : (
                      <span className="text-slate-500">{t.customer_name ?? '—'}</span>
                    )}
                    {t.primary_phone && <div className="font-mono text-xs text-slate-500">{t.primary_phone}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {t.serial ? (
                      <Link href={`/may/${encodeURIComponent(t.serial)}`} prefetch={false} className="text-slate-900 underline">
                        {t.product_name}
                      </Link>
                    ) : t.source_serial ? (
                      <MayThieuBadge t={t} />
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {t.cs_ten || t.ky_thuat_ten ? (
                      <>
                        {t.cs_ten && <div>CS: {t.cs_ten}</div>}
                        {t.ky_thuat_ten && <div>KT: {t.ky_thuat_ten}</div>}
                      </>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <KhanBadge khan={t.khan} />
                      <StateBadge state={t.state} />
                    </div>
                  </td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr>
                  <td colSpan={admin ? 8 : 7} className="px-4 py-10 text-center text-slate-400">
                    Không tìm thấy ticket nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </KhungChon>

        <Suspense>
          <PhanTrang trang={trang} soTrang={soTrang} />
        </Suspense>
      </div>
    </main>
  )
}
