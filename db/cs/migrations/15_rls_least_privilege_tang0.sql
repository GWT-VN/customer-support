-- ══════════════════════════════════════════════════════════════════════════
-- 15 — RLS least-privilege TẦNG 0 (#1): nền phòng thủ ở tầng DB
-- Thêm policy cho vai `authenticated` (= JWT nhân viên đã đăng nhập) trên các
-- bảng CSKH. App HIỆN vẫn dùng service_role (bỏ qua RLS) nên KHÔNG đổi hành vi —
-- đây là bổ sung thuần, revert được. Tầng 1 (chuyển app sang authClient) làm sau.
--
-- Chỉ nhân viên đang hoạt động (staff.hoat_dong) mới qua được policy. Non-staff
-- có JWT hợp lệ vẫn ra 0 dòng. is_staff/is_admin là SECURITY DEFINER nên tự đọc
-- bảng staff không bị chính policy của nó chặn (không đệ quy).
-- ══════════════════════════════════════════════════════════════════════════

create or replace function public.is_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff s
    where lower(s.email) = lower(nullif(auth.jwt() ->> 'email', '')) and s.hoat_dong
  );
$$;

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff s
    where lower(s.email) = lower(nullif(auth.jwt() ->> 'email', ''))
      and s.hoat_dong and s.vai_tro = 'admin'
  );
$$;

revoke all on function public.is_staff() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- Policy: nhân viên đang hoạt động toàn quyền trên bảng CSKH (mirror hành vi app).
-- Phân biệt admin theo từng thao tác để dành cho Tầng 1 (giờ giữ đơn giản = is_staff).
do $$
declare t text;
begin
  foreach t in array array[
    'cs_customers','customer_contacts','installed_base','warranty','filter_replacement',
    'tickets','ticket_note','ticket_muc','issue_group','issue_override',
    'maintenance_plan','maintenance_visit','serial_registry','serial_pending',
    'cs_staff','staff','catalog_sync_log'
  ] loop
    execute format('drop policy if exists staff_all on public.%I', t);
    execute format(
      'create policy staff_all on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end $$;
