


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "work";


ALTER SCHEMA "work" OWNER TO "postgres";


COMMENT ON SCHEMA "work" IS 'GWT Work — task mgmt (personal + team). Owns its tables; reads Sales/CS via soft refs.';



CREATE OR REPLACE FUNCTION "public"."activate_and_seed"("p_customer_code" "text" DEFAULT NULL::"text", "p_dry_run" boolean DEFAULT true) RETURNS TABLE("customer_code" "text", "order_code" "text", "action" "text", "chi_tiet" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  r record;
  v_lan int;
begin
  for r in
    select p.id, p.customer_code, p.order_code, p.quantity, cs.id as cs_id, cs.full_name
    from public.customer_purchases p
    left join public.cs_customers cs on cs.customer_code = p.customer_code
    where p.internal_code = 'DVBT'
      and (p_customer_code is null or p.customer_code = p_customer_code)
    order by p.customer_code, p.order_code, p.id
  loop
    customer_code := r.customer_code;
    order_code := r.order_code;
    v_lan := greatest(1, round(coalesce(r.quantity, 1))::int);

    if r.cs_id is null then
      action := 'bỏ qua';
      chi_tiet := 'khách chưa có trong CS (không auto-tạo)';
      return next; continue;
    end if;

    if exists (select 1 from public.maintenance_plan mp
               where mp.source_folder = 'DVBT#' || r.id::text) then
      action := 'bỏ qua';
      chi_tiet := 'đã seed trước đó (' || v_lan || ' lần)';
      return next; continue;
    end if;

    if not p_dry_run then
      insert into public.maintenance_plan
        (customer_id, source_folder, source_customer_name, loai_goi, tong_lan, ghi_chu, trang_thai)
      values
        (r.cs_id, 'DVBT#' || r.id::text, r.full_name, 'hop_dong', v_lan,
         'Seed tự động từ DVBT (đơn ' || coalesce(r.order_code, '?') || ')', 'dang_hoat_dong');
    end if;

    action := case when p_dry_run then 'SẼ TẠO' else 'ĐÃ TẠO' end;
    chi_tiet := 'gói bảo trì ' || v_lan || ' lần';
    return next;
  end loop;
end;
$$;


ALTER FUNCTION "public"."activate_and_seed"("p_customer_code" "text", "p_dry_run" boolean) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."warranty" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "serial" "text" NOT NULL,
    "activated" boolean DEFAULT false NOT NULL,
    "start_date" "date",
    "full_end" "date",
    "core_end" "date",
    "policy_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."warranty" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."activate_warranty"("p_serial" "text", "p_start" "date" DEFAULT CURRENT_DATE) RETURNS "public"."warranty"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_full int; v_core int; v_note text;
  v_internal text; v_in_catalog boolean; v_row public.warranty;
begin
  select ib.internal_code, pw.full_years, pw.core_years, pw.core_scope
    into v_internal, v_full, v_core, v_note
  from public.installed_base ib
  left join public.product_warranty pw on pw.internal_code = ib.internal_code
  where ib.serial = p_serial;
  if not found then raise exception 'serial % không có trong installed_base', p_serial; end if;
  if p_start is null then raise exception 'p_start không được null (serial %)', p_serial; end if;
  if v_internal is not null then
    select exists(select 1 from public.catalog_item ci where ci."Mã nội bộ" = v_internal) into v_in_catalog;
    if not v_in_catalog then
      raise warning 'internal_code % chưa có trong catalog mirror (nghi mirror lag) — serial %', v_internal, p_serial;
      v_note := coalesce(v_note || ' | ', '') || '⚠️ internal_code chưa có trong catalog mirror lúc kích hoạt, hạn BH có thể tính thiếu — kiểm lại sau khi mirror đồng bộ.';
    end if;
  end if;
  insert into public.warranty(serial, activated, start_date, full_end, core_end, policy_note)
  values (p_serial, true, p_start,
    case when v_full is not null then (p_start + make_interval(years => v_full))::date end,
    case when v_core is not null then (p_start + make_interval(years => v_core))::date end, v_note)
  on conflict (serial) do update
    set activated=true, start_date=excluded.start_date, full_end=excluded.full_end,
        core_end=excluded.core_end, policy_note=excluded.policy_note
  returning * into v_row;
  return v_row;
end; $$;


ALTER FUNCTION "public"."activate_warranty"("p_serial" "text", "p_start" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."duyet_serial_pending"("p_id" "uuid", "p_admin" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
end $$;


ALTER FUNCTION "public"."duyet_serial_pending"("p_id" "uuid", "p_admin" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.staff s
    where lower(s.email) = lower(nullif(auth.jwt() ->> 'email', ''))
      and s.hoat_dong and s.vai_tro @> array['admin']
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_report_viewer"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    lower(auth.jwt() ->> 'email') like '%@gwt.vn'
    or lower(auth.jwt() ->> 'email') in (select lower(email) from report_allowlist)
  , false);
$$;


ALTER FUNCTION "public"."is_report_viewer"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.staff s
    where lower(s.email) = lower(nullif(auth.jwt() ->> 'email', '')) and s.hoat_dong
  );
$$;


ALTER FUNCTION "public"."is_staff"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."khong_dau"("t" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  select lower(replace(replace(public.unaccent('public.unaccent', t), 'đ', 'd'), 'Đ', 'D'))
$$;


ALTER FUNCTION "public"."khong_dau"("t" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."khong_dau"("t" "text") IS 'Bo dau tieng Viet + ve chu thuong. IMMUTABLE de dung duoc trong cot sinh san va index.';



CREATE OR REPLACE FUNCTION "public"."kiem_tra_regex_pg"("p" "text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
begin
  if p is null or btrim(p) = '' then
    return false;
  end if;
  perform 'x' ~* p;
  return true;
exception when others then
  return false;
end
$$;


ALTER FUNCTION "public"."kiem_tra_regex_pg"("p" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."kiem_tra_regex_pg"("p" "text") IS 'TRUE nếu p là regex POSIX hợp lệ (thử biên dịch). Dùng để chặn mẫu hỏng làm vỡ v_ticket_issue.';



CREATE OR REPLACE FUNCTION "public"."lap_bo_combo"("p_combo" "text", "p_customer" "uuid", "p_install_date" "date", "p_install_address" "text", "p_serials" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_prefix text; v_max int; v_ma_bo text;
  v_item jsonb; v_serial text; v_ic text; v_owner uuid;
  v_n int := 0;
begin
  if p_combo is null or p_combo not in ('WH15A', 'WH30A', 'WH15AECO', 'WH30AECO') then
    raise exception 'Combo không hợp lệ: %', p_combo;
  end if;
  if p_customer is null then raise exception 'Thiếu khách hàng'; end if;
  if p_install_date is null then raise exception 'Thiếu ngày bắt đầu bảo hành'; end if;
  if jsonb_typeof(p_serials) <> 'array' or jsonb_array_length(p_serials) = 0 then
    raise exception 'Thiếu danh sách serial thiết bị';
  end if;

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

  v_prefix := p_combo || to_char(p_install_date, 'YYYYMM');
  select coalesce(max((substring(serial from length(v_prefix) + 1))::int), 0)
    into v_max
  from public.installed_base
  where serial like v_prefix || '%'
    and substring(serial from length(v_prefix) + 1) ~ '^[0-9]+$';
  v_ma_bo := v_prefix || lpad((v_max + 1)::text, 3, '0');

  insert into public.installed_base
    (serial, internal_code, customer_id, install_date, install_address, channel_source, status)
  values
    (v_ma_bo, p_combo, p_customer, p_install_date, nullif(trim(p_install_address), ''), 'CSKH lắp bộ', 'active');

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
$_$;


ALTER FUNCTION "public"."lap_bo_combo"("p_combo" "text", "p_customer" "uuid", "p_install_date" "date", "p_install_address" "text", "p_serials" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_catalog_table"("p_table" "text", "p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare v_n integer;
begin
  if p_table not in ('catalog_item','catalog_category','supplier_code',
                     'product_bundle','product_filter','product_warranty') then
    raise exception 'Bang khong duoc phep: %', p_table;
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'p_rows rong — tu choi xoa %', p_table;
  end if;
  execute format('delete from public.%I where true', p_table);
  execute format(
    'insert into public.%I select * from jsonb_populate_recordset(null::public.%I, $1)',
    p_table, p_table) using p_rows;
  execute format('select count(*) from public.%I', p_table) into v_n;
  return v_n;
end $_$;


ALTER FUNCTION "public"."replace_catalog_table"("p_table" "text", "p_rows" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sales_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end $$;


ALTER FUNCTION "public"."sales_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$ begin new.updated_at = now(); return new; end; $$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_catalog"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  v_key     text;
  v_base    text := 'https://qynpywysgltspmgnhhga.supabase.co/rest/v1/';
  v_tables  text[] := array['catalog_item','catalog_category','supplier_code',
                            'product_bundle','product_filter','product_warranty'];
  v_t       text;
  v_resp    extensions.http_response;
  v_rows    jsonb;
  v_n       int;
  v_result  jsonb := '{}'::jsonb;
  v_ok      boolean := true;
  v_msg     text := '';
  v_started timestamptz := clock_timestamp();
begin
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'masterdata_anon_key';
  if v_key is null then
    raise exception 'Vault secret masterdata_anon_key chua ton tai';
  end if;

  foreach v_t in array v_tables loop
    begin
      v_resp := extensions.http((
        'GET',
        v_base || v_t || '?limit=100000',
        array[ extensions.http_header('apikey', v_key),
               extensions.http_header('Authorization', 'Bearer ' || v_key) ],
        null, null
      )::extensions.http_request);

      if v_resp.status <> 200 then
        v_ok := false;
        v_msg := v_msg || format('%s: HTTP %s; ', v_t, v_resp.status);
        v_result := v_result || jsonb_build_object(v_t, jsonb_build_object('error', 'http ' || v_resp.status));
        continue;
      end if;

      v_rows := v_resp.content::jsonb;
      if v_rows is null or jsonb_typeof(v_rows) <> 'array' or jsonb_array_length(v_rows) = 0 then
        v_ok := false;
        v_msg := v_msg || format('%s: nguon rong (giu nguyen mirror); ', v_t);
        v_result := v_result || jsonb_build_object(v_t, jsonb_build_object('skipped', 'empty'));
        continue;
      end if;

      v_n := public.replace_catalog_table(v_t, v_rows);
      v_result := v_result || jsonb_build_object(v_t, v_n);
    exception when others then
      v_ok := false;
      v_msg := v_msg || format('%s: %s; ', v_t, sqlerrm);
      v_result := v_result || jsonb_build_object(v_t, jsonb_build_object('error', sqlerrm));
    end;
  end loop;

  insert into public.catalog_sync_log(ok, chi_tiet, thong_bao, ms)
  values (v_ok, v_result, nullif(v_msg, ''),
          extract(milliseconds from clock_timestamp() - v_started)::int);

  return jsonb_build_object('ok', v_ok, 'tables', v_result, 'msg', nullif(v_msg, ''));
end $$;


ALTER FUNCTION "public"."sync_catalog"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tu_dong_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end $$;


ALTER FUNCTION "public"."tu_dong_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."work_doi_trang_thai"("p_email" "text", "p_task_id" bigint, "p_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_me uuid;
begin
  if p_status not in ('todo','doing','blocked','review','done','cancelled') then
    raise exception 'Trạng thái không hợp lệ: %', p_status;
  end if;
  select id into v_me from public.staff where email = lower(btrim(p_email)) and hoat_dong limit 1;
  if v_me is null then raise exception 'Nhân sự không hợp lệ'; end if;
  if not exists (
    select 1 from work.task t where t.id = p_task_id and (
      t.creator_id = v_me
      or exists (select 1 from work.task_assignee a where a.task_id = t.id and a.staff_id = v_me))
  ) then raise exception 'Không có quyền với việc này'; end if;

  update work.task
     set status = p_status,
         completed_at = case when p_status = 'done' then now() else null end
   where id = p_task_id;

  insert into work.activity(task_id, actor_id, verb, payload)
  values (p_task_id, v_me, 'status_changed', jsonb_build_object('status', p_status));
end $$;


ALTER FUNCTION "public"."work_doi_trang_thai"("p_email" "text", "p_task_id" bigint, "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."work_tao_viec"("p_email" "text", "p_title" "text", "p_priority" smallint DEFAULT 3, "p_due" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_team_id" bigint DEFAULT NULL::bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_me uuid; v_id bigint; v_ref text;
begin
  select id into v_me from public.staff where email = lower(btrim(p_email)) and hoat_dong limit 1;
  if v_me is null then raise exception 'Không tìm thấy nhân sự đang hoạt động: %', p_email; end if;
  if coalesce(btrim(p_title),'') = '' then raise exception 'Tiêu đề trống'; end if;

  insert into work.task(title, priority, due_at, team_id, creator_id, origin)
  values (btrim(p_title), greatest(1, least(4, coalesce(p_priority,3))), p_due, p_team_id, v_me, 'manual')
  returning id, ref into v_id, v_ref;

  insert into work.task_assignee(task_id, staff_id, role, assigned_by)
  values (v_id, v_me, 'owner', v_me);

  insert into work.activity(task_id, actor_id, verb, payload)
  values (v_id, v_me, 'created', jsonb_build_object('title', btrim(p_title)));

  return jsonb_build_object('id', v_id, 'ref', v_ref);
end $$;


ALTER FUNCTION "public"."work_tao_viec"("p_email" "text", "p_title" "text", "p_priority" smallint, "p_due" timestamp with time zone, "p_team_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."work_viec_cua_toi"("p_email" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with me as (
    select id from public.staff where email = lower(btrim(p_email)) and hoat_dong limit 1
  )
  select coalesce(jsonb_agg(to_jsonb(v) order by v.priority, v.due_at nulls last), '[]'::jsonb)
  from (
    select t.id, t.ref, t.title, t.status, t.priority, t.due_at, t.team_id,
           tm.name as team_name, tm.color as team_color,
           (select a.role from work.task_assignee a, me
             where a.task_id = t.id and a.staff_id = me.id limit 1) as my_role,
           (select count(*) from work.task c
             where c.parent_id = t.id and c.status <> 'cancelled') as sub_n
    from work.task t
    join me on true
    left join work.team tm on tm.id = t.team_id
    where t.duplicate_of is null
      and t.status not in ('done','cancelled')
      and ( t.creator_id = me.id
            or exists (select 1 from work.task_assignee a where a.task_id = t.id and a.staff_id = me.id) )
  ) v
$$;


ALTER FUNCTION "public"."work_viec_cua_toi"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "work"."me"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select s.id from public.staff s
  where s.email = nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'email','')
    and s.hoat_dong
  limit 1
$$;


ALTER FUNCTION "work"."me"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "work"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin new.updated_at = now(); return new; end $$;


ALTER FUNCTION "work"."touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "work"."visible_task_ids"("p_staff" "uuid") RETURNS TABLE("task_id" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select t.id
  from work.task t
  where t.duplicate_of is null
    and (
      t.visibility = 'company'
      or t.creator_id = p_staff
      or exists (select 1 from work.task_assignee a where a.task_id = t.id and a.staff_id = p_staff)
      or (t.visibility = 'team' and exists (
            select 1 from work.team_member m where m.staff_id = p_staff and m.team_id = t.team_id))
      or (t.visibility = 'team' and exists (
            select 1 from work.task_project tp
            join work.project pr    on pr.id = tp.project_id
            join work.team_member m on m.team_id = pr.team_id
            where tp.task_id = t.id and m.staff_id = p_staff))
    )
$$;


ALTER FUNCTION "work"."visible_task_ids"("p_staff" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" bigint NOT NULL,
    "luc" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor" "text",
    "actor_id" "uuid",
    "hanh_dong" "text" NOT NULL,
    "doi_tuong" "text",
    "chi_tiet" "jsonb",
    "ket_qua" "text" DEFAULT 'ok'::"text" NOT NULL
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


ALTER TABLE "public"."audit_log" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."audit_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."bang_view" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bang" "text" NOT NULL,
    "ten" "text" NOT NULL,
    "chu" "text" NOT NULL,
    "cot" "jsonb" NOT NULL,
    "tao_boi" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bang_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catalog_category" (
    "Cấp 1" "text",
    "Cấp 2" "text",
    "Cấp 3" "text",
    "Mã danh mục" "text" NOT NULL,
    "Mã cha" "text",
    "Last updated" timestamp with time zone DEFAULT "now"() NOT NULL,
    "Tên" "text",
    "Cấp" smallint
);


ALTER TABLE "public"."catalog_category" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catalog_item" (
    "STT" integer,
    "Danh mục cấp 1" "text",
    "Danh mục cấp 2" "text",
    "Danh mục cấp 3" "text",
    "Máy liên quan" "text",
    "Mã nội bộ" "text" NOT NULL,
    "Tên ngắn gọn (đề xuất)" "text",
    "Trạng thái" "text",
    "Mã cũ" "text",
    "Mã đối tác/Kho" "text",
    "Thời gian thay" "text",
    "Tính chất" "text",
    "Note" "text",
    "Last updated" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."catalog_item" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catalog_sync_log" (
    "id" bigint NOT NULL,
    "chay_luc" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ok" boolean NOT NULL,
    "chi_tiet" "jsonb",
    "thong_bao" "text",
    "ms" integer
);


ALTER TABLE "public"."catalog_sync_log" OWNER TO "postgres";


ALTER TABLE "public"."catalog_sync_log" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."catalog_sync_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."company_customers" (
    "id" integer NOT NULL,
    "status" "text",
    "company_name" "text",
    "company_name_alt" "text",
    "contact_name" "text",
    "tax_code" "text",
    "phone" "text",
    "invoice_address" "text",
    "customer_type" "text",
    "agent_name" "text",
    "channel_old" "text",
    "channel_new" "text",
    "note" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_customers" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."company_customers_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."company_customers_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."company_customers_id_seq" OWNED BY "public"."company_customers"."id";



CREATE TABLE IF NOT EXISTS "public"."cs_customer_code_remap_20260812" (
    "cs_id" "uuid" NOT NULL,
    "ma_cu" "text",
    "ma_moi" "text",
    "phone" "text",
    "remap_luc" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cs_customer_code_remap_20260812" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cs_customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "primary_phone" "text",
    "full_name" "text" NOT NULL,
    "source" "text",
    "partner_ref" "text",
    "province" "text",
    "address" "text",
    "needs_phone" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "customer_code" "text",
    "ten_kd" "text" GENERATED ALWAYS AS ("public"."khong_dau"("full_name")) STORED,
    "dia_chi_kd" "text" GENERATED ALWAYS AS ("public"."khong_dau"(((COALESCE("address", ''::"text") || ' '::"text") || COALESCE("province", ''::"text")))) STORED,
    "trang_thai" "text" DEFAULT 'da_duyet'::"text" NOT NULL,
    "address_truoc_sap_nhap" "text",
    "province_truoc_sap_nhap" "text",
    "channel_id" integer,
    CONSTRAINT "cs_customers_trang_thai_check" CHECK (("trang_thai" = ANY (ARRAY['da_duyet'::"text", 'cho_duyet'::"text", 'da_xoa'::"text"])))
);


ALTER TABLE "public"."cs_customers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."cs_customers"."trang_thai" IS 'da_duyet (mặc định, khách cũ) | cho_duyet (tạo mới từ CS, chờ admin duyệt).';



COMMENT ON COLUMN "public"."cs_customers"."address_truoc_sap_nhap" IS 'Dia chi theo don vi hanh chinh TRUOC sap nhap 2025. Cot address la ban HIEN HANH.';



COMMENT ON COLUMN "public"."cs_customers"."province_truoc_sap_nhap" IS 'Tinh/TP TRUOC sap nhap 2025. Cot province la ban HIEN HANH.';



CREATE TABLE IF NOT EXISTS "public"."cs_staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "ho_ten" "text",
    "vai_tro" "text" DEFAULT 'nhan_vien'::"text" NOT NULL,
    "hoat_dong" boolean DEFAULT true NOT NULL,
    "ghi_chu" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cs_staff_email_chu_thuong" CHECK (("email" = "lower"("email")))
);


ALTER TABLE "public"."cs_staff" OWNER TO "postgres";


COMMENT ON TABLE "public"."cs_staff" IS 'NGUNG DUNG 2026-07-28 - da gop vao public.staff. Giu lam ban lui, xoa sau khi chay on dinh.';



CREATE TABLE IF NOT EXISTS "public"."customer_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "phone" "text",
    "contact_name" "text",
    "role" "text",
    "is_primary" boolean DEFAULT false NOT NULL,
    "zalo_ok" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customer_contacts_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'family'::"text", 'helper'::"text", 'manager'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."customer_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_purchases" (
    "id" bigint NOT NULL,
    "customer_code" "text",
    "order_code" "text" NOT NULL,
    "order_date" "date",
    "source_tab" "text",
    "is_gift" boolean DEFAULT false NOT NULL,
    "product_code" "text",
    "internal_code" "text",
    "product_name" "text",
    "category_l1" "text",
    "category_l2" "text",
    "quantity" numeric,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."customer_purchases" OWNER TO "postgres";


COMMENT ON TABLE "public"."customer_purchases" IS 'San pham da ban theo khach (GOM ca may tang DON_TANG), mirror 1 chieu tu 4 tab don. Khong co cot tien. customer_code -> customers.customer_code. internal_code -> masterdata (lich thay loi). Sheet la nguon chan ly.';



COMMENT ON COLUMN "public"."customer_purchases"."order_date" IS 'Don loc tong lich su: ngay la QUY UOC (mung 1) - file goc chi ghi Thang N. install_date la cua CS, KHONG o day.';



ALTER TABLE "public"."customer_purchases" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."customer_purchases_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" bigint NOT NULL,
    "customer_code" "text" NOT NULL,
    "name" "text",
    "phone" "text",
    "address" "text",
    "province" "text",
    "company_invoice" "text",
    "tax_code" "text",
    "total_orders" integer,
    "total_gift_orders" integer,
    "first_order_date" "date",
    "last_order_date" "date",
    "note" "text",
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "phone_chuan" "text" GENERATED ALWAYS AS (
CASE
    WHEN (("phone" IS NULL) OR ("btrim"("phone") = ''::"text")) THEN NULL::"text"
    WHEN ("length"("regexp_replace"("phone", '\D'::"text", ''::"text", 'g'::"text")) = 9) THEN ('0'::"text" || "regexp_replace"("phone", '\D'::"text", ''::"text", 'g'::"text"))
    WHEN (("length"("regexp_replace"("phone", '\D'::"text", ''::"text", 'g'::"text")) = 10) AND ("left"("regexp_replace"("phone", '\D'::"text", ''::"text", 'g'::"text"), 1) = '0'::"text")) THEN "regexp_replace"("phone", '\D'::"text", ''::"text", 'g'::"text")
    ELSE "regexp_replace"("phone", '\D'::"text", ''::"text", 'g'::"text")
END) STORED,
    "phone_no0" "text",
    "province_moi" "text"
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


COMMENT ON TABLE "public"."customers" IS 'Master khach hang, mirror 1 chieu tu tab DM_KHACH (Google Sheet). CO PII (phone/address) -> RLS chan anon, chi service_role/CS doc. customer_code la khoa noi ON DINH qua cac lan build. KHONG nhap tay: moi lan sync xoa sach roi ghi lai.';



COMMENT ON COLUMN "public"."customers"."note" IS 'Co "warning Chua co SDT" = khach khong dedupe duoc theo SDT, co the trung.';



COMMENT ON COLUMN "public"."customers"."phone_chuan" IS 'SDT chuan hoa (them lai so 0 dau). GENERATED -> tu tinh, sync xoa-ghi khong lam mat. Dung cot nay de ghep sang cs_customers.primary_phone.';



ALTER TABLE "public"."customers" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."customers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."dim_channel" (
    "id" integer NOT NULL,
    "channel_l1" "text" NOT NULL,
    "channel_l2" "text" DEFAULT ''::"text" NOT NULL,
    "sort_order" integer,
    "company_name" "text",
    "mst" "text",
    "tax_code" "text"
);


ALTER TABLE "public"."dim_channel" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."dim_channel_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."dim_channel_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."dim_channel_id_seq" OWNED BY "public"."dim_channel"."id";



CREATE TABLE IF NOT EXISTS "public"."filter_replacement" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "serial" "text" NOT NULL,
    "filter_code" "text" NOT NULL,
    "replaced_at" "date" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."filter_replacement" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."installed_base" (
    "serial" "text" NOT NULL,
    "internal_code" "text",
    "source_product_code" "text",
    "model_freetext" "text",
    "customer_id" "uuid",
    "parent_serial" "text",
    "notify_contact_id" "uuid",
    "install_date" "date",
    "install_address" "text",
    "channel_source" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_code_or_freetext" CHECK ((("internal_code" IS NOT NULL) OR ("model_freetext" IS NOT NULL))),
    CONSTRAINT "installed_base_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'moved'::"text", 'removed'::"text"])))
);


ALTER TABLE "public"."installed_base" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."issue_group" (
    "code" "text" NOT NULL,
    "ten" "text" NOT NULL,
    "mo_ta" "text",
    "muc_do" "text" NOT NULL,
    "bao_hang" boolean DEFAULT false NOT NULL,
    "mau_mo_ta" "text" NOT NULL,
    "mau_may" "text",
    "thu_tu" integer DEFAULT 100 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "issue_group_muc_do_check" CHECK (("muc_do" = ANY (ARRAY['an_toan'::"text", 'nghiem_trong'::"text", 'thuong'::"text", 'nhe'::"text", 'khong_loi'::"text"])))
);


ALTER TABLE "public"."issue_group" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."issue_override" (
    "ticket_code" "text" NOT NULL,
    "group_code" "text" NOT NULL,
    "gan" boolean NOT NULL,
    "ly_do" "text",
    "nguoi_sua" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."issue_override" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ky_thuat" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ten" "text" NOT NULL,
    "sdt" "text",
    "vung" "text",
    "email" "text",
    "la_ctv" boolean DEFAULT false NOT NULL,
    "hoat_dong" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ky_thuat" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ky_thuat_nghi" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ky_thuat_id" "uuid",
    "ngay" "date" NOT NULL,
    "ly_do" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ky_thuat_nghi" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lich_ky_thuat" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ky_thuat_id" "uuid",
    "ngay" "date" NOT NULL,
    "customer_id" "uuid",
    "dia_chi" "text",
    "ghi_chu" "text",
    "trang_thai" "text" DEFAULT 'hen'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tinh" "text",
    CONSTRAINT "lich_ky_thuat_trang_thai_check" CHECK (("trang_thai" = ANY (ARRAY['hen'::"text", 'xong'::"text", 'huy'::"text"])))
);


ALTER TABLE "public"."lich_ky_thuat" OWNER TO "postgres";


COMMENT ON COLUMN "public"."lich_ky_thuat"."tinh" IS 'Tỉnh/TP của địa chỉ chuyến đi (chọn từ dropdown).';



CREATE TABLE IF NOT EXISTS "public"."lich_ky_thuat_viec" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lich_id" "uuid",
    "loai_viec" "text" NOT NULL,
    "mo_ta" "text",
    "ref" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "so_tien" bigint,
    CONSTRAINT "lich_ky_thuat_viec_loai_viec_check" CHECK (("loai_viec" = ANY (ARRAY['lap_may'::"text", 'bao_tri'::"text", 'ticket'::"text", 'thay_loi'::"text", 'khao_sat'::"text", 'thu_tien'::"text", 'khac'::"text"])))
);


ALTER TABLE "public"."lich_ky_thuat_viec" OWNER TO "postgres";


COMMENT ON COLUMN "public"."lich_ky_thuat_viec"."so_tien" IS 'Số tiền cần thu (VND) khi loai_viec=thu_tien.';



CREATE TABLE IF NOT EXISTS "public"."maintenance_plan" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid",
    "serial" "text",
    "source_folder" "text" NOT NULL,
    "source_customer_name" "text",
    "source_phone" "text",
    "bo_may" "text",
    "loai_goi" "text" NOT NULL,
    "ngay_ky_hd" "date",
    "so_nam" numeric,
    "chu_ky_thang" integer,
    "tong_lan" integer,
    "ghi_chu" "text",
    "trang_thai" "text" DEFAULT 'dang_hoat_dong'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ten_kd" "text" GENERATED ALWAYS AS ("public"."khong_dau"("source_customer_name")) STORED,
    "bo_may_kd" "text" GENERATED ALWAYS AS ("public"."khong_dau"("bo_may")) STORED,
    "ngay_bat_dau" "date",
    "vung" "text",
    CONSTRAINT "chk_hop_dong_co_tong_lan" CHECK ((("loai_goi" <> 'hop_dong'::"text") OR ("tong_lan" IS NOT NULL))),
    CONSTRAINT "maintenance_plan_loai_goi_check" CHECK (("loai_goi" = ANY (ARRAY['hop_dong'::"text", 'tang_noi_bo'::"text"]))),
    CONSTRAINT "maintenance_plan_trang_thai_check" CHECK (("trang_thai" = ANY (ARRAY['dang_hoat_dong'::"text", 'dung_phuc_vu'::"text", 'het_han'::"text"]))),
    CONSTRAINT "maintenance_plan_vung_check" CHECK ((("vung" IS NULL) OR ("vung" = ANY (ARRAY['bac'::"text", 'nam'::"text"]))))
);


ALTER TABLE "public"."maintenance_plan" OWNER TO "postgres";


COMMENT ON COLUMN "public"."maintenance_plan"."ngay_bat_dau" IS 'Mốc bắt đầu tính lịch bảo trì (mặc định = ngày lắp, sửa được).';



COMMENT ON COLUMN "public"."maintenance_plan"."vung" IS 'Vùng quy tắc cuối tuần: bac (nghỉ T7+CN) | nam (nghỉ CN). Null = suy từ tỉnh.';



CREATE TABLE IF NOT EXISTS "public"."maintenance_visit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid",
    "asana_task_id" "text",
    "section" "text",
    "ten_task" "text",
    "lan_thu" integer,
    "due_date" "date",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "section_kd" "text" GENERATED ALWAYS AS ("public"."khong_dau"("section")) STORED,
    "tds_truoc" numeric,
    "tds_sau" numeric,
    "ph_truoc" numeric,
    "ph_sau" numeric,
    "do_cung_truoc" numeric,
    "do_cung_sau" numeric,
    "clo_truoc" numeric,
    "clo_sau" numeric,
    "ket_qua_ghi_chu" "text"
);


ALTER TABLE "public"."maintenance_visit" OWNER TO "postgres";


COMMENT ON COLUMN "public"."maintenance_visit"."tds_truoc" IS 'TDS trước lọc (ppm) — kết quả đo khi bảo trì.';



CREATE TABLE IF NOT EXISTS "public"."media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "drive_file_id" "text" NOT NULL,
    "filename" "text",
    "mime" "text",
    "size_bytes" bigint,
    "uploaded_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "media_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['ticket'::"text", 'bao_tri'::"text"])))
);


