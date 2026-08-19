import Link from 'next/link'
import { Suspense } from 'react'
import { issueReport, ticketsChuaPhanNhom, goiYGomNhom } from '@/app/actions'
import { laAdmin } from '@/lib/supabase'
import { MucDoBadge, BaoHangBadge } from '@/components/NhomLoiBadge'
import { OTimKiem } from '@/bang'
import { ThanhDangLoc } from '@/bang'

export default async function NhomLoiPage({
  searchParams,
}: {
  searchParams: Promise<{ bh?: string; q?: string; nguong?: string }>
}) {
  const { bh, q = '', nguong } = await searchParams
  const baoHangOnly = bh === '1'
  const nguongGom = Math.min(5, Math.max(2, Number(nguong) || 3))
  const [rows, chuaPhanNhom, goiY, admin] = await Promise.all([
    issueReport(baoHangOnly, q),
    ticketsChuaPhanNhom(q),
    goiYGomNhom(nguongGom),
    laAdmin(),
  ])

  const anToan = rows.filter((r) => r.muc_do === 'an_toan')
  const thieuMoTa = chuaPhanNhom.filter((t) => t.ly_do.startsWith('thiếu mô tả')).length

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">Nhóm lỗi</h1>
          {admin && (
            <Link href="/nhom-loi/moi" className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm font-medium">
              + Tạo nhóm lỗi
            </Link>
          )}
        </header>

        <Suspense>
          <OTimKiem placeholder="Gõ tên nhóm, mô tả lỗi, mã ticket…" />
        </Suspense>

        {anToan.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-900">
              🚨 <strong>Có {anToan.reduce((s, r) => s + r.so_ticket, 0)} ticket thuộc nhóm RỦI RO AN TOÀN</strong>{' '}
              ({anToan.map((r) => r.ten).join(', ')}). Gồm ca máy tự bốc khói và ca đun nóng liên tục —
              cần báo hãng kể cả khi ticket đã đóng.
            </p>
          </div>
        )}

        <div className="flex gap-2 flex-wrap items-center">
          <Link
            href={`/nhom-loi?${new URLSearchParams({ ...(q && { q }) })}`}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              !baoHangOnly ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'
            }`}
          >
            Tất cả nhóm
          </Link>
          <Link
            href={`/nhom-loi?${new URLSearchParams({ ...(q && { q }), bh: '1' })}`}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              baoHangOnly ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'
            }`}
          >
            Chỉ nhóm báo hãng
          </Link>
        </div>

        <p className="text-sm bg-slate-100 text-slate-600 rounded-lg px-3 py-2">
          Nhóm được gom <strong>tự động từ nội dung mô tả lỗi</strong>, không theo &ldquo;loại ticket&rdquo; của Odoo —
          vì loại ticket là kênh tiếp nhận (&ldquo;Khác&rdquo; chiếm 25%), không phải triệu chứng.
          Một ticket có thể thuộc nhiều nhóm. Bấm vào nhóm để soi từng ticket.
        </p>

        {/* PhanTrang vẫn không gắn: issueReport()/ticketsChuaPhanNhom() trả về TOÀN BỘ mảng
            đã lọc theo q, không phân trang (không có KetQuaTrang) — danh sách ngắn (13 nhóm)
            nên chưa cần, xem báo cáo Task 5a. */}
        <ThanhDangLoc
          dieuKien={q ? [{ nhan: 'Từ khoá', giaTri: q }] : []}
          hienThi={rows.length}
          tong={rows.length}
          nhan="nhóm lỗi"
        />

        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nhóm lỗi</th>
                <th className="text-left px-4 py-3 font-medium">Mức</th>
                <th className="text-right px-4 py-3 font-medium">Ticket</th>
                <th className="text-right px-4 py-3 font-medium">Đang mở</th>
                <th className="text-right px-4 py-3 font-medium">90 ngày</th>
                <th className="text-right px-4 py-3 font-medium">Khách</th>
                <th className="text-right px-4 py-3 font-medium">Máy</th>
                <th className="text-left px-4 py-3 font-medium">Model dính</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.code} className={`hover:bg-slate-50 align-top ${r.muc_do === 'an_toan' ? 'bg-red-50/50' : ''}`}>
                  <td className="px-4 py-3">
                    <Link href={`/nhom-loi/${r.code}`} prefetch={false} className="text-slate-900 underline font-medium">
                      {r.ten}
                    </Link>
                    {r.bao_hang && <span className="ml-2 inline-block"><BaoHangBadge /></span>}
                    {r.mo_ta && <div className="text-xs text-slate-500 mt-1 max-w-xl">{r.mo_ta}</div>}
                  </td>
                  <td className="px-4 py-3"><MucDoBadge muc_do={r.muc_do} /></td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">{r.so_ticket}</td>
                  <td className="px-4 py-3 text-right">
                    {r.dang_mo > 0
                      ? <span className="text-amber-700 font-medium">{r.dang_mo}</span>
                      : <span className="text-slate-400">0</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{r.trong_90_ngay}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{r.so_khach}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{r.so_may}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-500 max-w-xs">
                    {r.cac_model ?? <span className="text-slate-400">chưa gắn máy</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="font-medium text-amber-900">💡 Gợi ý gom nhóm mới ({goiY.length})</h2>
                <p className="text-sm text-amber-800">
                  Cụm từ lặp ở ≥{nguongGom} ticket <strong>chưa có nhóm</strong> — dấu hiệu nên lập nhóm để hệ tự gom về sau.
                  {admin ? ' Bấm "Tạo nhóm" để mở form đã điền sẵn mẫu.' : ' (Chỉ admin tạo được nhóm.)'}
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-amber-700">Ngưỡng:</span>
                {[2, 3, 4].map((n) => (
                  <Link key={n} href={`/nhom-loi?${new URLSearchParams({ ...(q && { q }), ...(baoHangOnly && { bh: '1' }), nguong: String(n) })}`}
                    className={`px-2 py-0.5 rounded border ${nguongGom === n ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-800 border-amber-300'}`}>
                    ≥{n}
                  </Link>
                ))}
              </div>
            </div>
            {goiY.length === 0 ? (
              <p className="text-sm text-amber-700">
                Chưa có cụm nào lặp đủ ≥{nguongGom} ticket. Khi cùng một triệu chứng xuất hiện thêm, gợi ý sẽ hiện ở đây;
                hạ ngưỡng để soi sớm hơn.
              </p>
            ) : (
            <div className="space-y-2">
              {goiY.map((c) => (
                <div key={c.tu} className="flex flex-wrap items-center gap-2 bg-white rounded-lg border border-amber-200 px-3 py-2">
                  <span className="font-medium text-slate-900">&ldquo;{c.tu}&rdquo;</span>
                  <span className="text-xs text-slate-500">{c.so} ticket</span>
                  <span className="flex flex-wrap gap-1">
                    {c.tickets.map((tc) => (
                      <Link key={tc} href={`/ticket/${tc}`} className="px-1.5 py-0.5 rounded border text-[11px] font-mono text-slate-600 hover:bg-slate-50">
                        {tc}
                      </Link>
                    ))}
                  </span>
                  {admin && (
                    <Link
                      href={`/nhom-loi/moi?${new URLSearchParams({ goi_y: c.tu, ten: c.tu, tickets: c.tickets.join(',') })}`}
                      className="ml-auto rounded-lg bg-slate-900 text-white px-3 py-1 text-xs font-medium"
                    >
                      Tạo nhóm
                    </Link>
                  )}
                </div>
              ))}
            </div>
            )}
        </div>

        {chuaPhanNhom.length > 0 && (
          <div className="bg-white rounded-xl border p-4 space-y-2">
            <h2 className="font-medium text-slate-900">
              {chuaPhanNhom.length} ticket chưa vào nhóm nào
            </h2>
            <p className="text-sm text-slate-600">
              {thieuMoTa > 0 && (
                <>
                  <strong>{thieuMoTa} ticket thiếu mô tả lỗi</strong> (Odoo để trống) — không có gì để gom,
                  phải mở ticket bổ sung nội dung khách báo.{' '}
                </>
              )}
              Số còn lại mô tả không khớp nhóm nào — cân nhắc tạo nhóm mới.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {chuaPhanNhom.map((t) => (
                <Link
                  key={t.ticket_code}
                  href={`/ticket/${t.ticket_code}`}
                  className="px-2 py-1 rounded border text-xs font-mono text-slate-700 hover:bg-slate-50"
                  title={t.ly_do}
                >
                  {t.ticket_code}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
