-- ============================================================================
-- work_00b_harden_function_search_path.sql
-- Ngày: 2026-08-18 · Hardening theo Supabase advisor (lint 0011 function_search_path_mutable)
-- Pin search_path='' cho 3 hàm của schema work (mọi tham chiếu đã fully-qualified),
-- chặn search_path hijacking — quan trọng vì work.me()/visible_task_ids() phân giải
-- danh tính & quyền xem. Đã apply production 2026-08-18.
-- ============================================================================

create or replace function work.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin new.updated_at = now(); return new; end $$;

create or replace function work.me() returns uuid
language sql stable
set search_path = ''
as $$
  select s.id from public.staff s
  where s.email = nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'email','')
    and s.hoat_dong
  limit 1
$$;

create or replace function work.visible_task_ids(p_staff uuid)
returns table(task_id bigint)
language sql stable
set search_path = ''
as $$
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