ALTER TABLE "public"."media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_bundle" (
    "id" bigint NOT NULL,
    "STT" integer,
    "Mã thành phẩm" "text",
    "Tên thành phẩm" "text",
    "Mã thành phần" "text",
    "Tên thành phần" "text",
    "Số lượng" numeric,
    "Lưu ý" "text",
    "Last updated" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."product_bundle" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_filter" (
    "id" bigint NOT NULL,
    "STT" integer,
    "Máy (model)" "text",
    "Mã lõi lọc" "text",
    "Tên lõi lọc" "text",
    "Chu kỳ thay (tháng)" "text",
    "Ghi chú" "text",
    "Last updated" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."product_filter" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_warranty" (
    "internal_code" "text" NOT NULL,
    "full_years" integer,
    "core_years" integer,
    "core_scope" "text",
    "warranty_text" "text",
    "source" "text" DEFAULT 'mirror'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."product_warranty" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_allowlist" (
    "email" "text" NOT NULL
);


ALTER TABLE "public"."report_allowlist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_order_items" (
    "id" bigint NOT NULL,
    "order_id" "uuid" NOT NULL,
    "line_no" integer,
    "internal_code" "text",
    "product_name" "text",
    "category_l1" "text",
    "category_l2" "text",
    "quantity" numeric DEFAULT 1,
    "unit_price_vat" bigint,
    "amount_vat" bigint,
    "is_gift" boolean DEFAULT false,
    "is_maintenance" boolean DEFAULT false,
    "vat_pct" numeric,
    "note" "text"
);


ALTER TABLE "public"."sales_order_items" OWNER TO "postgres";


ALTER TABLE "public"."sales_order_items" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."sales_order_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."sales_order_lines" (
    "id" bigint NOT NULL,
    "source_tab" "text" NOT NULL,
    "order_code" "text" NOT NULL,
    "partner_order_code" "text",
    "category_l1" "text",
    "category_l2" "text",
    "order_date" "date",
    "report_month" "text",
    "channel" "text",
    "channel_detail" "text",
    "customer_name" "text",
    "province" "text",
    "product_code" "text",
    "internal_code" "text",
    "product_name" "text",
    "quantity" numeric,
    "unit_price_vat" numeric,
    "vat_pct" numeric,
    "unit_price_net" numeric,
    "amount_vat" numeric,
    "amount_net" numeric,
    "fulfillment_status" "text",
    "payment_status" "text",
    "note" "text",
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "province_moi" "text"
);


