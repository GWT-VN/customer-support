-- 07 — Hệ serial (2026-07-29): mã quốc tế + hàng chờ duyệt serial mới tạo từ app CSKH.
-- Serial mới NV tạo vào serial_pending (chờ duyệt); admin duyệt -> đẩy lên serial_registry.

alter table public.serial_registry add column if not exists ma_quoc_te text;
comment on column public.serial_registry.ma_quoc_te is
  'Mã quốc tế của sản phẩm (vd LX-PCF-003-G) — khác model cụ thể & mã nội bộ gộp.';

create table if not exists public.serial_pending (
  id            uuid primary key default gen_random_uuid(),
  serial        text not null,
  code          text,
  model         text,
  internal_code text,
  ma_quoc_te    text,
  ten_noi_bo    text,
  ghi_chu       text,
  nguoi_tao     text,
  trang_thai    text not null default 'cho_duyet'
                  check (trang_thai in ('cho_duyet','da_duyet','tu_choi')),
  ly_do_tu_choi text,
  duyet_boi     text,
  duyet_luc     timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_serial_pending_tt on public.serial_pending(trang_thai, created_at desc);
alter table public.serial_pending enable row level security;   -- 0 policy: chỉ service_role (app)

-- Duyệt nguyên tử: đẩy vào serial_registry (upsert) + đánh dấu đã duyệt.
create or replace function public.duyet_serial_pending(p_id uuid, p_admin text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.serial_pending;
begin
  select * into r from public.serial_pending where id = p_id and trang_thai = 'cho_duyet';
  if not found then raise exception 'Không có serial pending chờ duyệt với id này'; end if;

  insert into public.serial_registry
    (serial, code, model, internal_code, ma_quoc_te, ten_noi_bo, po, source_file, imported_at)
  values
    (r.serial, coalesce(r.code, r.internal_code, 'CSKH'), r.model, r.internal_code,
     r.ma_quoc_te, r.ten_noi_bo, 'CSKH-app', 'serial_pending', now())  -- code NOT NULL -> coalesce
  on conflict (serial) do update set
    internal_code = coalesce(excluded.internal_code, public.serial_registry.internal_code),
    ma_quoc_te    = coalesce(excluded.ma_quoc_te,    public.serial_registry.ma_quoc_te),
    ten_noi_bo    = coalesce(excluded.ten_noi_bo,    public.serial_registry.ten_noi_bo);

  update public.serial_pending
    set trang_thai = 'da_duyet', duyet_boi = p_admin, duyet_luc = now()
  where id = p_id;
end $$;
