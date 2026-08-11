-- 28_serial_su_dung.sql
-- A — Vòng đời máy: trạng thái sử dụng của từng serial + nhật ký sự kiện.
--
-- serial_registry.trang_thai:
--   ton_kho    — tồn kho, sẵn sàng lắp/bán
--   da_lap     — đang lắp cho khách (có trong installed_base)
--   trung_bay  — máy trưng bày (showroom)
--   mkt        — dùng cho marketing / quay phim
--   bao_tri    — thu hồi từ khách do đổi máy (không gắn khách nữa, chờ xử lý)
--   thanh_ly   — đã thanh lý / loại bỏ
--
-- serial_su_dung: mỗi dòng 1 SỰ KIỆN đổi trạng thái (append-only) -> timeline ở /may/[serial].

alter table public.serial_registry
  add column if not exists trang_thai text not null default 'ton_kho';

-- Backfill: serial đang có trong installed_base -> da_lap; còn lại giữ ton_kho.
update public.serial_registry sr
set trang_thai = 'da_lap'
where sr.trang_thai = 'ton_kho'
  and exists (select 1 from public.installed_base ib where ib.serial = sr.serial);

create table if not exists public.serial_su_dung (
  id uuid primary key default gen_random_uuid(),
  serial text not null,
  su_kien text not null,               -- nhãn: lap_dat / tra_kho / trung_bay / mkt / thu_hoi_bao_tri / thanh_ly / doi_serial…
  tu_trang_thai text,
  den_trang_thai text,
  customer_id uuid references public.cs_customers(id) on delete set null,
  ghi_chu text,
  boi text,                            -- email nhân viên thao tác
  luc timestamptz not null default now()
);
create index if not exists serial_su_dung_serial_idx on public.serial_su_dung(serial, luc desc);

-- RLS bật + 0 policy = chỉ service_role (đồng bộ quy ước bảng CSKH khác).
alter table public.serial_su_dung enable row level security;
