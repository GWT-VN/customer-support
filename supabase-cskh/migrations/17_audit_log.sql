-- ══════════════════════════════════════════════════════════════════════════
-- 17 — audit_log (Đợt A2): vết ai · làm gì · lên bản ghi nào · lúc nào
-- Ghi ở các thao tác nhạy cảm (duyệt serial, duyệt khách, kích hoạt BH, sửa/khoá
-- NV, xoá...). App ghi bằng service_role. Chỉ ADMIN đọc (RLS Tầng 0).
-- audit KHÔNG được làm hỏng nghiệp vụ: app bọc try/catch khi ghi.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  luc        timestamptz not null default now(),
  actor      text,                 -- email NV thực hiện
  actor_id   uuid,                 -- staff.id nếu có
  hanh_dong  text not null,        -- vd 'duyet_serial','duyet_khach','kich_hoat_bh','sua_nv','xoa_muc_ticket'
  doi_tuong  text,                 -- 'serial:ABC' | 'khach:<uuid>' | 'ticket:GWT-...' | 'nv:<uuid>'
  chi_tiet   jsonb,                -- payload/tóm tắt
  ket_qua    text not null default 'ok'   -- 'ok' | 'loi:...'
);

create index if not exists audit_log_luc_idx on public.audit_log (luc desc);
create index if not exists audit_log_hanh_dong_idx on public.audit_log (hanh_dong);

alter table public.audit_log enable row level security;
-- Chỉ admin đọc; ghi chỉ qua service_role (bypass RLS) — không policy insert cho authenticated.
drop policy if exists audit_read_admin on public.audit_log;
create policy audit_read_admin on public.audit_log
  for select to authenticated using (public.is_admin());
