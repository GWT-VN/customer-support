-- ══════════════════════════════════════════════════════════════════════════
-- 16 — Khoá quyền gọi RPC nhạy cảm (nút thắt "RPC cần khoá quyền gọi")
-- 4 hàm SECURITY DEFINER trước đây EXECUTE cho PUBLIC → anon/authenticated gọi
-- được qua PostgREST. Nguy hiểm: bất kỳ ai có anon key có thể duyệt serial bừa,
-- sửa bảo hành, hoặc replace_catalog_table ghi đè nguyên bảng catalog.
-- → Thu hồi khỏi public/anon/authenticated; chỉ service_role (app) gọi được.
-- (is_staff/is_admin GIỮ execute cho authenticated vì RLS policy cần đánh giá.)
-- ══════════════════════════════════════════════════════════════════════════

do $$
declare f text;
begin
  foreach f in array array[
    'duyet_serial_pending(uuid, text)',
    'activate_warranty(text, date)',
    'sync_catalog()',
    'replace_catalog_table(text, jsonb)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('revoke all on function public.%s from anon', f);
    execute format('revoke all on function public.%s from authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
