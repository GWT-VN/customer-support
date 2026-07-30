-- 10 — Serial: ngày tạo / lần cập nhật cuối + view trạng thái kích hoạt (2026-07-29)
--
-- User chốt: bỏ bảng backup, thêm mốc thời gian, và cần biết "serial nào đã có
-- khách kích hoạt chưa" -> làm bằng VIEW (không thêm cột trạng thái vào bảng,
-- vì sự thật nằm ở installed_base + warranty, nhân bản ra sẽ lệch nhau).

begin;

drop table if exists public.serial_registry_bak_20260729;

alter table public.serial_registry
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Dòng cũ: ngày tạo lấy theo lần nhập file PO (imported_at) cho đúng sự thật.
update public.serial_registry
   set created_at = coalesce(imported_at, created_at),
       updated_at = greatest(coalesce(imported_at, created_at), created_at)
 where imported_at is not null;

create or replace function public.tu_dong_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_serial_registry_updated_at on public.serial_registry;
create trigger trg_serial_registry_updated_at
  before update on public.serial_registry
  for each row execute function public.tu_dong_updated_at();

comment on column public.serial_registry.created_at is 'Ngày serial vào kho (dòng cũ = imported_at của file PO).';
comment on column public.serial_registry.updated_at is 'Lần cập nhật cuối — trigger tự ghi.';

-- CÓ PII (tên/SĐT khách) -> security_invoker như v_installed_base/v_tickets,
-- để RLS của bảng gốc vẫn chặn anon thay vì bị view "mở cửa sau".
create or replace view public.v_serial_kho
with (security_invoker = true) as
select
  s.stt, s.serial,
  s.internal_code as ma_noi_bo, s.ten_noi_bo, s.model as ma_goc, s.po,
  case
    when w.activated is true   then 'da_kich_hoat'
    when ib.serial is not null then 'da_lap_chua_kich_hoat'
    else                            'ton_kho'
  end as trang_thai,
  (ib.serial is not null)      as da_lap,
  coalesce(w.activated, false) as bh_kich_hoat,
  ib.customer_id, k.full_name as ten_khach, k.primary_phone as sdt_khach,
  ib.install_date as ngay_lap, ib.parent_serial as serial_me,
  w.start_date as bh_bat_dau, w.full_end as bh_het_han, w.core_end as bh_loi_het_han,
  s.created_at, s.updated_at
from public.serial_registry s
left join public.installed_base ib on ib.serial = s.serial
left join public.warranty      w  on w.serial  = s.serial
left join public.cs_customers  k  on k.id      = ib.customer_id;

comment on view public.v_serial_kho is
  'Kho serial + trả lời "serial này đã có khách kích hoạt chưa". trang_thai: ton_kho | da_lap_chua_kich_hoat | da_kich_hoat. CÓ PII -> security_invoker.';

commit;
