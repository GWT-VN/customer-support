-- ============================================================================
-- work_01_rpc_gd0.sql — RPC public bọc schema work cho GĐ0
-- Ngày: 2026-08-19 · Đã apply production.
--
-- VÌ SAO: app CS đọc Supabase qua PostgREST — chỉ phục vụ schema ĐƯỢC EXPOSE
--   (mặc định public). Thay vì đổi cấu hình API production để expose `work`,
--   ta bọc bằng RPC trong `public` (SECURITY DEFINER) — giống pattern cross-module
--   sẵn có của CS (activate_and_seed). App gọi dataClient().rpc('work_*').
-- BẢO MẬT: search_path='' + REVOKE khỏi public → chỉ service_role (app server,
--   sau requireNhanSu()) gọi được. Bảng work vẫn khoá (RLS bật, chưa expose).
-- ============================================================================

create or replace function public.work_viec_cua_toi(p_email text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
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

create or replace function public.work_tao_viec(
  p_email text, p_title text, p_priority smallint default 3,
  p_due timestamptz default null, p_team_id bigint default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
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

create or replace function public.work_doi_trang_thai(p_email text, p_task_id bigint, p_status text)
returns void
language plpgsql security definer set search_path = ''
as $$
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

revoke execute on function public.work_viec_cua_toi(text) from public;
revoke execute on function public.work_tao_viec(text,text,smallint,timestamptz,bigint) from public;
revoke execute on function public.work_doi_trang_thai(text,bigint,text) from public;
grant execute on function public.work_viec_cua_toi(text) to service_role;
grant execute on function public.work_tao_viec(text,text,smallint,timestamptz,bigint) to service_role;
grant execute on function public.work_doi_trang_thai(text,bigint,text) to service_role;
