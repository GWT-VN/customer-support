-- ============================================================================
-- work_04b_sua_bien_id_trung_ten_cot.sql — bản work_hang_loat ĐANG CHẠY (2026-08-19)
--
-- work_04 khai biến PL/pgSQL tên `id`, trùng tên cột `work.task.id`, nên
-- `where id = any(v_ids)` báo: 42702 column reference "id" is ambiguous.
-- Đổi biến thành `v_id` và đặt alias cho mọi bảng trong UPDATE/DELETE.
-- Bài học: trong plpgsql đừng đặt tên biến trùng tên cột — Postgres không ưu
-- tiên bên nào, nó từ chối chạy.
--
-- File này chứa TOÀN BỘ hàm (không phải bản vá), nên dựng lại từ đầu chỉ cần
-- chạy file này, bỏ qua work_04.
-- ============================================================================

create or replace function public.work_hang_loat(
  p_email      text,
  p_ids        bigint[],
  p_status     text     default null,
  p_gan_ai     uuid     default null,
  p_gan_vai    text     default 'doer',
  p_bo_ai      uuid     default null,
  p_priority   smallint default null,
  p_due        timestamptz default null,
  p_xoa_due    boolean  default false,
  p_team_id    bigint   default null,
  p_xoa_team   boolean  default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid; v_ids bigint[]; v_n int; v_bo_qua int; v_ten text; v_id bigint;
begin
  v_me := work.staff_theo_email(p_email);
  if v_me is null then raise exception 'Nhân sự không hợp lệ'; end if;
  if p_ids is null or array_length(p_ids, 1) is null then
    raise exception 'Chưa chọn việc nào';
  end if;
  if array_length(p_ids, 1) > 200 then
    raise exception 'Một lượt tối đa 200 việc';
  end if;
  if p_status is not null and p_status not in
     ('todo','doing','blocked','review','done','cancelled') then
    raise exception 'Trạng thái không hợp lệ: %', p_status;
  end if;
  if p_gan_ai is not null and p_gan_vai not in ('owner','doer','reviewer','watcher') then
    raise exception 'Vai trò không hợp lệ: %', p_gan_vai;
  end if;

  -- Quyền kiểm cho TỪNG việc, không kiểm một lần rồi áp cho cả mớ.
  select coalesce(array_agg(t.id), '{}') into v_ids
  from work.task t
  where t.id = any(p_ids) and work.co_the_sua(v_me, t.id);

  v_n := coalesce(array_length(v_ids, 1), 0);
  v_bo_qua := array_length(p_ids, 1) - v_n;
  if v_n = 0 then
    return jsonb_build_object('da_sua', 0, 'bo_qua', v_bo_qua);
  end if;

  if p_status is not null then
    update work.task t set
      status = p_status,
      completed_at = case when p_status = 'done' then now() else null end
    where t.id = any(v_ids);
    insert into work.activity(task_id, actor_id, verb, payload)
    select unnest(v_ids), v_me, 'status_changed',
           jsonb_build_object('status', p_status, 'hang_loat', true);
  end if;

  if p_priority is not null or p_due is not null or p_xoa_due
     or p_team_id is not null or p_xoa_team then
    update work.task t set
      priority = case when p_priority is null then t.priority
                      else greatest(1, least(4, p_priority)) end,
      due_at   = case when p_xoa_due then null
                      when p_due is null then t.due_at else p_due end,
      team_id  = case when p_xoa_team then null
                      when p_team_id is null then t.team_id else p_team_id end
    where t.id = any(v_ids);
    insert into work.activity(task_id, actor_id, verb, payload)
    select unnest(v_ids), v_me, 'updated', jsonb_strip_nulls(jsonb_build_object(
      'priority', p_priority, 'due_at', p_due, 'team_id', p_team_id, 'hang_loat', true));
  end if;

  if p_gan_ai is not null then
    select s.ten into v_ten from public.staff s where s.id = p_gan_ai and s.hoat_dong;
    if v_ten is null then raise exception 'Người được gán không hoạt động'; end if;
    insert into work.task_assignee(task_id, staff_id, role, assigned_by)
    select unnest(v_ids), p_gan_ai, p_gan_vai, v_me
    on conflict (task_id, staff_id) do update
      set role = excluded.role, assigned_by = v_me;
    insert into work.activity(task_id, actor_id, verb, payload)
    select unnest(v_ids), v_me, 'assigned',
           jsonb_build_object('staff_id', p_gan_ai, 'ten', v_ten,
                              'role', p_gan_vai, 'hang_loat', true);
  end if;

  if p_bo_ai is not null then
    -- Kiểm TỪNG việc: việc nào bỏ xong mà hết người thì trả lại — không mồ côi.
    foreach v_id in array v_ids loop
      delete from work.task_assignee a where a.task_id = v_id and a.staff_id = p_bo_ai;
      if not exists (select 1 from work.task_assignee a where a.task_id = v_id) then
        insert into work.task_assignee(task_id, staff_id, role, assigned_by)
        values (v_id, p_bo_ai, 'owner', v_me);
      else
        insert into work.activity(task_id, actor_id, verb, payload)
        values (v_id, v_me, 'unassigned',
                jsonb_build_object('staff_id', p_bo_ai, 'hang_loat', true));
      end if;
    end loop;
  end if;

  return jsonb_build_object('da_sua', v_n, 'bo_qua', v_bo_qua);
end $$;

revoke execute on function public.work_hang_loat(text,bigint[],text,uuid,text,uuid,smallint,timestamptz,boolean,bigint,boolean) from public;
grant  execute on function public.work_hang_loat(text,bigint[],text,uuid,text,uuid,smallint,timestamptz,boolean,bigint,boolean) to service_role;

notify pgrst, 'reload schema';
