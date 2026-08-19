'use client'

/**
 * Mảnh giao diện dùng chung của khu Việc — bám theo mockup "GWT Work — Mockup".
 * Màu lấy từ biến CSS trong `[data-khu="work"]` (xem app/globals.css), KHÔNG
 * viết hex rải rác: đổi tông sau này chỉ sửa một chỗ.
 */
import { chuTat } from '@/lib/work'

/** Bảng màu avatar của mockup. Chọn theo tên nên cùng một người luôn ra cùng màu. */
const MAU_AVATAR = ['#2f7d8a', '#b5642a', '#5560c9', '#7a8a2f', '#b0518f', '#3f8a6a', '#8a52b8', '#0e1c1f']

export function mauTheoTen(ten: string | null | undefined): string {
  const s = (ten ?? '').trim()
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return MAU_AVATAR[h % MAU_AVATAR.length]
}

/** Avatar tròn. `vien` = viền theo màu nhấn, đánh dấu "người phụ trách". */
export function Avatar({
  ten, chuThich, co = 25, vien = false,
}: { ten: string; chuThich?: string; co?: number; vien?: boolean }) {
  return (
    <span
      title={chuThich ?? ten}
      className="rounded-full grid place-items-center font-bold text-white flex-none"
      style={{
        width: co, height: co,
        fontSize: co * 0.42,
        background: mauTheoTen(ten),
        border: '2px solid var(--surface)',
        boxShadow: vien ? '0 0 0 2px var(--accent)' : undefined,
      }}
    >
      {chuTat(ten)}
    </span>
  )
}

/** Chồng avatar, tràn thì hiện "+n". */
export function ChongAvatar({
  nguoi, toiDa = 3, co = 25,
}: { nguoi: { ten: string; role?: string; chuThich?: string }[]; toiDa?: number; co?: number }) {
  const hien = nguoi.slice(0, toiDa)
  const du = nguoi.length - hien.length
  return (
    <span className="flex" aria-label="Người làm">
      {hien.map((n, i) => (
        <span key={i} style={{ marginLeft: i === 0 ? 0 : -7 }}>
          <Avatar ten={n.ten} chuThich={n.chuThich} co={co} vien={n.role === 'owner'} />
        </span>
      ))}
      {du > 0 && (
        <span
          className="rounded-full grid place-items-center font-bold flex-none"
          style={{
            width: co, height: co, marginLeft: -7, fontSize: co * 0.4,
            background: 'var(--surface-3)', color: 'var(--muted)',
            border: '2px solid var(--surface)',
          }}
        >+{du}</span>
      )}
    </span>
  )
}

/** Chip bo tròn có chấm màu — dùng cho team, loại việc, khoá nối ERP. */
export function Chip({
  chamMau, mono = false, children,
}: { chamMau?: string; mono?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-[5px] rounded-full whitespace-nowrap ${mono ? 'mono' : ''}`}
      style={{
        fontSize: mono ? 11 : 11.5, fontWeight: 550, padding: '3px 8px',
        border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--ink-2)',
      }}
    >
      {chamMau && (
        <span className="rounded-full flex-none" style={{ width: 6, height: 6, background: chamMau }} />
      )}
      {children}
    </span>
  )
}

/** Tiêu đề nhóm: tên + số đếm + đường kẻ chạy hết dòng (như mockup). */
export function TieuDeNhom({
  nhan, so, khan = false,
}: { nhan: string; so: number; khan?: boolean }) {
  return (
    <h2
      className="flex items-center gap-[9px] m-0 mb-2.5 ml-0.5"
      style={{ fontSize: 12.5, fontWeight: 650, letterSpacing: '.02em', color: khan ? 'var(--red)' : 'var(--ink-2)' }}
    >
      {nhan}
      <span
        className="mono rounded-full"
        style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', background: 'var(--surface-3)', padding: '3px 8px' }}
      >{so}</span>
      <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
    </h2>
  )
}

/** Một ô trong dải thống kê đầu trang. */
export function OThongKe({
  nhan, so, phu, mauCham, mauSo, noiBat = false,
}: { nhan: string; so: number; phu: string; mauCham: string; mauSo?: string; noiBat?: boolean }) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 11, padding: '13px 15px', boxShadow: 'var(--shadow)',
      }}
    >
      {noiBat && (
        <span
          className="absolute rounded-full"
          style={{ right: -8, top: -8, width: 66, height: 66, background: 'var(--accent-wash)', opacity: .5 }}
          aria-hidden
        />
      )}
      <div
        className="flex items-center gap-1.5 uppercase"
        style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.04em', color: 'var(--muted)' }}
      >
        <span className="rounded-full" style={{ width: 7, height: 7, background: mauCham }} />
        {nhan}
      </div>
      <div className="so" style={{ fontSize: 27, fontWeight: 680, letterSpacing: '-.02em', marginTop: 9, color: mauSo }}>
        {so}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{phu}</div>
    </div>
  )
}

/** Nút chính (teal) và nút phụ (viền) theo mockup. */
export function Nut({
  chinh = false, className = '', style, ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { chinh?: boolean }) {
  return (
    <button
      {...p}
      className={`inline-flex items-center gap-[7px] rounded-[9px] disabled:opacity-50 ${className}`}
      style={{
        padding: '7px 12px', fontWeight: 600, fontSize: 13,
        ...(chinh
          ? { background: 'var(--accent)', border: '1px solid var(--accent)', color: '#fff', boxShadow: '0 2px 8px -2px rgba(14,140,154,.6)' }
          : { background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--ink-2)' }),
        ...style,
      }}
    />
  )
}

/** Ô nhập / select dùng chung — gom style về một chỗ cho đồng bộ. */
export const oNhap: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 9,
  padding: '7px 11px',
  fontSize: 13,
  color: 'var(--ink)',
  outline: 'none',
}

export const MAU_UT_VAR: Record<number, string> = {
  1: 'var(--red)', 2: 'var(--amber)', 3: 'var(--indigo)', 4: 'var(--border-strong)',
}

/** Màu ô kanban theo trạng thái. */
export const MAU_TRANG_THAI: Record<string, string> = {
  todo: 'var(--faint)',
  doing: 'var(--accent)',
  blocked: 'var(--red)',
  review: 'var(--amber)',
  done: 'var(--green)',
}