ALTER TABLE "public"."sales_order_lines" OWNER TO "postgres";


COMMENT ON TABLE "public"."sales_order_lines" IS 'Mirror 1 chiều của tab TONG_HOP (Google Sheet). Sheet là nguồn chân lý — KHÔNG nhập tay vào đây, mỗi lần sync sẽ xoá sạch rồi ghi lại. Không chứa SĐT/Địa chỉ (quyết định PII 2026-07-16).';



COMMENT ON COLUMN "public"."sales_order_lines"."order_date" IS 'Đơn lọc tổng lịch sử: ngày là QUY ƯỚC (mùng 1) - file gốc chỉ ghi "Tháng N". Dùng report_month cho báo cáo doanh thu.';



COMMENT ON COLUMN "public"."sales_order_lines"."report_month" IS 'Kỳ ghi nhận doanh thu YYYY-MM. NULL = chưa xác định (22 đơn lọc tổng thiếu tháng), cần điền tay trên Sheet.';



COMMENT ON COLUMN "public"."sales_order_lines"."internal_code" IS 'Có thể mang cờ "⚠ chưa chuẩn" (mã lạ) hoặc "⚠ nhập nhằng" (mã trỏ nhiều đích) - lọc ra khi báo cáo theo sản phẩm.';



ALTER TABLE "public"."sales_order_lines" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."sales_order_lines_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."sales_orders" (
    "order_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_code" "text" NOT NULL,
    "source_tab" "text" NOT NULL,
    "customer_code" "text",
    "phone" "text",
    "customer_name" "text",
    "order_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "channel_id" integer,
    "status" "text",
    "payment_status" "text",
    "total_vat" bigint DEFAULT 0,
    "note" "text",
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "address" "text",
    "province" "text",
    "partner_order_code" "text",
    "payment_method" "text",
    "shipping_code" "text",
    "install_date" "date",
    CONSTRAINT "sales_orders_source_tab_check" CHECK (("source_tab" = ANY (ARRAY['DON_POE'::"text", 'DON_POU'::"text", 'DON_OTHERS'::"text", 'DON_TANG'::"text"])))
);


ALTER TABLE "public"."sales_orders" OWNER TO "postgres";


COMMENT ON TABLE "public"."sales_orders" IS 'Đơn WRITABLE tạo từ web app Sales (Phase 2). Sales sở hữu. RLS bật, ghi/đọc qua service_role server-side.';



CREATE TABLE IF NOT EXISTS "public"."serial_pending" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "serial" "text" NOT NULL,
    "code" "text",
    "model" "text",
    "internal_code" "text",
    "ma_quoc_te" "text",
    "ten_noi_bo" "text",
    "ghi_chu" "text",
    "nguoi_tao" "text",
    "trang_thai" "text" DEFAULT 'cho_duyet'::"text" NOT NULL,
    "ly_do_tu_choi" "text",
    "duyet_boi" "text",
    "duyet_luc" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "serial_pending_trang_thai_check" CHECK (("trang_thai" = ANY (ARRAY['cho_duyet'::"text", 'da_duyet'::"text", 'tu_choi'::"text"])))
);


ALTER TABLE "public"."serial_pending" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."serial_registry" (
    "serial" "text" NOT NULL,
    "code" "text" NOT NULL,
    "batch" "text",
    "seq" "text",
    "model" "text",
    "po" "text",
    "source_file" "text",
    "source_sheet" "text",
    "imported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "internal_code" "text",
    "ten_noi_bo" "text",
    "ma_quoc_te" "text",
    "stt" integer,
    "code_file_goc" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "trang_thai" "text" DEFAULT 'ton_kho'::"text" NOT NULL
);


ALTER TABLE "public"."serial_registry" OWNER TO "postgres";


COMMENT ON TABLE "public"."serial_registry" IS 'Kho serial xuất xưởng theo thiết bị (gộp từ file PO nhà máy).';



COMMENT ON COLUMN "public"."serial_registry"."internal_code" IS 'Mã nội bộ resolve từ catalog_item (Masterdata) theo model.';



COMMENT ON COLUMN "public"."serial_registry"."ten_noi_bo" IS 'Tên ngắn gọn (đề xuất) của catalog_item theo internal_code.';



COMMENT ON COLUMN "public"."serial_registry"."ma_quoc_te" IS 'Bang ma goc (model). Chot 2026-07-29: khong bo cot, dien theo ma goc.';



COMMENT ON COLUMN "public"."serial_registry"."stt" IS 'So thu tu co dinh theo ban soat tay 2026-07-29.';



COMMENT ON COLUMN "public"."serial_registry"."code_file_goc" IS 'Cot Code doc truc tiep tu file PO goc — de doi chieu voi code cua DB.';



COMMENT ON COLUMN "public"."serial_registry"."created_at" IS 'Ngay serial vao kho (dong cu = imported_at cua file PO).';



COMMENT ON COLUMN "public"."serial_registry"."updated_at" IS 'Lan cap nhat cuoi — trigger tu ghi.';



CREATE TABLE IF NOT EXISTS "public"."serial_su_dung" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "serial" "text" NOT NULL,
    "su_kien" "text" NOT NULL,
    "tu_trang_thai" "text",
    "den_trang_thai" "text",
    "customer_id" "uuid",
    "ghi_chu" "text",
    "boi" "text",
    "luc" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."serial_su_dung" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."serial_trang_thai" (
    "code" "text" NOT NULL,
    "nhan" "text" NOT NULL,
    "mau" "text" DEFAULT 'slate'::"text" NOT NULL,
    "thu_tu" integer DEFAULT 100 NOT NULL,
    "he_thong" boolean DEFAULT false NOT NULL,
    "cho_dat_tay" boolean DEFAULT true NOT NULL,
    "hoat_dong" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."serial_trang_thai" OWNER TO "postgres";


COMMENT ON TABLE "public"."serial_trang_thai" IS 'Danh mục trạng thái máy (cấu hình được). he_thong=khoá mã; cho_dat_tay=hiện trong đặt-tay.';



CREATE TABLE IF NOT EXISTS "public"."staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text",
    "ten" "text" NOT NULL,
    "vai_tro" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "hoat_dong" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ghi_chu" "text",
    CONSTRAINT "chk_vai_tro" CHECK (("vai_tro" <@ '{admin,cs_manager,cs,sales_manager,sales,ky_thuat}'::"text"[])),
    CONSTRAINT "staff_email_chu_thuong" CHECK ((("email" IS NULL) OR ("email" = "lower"("email"))))
);


ALTER TABLE "public"."staff" OWNER TO "postgres";


COMMENT ON TABLE "public"."staff" IS 'Nhan vien CSKH. Vua la danh sach cho phep dang nhap (rao vao cua), vua la danh sach nguoi phu trach ticket. vai_tro: admin | cs.';



CREATE TABLE IF NOT EXISTS "public"."supplier_code" (
    "Mã đối tác" "text" NOT NULL,
    "Mã nội bộ" "text" NOT NULL,
    "Tên" "text",
    "Loại mã" "text",
    "Last updated" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."supplier_code" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_muc" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_code" "text" NOT NULL,
    "loai" "text" NOT NULL,
    "mo_ta" "text",
    "so_tien" numeric,
    "tinh_phi" boolean DEFAULT false NOT NULL,
    "serial_cu" "text",
    "serial_moi" "text",
    "tac_gia" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "catalog_code" "text",
    "so_luong" integer DEFAULT 1 NOT NULL,
    "ngay_thu_phi" "date",
    CONSTRAINT "ticket_muc_loai_check" CHECK (("loai" = ANY (ARRAY['hang_muc'::"text", 'doi_may'::"text"])))
);


ALTER TABLE "public"."ticket_muc" OWNER TO "postgres";


COMMENT ON COLUMN "public"."ticket_muc"."catalog_code" IS 'Mã nội bộ catalog_item (hạng mục thu phí/vật tư) — không FK vì catalog là bảng gương truncate+reload.';



COMMENT ON COLUMN "public"."ticket_muc"."ngay_thu_phi" IS 'Ngày thu phí khách cho hạng mục tinh_phi=true (null nếu miễn phí / chưa thu). Chỉ để log, không dùng tính doanh số.';



CREATE TABLE IF NOT EXISTS "public"."ticket_note" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_code" "text" NOT NULL,
    "noi_dung" "text" NOT NULL,
    "tac_gia" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ticket_note" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tickets" (
    "ticket_code" "text" NOT NULL,
    "serial" "text",
    "source_serial" "text",
    "customer_id" "uuid",
    "source_customer" "text",
    "ticket_type" "text",
    "state" "text" DEFAULT 'Open'::"text" NOT NULL,
    "description" "text",
    "last_note" "text",
    "province" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "khan" boolean DEFAULT false NOT NULL,
    "cs_phu_trach" "uuid",
    "ky_thuat" "uuid",
    CONSTRAINT "tickets_state_check" CHECK (("state" = ANY (ARRAY['Open'::"text", 'Done'::"text", 'Cancel'::"text"])))
);


ALTER TABLE "public"."tickets" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_bh_cho_kich_hoat" AS
SELECT
    NULL::"text" AS "nguon",
    NULL::"text" AS "serial",
    NULL::"text" AS "ma_noi_bo",
    NULL::"text" AS "ten_noi_bo",
    NULL::"uuid" AS "customer_id",
    NULL::"text" AS "ten_khach",
    NULL::"text" AS "sdt_khach",
    NULL::"text" AS "dia_chi",
    NULL::"date" AS "ngay_lap",
    NULL::"date" AS "ngay_dat_hang",
    NULL::"text" AS "ma_don",
    NULL::integer AS "so_luong",
    NULL::timestamp with time zone AS "tao_luc";


ALTER VIEW "public"."v_bh_cho_kich_hoat" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_bh_cho_kich_hoat" IS 'Hang cho kich hoat bao hanh cho CSKH. nguon=da_lap_chua_kich_hoat (co serial, kich hoat ngay) | don_sales_chua_gan_may (don ban co may, chi can dien serial). Kich hoat xong dong tu bien mat. CO PII -> security_invoker.';



