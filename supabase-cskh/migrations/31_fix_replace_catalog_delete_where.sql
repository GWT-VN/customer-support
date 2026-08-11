-- 31_fix_replace_catalog_delete_where.sql
-- Sửa lỗi đồng bộ catalog: replace_catalog_table chạy `delete from %I` KHÔNG có WHERE
-- -> bị chặn "DELETE requires a WHERE clause" (guard safe-delete). Thêm `where true`
-- (vẫn xoá toàn bảng để nạp lại từ Masterdata, nhưng thoả guard).

create or replace function public.replace_catalog_table(p_table text, p_rows jsonb)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
end $function$;
