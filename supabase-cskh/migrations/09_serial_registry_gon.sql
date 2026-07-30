-- 09 — Gọn bảng serial_registry theo bản soát tay 2026-07-29 (file v3).
--
-- Chốt của người dùng:
--   * Bảng chỉ giữ: stt, serial, mã nội bộ, tên nội bộ, mã gốc, PO, batch, seq,
--     code (DB), code (file gốc), file gốc, sheet.
--   * KHÔNG xoá ma_quoc_te — thay vào đó ma_quoc_te ĐIỀN BẰNG mã gốc (model).
--   * Mã gốc đuôi "-DP" viết thành "-G-SHELL" (27 dòng vỏ máy).
--
-- Giữ lại imported_at vì RPC duyet_serial_pending() có ghi cột này.
-- Bỏ product_name (tên gốc tiếng Trung) và can_xac_nhan — không dùng ở đâu.

begin;

-- Sao lưu nguyên trạng trước khi xoá cột. Xoá bảng này sau khi chạy ổn định.
create table if not exists public.serial_registry_bak_20260729 as
  select * from public.serial_registry;

alter table public.serial_registry
  add column if not exists stt integer,
  add column if not exists code_file_goc text;

comment on column public.serial_registry.stt is 'Số thứ tự cố định theo bản soát tay 2026-07-29.';
comment on column public.serial_registry.code_file_goc is 'Cột Code đọc trực tiếp từ file PO gốc — để đối chiếu với code của DB.';
comment on column public.serial_registry.ma_quoc_te is 'Bằng mã gốc (model). Chốt 2026-07-29: không bỏ cột, điền theo mã gốc.';

-- Dữ liệu 1891 dòng nạp bằng upsert theo khoá serial từ file
-- "GWT_serial_registry_2026-07-29 v3.xlsx" (bản người dùng soát tay ở cột V).

alter table public.serial_registry
  drop column if exists product_name,
  drop column if exists can_xac_nhan;

-- Dòng serial mới duyệt từ app cũng phải theo luật: ma_quoc_te = mã gốc (model).
create or replace function public.duyet_serial_pending(p_id uuid, p_admin text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare r public.serial_pending;
begin
  select * into r from public.serial_pending where id = p_id and trang_thai = 'cho_duyet';
  if not found then raise exception 'Không có serial pending chờ duyệt với id này'; end if;

  insert into public.serial_registry
    (serial, code, model, internal_code, ma_quoc_te, ten_noi_bo, po, source_file, imported_at)
  values
    (r.serial, coalesce(r.code, r.internal_code, 'CSKH'), r.model, r.internal_code,
     coalesce(r.ma_quoc_te, r.model), r.ten_noi_bo, 'CSKH-app', 'serial_pending', now())
  on conflict (serial) do update set
    internal_code = coalesce(excluded.internal_code, public.serial_registry.internal_code),
    ma_quoc_te    = coalesce(excluded.ma_quoc_te,    public.serial_registry.ma_quoc_te),
    ten_noi_bo    = coalesce(excluded.ten_noi_bo,    public.serial_registry.ten_noi_bo);

  update public.serial_pending
    set trang_thai = 'da_duyet', duyet_boi = p_admin, duyet_luc = now()
  where id = p_id;
end $function$;

commit;