CREATE OR REPLACE VIEW "public"."v_machine_filter" WITH ("security_invoker"='true') AS
 WITH "pf" AS (
         SELECT TRIM(BOTH FROM "x"."x") AS "model",
            "pf"."Mã lõi lọc" AS "filter_code",
            "pf"."Tên lõi lọc" AS "filter_name",
            "pf"."Chu kỳ thay (tháng)" AS "chu_ky_raw"
           FROM "public"."product_filter" "pf",
            LATERAL "unnest"("string_to_array"("replace"("pf"."Máy (model)", '/'::"text", '
'::"text"), '
'::"text")) "x"("x")
          WHERE (TRIM(BOTH FROM "x"."x") <> ''::"text")
        ), "parsed" AS (
         SELECT "pf"."model",
            "pf"."filter_code",
            "pf"."filter_name",
            "pf"."chu_ky_raw",
            (("regexp_match"("pf"."chu_ky_raw", '(\d+)'::"text"))[1])::integer AS "so_dau",
            (("regexp_match"("pf"."chu_ky_raw", '-\s*(\d+)'::"text"))[1])::integer AS "so_sau",
            ("pf"."chu_ky_raw" ~* 'năm'::"text") AS "la_nam"
           FROM "pf"
        ), "chu_ky" AS (
         SELECT "parsed"."model",
            "parsed"."filter_code",
            "parsed"."filter_name",
            "parsed"."chu_ky_raw",
                CASE
                    WHEN "parsed"."la_nam" THEN ("parsed"."so_dau" * 12)
                    ELSE "parsed"."so_dau"
                END AS "thang_min",
                CASE
                    WHEN "parsed"."la_nam" THEN (COALESCE("parsed"."so_sau", "parsed"."so_dau") * 12)
                    ELSE COALESCE("parsed"."so_sau", "parsed"."so_dau")
                END AS "thang_max"
           FROM "parsed"
        ), "direct" AS (
         SELECT "ci"."Mã nội bộ" AS "internal_code",
            "k"."filter_code",
            "k"."filter_name",
            "k"."chu_ky_raw",
            "k"."thang_min",
            "k"."thang_max",
            "k"."model" AS "source_model",
                CASE
                    WHEN ("ci"."Mã nội bộ" = "k"."model") THEN 'mã nội bộ'::"text"
                    WHEN (EXISTS ( SELECT 1
                       FROM "public"."supplier_code" "sc"
                      WHERE (("sc"."Mã đối tác" = "k"."model") AND ("sc"."Mã nội bộ" = "ci"."Mã nội bộ")))) THEN 'mã đối tác'::"text"
                    ELSE 'tên thương mại'::"text"
                END AS "cach_khop",
            NULL::"text" AS "via_component"
           FROM ("chu_ky" "k"
             JOIN "public"."catalog_item" "ci" ON ((("ci"."Danh mục cấp 1" = 'Machines'::"text") AND (("ci"."Mã nội bộ" = "k"."model") OR (EXISTS ( SELECT 1
                   FROM "public"."supplier_code" "sc"
                  WHERE (("sc"."Mã đối tác" = "k"."model") AND ("sc"."Mã nội bộ" = "ci"."Mã nội bộ")))) OR ("ci"."Tên ngắn gọn (đề xuất)" ~* (('(^|[^A-Z0-9])'::"text" || "k"."model") || '($|[^A-Z0-9])'::"text"))) AND ("ci"."Mã nội bộ" <> 'GEUT-B04-G-NF'::"text"))))
        ), "via_bundle" AS (
         SELECT "b"."Mã thành phẩm" AS "internal_code",
            "d"."filter_code",
            "d"."filter_name",
            "d"."chu_ky_raw",
            "d"."thang_min",
            "d"."thang_max",
            "d"."source_model",
            ('qua combo: '::"text" || "b"."Mã thành phần") AS "cach_khop",
            "b"."Mã thành phần" AS "via_component"
           FROM ("public"."product_bundle" "b"
             JOIN "direct" "d" ON (("d"."internal_code" = "b"."Mã thành phần")))
        )
 SELECT "direct"."internal_code",
    "direct"."filter_code",
    "direct"."filter_name",
    "direct"."chu_ky_raw",
    "direct"."thang_min",
    "direct"."thang_max",
    "direct"."source_model",
    "direct"."cach_khop",
    "direct"."via_component"
   FROM "direct"
UNION
 SELECT "via_bundle"."internal_code",
    "via_bundle"."filter_code",
    "via_bundle"."filter_name",
    "via_bundle"."chu_ky_raw",
    "via_bundle"."thang_min",
    "via_bundle"."thang_max",
    "via_bundle"."source_model",
    "via_bundle"."cach_khop",
    "via_bundle"."via_component"
   FROM "via_bundle";


ALTER VIEW "public"."v_machine_filter" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_core_forecast" WITH ("security_invoker"='true') AS
 SELECT "ib"."serial",
    "ib"."internal_code",
    COALESCE("ci"."Tên ngắn gọn (đề xuất)", "ib"."model_freetext") AS "product_name",
    "mf"."filter_code",
    "mf"."filter_name",
    "mf"."chu_ky_raw",
    "mf"."thang_min",
    "mf"."thang_max",
    "ib"."install_date",
    "fr"."replaced_at" AS "lan_thay_gan_nhat",
    COALESCE("fr"."replaced_at", "ib"."install_date") AS "moc_tinh",
    ((COALESCE("fr"."replaced_at", "ib"."install_date") + "make_interval"("months" => "mf"."thang_min")))::"date" AS "han_som",
    ((COALESCE("fr"."replaced_at", "ib"."install_date") + "make_interval"("months" => "mf"."thang_max")))::"date" AS "han_muon",
    (((COALESCE("fr"."replaced_at", "ib"."install_date") + "make_interval"("months" => "mf"."thang_min")))::"date" - CURRENT_DATE) AS "con_bao_nhieu_ngay",
        CASE
            WHEN ("ib"."install_date" IS NULL) THEN 'không rõ (máy thiếu ngày lắp)'::"text"
            WHEN (((COALESCE("fr"."replaced_at", "ib"."install_date") + "make_interval"("months" => "mf"."thang_min")))::"date" < CURRENT_DATE) THEN 'QUÁ HẠN'::"text"
            WHEN (((COALESCE("fr"."replaced_at", "ib"."install_date") + "make_interval"("months" => "mf"."thang_min")))::"date" <= (CURRENT_DATE + 30)) THEN 'sắp đến hạn (≤30 ngày)'::"text"
            ELSE 'còn hạn'::"text"
        END AS "tinh_trang",
    "ib"."customer_id",
    "c"."full_name" AS "customer_name",
    "c"."primary_phone",
    "c"."needs_phone"
   FROM (((("public"."installed_base" "ib"
     JOIN "public"."v_machine_filter" "mf" ON (("mf"."internal_code" = "ib"."internal_code")))
     LEFT JOIN "public"."catalog_item" "ci" ON (("ci"."Mã nội bộ" = "ib"."internal_code")))
     LEFT JOIN "public"."cs_customers" "c" ON (("c"."id" = "ib"."customer_id")))
     LEFT JOIN LATERAL ( SELECT "r"."replaced_at"
           FROM "public"."filter_replacement" "r"
          WHERE (("r"."serial" = "ib"."serial") AND ("r"."filter_code" = "mf"."filter_code"))
          ORDER BY "r"."replaced_at" DESC
         LIMIT 1) "fr" ON (true))
  WHERE (("ib"."status" = 'active'::"text") AND (NOT (("mf"."via_component" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."installed_base" "ch"
          WHERE (("ch"."parent_serial" = "ib"."serial") AND ("ch"."internal_code" = "mf"."via_component") AND ("ch"."status" = 'active'::"text")))))));


ALTER VIEW "public"."v_core_forecast" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_customer_360" WITH ("security_invoker"='true') AS
 SELECT "cs"."customer_code",
    "cs"."full_name" AS "ten",
    "cs"."primary_phone" AS "phone_chuan",
    "cs"."province",
    "cs"."channel_id",
    "c"."name" AS "sales_name",
    "c"."phone" AS "sales_phone",
    "c"."first_order_date",
    "c"."last_order_date",
    ( SELECT "count"(DISTINCT "p"."order_code") AS "count"
           FROM "public"."customer_purchases" "p"
          WHERE ("p"."customer_code" = "cs"."customer_code")) AS "so_don",
    NULL::bigint AS "tong_chi_vat",
    ( SELECT "count"(*) AS "count"
           FROM "public"."installed_base" "ib"
          WHERE ("ib"."customer_id" = "cs"."id")) AS "so_may_da_lap",
    ( SELECT "array_agg"("ib"."serial" ORDER BY "ib"."serial") AS "array_agg"
           FROM "public"."installed_base" "ib"
          WHERE ("ib"."customer_id" = "cs"."id")) AS "ds_serial",
    ( SELECT "count"(*) AS "count"
           FROM ("public"."installed_base" "ib"
             JOIN "public"."warranty" "w" ON (("w"."serial" = "ib"."serial")))
          WHERE (("ib"."customer_id" = "cs"."id") AND "w"."activated" AND ("w"."full_end" >= CURRENT_DATE))) AS "so_may_con_bh",
    ( SELECT "count"(*) AS "count"
           FROM "public"."tickets" "t"
          WHERE ("t"."customer_id" = "cs"."id")) AS "so_ticket_tong",
    ( SELECT "count"(*) AS "count"
           FROM "public"."tickets" "t"
          WHERE (("t"."customer_id" = "cs"."id") AND (COALESCE("t"."state", ''::"text") <> ALL (ARRAY['Done'::"text", 'Cancel'::"text"])))) AS "so_ticket_mo",
    (( SELECT COALESCE("sum"("mp"."tong_lan"), (0)::bigint) AS "coalesce"
           FROM "public"."maintenance_plan" "mp"
          WHERE (("mp"."customer_id" = "cs"."id") AND ("mp"."trang_thai" = 'dang_hoat_dong'::"text"))) - ( SELECT "count"(*) AS "count"
           FROM ("public"."maintenance_visit" "mv"
             JOIN "public"."maintenance_plan" "mp" ON (("mp"."id" = "mv"."plan_id")))
          WHERE (("mp"."customer_id" = "cs"."id") AND ("mp"."trang_thai" = 'dang_hoat_dong'::"text") AND ("mv"."completed_at" IS NOT NULL)))) AS "bao_tri_con_lai"
   FROM ("public"."cs_customers" "cs"
     LEFT JOIN "public"."customers" "c" ON (("c"."customer_code" = "cs"."customer_code")));


ALTER VIEW "public"."v_customer_360" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_customer_360" IS 'Chân dung 360 của khách CS: gộp đơn Sales + máy/BH/ticket/bảo trì. tong_chi_vat null ở Phase 1 (chờ sales_orders). Sales đã duyệt danh sách cột 2026-08-12.';



CREATE OR REPLACE VIEW "public"."v_doanh_so_cskh" AS
 SELECT ("date_trunc"('month'::"text", "tm"."created_at"))::"date" AS "thang",
    "tm"."catalog_code",
    "ci"."Tên ngắn gọn (đề xuất)" AS "ten_hang_muc",
    "ci"."Danh mục cấp 1" AS "danh_muc",
    "count"(*) AS "so_luot",
    "sum"("tm"."so_luong") AS "tong_so_luong",
    "sum"("tm"."so_tien") AS "tong_tien"
   FROM ("public"."ticket_muc" "tm"
     LEFT JOIN "public"."catalog_item" "ci" ON (("ci"."Mã nội bộ" = "tm"."catalog_code")))
  WHERE (("tm"."tinh_phi" = true) AND ("tm"."loai" = 'hang_muc'::"text"))
  GROUP BY (("date_trunc"('month'::"text", "tm"."created_at"))::"date"), "tm"."catalog_code", "ci"."Tên ngắn gọn (đề xuất)", "ci"."Danh mục cấp 1"
  ORDER BY (("date_trunc"('month'::"text", "tm"."created_at"))::"date") DESC, ("sum"("tm"."so_tien")) DESC NULLS LAST;


ALTER VIEW "public"."v_doanh_so_cskh" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_installed_base" WITH ("security_invoker"='true') AS
 SELECT "ib"."serial",
    "ib"."internal_code",
    COALESCE("ci"."Tên ngắn gọn (đề xuất)", "ib"."model_freetext") AS "product_name",
    "ci"."Danh mục cấp 1" AS "category_l1",
    "ci"."Danh mục cấp 2" AS "category_l2",
    "ib"."source_product_code",
    "ib"."customer_id",
    "c"."full_name" AS "customer_name",
    "c"."primary_phone",
    "c"."needs_phone",
    "ib"."parent_serial",
    "ib"."install_date",
    "ib"."install_address",
    "ib"."status",
    COALESCE(
        CASE
            WHEN ("w"."id" IS NOT NULL) THEN "w"."activated"
            ELSE "wp"."activated"
        END, false) AS "warranty_activated",
        CASE
            WHEN ("w"."id" IS NOT NULL) THEN "w"."start_date"
            ELSE "wp"."start_date"
        END AS "warranty_start",
        CASE
            WHEN ("w"."id" IS NOT NULL) THEN "w"."full_end"
            ELSE "wp"."full_end"
        END AS "warranty_full_end",
        CASE
            WHEN ("w"."id" IS NOT NULL) THEN "w"."core_end"
            ELSE "wp"."core_end"
        END AS "warranty_core_end",
        CASE
            WHEN (
            CASE
                WHEN ("w"."id" IS NOT NULL) THEN "w"."full_end"
                ELSE "wp"."full_end"
            END IS NULL) THEN NULL::boolean
            ELSE (
            CASE
                WHEN ("w"."id" IS NOT NULL) THEN "w"."full_end"
                ELSE "wp"."full_end"
            END >= CURRENT_DATE)
        END AS "con_han_may",
        CASE
            WHEN (
            CASE
                WHEN ("w"."id" IS NOT NULL) THEN "w"."core_end"
                ELSE "wp"."core_end"
            END IS NULL) THEN NULL::boolean
            ELSE (
            CASE
                WHEN ("w"."id" IS NOT NULL) THEN "w"."core_end"
                ELSE "wp"."core_end"
            END >= CURRENT_DATE)
        END AS "con_han_loi",
    ("pw"."internal_code" IS NOT NULL) AS "co_chinh_sach_bh",
    (("w"."id" IS NULL) AND ("wp"."id" IS NOT NULL)) AS "bh_theo_me",
    "c"."ten_kd",
    "c"."dia_chi_kd"
   FROM ((((("public"."installed_base" "ib"
     LEFT JOIN "public"."catalog_item" "ci" ON (("ci"."Mã nội bộ" = "ib"."internal_code")))
     LEFT JOIN "public"."cs_customers" "c" ON (("c"."id" = "ib"."customer_id")))
     LEFT JOIN "public"."warranty" "w" ON (("w"."serial" = "ib"."serial")))
     LEFT JOIN "public"."warranty" "wp" ON (("wp"."serial" = "ib"."parent_serial")))
     LEFT JOIN "public"."product_warranty" "pw" ON (("pw"."internal_code" = "ib"."internal_code")));


ALTER VIEW "public"."v_installed_base" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_ticket_issue" AS
 WITH "base" AS (
         SELECT "t"."ticket_code",
            "t"."state",
            "t"."ticket_type",
            "t"."description",
            "t"."created_at",
            "t"."serial",
            "t"."province",
            "ib"."internal_code",
            COALESCE("ci"."Tên ngắn gọn (đề xuất)", "ib"."model_freetext") AS "product_name",
            COALESCE("t"."customer_id", "ib"."customer_id") AS "customer_id",
            ((COALESCE("t"."description", ''::"text") || ' '::"text") || COALESCE("t"."ticket_type", ''::"text")) AS "van_ban",
            ((((((COALESCE("ib"."internal_code", ''::"text") || ' '::"text") || COALESCE("ci"."Tên ngắn gọn (đề xuất)", ''::"text")) || ' '::"text") || COALESCE("ib"."model_freetext", ''::"text")) || ' '::"text") || COALESCE("t"."description", ''::"text")) AS "van_ban_may"
           FROM (("public"."tickets" "t"
             LEFT JOIN "public"."installed_base" "ib" ON (("ib"."serial" = "t"."serial")))
             LEFT JOIN "public"."catalog_item" "ci" ON (("ci"."Mã nội bộ" = "ib"."internal_code")))
        ), "khop" AS (
         SELECT "b_1"."ticket_code",
            "g_1"."code" AS "group_code",
            "g_1"."muc_do"
           FROM ("base" "b_1"
             JOIN "public"."issue_group" "g_1" ON ((("b_1"."van_ban" ~* "g_1"."mau_mo_ta") AND (("g_1"."mau_may" IS NULL) OR ("b_1"."van_ban_may" ~* "g_1"."mau_may")))))
        ), "auto_loi" AS (
         SELECT "khop"."ticket_code",
            "khop"."group_code"
           FROM "khop"
          WHERE ("khop"."muc_do" <> 'khong_loi'::"text")
        ), "auto_dv" AS (
         SELECT "k_1"."ticket_code",
            "k_1"."group_code"
           FROM "khop" "k_1"
          WHERE (("k_1"."muc_do" = 'khong_loi'::"text") AND (NOT (EXISTS ( SELECT 1
                   FROM "auto_loi" "al"
                  WHERE ("al"."ticket_code" = "k_1"."ticket_code")))))
        ), "auto" AS (
         SELECT "auto_loi"."ticket_code",
            "auto_loi"."group_code"
           FROM "auto_loi"
        UNION
         SELECT "auto_dv"."ticket_code",
            "auto_dv"."group_code"
           FROM "auto_dv"
        ), "ket_hop" AS (
         SELECT "a"."ticket_code",
            "a"."group_code",
            'rule'::"text" AS "nguon"
           FROM "auto" "a"
          WHERE (NOT (EXISTS ( SELECT 1
                   FROM "public"."issue_override" "o"
                  WHERE (("o"."ticket_code" = "a"."ticket_code") AND ("o"."group_code" = "a"."group_code") AND ("o"."gan" = false)))))
        UNION
         SELECT "o"."ticket_code",
            "o"."group_code",
            'người'::"text" AS "nguon"
           FROM "public"."issue_override" "o"
          WHERE ("o"."gan" = true)
        )
 SELECT "k"."ticket_code",
    "k"."group_code",
    "k"."nguon",
    "g"."ten" AS "nhom_ten",
    "g"."muc_do",
    "g"."bao_hang",
    "g"."thu_tu",
    "b"."state",
    "b"."ticket_type",
    "b"."description",
    "b"."created_at",
    "b"."province",
    "b"."serial",
    "b"."internal_code",
    "b"."product_name",
    "b"."customer_id",
    "c"."full_name" AS "customer_name",
    "c"."primary_phone"
   FROM ((("ket_hop" "k"
     JOIN "public"."issue_group" "g" ON (("g"."code" = "k"."group_code")))
     JOIN "base" "b" ON (("b"."ticket_code" = "k"."ticket_code")))
     LEFT JOIN "public"."cs_customers" "c" ON (("c"."id" = "b"."customer_id")));


ALTER VIEW "public"."v_ticket_issue" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_issue_report" AS
 SELECT "g"."code",
    "g"."ten",
    "g"."muc_do",
    "g"."bao_hang",
    "g"."mo_ta",
    "g"."thu_tu",
    "count"("vi"."ticket_code") AS "so_ticket",
    "count"(*) FILTER (WHERE ("vi"."state" = 'Open'::"text")) AS "dang_mo",
    "count"(*) FILTER (WHERE ("vi"."state" = 'Done'::"text")) AS "da_xong",
    "count"(*) FILTER (WHERE ("vi"."state" = 'Cancel'::"text")) AS "da_huy",
    "count"(DISTINCT "vi"."customer_id") AS "so_khach",
    "count"(DISTINCT "vi"."serial") AS "so_may",
    "count"(DISTINCT "vi"."internal_code") AS "so_model",
    "string_agg"(DISTINCT "vi"."internal_code", ', '::"text" ORDER BY "vi"."internal_code") AS "cac_model",
    ("min"("vi"."created_at"))::"date" AS "som_nhat",
    ("max"("vi"."created_at"))::"date" AS "gan_nhat",
    "count"(*) FILTER (WHERE ("vi"."created_at" >= (CURRENT_DATE - 90))) AS "trong_90_ngay"
   FROM ("public"."issue_group" "g"
     LEFT JOIN "public"."v_ticket_issue" "vi" ON (("vi"."group_code" = "g"."code")))
  GROUP BY "g"."code", "g"."ten", "g"."muc_do", "g"."bao_hang", "g"."mo_ta", "g"."thu_tu";


ALTER VIEW "public"."v_issue_report" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_maintenance_due" WITH ("security_invoker"='true') AS
 SELECT "mv"."id" AS "visit_id",
    "mv"."asana_task_id",
    "mv"."lan_thu",
    "mv"."due_date",
    "mv"."completed_at",
    "mp"."id" AS "plan_id",
    "mp"."loai_goi",
    "mp"."tong_lan",
    "mp"."bo_may",
    COALESCE("c"."full_name", "mp"."source_customer_name") AS "customer_name",
    COALESCE("c"."primary_phone", "mp"."source_phone") AS "primary_phone",
    ("mp"."customer_id" IS NULL) AS "chua_khop_khach",
    "mv"."section",
        CASE
            WHEN ("mv"."completed_at" IS NOT NULL) THEN 'đã xong'::"text"
            WHEN ("mv"."due_date" IS NULL) THEN 'không rõ hạn'::"text"
            WHEN ("mv"."due_date" < CURRENT_DATE) THEN 'QUÁ HẠN'::"text"
            WHEN ("mv"."due_date" <= (CURRENT_DATE + 30)) THEN 'sắp đến hạn (≤30 ngày)'::"text"
            ELSE 'còn hạn'::"text"
        END AS "tinh_trang",
    COALESCE("c"."ten_kd", "mp"."ten_kd") AS "ten_kd",
    "mv"."section_kd",
    "mp"."bo_may_kd"
   FROM (("public"."maintenance_visit" "mv"
     LEFT JOIN "public"."maintenance_plan" "mp" ON (("mp"."id" = "mv"."plan_id")))
     LEFT JOIN "public"."cs_customers" "c" ON (("c"."id" = "mp"."customer_id")));


ALTER VIEW "public"."v_maintenance_due" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_may_kho" AS
 SELECT "s"."internal_code",
    "max"("s"."ten_noi_bo") AS "ten_noi_bo",
    "count"(*) FILTER (WHERE (COALESCE("w"."activated", false) = false)) AS "con_lai",
    "count"(*) AS "tong"
   FROM ("public"."serial_registry" "s"
     LEFT JOIN "public"."warranty" "w" ON (("w"."serial" = "s"."serial")))
  WHERE (("s"."internal_code" IS NOT NULL) AND ("s"."ten_noi_bo" !~~* 'Bộ lọc%'::"text") AND ("s"."ten_noi_bo" !~~* 'Bộ vỏ%'::"text") AND ("s"."internal_code" !~~* '%-SHELL'::"text"))
  GROUP BY "s"."internal_code";


ALTER VIEW "public"."v_may_kho" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_report_base" AS
 SELECT "order_code",
    "source_tab",
    "category_l1",
    "category_l2",
    "order_date",
    "to_char"(("order_date")::timestamp with time zone, 'YYYY-MM'::"text") AS "ymonth",
    "channel",
    "channel_detail",
    "product_name",
    "internal_code",
    "province_moi",
    COALESCE("quantity", (0)::numeric) AS "qty",
    COALESCE("amount_vat", (0)::numeric) AS "amount",
    "fulfillment_status"
   FROM "public"."sales_order_lines"
  WHERE (("order_code" IS NOT NULL) AND ("btrim"("order_code") <> ''::"text") AND (COALESCE("fulfillment_status", ''::"text") <> ALL (ARRAY['Huỷ'::"text", 'Hoàn hàng'::"text"])));


ALTER VIEW "public"."v_report_base" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_report_cat1" AS
 SELECT "ymonth",
    COALESCE(NULLIF("btrim"("category_l1"), ''::"text"), '(không rõ)'::"text") AS "category_l1",
    ("sum"("amount"))::bigint AS "amount",
    "count"(DISTINCT "order_code") AS "orders",
    ("sum"("qty"))::bigint AS "qty"
   FROM "public"."v_report_base"
  GROUP BY "ymonth", COALESCE(NULLIF("btrim"("category_l1"), ''::"text"), '(không rõ)'::"text");


ALTER VIEW "public"."v_report_cat1" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_report_channel" AS
 SELECT "ymonth",
    COALESCE(NULLIF("btrim"("channel"), ''::"text"), '(không rõ)'::"text") AS "channel",
    ("sum"("amount"))::bigint AS "amount",
    "count"(DISTINCT "order_code") AS "orders"
   FROM "public"."v_report_base"
  GROUP BY "ymonth", COALESCE(NULLIF("btrim"("channel"), ''::"text"), '(không rõ)'::"text");


ALTER VIEW "public"."v_report_channel" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_report_day" AS
 SELECT "order_date",
    "to_char"(("order_date")::timestamp with time zone, 'YYYY-MM'::"text") AS "ymonth",
    ("sum"("amount"))::bigint AS "amount",
    "count"(DISTINCT "order_code") AS "orders"
   FROM "public"."v_report_base"
  GROUP BY "order_date", ("to_char"(("order_date")::timestamp with time zone, 'YYYY-MM'::"text"));


ALTER VIEW "public"."v_report_day" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_report_day_cat1" AS
 SELECT "order_date",
    COALESCE(NULLIF("btrim"("category_l1"), ''::"text"), '(không rõ)'::"text") AS "category_l1",
    ("sum"("amount"))::bigint AS "amount",
    "count"(DISTINCT "order_code") AS "orders",
    ("sum"("qty"))::bigint AS "qty"
   FROM "public"."v_report_base"
  GROUP BY "order_date", COALESCE(NULLIF("btrim"("category_l1"), ''::"text"), '(không rõ)'::"text");


ALTER VIEW "public"."v_report_day_cat1" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_report_day_channel" AS
 SELECT "order_date",
    COALESCE(NULLIF("btrim"("channel"), ''::"text"), '(không rõ)'::"text") AS "channel",
    ("sum"("amount"))::bigint AS "amount",
    "count"(DISTINCT "order_code") AS "orders"
   FROM "public"."v_report_base"
  GROUP BY "order_date", COALESCE(NULLIF("btrim"("channel"), ''::"text"), '(không rõ)'::"text");


ALTER VIEW "public"."v_report_day_channel" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_report_day_product" AS
 SELECT "order_date",
    COALESCE(NULLIF("btrim"("product_name"), ''::"text"), '(không rõ)'::"text") AS "product_name",
    ("sum"("amount"))::bigint AS "amount",
    ("sum"("qty"))::bigint AS "qty",
    "count"(DISTINCT "order_code") AS "orders"
   FROM "public"."v_report_base"
  GROUP BY "order_date", COALESCE(NULLIF("btrim"("product_name"), ''::"text"), '(không rõ)'::"text");


ALTER VIEW "public"."v_report_day_product" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_report_day_tab" AS
 SELECT "order_date",
        CASE "upper"("replace"("source_tab", 'DON_'::"text", ''::"text"))
            WHEN 'POE'::"text" THEN 'POE'::"text"
            WHEN 'POU'::"text" THEN 'POU'::"text"
            WHEN 'OTHERS'::"text" THEN 'Others'::"text"
            ELSE COALESCE(NULLIF("replace"("source_tab", 'DON_'::"text", ''::"text"), ''::"text"), '(khác)'::"text")
        END AS "tab",
    ("sum"("amount"))::bigint AS "amount",
    "count"(DISTINCT "order_code") AS "orders",
    ("sum"("qty"))::bigint AS "qty"
   FROM "public"."v_report_base"
  GROUP BY "order_date",
        CASE "upper"("replace"("source_tab", 'DON_'::"text", ''::"text"))
            WHEN 'POE'::"text" THEN 'POE'::"text"
            WHEN 'POU'::"text" THEN 'POU'::"text"
            WHEN 'OTHERS'::"text" THEN 'Others'::"text"
            ELSE COALESCE(NULLIF("replace"("source_tab", 'DON_'::"text", ''::"text"), ''::"text"), '(khác)'::"text")
        END;


ALTER VIEW "public"."v_report_day_tab" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_report_month" AS
 SELECT "ymonth",
    ("sum"("amount"))::bigint AS "amount",
    "count"(DISTINCT "order_code") AS "orders",
    "count"(*) AS "lines",
    "count"(DISTINCT "order_date") AS "active_days"
   FROM "public"."v_report_base"
  GROUP BY "ymonth";


ALTER VIEW "public"."v_report_month" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_report_product" AS
 SELECT "ymonth",
    COALESCE(NULLIF("btrim"("product_name"), ''::"text"), '(không rõ)'::"text") AS "product_name",
    ("sum"("amount"))::bigint AS "amount",
    ("sum"("qty"))::bigint AS "qty",
    "count"(DISTINCT "order_code") AS "orders"
   FROM "public"."v_report_base"
  GROUP BY "ymonth", COALESCE(NULLIF("btrim"("product_name"), ''::"text"), '(không rõ)'::"text");


ALTER VIEW "public"."v_report_product" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_report_tab" AS
 SELECT "ymonth",
        CASE "upper"("replace"("source_tab", 'DON_'::"text", ''::"text"))
            WHEN 'POE'::"text" THEN 'POE'::"text"
            WHEN 'POU'::"text" THEN 'POU'::"text"
            WHEN 'OTHERS'::"text" THEN 'Others'::"text"
            ELSE COALESCE(NULLIF("replace"("source_tab", 'DON_'::"text", ''::"text"), ''::"text"), '(khác)'::"text")
        END AS "tab",
    ("sum"("amount"))::bigint AS "amount",
    "count"(DISTINCT "order_code") AS "orders",
    ("sum"("qty"))::bigint AS "qty"
   FROM "public"."v_report_base"
  GROUP BY "ymonth",
        CASE "upper"("replace"("source_tab", 'DON_'::"text", ''::"text"))
            WHEN 'POE'::"text" THEN 'POE'::"text"
            WHEN 'POU'::"text" THEN 'POU'::"text"
            WHEN 'OTHERS'::"text" THEN 'Others'::"text"
            ELSE COALESCE(NULLIF("replace"("source_tab", 'DON_'::"text", ''::"text"), ''::"text"), '(khác)'::"text")
        END;


ALTER VIEW "public"."v_report_tab" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_serial_kho" WITH ("security_invoker"='true') AS
 SELECT "s"."stt",
    "s"."serial",
    "s"."internal_code" AS "ma_noi_bo",
    "s"."ten_noi_bo",
    "s"."model" AS "ma_goc",
    "s"."po",
        CASE
            WHEN ("w"."activated" IS TRUE) THEN 'da_kich_hoat'::"text"
            WHEN ("ib"."serial" IS NOT NULL) THEN 'da_lap_chua_kich_hoat'::"text"
            ELSE 'chua_kich_hoat'::"text"
        END AS "trang_thai",
    ("ib"."serial" IS NOT NULL) AS "da_lap",
    COALESCE("w"."activated", false) AS "bh_kich_hoat",
    "ib"."customer_id",
    "k"."full_name" AS "ten_khach",
    "k"."primary_phone" AS "sdt_khach",
    "ib"."install_date" AS "ngay_lap",
    "ib"."parent_serial" AS "serial_me",
    "w"."start_date" AS "bh_bat_dau",
    "w"."full_end" AS "bh_het_han",
    "w"."core_end" AS "bh_loi_het_han",
    "s"."created_at",
    "s"."updated_at"
   FROM ((("public"."serial_registry" "s"
     LEFT JOIN "public"."installed_base" "ib" ON (("ib"."serial" = "s"."serial")))
     LEFT JOIN "public"."warranty" "w" ON (("w"."serial" = "s"."serial")))
     LEFT JOIN "public"."cs_customers" "k" ON (("k"."id" = "ib"."customer_id")));


ALTER VIEW "public"."v_serial_kho" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_serial_kho" IS 'Kho serial + tra loi "serial nay da co khach kich hoat chua". trang_thai: ton_kho | da_lap_chua_kich_hoat | da_kich_hoat. CO PII (ten/SDT khach) -> security_invoker, RLS bang goc van chan anon.';



CREATE OR REPLACE VIEW "public"."v_ticket_chua_phan_nhom" AS
 SELECT "ticket_code",
    "state",
    "ticket_type",
    "description",
    "created_at",
    "serial",
        CASE
            WHEN (("description" IS NULL) OR ("btrim"("description") = ''::"text")) THEN 'thiếu mô tả lỗi — không có gì để gom'::"text"
            ELSE 'mô tả không khớp nhóm nào — cân nhắc tạo nhóm mới hoặc gán tay'::"text"
        END AS "ly_do"
   FROM "public"."tickets" "t"
  WHERE (NOT (EXISTS ( SELECT 1
           FROM "public"."v_ticket_issue" "vi"
          WHERE ("vi"."ticket_code" = "t"."ticket_code"))));


ALTER VIEW "public"."v_ticket_chua_phan_nhom" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_tickets" AS
 SELECT "t"."ticket_code",
    "t"."state",
    "t"."ticket_type",
    "t"."description",
    "t"."last_note",
    COALESCE("c"."province", "cm"."province", "t"."province") AS "province",
    "t"."created_at",
    "t"."serial",
    "t"."source_serial",
    COALESCE("ci"."Tên ngắn gọn (đề xuất)", "ib"."model_freetext") AS "product_name",
    "ib"."internal_code",
    (("t"."source_serial" IS NOT NULL) AND ("t"."serial" IS NULL)) AS "may_khong_trong_he_thong",
    COALESCE("t"."customer_id", "ib"."customer_id") AS "customer_id",
    COALESCE("c"."full_name", "cm"."full_name", "t"."source_customer") AS "customer_name",
    COALESCE("c"."primary_phone", "cm"."primary_phone") AS "primary_phone",
    COALESCE(
        CASE
            WHEN ("w"."id" IS NOT NULL) THEN "w"."activated"
            ELSE "wp"."activated"
        END, false) AS "warranty_activated",
        CASE
            WHEN ("w"."id" IS NOT NULL) THEN "w"."full_end"
            ELSE "wp"."full_end"
        END AS "warranty_full_end",
        CASE
            WHEN ("w"."id" IS NOT NULL) THEN "w"."core_end"
            ELSE "wp"."core_end"
        END AS "warranty_core_end",
        CASE
            WHEN (
            CASE
                WHEN ("w"."id" IS NOT NULL) THEN "w"."full_end"
                ELSE "wp"."full_end"
            END IS NULL) THEN NULL::boolean
            ELSE (
            CASE
                WHEN ("w"."id" IS NOT NULL) THEN "w"."full_end"
                ELSE "wp"."full_end"
            END >= CURRENT_DATE)
        END AS "con_han_may",
        CASE
            WHEN (
            CASE
                WHEN ("w"."id" IS NOT NULL) THEN "w"."core_end"
                ELSE "wp"."core_end"
            END IS NULL) THEN NULL::boolean
            ELSE (
            CASE
                WHEN ("w"."id" IS NOT NULL) THEN "w"."core_end"
                ELSE "wp"."core_end"
            END >= CURRENT_DATE)
        END AS "con_han_loi",
    (("w"."id" IS NULL) AND ("wp"."id" IS NOT NULL)) AS "bh_theo_me",
    "t"."khan",
    "t"."cs_phu_trach",
    "t"."ky_thuat",
    "scs"."ten" AS "cs_ten",
    "skt"."ten" AS "ky_thuat_ten",
    COALESCE("c"."ten_kd", "cm"."ten_kd", "public"."khong_dau"("t"."source_customer")) AS "ten_kd",
    COALESCE("c"."dia_chi_kd", "cm"."dia_chi_kd") AS "dia_chi_kd"
   FROM (((((((("public"."tickets" "t"
     LEFT JOIN "public"."installed_base" "ib" ON (("ib"."serial" = "t"."serial")))
     LEFT JOIN "public"."catalog_item" "ci" ON (("ci"."Mã nội bộ" = "ib"."internal_code")))
     LEFT JOIN "public"."cs_customers" "c" ON (("c"."id" = "t"."customer_id")))
     LEFT JOIN "public"."cs_customers" "cm" ON (("cm"."id" = "ib"."customer_id")))
     LEFT JOIN "public"."warranty" "w" ON (("w"."serial" = "t"."serial")))
     LEFT JOIN "public"."warranty" "wp" ON (("wp"."serial" = "ib"."parent_serial")))
     LEFT JOIN "public"."staff" "scs" ON (("scs"."id" = "t"."cs_phu_trach")))
     LEFT JOIN "public"."staff" "skt" ON (("skt"."id" = "t"."ky_thuat")));


ALTER VIEW "public"."v_tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."warranty_bak_combo_backfill_20260811" (
    "id" "uuid",
    "serial" "text",
    "activated" boolean,
    "start_date" "date",
    "full_end" "date",
    "core_end" "date",
    "policy_note" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."warranty_bak_combo_backfill_20260811" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."yeu_cau_export" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bang" "text" DEFAULT 'cs_customers'::"text" NOT NULL,
    "tieu_chi" "jsonb",
    "co_pii" boolean DEFAULT true NOT NULL,
    "nguoi_gui" "text",
    "trang_thai" "text" DEFAULT 'cho_duyet'::"text" NOT NULL,
    "duyet_boi" "text",
    "duyet_luc" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "yeu_cau_export_trang_thai_check" CHECK (("trang_thai" = ANY (ARRAY['cho_duyet'::"text", 'da_duyet'::"text", 'tu_choi'::"text", 'da_tai'::"text"])))
);


ALTER TABLE "public"."yeu_cau_export" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."yeu_cau_thay_doi" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "doi_tuong" "text" NOT NULL,
    "ban_ghi_id" "text" NOT NULL,
    "loai" "text" NOT NULL,
    "payload" "jsonb",
    "ly_do" "text",
    "nguoi_gui" "text",
    "trang_thai" "text" DEFAULT 'cho_duyet'::"text" NOT NULL,
    "ly_do_tu_choi" "text",
    "duyet_boi" "text",
    "duyet_luc" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "yeu_cau_thay_doi_doi_tuong_check" CHECK (("doi_tuong" = ANY (ARRAY['cs_customers'::"text", 'filter_replacement'::"text", 'customer_contacts'::"text", 'installed_base'::"text"]))),
    CONSTRAINT "yeu_cau_thay_doi_loai_check" CHECK (("loai" = ANY (ARRAY['sua'::"text", 'xoa'::"text", 'doi_serial'::"text"]))),
    CONSTRAINT "yeu_cau_thay_doi_trang_thai_check" CHECK (("trang_thai" = ANY (ARRAY['cho_duyet'::"text", 'da_duyet'::"text", 'tu_choi'::"text"])))
);


