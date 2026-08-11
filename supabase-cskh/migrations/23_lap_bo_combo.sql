-- 23_lap_bo_combo.sql
-- E1 — Lắp bộ combo (WH15A/WH30A): sinh mã bộ mới + tạo mẹ (nhóm) và các con
-- (thiết bị thật) + kích hoạt BH TỪNG CON. Nguyên tử trong 1 transaction để không
-- bao giờ để lại trạng thái nửa vời (mẹ có, con thiếu, hoặc BH kích một nửa).
--
-- Quy ước (chốt với user 2026-08-11):
--   · BH ở TỪNG THIẾT BỊ CON (mỗi con activate_warranty theo internal_code của nó).
--   · Mẹ = dòng nhóm: internal_code = combo (WH30A/WH15A), KHÔNG kích hoạt BH.
--   · Mã bộ = combo + YYYY + MM (theo ngày lắp) + STT 3 số, reset theo combo+tháng.
--     Ví dụ WH30A202608001 = bộ WH30A lắp 2026 tháng 8, thứ tự 001.
--   · Đợt đầu chỉ WH15A/WH30A (3 thiết bị đều có chính sách BH). ECO làm sau.

create or replace function public.lap_bo_combo(
  p_combo          text,
  p_customer       uuid,
  p_install_date   date,
  p_install_address text,
  p_serials        jsonb   -- [{ "internal_code": "...", "serial": "..." }, ...]
) returns text              -- trả về MÃ BỘ vừa sinh
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_prefix text; v_max int; v_ma_bo text;
  v_item jsonb; v_serial text; v_ic text; v_owner uuid;
  v_n int := 0;
begin
  if p_combo is null or p_combo not in ('WH15A', 'WH30A') then
    raise exception 'Combo không hợp lệ (đợt đầu chỉ WH15A/WH30A): %', p_combo;
  end if;
  if p_customer is null then raise exception 'Thiếu khách hàng'; end if;
  if p_install_date is null then raise exception 'Thiếu ngày bắt đầu bảo hành'; end if;
  if jsonb_typeof(p_serials) <> 'array' or jsonb_array_length(p_serials) = 0 then
    raise exception 'Thiếu danh sách serial thiết bị';
  end if;

  -- 1) Validate TẤT CẢ serial trước khi ghi bất cứ gì (không có thì không sinh mẹ).
  for v_item in select * from jsonb_array_elements(p_serials) loop
    v_serial := nullif(trim(v_item->>'serial'), '');
    if v_serial is null then raise exception 'Có thiết bị chưa chọn serial'; end if;
    if not exists (select 1 from public.serial_registry where serial = v_serial) then
      raise exception 'Serial % không có trong kho', v_serial;
    end if;
    select customer_id into v_owner from public.installed_base where serial = v_serial;
    if v_owner is not null then
      raise exception 'Serial % đã lắp cho khách khác — không lắp lại', v_serial;
    end if;
    v_n := v_n + 1;
  end loop;

  -- 2) Sinh mã bộ: combo + YYYYMM(ngày lắp) + STT(3) — STT = max hiện có cùng tiền tố +1.
  v_prefix := p_combo || to_char(p_install_date, 'YYYYMM');
  select coalesce(max((substring(serial from length(v_prefix) + 1))::int), 0)
    into v_max
  from public.installed_base
  where serial like v_prefix || '%'
    and substring(serial from length(v_prefix) + 1) ~ '^[0-9]+$';
  v_ma_bo := v_prefix || lpad((v_max + 1)::text, 3, '0');

  -- 3) Mẹ = dòng nhóm (không BH).
  insert into public.installed_base
    (serial, internal_code, customer_id, install_date, install_address, channel_source, status)
  values
    (v_ma_bo, p_combo, p_customer, p_install_date, nullif(trim(p_install_address), ''), 'CSKH lắp bộ', 'active');

  -- 4) Con = thiết bị thật + kích hoạt BH từng cái (activate_warranty đọc installed_base
  --    nên con phải được ghi TRƯỚC khi kích hoạt).
  for v_item in select * from jsonb_array_elements(p_serials) loop
    v_serial := trim(v_item->>'serial');
    v_ic := nullif(trim(v_item->>'internal_code'), '');
    insert into public.installed_base
      (serial, internal_code, model_freetext, parent_serial, customer_id, install_date, install_address, channel_source, status)
    select v_serial, coalesce(v_ic, sr.internal_code), sr.model, v_ma_bo,
           p_customer, p_install_date, nullif(trim(p_install_address), ''), 'CSKH lắp bộ', 'active'
    from public.serial_registry sr where sr.serial = v_serial
    on conflict (serial) do update set
      internal_code   = coalesce(excluded.internal_code, public.installed_base.internal_code),
      parent_serial   = excluded.parent_serial,
      customer_id     = excluded.customer_id,
      install_date    = excluded.install_date,
      install_address = excluded.install_address,
      channel_source  = excluded.channel_source,
      status          = 'active';
    perform public.activate_warranty(v_serial, p_install_date);
  end loop;

  return v_ma_bo;
end;
$$;

-- Khoá quyền gọi: chỉ chạy qua service_role (app đã gác admin ở Server Action).
revoke all on function public.lap_bo_combo(text, uuid, date, text, jsonb) from public;
revoke all on function public.lap_bo_combo(text, uuid, date, text, jsonb) from anon;
revoke all on function public.lap_bo_combo(text, uuid, date, text, jsonb) from authenticated;
