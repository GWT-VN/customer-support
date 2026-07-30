-- ══════════════════════════════════════════════════════════════════════════
-- 13 — Đồng bộ TỰ ĐỘNG 6 bảng gương catalog từ GWT-Masterdata (#2)
-- Thay việc chạy tay: pg_cron gọi sync_catalog() định kỳ, dùng http fetch REST
-- của Masterdata (anon key lấy từ Vault), refresh NGUYÊN TỬ từng bảng + ghi log.
-- An toàn: KHÔNG bao giờ xoá mirror nếu nguồn lỗi/rỗng (empty-guard).
-- ══════════════════════════════════════════════════════════════════════════

create extension if not exists http    with schema extensions;
create extension if not exists pg_cron;

-- ── Nhật ký mỗi lần chạy ───────────────────────────────────────────────────
create table if not exists public.catalog_sync_log (
  id        bigint generated always as identity primary key,
  chay_luc  timestamptz not null default now(),
  ok        boolean     not null,
  chi_tiet  jsonb,               -- {table: số_dòng | {error|skipped}}
  thong_bao text,
  ms        integer
);
alter table public.catalog_sync_log enable row level security;  -- 0 policy → chỉ service_role

-- ── Refresh nguyên tử 1 bảng (DELETE + INSERT trong 1 transaction) ─────────
-- Dùng jsonb_populate_recordset: map key JSON -> đúng tên cột (kể cả cột tiếng Việt).
create or replace function public.replace_catalog_table(p_table text, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  if p_table not in ('catalog_item','catalog_category','supplier_code',
                     'product_bundle','product_filter','product_warranty') then
    raise exception 'Bảng không được phép: %', p_table;
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'p_rows rỗng — từ chối xoá %', p_table;   -- empty-guard
  end if;
  execute format('delete from public.%I', p_table);
  execute format(
    'insert into public.%I select * from jsonb_populate_recordset(null::public.%I, $1)',
    p_table, p_table) using p_rows;
  execute format('select count(*) from public.%I', p_table) into v_n;
  return v_n;
end $$;

-- ── Đồng bộ toàn bộ 6 bảng ─────────────────────────────────────────────────
create or replace function public.sync_catalog()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
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
    raise exception 'Vault secret masterdata_anon_key chưa tồn tại';
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
        v_msg := v_msg || format('%s: nguồn rỗng (giữ nguyên mirror); ', v_t);
        v_result := v_result || jsonb_build_object(v_t, jsonb_build_object('skipped', 'empty'));
        continue;   -- KHÔNG replace bằng rỗng
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

-- ── Lịch chạy: HÀNG NGÀY 02:00 giờ VN (= 19:00 UTC) ───────────────────────
-- (đã áp trên GWT-SalesTracking; app còn có nút bấm sync thủ công — Server Action syncCatalogNow)
select cron.schedule('catalog-sync-daily', '0 19 * * *', $$select public.sync_catalog()$$);