ALTER TABLE "public"."yeu_cau_thay_doi" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "work"."activity" (
    "id" bigint NOT NULL,
    "task_id" bigint,
    "actor_id" "uuid",
    "verb" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "work"."activity" OWNER TO "postgres";


ALTER TABLE "work"."activity" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "work"."activity_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "work"."attachment" (
    "id" bigint NOT NULL,
    "task_id" bigint NOT NULL,
    "drive_file_id" "text" NOT NULL,
    "drive_url" "text" NOT NULL,
    "name" "text",
    "mime" "text",
    "added_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "work"."attachment" OWNER TO "postgres";


ALTER TABLE "work"."attachment" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "work"."attachment_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "work"."comment" (
    "id" bigint NOT NULL,
    "task_id" bigint NOT NULL,
    "author_id" "uuid",
    "body" "text" NOT NULL,
    "mentions" "uuid"[] DEFAULT '{}'::"uuid"[],
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "work"."comment" OWNER TO "postgres";


ALTER TABLE "work"."comment" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "work"."comment_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "work"."notification" (
    "id" bigint NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "task_id" bigint,
    "channel" "text" DEFAULT 'discord'::"text" NOT NULL,
    "kind" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "sent_at" timestamp with time zone,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notification_channel_check" CHECK (("channel" = ANY (ARRAY['discord'::"text", 'email'::"text", 'inapp'::"text"])))
);


ALTER TABLE "work"."notification" OWNER TO "postgres";


ALTER TABLE "work"."notification" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "work"."notification_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "work"."project" (
    "id" bigint NOT NULL,
    "key" "text",
    "name" "text" NOT NULL,
    "kind" "text" DEFAULT 'initiative'::"text" NOT NULL,
    "team_id" bigint,
    "customer_code" "text",
    "owner_id" "uuid",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "color" "text",
    "start_date" "date",
    "due_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "project_kind_check" CHECK (("kind" = ANY (ARRAY['initiative'::"text", 'customer'::"text", 'internal'::"text", 'personal'::"text"]))),
    CONSTRAINT "project_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'on_hold'::"text", 'done'::"text", 'archived'::"text"])))
);


ALTER TABLE "work"."project" OWNER TO "postgres";


ALTER TABLE "work"."project" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "work"."project_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "work"."recurring" (
    "id" bigint NOT NULL,
    "title_tmpl" "text" NOT NULL,
    "rrule" "text" NOT NULL,
    "team_id" bigint,
    "default_project_id" bigint,
    "default_assignees" "jsonb" DEFAULT '[]'::"jsonb",
    "link_tmpl" "jsonb" DEFAULT '{}'::"jsonb",
    "active" boolean DEFAULT true NOT NULL,
    "last_run_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "work"."recurring" OWNER TO "postgres";


ALTER TABLE "work"."recurring" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "work"."recurring_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "work"."staff_channel" (
    "staff_id" "uuid" NOT NULL,
    "discord_id" "text",
    "discord_dm_id" "text",
    "email_optin" boolean DEFAULT true,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "work"."staff_channel" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "work"."task_ref_seq"
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "work"."task_ref_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "work"."task" (
    "id" bigint NOT NULL,
    "ref" "text" DEFAULT ('TK-'::"text" || "nextval"('"work"."task_ref_seq"'::"regclass")) NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'todo'::"text" NOT NULL,
    "priority" smallint DEFAULT 3 NOT NULL,
    "scope" "text" DEFAULT 'team'::"text" NOT NULL,
    "visibility" "text" DEFAULT 'team'::"text" NOT NULL,
    "team_id" bigint,
    "parent_id" bigint,
    "creator_id" "uuid",
    "start_at" timestamp with time zone,
    "due_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "estimate_min" integer,
    "origin" "text" DEFAULT 'manual'::"text" NOT NULL,
    "origin_ref" "text",
    "recurring_id" bigint,
    "follow_up_from" bigint,
    "duplicate_of" bigint,
    "merged_at" timestamp with time zone,
    "sort_order" double precision DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "task_origin_check" CHECK (("origin" = ANY (ARRAY['manual'::"text", 'auto_erp'::"text", 'recurring'::"text", 'follow_up'::"text"]))),
    CONSTRAINT "task_priority_check" CHECK ((("priority" >= 1) AND ("priority" <= 4))),
    CONSTRAINT "task_scope_check" CHECK (("scope" = ANY (ARRAY['team'::"text", 'personal'::"text"]))),
    CONSTRAINT "task_status_check" CHECK (("status" = ANY (ARRAY['todo'::"text", 'doing'::"text", 'blocked'::"text", 'review'::"text", 'done'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "task_visibility_check" CHECK (("visibility" = ANY (ARRAY['private'::"text", 'team'::"text", 'company'::"text"])))
);


ALTER TABLE "work"."task" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "work"."task_assignee" (
    "task_id" bigint NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'doer'::"text" NOT NULL,
    "assigned_by" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "accepted_at" timestamp with time zone,
    "done_at" timestamp with time zone,
    CONSTRAINT "task_assignee_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'doer'::"text", 'reviewer'::"text", 'watcher'::"text"])))
);


ALTER TABLE "work"."task_assignee" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "work"."task_dependency" (
    "task_id" bigint NOT NULL,
    "blocked_by_id" bigint NOT NULL,
    "type" "text" DEFAULT 'finish_to_start'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "task_dependency_check" CHECK (("task_id" <> "blocked_by_id"))
);


ALTER TABLE "work"."task_dependency" OWNER TO "postgres";


ALTER TABLE "work"."task" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "work"."task_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "work"."task_link" (
    "id" bigint NOT NULL,
    "task_id" bigint NOT NULL,
    "link_type" "text" NOT NULL,
    "customer_code" "text",
    "ticket_code" "text",
    "order_code" "text",
    "serial" "text",
    "maintenance_plan_id" "uuid",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "task_link_link_type_check" CHECK (("link_type" = ANY (ARRAY['sales_quote'::"text", 'sales_contract'::"text", 'sales_visit'::"text", 'cs_install'::"text", 'cs_ticket'::"text", 'cs_maintenance'::"text", 'internal'::"text"])))
);


ALTER TABLE "work"."task_link" OWNER TO "postgres";


ALTER TABLE "work"."task_link" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "work"."task_link_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "work"."task_project" (
    "task_id" bigint NOT NULL,
    "project_id" bigint NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "work"."task_project" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "work"."team" (
    "id" bigint NOT NULL,
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "work"."team" OWNER TO "postgres";


ALTER TABLE "work"."team" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "work"."team_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "work"."team_member" (
    "team_id" bigint NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "role_in_team" "text" DEFAULT 'member'::"text"
);


ALTER TABLE "work"."team_member" OWNER TO "postgres";


ALTER TABLE ONLY "public"."company_customers" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."company_customers_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."dim_channel" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."dim_channel_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bang_view"
    ADD CONSTRAINT "bang_view_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."catalog_category"
    ADD CONSTRAINT "catalog_category_pkey" PRIMARY KEY ("Mã danh mục");



ALTER TABLE ONLY "public"."catalog_item"
    ADD CONSTRAINT "catalog_item_pkey" PRIMARY KEY ("Mã nội bộ");



ALTER TABLE ONLY "public"."catalog_sync_log"
    ADD CONSTRAINT "catalog_sync_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_customers"
    ADD CONSTRAINT "company_customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cs_customer_code_remap_20260812"
    ADD CONSTRAINT "cs_customer_code_remap_20260812_pkey" PRIMARY KEY ("cs_id");



ALTER TABLE ONLY "public"."cs_staff"
    ADD CONSTRAINT "cs_staff_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."cs_staff"
    ADD CONSTRAINT "cs_staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_contacts"
    ADD CONSTRAINT "customer_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_purchases"
    ADD CONSTRAINT "customer_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_customer_code_key" UNIQUE ("customer_code");



ALTER TABLE ONLY "public"."cs_customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cs_customers"
    ADD CONSTRAINT "customers_primary_phone_key" UNIQUE ("primary_phone");



ALTER TABLE ONLY "public"."dim_channel"
    ADD CONSTRAINT "dim_channel_channel_l1_channel_l2_key" UNIQUE ("channel_l1", "channel_l2");



ALTER TABLE ONLY "public"."dim_channel"
    ADD CONSTRAINT "dim_channel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."filter_replacement"
    ADD CONSTRAINT "filter_replacement_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."installed_base"
    ADD CONSTRAINT "installed_base_pkey" PRIMARY KEY ("serial");



ALTER TABLE ONLY "public"."issue_group"
    ADD CONSTRAINT "issue_group_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."issue_override"
    ADD CONSTRAINT "issue_override_pkey" PRIMARY KEY ("ticket_code", "group_code");



ALTER TABLE ONLY "public"."ky_thuat_nghi"
    ADD CONSTRAINT "ky_thuat_nghi_ky_thuat_id_ngay_key" UNIQUE ("ky_thuat_id", "ngay");



ALTER TABLE ONLY "public"."ky_thuat_nghi"
    ADD CONSTRAINT "ky_thuat_nghi_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ky_thuat"
    ADD CONSTRAINT "ky_thuat_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lich_ky_thuat"
    ADD CONSTRAINT "lich_ky_thuat_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lich_ky_thuat_viec"
    ADD CONSTRAINT "lich_ky_thuat_viec_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."maintenance_plan"
    ADD CONSTRAINT "maintenance_plan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."maintenance_visit"
    ADD CONSTRAINT "maintenance_visit_asana_task_id_key" UNIQUE ("asana_task_id");



ALTER TABLE ONLY "public"."maintenance_visit"
    ADD CONSTRAINT "maintenance_visit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media"
    ADD CONSTRAINT "media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_bundle"
    ADD CONSTRAINT "product_bundle_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_filter"
    ADD CONSTRAINT "product_filter_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_warranty"
    ADD CONSTRAINT "product_warranty_pkey" PRIMARY KEY ("internal_code");



ALTER TABLE ONLY "public"."report_allowlist"
    ADD CONSTRAINT "report_allowlist_pkey" PRIMARY KEY ("email");



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_order_lines"
    ADD CONSTRAINT "sales_order_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_order_code_key" UNIQUE ("order_code");



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("order_id");



ALTER TABLE ONLY "public"."serial_pending"
    ADD CONSTRAINT "serial_pending_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."serial_registry"
    ADD CONSTRAINT "serial_registry_pkey" PRIMARY KEY ("serial");



ALTER TABLE ONLY "public"."serial_su_dung"
    ADD CONSTRAINT "serial_su_dung_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."serial_trang_thai"
    ADD CONSTRAINT "serial_trang_thai_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_code"
    ADD CONSTRAINT "supplier_code_pkey" PRIMARY KEY ("Mã đối tác");



ALTER TABLE ONLY "public"."ticket_muc"
    ADD CONSTRAINT "ticket_muc_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_note"
    ADD CONSTRAINT "ticket_note_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_pkey" PRIMARY KEY ("ticket_code");



ALTER TABLE ONLY "public"."warranty"
    ADD CONSTRAINT "warranty_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."warranty"
    ADD CONSTRAINT "warranty_serial_key" UNIQUE ("serial");



ALTER TABLE ONLY "public"."yeu_cau_export"
    ADD CONSTRAINT "yeu_cau_export_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."yeu_cau_thay_doi"
    ADD CONSTRAINT "yeu_cau_thay_doi_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "work"."activity"
    ADD CONSTRAINT "activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "work"."attachment"
    ADD CONSTRAINT "attachment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "work"."comment"
    ADD CONSTRAINT "comment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "work"."notification"
    ADD CONSTRAINT "notification_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "work"."project"
    ADD CONSTRAINT "project_key_key" UNIQUE ("key");



ALTER TABLE ONLY "work"."project"
    ADD CONSTRAINT "project_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "work"."recurring"
    ADD CONSTRAINT "recurring_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "work"."staff_channel"
    ADD CONSTRAINT "staff_channel_pkey" PRIMARY KEY ("staff_id");



ALTER TABLE ONLY "work"."task_assignee"
    ADD CONSTRAINT "task_assignee_pkey" PRIMARY KEY ("task_id", "staff_id", "role");



ALTER TABLE ONLY "work"."task_dependency"
    ADD CONSTRAINT "task_dependency_pkey" PRIMARY KEY ("task_id", "blocked_by_id");



ALTER TABLE ONLY "work"."task_link"
    ADD CONSTRAINT "task_link_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "work"."task"
    ADD CONSTRAINT "task_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "work"."task_project"
    ADD CONSTRAINT "task_project_pkey" PRIMARY KEY ("task_id", "project_id");



ALTER TABLE ONLY "work"."task"
    ADD CONSTRAINT "task_ref_key" UNIQUE ("ref");



ALTER TABLE ONLY "work"."team"
    ADD CONSTRAINT "team_key_key" UNIQUE ("key");



ALTER TABLE ONLY "work"."team_member"
    ADD CONSTRAINT "team_member_pkey" PRIMARY KEY ("team_id", "staff_id");



ALTER TABLE ONLY "work"."team"
    ADD CONSTRAINT "team_pkey" PRIMARY KEY ("id");



CREATE INDEX "audit_log_hanh_dong_idx" ON "public"."audit_log" USING "btree" ("hanh_dong");



CREATE INDEX "audit_log_luc_idx" ON "public"."audit_log" USING "btree" ("luc" DESC);



CREATE INDEX "bang_view_idx" ON "public"."bang_view" USING "btree" ("bang", "chu");



CREATE INDEX "company_customers_tax_code_idx" ON "public"."company_customers" USING "btree" ("tax_code");



CREATE INDEX "cs_customers_channel_id_idx" ON "public"."cs_customers" USING "btree" ("channel_id");



CREATE INDEX "cust_purch_customer_idx" ON "public"."customer_purchases" USING "btree" ("customer_code");



CREATE INDEX "cust_purch_internal_idx" ON "public"."customer_purchases" USING "btree" ("internal_code");



CREATE INDEX "customers_phone_chuan_idx" ON "public"."customers" USING "btree" ("phone_chuan");



CREATE INDEX "customers_phone_idx" ON "public"."customers" USING "btree" ("phone");



CREATE INDEX "idx_cs_customers_code" ON "public"."cs_customers" USING "btree" ("customer_code") WHERE ("customer_code" IS NOT NULL);



CREATE INDEX "idx_cs_customers_dia_chi_kd" ON "public"."cs_customers" USING "gin" ("dia_chi_kd" "public"."gin_trgm_ops");



CREATE INDEX "idx_cs_customers_needs_phone" ON "public"."cs_customers" USING "btree" ("needs_phone") WHERE "needs_phone";



CREATE INDEX "idx_cs_customers_ten_kd" ON "public"."cs_customers" USING "gin" ("ten_kd" "public"."gin_trgm_ops");



CREATE INDEX "idx_customer_contacts_customer" ON "public"."customer_contacts" USING "btree" ("customer_id");



CREATE INDEX "idx_customer_contacts_phone" ON "public"."customer_contacts" USING "btree" ("phone");



CREATE INDEX "idx_filter_repl_code" ON "public"."filter_replacement" USING "btree" ("serial", "filter_code", "replaced_at" DESC);



CREATE INDEX "idx_filter_repl_serial" ON "public"."filter_replacement" USING "btree" ("serial");



CREATE INDEX "idx_installed_base_customer" ON "public"."installed_base" USING "btree" ("customer_id");



CREATE INDEX "idx_installed_base_internal_code" ON "public"."installed_base" USING "btree" ("internal_code");



CREATE INDEX "idx_installed_base_parent" ON "public"."installed_base" USING "btree" ("parent_serial");



CREATE INDEX "idx_kt_nghi_ngay" ON "public"."ky_thuat_nghi" USING "btree" ("ngay");



CREATE INDEX "idx_lich_kt_ky_thuat" ON "public"."lich_ky_thuat" USING "btree" ("ky_thuat_id");



CREATE INDEX "idx_lich_kt_ngay" ON "public"."lich_ky_thuat" USING "btree" ("ngay");



CREATE INDEX "idx_lich_kt_viec_lich" ON "public"."lich_ky_thuat_viec" USING "btree" ("lich_id");



CREATE INDEX "idx_maintenance_plan_bo_may_kd" ON "public"."maintenance_plan" USING "gin" ("bo_may_kd" "public"."gin_trgm_ops");



CREATE INDEX "idx_maintenance_plan_customer" ON "public"."maintenance_plan" USING "btree" ("customer_id");



CREATE INDEX "idx_maintenance_plan_serial" ON "public"."maintenance_plan" USING "btree" ("serial");



CREATE INDEX "idx_maintenance_plan_ten_kd" ON "public"."maintenance_plan" USING "gin" ("ten_kd" "public"."gin_trgm_ops");



CREATE INDEX "idx_maintenance_visit_due" ON "public"."maintenance_visit" USING "btree" ("due_date");



CREATE INDEX "idx_maintenance_visit_plan" ON "public"."maintenance_visit" USING "btree" ("plan_id");



CREATE INDEX "idx_maintenance_visit_section_kd" ON "public"."maintenance_visit" USING "gin" ("section_kd" "public"."gin_trgm_ops");



CREATE INDEX "idx_serial_pending_tt" ON "public"."serial_pending" USING "btree" ("trang_thai", "created_at" DESC);



CREATE INDEX "idx_serial_registry_code" ON "public"."serial_registry" USING "btree" ("code");



CREATE INDEX "idx_serial_registry_model" ON "public"."serial_registry" USING "btree" ("model");



CREATE INDEX "idx_serial_registry_po" ON "public"."serial_registry" USING "btree" ("po");



CREATE INDEX "idx_so_customer" ON "public"."sales_orders" USING "btree" ("customer_code");



CREATE INDEX "idx_so_date" ON "public"."sales_orders" USING "btree" ("order_date");



CREATE INDEX "idx_soi_internal" ON "public"."sales_order_items" USING "btree" ("internal_code");



CREATE INDEX "idx_soi_order" ON "public"."sales_order_items" USING "btree" ("order_id");



CREATE INDEX "idx_ticket_muc_code" ON "public"."ticket_muc" USING "btree" ("ticket_code", "created_at");



CREATE INDEX "idx_ticket_note_code" ON "public"."ticket_note" USING "btree" ("ticket_code", "created_at" DESC);



CREATE INDEX "idx_tickets_created" ON "public"."tickets" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_tickets_customer" ON "public"."tickets" USING "btree" ("customer_id");



CREATE INDEX "idx_tickets_serial" ON "public"."tickets" USING "btree" ("serial");



CREATE INDEX "idx_tickets_source_serial" ON "public"."tickets" USING "btree" ("source_serial");



CREATE INDEX "idx_tickets_state" ON "public"."tickets" USING "btree" ("state");



CREATE INDEX "media_entity_idx" ON "public"."media" USING "btree" ("entity_type", "entity_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "sales_order_lines_category_idx" ON "public"."sales_order_lines" USING "btree" ("category_l1", "category_l2");



CREATE INDEX "sales_order_lines_order_code_idx" ON "public"."sales_order_lines" USING "btree" ("order_code");



CREATE INDEX "sales_order_lines_report_month_idx" ON "public"."sales_order_lines" USING "btree" ("report_month");



CREATE INDEX "serial_su_dung_serial_idx" ON "public"."serial_su_dung" USING "btree" ("serial", "luc" DESC);



CREATE INDEX "yc_export_cho_idx" ON "public"."yeu_cau_export" USING "btree" ("trang_thai", "created_at" DESC);



CREATE INDEX "yc_export_nguoi_idx" ON "public"."yeu_cau_export" USING "btree" ("nguoi_gui", "trang_thai");



CREATE INDEX "yctd_cho_idx" ON "public"."yeu_cau_thay_doi" USING "btree" ("trang_thai", "created_at" DESC);



CREATE INDEX "ix_activity_task" ON "work"."activity" USING "btree" ("task_id");



CREATE INDEX "ix_activity_time" ON "work"."activity" USING "btree" ("created_at");



CREATE INDEX "ix_assignee_staff" ON "work"."task_assignee" USING "btree" ("staff_id");



CREATE INDEX "ix_attach_task" ON "work"."attachment" USING "btree" ("task_id");



CREATE INDEX "ix_comment_task" ON "work"."comment" USING "btree" ("task_id");



CREATE INDEX "ix_dep_blockedby" ON "work"."task_dependency" USING "btree" ("blocked_by_id");



CREATE INDEX "ix_link_customer" ON "work"."task_link" USING "btree" ("customer_code");



CREATE INDEX "ix_link_task" ON "work"."task_link" USING "btree" ("task_id");



CREATE INDEX "ix_link_ticket" ON "work"."task_link" USING "btree" ("ticket_code");



CREATE INDEX "ix_notif_unread" ON "work"."notification" USING "btree" ("staff_id") WHERE ("read_at" IS NULL);



CREATE INDEX "ix_project_customer" ON "work"."project" USING "btree" ("customer_code");



CREATE INDEX "ix_project_team" ON "work"."project" USING "btree" ("team_id");



CREATE INDEX "ix_task_creator" ON "work"."task" USING "btree" ("creator_id");



CREATE INDEX "ix_task_due" ON "work"."task" USING "btree" ("due_at");



CREATE INDEX "ix_task_parent" ON "work"."task" USING "btree" ("parent_id");



CREATE INDEX "ix_task_status" ON "work"."task" USING "btree" ("status");



CREATE INDEX "ix_task_team" ON "work"."task" USING "btree" ("team_id");



CREATE INDEX "ix_taskproj_project" ON "work"."task_project" USING "btree" ("project_id");



CREATE UNIQUE INDEX "ux_notif_idem" ON "work"."notification" USING "btree" ("staff_id", "task_id", "kind") WHERE ("sent_at" IS NOT NULL);



CREATE OR REPLACE VIEW "public"."v_bh_cho_kich_hoat" WITH ("security_invoker"='true') AS
 SELECT 'da_lap_chua_kich_hoat'::"text" AS "nguon",
    "ib"."serial",
    "ib"."internal_code" AS "ma_noi_bo",
    "sr"."ten_noi_bo",
    "k"."id" AS "customer_id",
    "k"."full_name" AS "ten_khach",
    "k"."primary_phone" AS "sdt_khach",
    "k"."address" AS "dia_chi",
    "ib"."install_date" AS "ngay_lap",
    NULL::"date" AS "ngay_dat_hang",
    NULL::"text" AS "ma_don",
    1 AS "so_luong",
    "ib"."created_at" AS "tao_luc"
   FROM ((("public"."installed_base" "ib"
     LEFT JOIN "public"."warranty" "w" ON (("w"."serial" = "ib"."serial")))
     LEFT JOIN "public"."serial_registry" "sr" ON (("sr"."serial" = "ib"."serial")))
     LEFT JOIN "public"."cs_customers" "k" ON (("k"."id" = "ib"."customer_id")))
  WHERE ("w"."activated" IS NOT TRUE)
UNION ALL
 SELECT 'don_sales_chua_gan_may'::"text" AS "nguon",
    NULL::"text" AS "serial",
    "cp"."internal_code" AS "ma_noi_bo",
    "max"("cp"."product_name") AS "ten_noi_bo",
    "k"."id" AS "customer_id",
    COALESCE("k"."full_name", "c"."name") AS "ten_khach",
    COALESCE("k"."primary_phone", "c"."phone_chuan") AS "sdt_khach",
    COALESCE("k"."address", "c"."address") AS "dia_chi",
    NULL::"date" AS "ngay_lap",
    "max"("cp"."order_date") AS "ngay_dat_hang",
    "max"("cp"."order_code") AS "ma_don",
    ((("sum"("cp"."quantity"))::integer - ( SELECT "count"(*) AS "count"
           FROM "public"."installed_base" "ib"
          WHERE (("ib"."customer_id" = "k"."id") AND ("ib"."internal_code" = "cp"."internal_code")))))::integer AS "so_luong",
    "max"("cp"."synced_at") AS "tao_luc"
   FROM (("public"."customer_purchases" "cp"
     JOIN "public"."customers" "c" ON (("c"."customer_code" = "cp"."customer_code")))
     LEFT JOIN "public"."cs_customers" "k" ON (("k"."primary_phone" = "c"."phone_chuan")))
  WHERE ("cp"."category_l1" = 'Machines'::"text")
  GROUP BY "cp"."internal_code", "c"."id", "k"."id"
 HAVING (("sum"("cp"."quantity"))::integer > ( SELECT "count"(*) AS "count"
           FROM "public"."installed_base" "ib"
          WHERE (("ib"."customer_id" = "k"."id") AND ("ib"."internal_code" = "cp"."internal_code"))));



CREATE OR REPLACE TRIGGER "trg_cs_customers_updated_at" BEFORE UPDATE ON "public"."cs_customers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_cs_staff_updated_at" BEFORE UPDATE ON "public"."cs_staff" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_installed_base_updated_at" BEFORE UPDATE ON "public"."installed_base" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_issue_group_updated_at" BEFORE UPDATE ON "public"."issue_group" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_maintenance_plan_updated_at" BEFORE UPDATE ON "public"."maintenance_plan" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sales_orders_updated" BEFORE UPDATE ON "public"."sales_orders" FOR EACH ROW EXECUTE FUNCTION "public"."sales_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_serial_registry_updated_at" BEFORE UPDATE ON "public"."serial_registry" FOR EACH ROW EXECUTE FUNCTION "public"."tu_dong_updated_at"();



CREATE OR REPLACE TRIGGER "trg_staff_updated_at" BEFORE UPDATE ON "public"."staff" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tickets_updated_at" BEFORE UPDATE ON "public"."tickets" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_warranty_updated_at" BEFORE UPDATE ON "public"."warranty" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "t_project_touch" BEFORE UPDATE ON "work"."project" FOR EACH ROW EXECUTE FUNCTION "work"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "t_task_touch" BEFORE UPDATE ON "work"."task" FOR EACH ROW EXECUTE FUNCTION "work"."touch_updated_at"();



ALTER TABLE ONLY "public"."cs_customers"
    ADD CONSTRAINT "cs_customers_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."dim_channel"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_contacts"
    ADD CONSTRAINT "customer_contacts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."cs_customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."filter_replacement"
    ADD CONSTRAINT "filter_replacement_serial_fkey" FOREIGN KEY ("serial") REFERENCES "public"."installed_base"("serial") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."installed_base"
    ADD CONSTRAINT "installed_base_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."cs_customers"("id");



ALTER TABLE ONLY "public"."installed_base"
    ADD CONSTRAINT "installed_base_notify_contact_id_fkey" FOREIGN KEY ("notify_contact_id") REFERENCES "public"."customer_contacts"("id");



ALTER TABLE ONLY "public"."installed_base"
    ADD CONSTRAINT "installed_base_parent_serial_fkey" FOREIGN KEY ("parent_serial") REFERENCES "public"."installed_base"("serial") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."issue_override"
    ADD CONSTRAINT "issue_override_group_code_fkey" FOREIGN KEY ("group_code") REFERENCES "public"."issue_group"("code") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."issue_override"
    ADD CONSTRAINT "issue_override_ticket_code_fkey" FOREIGN KEY ("ticket_code") REFERENCES "public"."tickets"("ticket_code") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ky_thuat_nghi"
    ADD CONSTRAINT "ky_thuat_nghi_ky_thuat_id_fkey" FOREIGN KEY ("ky_thuat_id") REFERENCES "public"."ky_thuat"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lich_ky_thuat"
    ADD CONSTRAINT "lich_ky_thuat_ky_thuat_id_fkey" FOREIGN KEY ("ky_thuat_id") REFERENCES "public"."ky_thuat"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lich_ky_thuat_viec"
    ADD CONSTRAINT "lich_ky_thuat_viec_lich_id_fkey" FOREIGN KEY ("lich_id") REFERENCES "public"."lich_ky_thuat"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."maintenance_plan"
    ADD CONSTRAINT "maintenance_plan_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."cs_customers"("id");



ALTER TABLE ONLY "public"."maintenance_plan"
    ADD CONSTRAINT "maintenance_plan_serial_fkey" FOREIGN KEY ("serial") REFERENCES "public"."installed_base"("serial") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."maintenance_visit"
    ADD CONSTRAINT "maintenance_visit_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."maintenance_plan"("id");



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("order_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."dim_channel"("id");



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_customer_code_fkey" FOREIGN KEY ("customer_code") REFERENCES "public"."customers"("customer_code");



ALTER TABLE ONLY "public"."serial_su_dung"
    ADD CONSTRAINT "serial_su_dung_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."cs_customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ticket_muc"
    ADD CONSTRAINT "ticket_muc_ticket_code_fkey" FOREIGN KEY ("ticket_code") REFERENCES "public"."tickets"("ticket_code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_note"
    ADD CONSTRAINT "ticket_note_ticket_code_fkey" FOREIGN KEY ("ticket_code") REFERENCES "public"."tickets"("ticket_code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_cs_phu_trach_fkey" FOREIGN KEY ("cs_phu_trach") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."cs_customers"("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_ky_thuat_fkey" FOREIGN KEY ("ky_thuat") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_serial_fkey" FOREIGN KEY ("serial") REFERENCES "public"."installed_base"("serial") ON UPDATE CASCADE;



ALTER TABLE ONLY "public"."warranty"
    ADD CONSTRAINT "warranty_serial_fkey" FOREIGN KEY ("serial") REFERENCES "public"."installed_base"("serial") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "work"."activity"
    ADD CONSTRAINT "activity_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "work"."activity"
    ADD CONSTRAINT "activity_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "work"."task"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "work"."attachment"
    ADD CONSTRAINT "attachment_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "work"."attachment"
    ADD CONSTRAINT "attachment_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "work"."task"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "work"."comment"
    ADD CONSTRAINT "comment_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "work"."comment"
    ADD CONSTRAINT "comment_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "work"."task"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "work"."notification"
    ADD CONSTRAINT "notification_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "work"."notification"
    ADD CONSTRAINT "notification_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "work"."task"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "work"."project"
    ADD CONSTRAINT "project_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "work"."project"
    ADD CONSTRAINT "project_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "work"."team"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "work"."recurring"
    ADD CONSTRAINT "recurring_default_project_id_fkey" FOREIGN KEY ("default_project_id") REFERENCES "work"."project"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "work"."recurring"
    ADD CONSTRAINT "recurring_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "work"."team"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "work"."staff_channel"
    ADD CONSTRAINT "staff_channel_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "work"."task_assignee"
    ADD CONSTRAINT "task_assignee_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "work"."task_assignee"
    ADD CONSTRAINT "task_assignee_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "work"."task_assignee"
    ADD CONSTRAINT "task_assignee_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "work"."task"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "work"."task"
    ADD CONSTRAINT "task_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "work"."task_dependency"
    ADD CONSTRAINT "task_dependency_blocked_by_id_fkey" FOREIGN KEY ("blocked_by_id") REFERENCES "work"."task"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "work"."task_dependency"
    ADD CONSTRAINT "task_dependency_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "work"."task"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "work"."task"
    ADD CONSTRAINT "task_duplicate_of_fkey" FOREIGN KEY ("duplicate_of") REFERENCES "work"."task"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "work"."task"
    ADD CONSTRAINT "task_follow_up_from_fkey" FOREIGN KEY ("follow_up_from") REFERENCES "work"."task"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "work"."task_link"
    ADD CONSTRAINT "task_link_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "work"."task"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "work"."task"
    ADD CONSTRAINT "task_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "work"."task"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "work"."task_project"
    ADD CONSTRAINT "task_project_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "work"."project"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "work"."task_project"
    ADD CONSTRAINT "task_project_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "work"."task"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "work"."task"
    ADD CONSTRAINT "task_recurring_fk" FOREIGN KEY ("recurring_id") REFERENCES "work"."recurring"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "work"."task"
    ADD CONSTRAINT "task_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "work"."team"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "work"."team_member"
    ADD CONSTRAINT "team_member_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "work"."team_member"
    ADD CONSTRAINT "team_member_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "work"."team"("id") ON DELETE CASCADE;



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_read_admin" ON "public"."audit_log" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



ALTER TABLE "public"."bang_view" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."catalog_category" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "catalog_category_select_all" ON "public"."catalog_category" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."catalog_item" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "catalog_item_select_all" ON "public"."catalog_item" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."catalog_sync_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cs_customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cs_staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dim_channel" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dim_channel_public_read" ON "public"."dim_channel" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."filter_replacement" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."installed_base" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."issue_group" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."issue_override" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ky_thuat" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ky_thuat_nghi" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lich_ky_thuat" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lich_ky_thuat_viec" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."maintenance_plan" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."maintenance_visit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."media" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_bundle" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_bundle_select_all" ON "public"."product_bundle" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."product_filter" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_filter_select_all" ON "public"."product_filter" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."product_warranty" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_warranty_select_all" ON "public"."product_warranty" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."report_allowlist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales_order_lines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."serial_pending" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."serial_registry" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."serial_su_dung" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."serial_trang_thai" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_all" ON "public"."catalog_sync_log" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "staff_all" ON "public"."cs_customers" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "staff_all" ON "public"."cs_staff" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "staff_all" ON "public"."customer_contacts" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "staff_all" ON "public"."filter_replacement" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "staff_all" ON "public"."installed_base" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "staff_all" ON "public"."issue_group" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "staff_all" ON "public"."issue_override" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "staff_all" ON "public"."maintenance_plan" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "staff_all" ON "public"."maintenance_visit" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "staff_all" ON "public"."serial_pending" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "staff_all" ON "public"."serial_registry" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "staff_all" ON "public"."staff" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "staff_all" ON "public"."ticket_muc" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "staff_all" ON "public"."ticket_note" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "staff_all" ON "public"."tickets" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "staff_all" ON "public"."warranty" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



ALTER TABLE "public"."supplier_code" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supplier_code_select_all" ON "public"."supplier_code" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."ticket_muc" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ticket_note" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tickets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."warranty" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."warranty_bak_combo_backfill_20260811" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."yeu_cau_export" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."yeu_cau_thay_doi" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "work"."activity" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "work"."attachment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "work"."comment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "work"."notification" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "work"."project" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "work"."recurring" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "work"."staff_channel" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "work"."task" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "work"."task_assignee" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "work"."task_dependency" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "work"."task_link" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "work"."task_project" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "work"."team" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "work"."team_member" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "fdw_masterdata";



REVOKE ALL ON FUNCTION "public"."activate_and_seed"("p_customer_code" "text", "p_dry_run" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."activate_and_seed"("p_customer_code" "text", "p_dry_run" boolean) TO "service_role";



GRANT ALL ON TABLE "public"."warranty" TO "anon";
GRANT ALL ON TABLE "public"."warranty" TO "authenticated";
GRANT ALL ON TABLE "public"."warranty" TO "service_role";



REVOKE ALL ON FUNCTION "public"."activate_warranty"("p_serial" "text", "p_start" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."activate_warranty"("p_serial" "text", "p_start" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."duyet_serial_pending"("p_id" "uuid", "p_admin" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."duyet_serial_pending"("p_id" "uuid", "p_admin" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_report_viewer"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_report_viewer"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_report_viewer"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_staff"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_staff"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_staff"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_staff"() TO "service_role";



GRANT ALL ON FUNCTION "public"."khong_dau"("t" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."khong_dau"("t" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."khong_dau"("t" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."kiem_tra_regex_pg"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."kiem_tra_regex_pg"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."kiem_tra_regex_pg"("p" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."lap_bo_combo"("p_combo" "text", "p_customer" "uuid", "p_install_date" "date", "p_install_address" "text", "p_serials" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lap_bo_combo"("p_combo" "text", "p_customer" "uuid", "p_install_date" "date", "p_install_address" "text", "p_serials" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."replace_catalog_table"("p_table" "text", "p_rows" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."replace_catalog_table"("p_table" "text", "p_rows" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."sales_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."sales_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sales_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_catalog"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_catalog"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tu_dong_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."tu_dong_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tu_dong_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."work_doi_trang_thai"("p_email" "text", "p_task_id" bigint, "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."work_doi_trang_thai"("p_email" "text", "p_task_id" bigint, "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."work_doi_trang_thai"("p_email" "text", "p_task_id" bigint, "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."work_doi_trang_thai"("p_email" "text", "p_task_id" bigint, "p_status" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."work_tao_viec"("p_email" "text", "p_title" "text", "p_priority" smallint, "p_due" timestamp with time zone, "p_team_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."work_tao_viec"("p_email" "text", "p_title" "text", "p_priority" smallint, "p_due" timestamp with time zone, "p_team_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."work_tao_viec"("p_email" "text", "p_title" "text", "p_priority" smallint, "p_due" timestamp with time zone, "p_team_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."work_tao_viec"("p_email" "text", "p_title" "text", "p_priority" smallint, "p_due" timestamp with time zone, "p_team_id" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."work_viec_cua_toi"("p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."work_viec_cua_toi"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."work_viec_cua_toi"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."work_viec_cua_toi"("p_email" "text") TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audit_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."bang_view" TO "anon";
GRANT ALL ON TABLE "public"."bang_view" TO "authenticated";
GRANT ALL ON TABLE "public"."bang_view" TO "service_role";



GRANT ALL ON TABLE "public"."catalog_category" TO "anon";
GRANT ALL ON TABLE "public"."catalog_category" TO "authenticated";
GRANT ALL ON TABLE "public"."catalog_category" TO "service_role";



GRANT ALL ON TABLE "public"."catalog_item" TO "anon";
GRANT ALL ON TABLE "public"."catalog_item" TO "authenticated";
GRANT ALL ON TABLE "public"."catalog_item" TO "service_role";



GRANT ALL ON TABLE "public"."catalog_sync_log" TO "anon";
GRANT ALL ON TABLE "public"."catalog_sync_log" TO "authenticated";
GRANT ALL ON TABLE "public"."catalog_sync_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."catalog_sync_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."catalog_sync_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."catalog_sync_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."company_customers" TO "anon";
GRANT ALL ON TABLE "public"."company_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."company_customers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."company_customers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."company_customers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."company_customers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cs_customer_code_remap_20260812" TO "anon";
GRANT ALL ON TABLE "public"."cs_customer_code_remap_20260812" TO "authenticated";
GRANT ALL ON TABLE "public"."cs_customer_code_remap_20260812" TO "service_role";



GRANT ALL ON TABLE "public"."cs_customers" TO "anon";
GRANT ALL ON TABLE "public"."cs_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."cs_customers" TO "service_role";



GRANT ALL ON TABLE "public"."cs_staff" TO "anon";
GRANT ALL ON TABLE "public"."cs_staff" TO "authenticated";
GRANT ALL ON TABLE "public"."cs_staff" TO "service_role";



GRANT ALL ON TABLE "public"."customer_contacts" TO "anon";
GRANT ALL ON TABLE "public"."customer_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."customer_purchases" TO "anon";
GRANT ALL ON TABLE "public"."customer_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_purchases" TO "service_role";



GRANT ALL ON SEQUENCE "public"."customer_purchases_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."customer_purchases_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."customer_purchases_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."customers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."customers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."customers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."dim_channel" TO "anon";
GRANT ALL ON TABLE "public"."dim_channel" TO "authenticated";
GRANT ALL ON TABLE "public"."dim_channel" TO "service_role";
GRANT SELECT ON TABLE "public"."dim_channel" TO "fdw_masterdata";



GRANT ALL ON SEQUENCE "public"."dim_channel_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."dim_channel_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."dim_channel_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."filter_replacement" TO "anon";
GRANT ALL ON TABLE "public"."filter_replacement" TO "authenticated";
GRANT ALL ON TABLE "public"."filter_replacement" TO "service_role";



GRANT ALL ON TABLE "public"."installed_base" TO "anon";
GRANT ALL ON TABLE "public"."installed_base" TO "authenticated";
GRANT ALL ON TABLE "public"."installed_base" TO "service_role";



GRANT ALL ON TABLE "public"."issue_group" TO "anon";
GRANT ALL ON TABLE "public"."issue_group" TO "authenticated";
GRANT ALL ON TABLE "public"."issue_group" TO "service_role";



GRANT ALL ON TABLE "public"."issue_override" TO "anon";
GRANT ALL ON TABLE "public"."issue_override" TO "authenticated";
GRANT ALL ON TABLE "public"."issue_override" TO "service_role";



GRANT ALL ON TABLE "public"."ky_thuat" TO "anon";
GRANT ALL ON TABLE "public"."ky_thuat" TO "authenticated";
GRANT ALL ON TABLE "public"."ky_thuat" TO "service_role";



GRANT ALL ON TABLE "public"."ky_thuat_nghi" TO "anon";
GRANT ALL ON TABLE "public"."ky_thuat_nghi" TO "authenticated";
GRANT ALL ON TABLE "public"."ky_thuat_nghi" TO "service_role";



GRANT ALL ON TABLE "public"."lich_ky_thuat" TO "anon";
GRANT ALL ON TABLE "public"."lich_ky_thuat" TO "authenticated";
GRANT ALL ON TABLE "public"."lich_ky_thuat" TO "service_role";



GRANT ALL ON TABLE "public"."lich_ky_thuat_viec" TO "anon";
GRANT ALL ON TABLE "public"."lich_ky_thuat_viec" TO "authenticated";
GRANT ALL ON TABLE "public"."lich_ky_thuat_viec" TO "service_role";



GRANT ALL ON TABLE "public"."maintenance_plan" TO "anon";
GRANT ALL ON TABLE "public"."maintenance_plan" TO "authenticated";
GRANT ALL ON TABLE "public"."maintenance_plan" TO "service_role";



GRANT ALL ON TABLE "public"."maintenance_visit" TO "anon";
GRANT ALL ON TABLE "public"."maintenance_visit" TO "authenticated";
GRANT ALL ON TABLE "public"."maintenance_visit" TO "service_role";



GRANT ALL ON TABLE "public"."media" TO "anon";
GRANT ALL ON TABLE "public"."media" TO "authenticated";
GRANT ALL ON TABLE "public"."media" TO "service_role";



GRANT ALL ON TABLE "public"."product_bundle" TO "anon";
GRANT ALL ON TABLE "public"."product_bundle" TO "authenticated";
GRANT ALL ON TABLE "public"."product_bundle" TO "service_role";



GRANT ALL ON TABLE "public"."product_filter" TO "anon";
GRANT ALL ON TABLE "public"."product_filter" TO "authenticated";
GRANT ALL ON TABLE "public"."product_filter" TO "service_role";



GRANT ALL ON TABLE "public"."product_warranty" TO "anon";
GRANT ALL ON TABLE "public"."product_warranty" TO "authenticated";
GRANT ALL ON TABLE "public"."product_warranty" TO "service_role";



GRANT ALL ON TABLE "public"."report_allowlist" TO "anon";
GRANT ALL ON TABLE "public"."report_allowlist" TO "authenticated";
GRANT ALL ON TABLE "public"."report_allowlist" TO "service_role";



GRANT ALL ON TABLE "public"."sales_order_items" TO "anon";
GRANT ALL ON TABLE "public"."sales_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_order_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sales_order_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sales_order_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sales_order_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sales_order_lines" TO "anon";
GRANT ALL ON TABLE "public"."sales_order_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_order_lines" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sales_order_lines_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sales_order_lines_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sales_order_lines_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sales_orders" TO "anon";
GRANT ALL ON TABLE "public"."sales_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_orders" TO "service_role";



GRANT ALL ON TABLE "public"."serial_pending" TO "anon";
GRANT ALL ON TABLE "public"."serial_pending" TO "authenticated";
GRANT ALL ON TABLE "public"."serial_pending" TO "service_role";



GRANT ALL ON TABLE "public"."serial_registry" TO "anon";
GRANT ALL ON TABLE "public"."serial_registry" TO "authenticated";
GRANT ALL ON TABLE "public"."serial_registry" TO "service_role";



GRANT ALL ON TABLE "public"."serial_su_dung" TO "anon";
GRANT ALL ON TABLE "public"."serial_su_dung" TO "authenticated";
GRANT ALL ON TABLE "public"."serial_su_dung" TO "service_role";



GRANT ALL ON TABLE "public"."serial_trang_thai" TO "anon";
GRANT ALL ON TABLE "public"."serial_trang_thai" TO "authenticated";
GRANT ALL ON TABLE "public"."serial_trang_thai" TO "service_role";



GRANT ALL ON TABLE "public"."staff" TO "anon";
GRANT ALL ON TABLE "public"."staff" TO "authenticated";
GRANT ALL ON TABLE "public"."staff" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_code" TO "anon";
GRANT ALL ON TABLE "public"."supplier_code" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_code" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_muc" TO "anon";
GRANT ALL ON TABLE "public"."ticket_muc" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_muc" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_note" TO "anon";
GRANT ALL ON TABLE "public"."ticket_note" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_note" TO "service_role";



GRANT ALL ON TABLE "public"."tickets" TO "anon";
GRANT ALL ON TABLE "public"."tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."tickets" TO "service_role";



GRANT ALL ON TABLE "public"."v_bh_cho_kich_hoat" TO "anon";
GRANT ALL ON TABLE "public"."v_bh_cho_kich_hoat" TO "authenticated";
GRANT ALL ON TABLE "public"."v_bh_cho_kich_hoat" TO "service_role";



GRANT ALL ON TABLE "public"."v_machine_filter" TO "anon";
GRANT ALL ON TABLE "public"."v_machine_filter" TO "authenticated";
GRANT ALL ON TABLE "public"."v_machine_filter" TO "service_role";



GRANT ALL ON TABLE "public"."v_core_forecast" TO "anon";
GRANT ALL ON TABLE "public"."v_core_forecast" TO "authenticated";
GRANT ALL ON TABLE "public"."v_core_forecast" TO "service_role";



GRANT ALL ON TABLE "public"."v_customer_360" TO "anon";
GRANT ALL ON TABLE "public"."v_customer_360" TO "authenticated";
GRANT ALL ON TABLE "public"."v_customer_360" TO "service_role";



GRANT ALL ON TABLE "public"."v_doanh_so_cskh" TO "anon";
GRANT ALL ON TABLE "public"."v_doanh_so_cskh" TO "authenticated";
GRANT ALL ON TABLE "public"."v_doanh_so_cskh" TO "service_role";



GRANT ALL ON TABLE "public"."v_installed_base" TO "anon";
GRANT ALL ON TABLE "public"."v_installed_base" TO "authenticated";
GRANT ALL ON TABLE "public"."v_installed_base" TO "service_role";



GRANT ALL ON TABLE "public"."v_ticket_issue" TO "anon";
GRANT ALL ON TABLE "public"."v_ticket_issue" TO "authenticated";
GRANT ALL ON TABLE "public"."v_ticket_issue" TO "service_role";



GRANT ALL ON TABLE "public"."v_issue_report" TO "anon";
GRANT ALL ON TABLE "public"."v_issue_report" TO "authenticated";
GRANT ALL ON TABLE "public"."v_issue_report" TO "service_role";



GRANT ALL ON TABLE "public"."v_maintenance_due" TO "anon";
GRANT ALL ON TABLE "public"."v_maintenance_due" TO "authenticated";
GRANT ALL ON TABLE "public"."v_maintenance_due" TO "service_role";



GRANT ALL ON TABLE "public"."v_may_kho" TO "anon";
GRANT ALL ON TABLE "public"."v_may_kho" TO "authenticated";
GRANT ALL ON TABLE "public"."v_may_kho" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."v_report_base" TO "anon";
GRANT ALL ON TABLE "public"."v_report_base" TO "authenticated";
GRANT ALL ON TABLE "public"."v_report_base" TO "service_role";



GRANT ALL ON TABLE "public"."v_report_cat1" TO "anon";
GRANT ALL ON TABLE "public"."v_report_cat1" TO "authenticated";
GRANT ALL ON TABLE "public"."v_report_cat1" TO "service_role";



GRANT ALL ON TABLE "public"."v_report_channel" TO "anon";
GRANT ALL ON TABLE "public"."v_report_channel" TO "authenticated";
GRANT ALL ON TABLE "public"."v_report_channel" TO "service_role";



GRANT ALL ON TABLE "public"."v_report_day" TO "anon";
GRANT ALL ON TABLE "public"."v_report_day" TO "authenticated";
GRANT ALL ON TABLE "public"."v_report_day" TO "service_role";



GRANT ALL ON TABLE "public"."v_report_day_cat1" TO "anon";
GRANT ALL ON TABLE "public"."v_report_day_cat1" TO "authenticated";
GRANT ALL ON TABLE "public"."v_report_day_cat1" TO "service_role";



GRANT ALL ON TABLE "public"."v_report_day_channel" TO "anon";
GRANT ALL ON TABLE "public"."v_report_day_channel" TO "authenticated";
GRANT ALL ON TABLE "public"."v_report_day_channel" TO "service_role";



GRANT ALL ON TABLE "public"."v_report_day_product" TO "anon";
GRANT ALL ON TABLE "public"."v_report_day_product" TO "authenticated";
GRANT ALL ON TABLE "public"."v_report_day_product" TO "service_role";



GRANT ALL ON TABLE "public"."v_report_day_tab" TO "anon";
GRANT ALL ON TABLE "public"."v_report_day_tab" TO "authenticated";
GRANT ALL ON TABLE "public"."v_report_day_tab" TO "service_role";



GRANT ALL ON TABLE "public"."v_report_month" TO "anon";
GRANT ALL ON TABLE "public"."v_report_month" TO "authenticated";
GRANT ALL ON TABLE "public"."v_report_month" TO "service_role";



GRANT ALL ON TABLE "public"."v_report_product" TO "anon";
GRANT ALL ON TABLE "public"."v_report_product" TO "authenticated";
GRANT ALL ON TABLE "public"."v_report_product" TO "service_role";



GRANT ALL ON TABLE "public"."v_report_tab" TO "anon";
GRANT ALL ON TABLE "public"."v_report_tab" TO "authenticated";
GRANT ALL ON TABLE "public"."v_report_tab" TO "service_role";



GRANT ALL ON TABLE "public"."v_serial_kho" TO "anon";
GRANT ALL ON TABLE "public"."v_serial_kho" TO "authenticated";
GRANT ALL ON TABLE "public"."v_serial_kho" TO "service_role";



GRANT ALL ON TABLE "public"."v_ticket_chua_phan_nhom" TO "anon";
GRANT ALL ON TABLE "public"."v_ticket_chua_phan_nhom" TO "authenticated";
GRANT ALL ON TABLE "public"."v_ticket_chua_phan_nhom" TO "service_role";



GRANT ALL ON TABLE "public"."v_tickets" TO "anon";
GRANT ALL ON TABLE "public"."v_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."v_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."warranty_bak_combo_backfill_20260811" TO "anon";
GRANT ALL ON TABLE "public"."warranty_bak_combo_backfill_20260811" TO "authenticated";
GRANT ALL ON TABLE "public"."warranty_bak_combo_backfill_20260811" TO "service_role";



GRANT ALL ON TABLE "public"."yeu_cau_export" TO "anon";
GRANT ALL ON TABLE "public"."yeu_cau_export" TO "authenticated";
GRANT ALL ON TABLE "public"."yeu_cau_export" TO "service_role";



GRANT ALL ON TABLE "public"."yeu_cau_thay_doi" TO "anon";
GRANT ALL ON TABLE "public"."yeu_cau_thay_doi" TO "authenticated";
GRANT ALL ON TABLE "public"."yeu_cau_thay_doi" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







