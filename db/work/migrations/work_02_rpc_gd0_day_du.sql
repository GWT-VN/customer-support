-- ============================================================================
-- work_02_rpc_gd0_day_du.sql — RPC còn lại để đóng GĐ0
-- Ngày: 2026-08-19
--
-- work_01 mới đủ cho "Việc của tôi" dạng danh sách phẳng. File này bổ sung phần
-- còn thiếu theo spec GĐ0: gán người (RACI), sửa việc, Bảng team, panel chi tiết,
-- bình luận, nhật ký.
--
-- NGUYÊN TẮC (giữ nguyên từ work_01):
--   • RPC nằm ở schema `public` vì PostgREST chỉ phục vụ schema được expose.
--   • security definer + search_path='' + revoke public / grant service_role
--     → chỉ app server (sau requireNhanSu()) gọi được.
--   • QUYỀN XEM: luôn qua work.visible_task_ids() — MỘT định nghĩa duy nhất.
--   • QUYỀN SỬA: luôn qua work.co_the_sua() — MỘT định nghĩa duy nhất.
-- ============================================================================

-- ── Sửa khoá chính task_assignee: 1 người = 1 vai trò trên 1 việc ───────────
-- work_00 đặt PK (task_id, staff_id, role) ⇒ cùng một người có thể vừa 'owner'
-- vừa 'watcher' trên một việc — không phải ý đồ RACI và khiến UI phải xử lý
-- danh sách trùng người. Bảng do Work sở hữu, chưa module nào khác đọc.
do $$
begin
  if exists (
    select 1 from pg_constraint c
    join pg_class r on r.oid = c.conrelid
    join pg_namespace n on n.oid = r.relnamespace
    where n.nspname='work' and r.relname='task_assignee' and c.conname='task_assignee_pkey'
      and array_length(c.conkey, 1) = 3
  ) then
    -- Còn nhiều vai trò cho cùng 1 người: giữ vai trò "nặng" nhất.
    delete from work.task_assignee a using work.task_assignee b
     where a.task_id = b.task_id and a.staff_id = b.staff_id
       and (case a.role when 'owner' then 0 when 'doer' then 1
                        when 'reviewer' then 2 else 3 end)
         > (case b.role when 'owner' then 0 when 'doer' then 1
                        when 'reviewer' then 2 else 3 end);
    alter table work.task_assignee drop constraint task_assignee_pkey;
    alter table work.task_assignee add primary key (task_id, staff_id);
  end if;
end $$;

-- ── Helper: 1 chỗ đổi email → staff, 1 chỗ định nghĩa quyền sửa ──────────────
create or replace function work.staff_theo_email(p_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.staff
  where email = lower(btrim(p_email)) and hoat_dong limit 1
$$;

create or replace function work.co_the_sua(p_staff uuid, p_task bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from work.task t
    where t.id = p_task
      and ( t.creator_id = p_staff
            or exists (select 1 from work.task_assignee a
                        where a.task_id = t.id and a.staff_id = p_staff) )
  )
$$;

-- Assignee của 1 task dưới dạng jsonb — dùng lại ở nhiều RPC
create or replace function work.assignees_json(p_task bigint) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'staff_id', a.staff_id, 'ten', s.ten, 'email', s.email, 'role', a.role
         ) order by case a.role when 'owner' then 0 when 'doer' then 1
                                when 'reviewer' then 2 else 3 end, s.ten), '[]'::jsonb)
  from work.task_assignee a join public.staff s on s.id = a.staff_id
  where a.task_id = p_task
$$;

-- ── Nền tảng cho form: tôi là ai, có những team/nhân sự/project nào ──────────
create or replace function public.work_nen_tang(p_email text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'me', (select jsonb_build_object('id', s.id, 'ten', s.ten, 'email', s.email,
                                     'vai_tro', to_jsonb(s.vai_tro))
             from public.staff s where s.id = work.staff_theo_email(p_email)),
    'teams', (select coalesce(jsonb_agg(jsonb_build_object(
                       'id', t.id, 'key', t.key, 'name', t.name, 'color', t.color)
                       order by t.sort_order, t.id), '[]'::jsonb) from work.team t),
    'nhan_su', (select coalesce(jsonb_agg(jsonb_build_object(
                       'id', s.id, 'ten', s.ten, 'email', s.email)
                       order by s.ten), '[]'::jsonb)
                  from public.staff s where s.hoat_dong),
    'projects', (select coalesce(jsonb_agg(jsonb_build_object(
                       'id', p.id, 'name', p.name, 'team_id', p.team_id)
                       order by p.name), '[]'::jsonb)
                  from work.project p where p.status <> 'archived')
  )
$$;

-- ── Việc của tôi (thay bản work_01: thêm mô tả, giờ bắt đầu, người cùng làm) ──
create or replace function public.work_viec_cua_toi(p_email text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with me as (select work.staff_theo_email(p_email) as id)
  select coalesce(jsonb_agg(to_jsonb(v) order by v.priority, v.due_at nulls last, v.id), '[]'::jsonb)
  from (
    select t.id, t.ref, t.title, t.description, t.status, t.priority,
           t.start_at, t.due_at, t.team_id,
           tm.name as team_name, tm.color as team_color,
           (select a.role from work.task_assignee a, me
             where a.task_id = t.id and a.staff_id = me.id limit 1) as my_role,
           (select count(*) from work.task c
             where c.parent_id = t.id and c.status <> 'cancelled') as sub_n,
           work.assignees_json(t.id) as assignees
    from work.task t
    join me on true
    left join work.team tm on tm.id = t.team_id
    where t.duplicate_of is null
      and t.status not in ('done','cancelled')
      and ( t.creator_id = me.id
            or exists (select 1 from work.task_assignee a
                        where a.task_id = t.id and a.staff_id = me.id) )
  ) v
$$;

-- ── Bảng team: mọi việc tôi ĐƯỢC XEM, lọc theo team / người / trạng thái ─────
create or replace function public.work_bang_team(
  p_email text, p_team_id bigint default null, p_assignee uuid default null,
  p_status text default null, p_q text default null
) returns jsonb
language sql stable security definer set search_path = '' as $$
  with me as (select work.staff_theo_email(p_email) as id)
  select coalesce(jsonb_agg(to_jsonb(v) order by v.priority, v.due_at nulls last, v.id), '[]'::jsonb)
  from (
    select t.id, t.ref, t.title, t.status, t.priority, t.due_at, t.team_id,
           tm.name as team_name, tm.color as team_color,
           s.ten as creator_ten,
           (select count(*) from work.task c
             where c.parent_id = t.id and c.status <> 'cancelled') as sub_n,
           work.assignees_json(t.id) as assignees
    from work.task t
    join me on true
    left join work.team tm on tm.id = t.team_id
    left join public.staff s on s.id = t.creator_id
    where t.id in (select task_id from work.visible_task_ids(me.id))
      and t.status <> 'cancelled'
      and (p_team_id  is null or t.team_id = p_team_id)
      and (p_status   is null or t.status  = p_status)
      and (p_assignee is null or exists (select 1 from work.task_assignee a
                                          where a.task_id = t.id and a.staff_id = p_assignee))
      and (coalesce(btrim(p_q),'') = ''
           or t.title ilike '%'||btrim(p_q)||'%' or t.ref ilike '%'||btrim(p_q)||'%')
  ) v
$$;

-- ── Chi tiết 1 việc: task + người + bình luận + nhật ký + việc con ───────────
create or replace function public.work_chi_tiet_viec(p_email text, p_task_id bigint)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid; v_out jsonb;
begin
  v_me := work.staff_theo_email(p_email);
  if v_me is null then raise exception 'Nhân sự không hợp lệ'; end if;
  if not exists (select 1 from work.visible_task_ids(v_me) where task_id = p_task_id) then
    raise exception 'Không có quyền xem việc này';
  end if;

  select jsonb_build_object(
    'task', (select to_jsonb(x) from (
        select t.id, t.ref, t.title, t.description, t.status, t.priority, t.visibility,
               t.start_at, t.due_at, t.completed_at, t.team_id, t.parent_id, t.origin,
               tm.name as team_name, tm.color as team_color,
               s.ten as creator_ten, t.created_at
        from work.task t
        left join work.team tm on tm.id = t.team_id
        left join public.staff s on s.id = t.creator_id
        where t.id = p_task_id) x),
    'assignees', work.assignees_json(p_task_id),
    'co_the_sua', work.co_the_sua(v_me, p_task_id),
    'comments', (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', c.id, 'body', c.body, 'ten', s.ten, 'created_at', c.created_at)
                   order by c.created_at), '[]'::jsonb)
                 from work.comment c left join public.staff s on s.id = c.author_id
                 where c.task_id = p_task_id),
    'activity', (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', a.id, 'verb', a.verb, 'payload', a.payload,
                   'ten', s.ten, 'created_at', a.created_at)
                   order by a.created_at desc), '[]'::jsonb)
                 from work.activity a left join public.staff s on s.id = a.actor_id
                 where a.task_id = p_task_id),
    'subtasks', (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', c.id, 'ref', c.ref, 'title', c.title, 'status', c.status)
                   order by c.id), '[]'::jsonb)
                 from work.task c where c.parent_id = p_task_id and c.status <> 'cancelled')
  ) into v_out;
  return v_out;
end $$;

-- ── Tạo việc (thay bản work_01: thêm mô tả, giờ bắt đầu, việc cha, gán người) ─
-- Tham số cũ giữ NGUYÊN TÊN + THỨ TỰ nên app bản cũ gọi 5 tham số vẫn chạy.
drop function if exists public.work_tao_viec(text, text, smallint, timestamptz, bigint);

create function public.work_tao_viec(
  p_email text, p_title text, p_priority smallint default 3,
  p_due timestamptz default null, p_team_id bigint default null,
  p_description text default null, p_start timestamptz default null,
  p_parent_id bigint default null, p_assignees jsonb default null,
  p_visibility text default 'team'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_me uuid; v_id bigint; v_ref text; v_n int := 0; r jsonb;
begin
  v_me := work.staff_theo_email(p_email);
  if v_me is null then raise exception 'Không tìm thấy nhân sự đang hoạt động: %', p_email; end if;
  if coalesce(btrim(p_title),'') = '' then raise exception 'Tiêu đề trống'; end if;
  if p_visibility not in ('private','team','company') then
    raise exception 'Phạm vi xem không hợp lệ: %', p_visibility;
  end if;
  if p_parent_id is not null and not exists (
       select 1 from work.visible_task_ids(v_me) where task_id = p_parent_id) then
    raise exception 'Không có quyền gắn vào việc cha này';
  end if;

  insert into work.task(title, description, priority, start_at, due_at, team_id,
                        parent_id, visibility, creator_id, origin)
  values (btrim(p_title), nullif(btrim(coalesce(p_description,'')),''),
          greatest(1, least(4, coalesce(p_priority,3))), p_start, p_due, p_team_id,
          p_parent_id, p_visibility, v_me, 'manual')
  returning id, ref into v_id, v_ref;

  -- Gán người theo danh sách [{staff_id, role}]; bỏ qua người không hoạt động.
  if p_assignees is not null then
    for r in select * from jsonb_array_elements(p_assignees) loop
      if exists (select 1 from public.staff
                  where id = (r->>'staff_id')::uuid and hoat_dong) then
        insert into work.task_assignee(task_id, staff_id, role, assigned_by)
        values (v_id, (r->>'staff_id')::uuid,
                coalesce(nullif(r->>'role',''), 'doer'), v_me)
        on conflict (task_id, staff_id) do update set role = excluded.role;
        v_n := v_n + 1;
      end if;
    end loop;
  end if;

  -- Không gán ai → người tạo là chủ việc (không để việc mồ côi).
  if v_n = 0 then
    insert into work.task_assignee(task_id, staff_id, role, assigned_by)
    values (v_id, v_me, 'owner', v_me)
    on conflict (task_id, staff_id) do nothing;
  end if;

  insert into work.activity(task_id, actor_id, verb, payload)
  values (v_id, v_me, 'created', jsonb_build_object('title', btrim(p_title)));

  return jsonb_build_object('id', v_id, 'ref', v_ref);
end $$;

-- ── Sửa việc ────────────────────────────────────────────────────────────────
create or replace function public.work_sua_viec(
  p_email text, p_task_id bigint,
  p_title text default null, p_description text default null,
  p_priority smallint default null, p_due timestamptz default null,
  p_team_id bigint default null, p_visibility text default null,
  p_xoa_due boolean default false, p_xoa_team boolean default false
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_me uuid;
begin
  v_me := work.staff_theo_email(p_email);
  if v_me is null then raise exception 'Nhân sự không hợp lệ'; end if;
  if not work.co_the_sua(v_me, p_task_id) then raise exception 'Không có quyền sửa việc này'; end if;
  if p_title is not null and btrim(p_title) = '' then raise exception 'Tiêu đề trống'; end if;
  if p_visibility is not null and p_visibility not in ('private','team','company') then
    raise exception 'Phạm vi xem không hợp lệ: %', p_visibility;
  end if;

  update work.task set
    title       = coalesce(nullif(btrim(coalesce(p_title,'')),''), title),
    description = case when p_description is null then description
                       else nullif(btrim(p_description),'') end,
    priority    = case when p_priority is null then priority
                       else greatest(1, least(4, p_priority)) end,
    due_at      = case when p_xoa_due then null
                       when p_due is null then due_at else p_due end,
    team_id     = case when p_xoa_team then null
                       when p_team_id is null then team_id else p_team_id end,
    visibility  = coalesce(p_visibility, visibility)
  where id = p_task_id;

  insert into work.activity(task_id, actor_id, verb, payload)
  values (p_task_id, v_me, 'updated', jsonb_strip_nulls(jsonb_build_object(
    'title', p_title, 'priority', p_priority, 'due_at', p_due,
    'team_id', p_team_id, 'visibility', p_visibility)));
end $$;

-- ── Gán / bỏ người ──────────────────────────────────────────────────────────
create or replace function public.work_gan_nguoi(
  p_email text, p_task_id bigint, p_staff_id uuid, p_role text default 'doer'
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_me uuid; v_ten text;
begin
  if p_role not in ('owner','doer','reviewer','watcher') then
    raise exception 'Vai trò không hợp lệ: %', p_role;
  end if;
  v_me := work.staff_theo_email(p_email);
  if v_me is null then raise exception 'Nhân sự không hợp lệ'; end if;
  if not work.co_the_sua(v_me, p_task_id) then raise exception 'Không có quyền sửa việc này'; end if;
  select ten into v_ten from public.staff where id = p_staff_id and hoat_dong;
  if v_ten is null then raise exception 'Người được gán không hoạt động'; end if;

  insert into work.task_assignee(task_id, staff_id, role, assigned_by)
  values (p_task_id, p_staff_id, p_role, v_me)
  on conflict (task_id, staff_id) do update set role = excluded.role, assigned_by = v_me;

  insert into work.activity(task_id, actor_id, verb, payload)
  values (p_task_id, v_me, 'assigned',
          jsonb_build_object('staff_id', p_staff_id, 'ten', v_ten, 'role', p_role));
end $$;

create or replace function public.work_bo_nguoi(p_email text, p_task_id bigint, p_staff_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_me uuid; v_con int;
begin
  v_me := work.staff_theo_email(p_email);
  if v_me is null then raise exception 'Nhân sự không hợp lệ'; end if;
  if not work.co_the_sua(v_me, p_task_id) then raise exception 'Không có quyền sửa việc này'; end if;

  delete from work.task_assignee where task_id = p_task_id and staff_id = p_staff_id;
  select count(*) into v_con from work.task_assignee where task_id = p_task_id;
  if v_con = 0 then raise exception 'Việc phải còn ít nhất 1 người phụ trách'; end if;

  insert into work.activity(task_id, actor_id, verb, payload)
  values (p_task_id, v_me, 'unassigned', jsonb_build_object('staff_id', p_staff_id));
end $$;

-- ── Bình luận ───────────────────────────────────────────────────────────────
create or replace function public.work_them_binh_luan(p_email text, p_task_id bigint, p_body text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_me uuid;
begin
  v_me := work.staff_theo_email(p_email);
  if v_me is null then raise exception 'Nhân sự không hợp lệ'; end if;
  if not exists (select 1 from work.visible_task_ids(v_me) where task_id = p_task_id) then
    raise exception 'Không có quyền xem việc này';
  end if;
  if coalesce(btrim(p_body),'') = '' then raise exception 'Bình luận trống'; end if;

  insert into work.comment(task_id, author_id, body) values (p_task_id, v_me, btrim(p_body));
  insert into work.activity(task_id, actor_id, verb, payload)
  values (p_task_id, v_me, 'commented', jsonb_build_object('len', length(btrim(p_body))));
end $$;

-- ── Quyền gọi: chỉ service_role (app server sau requireNhanSu) ───────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.work_nen_tang(text)',
    'public.work_viec_cua_toi(text)',
    'public.work_bang_team(text,bigint,uuid,text,text)',
    'public.work_chi_tiet_viec(text,bigint)',
    'public.work_tao_viec(text,text,smallint,timestamptz,bigint,text,timestamptz,bigint,jsonb,text)',
    'public.work_sua_viec(text,bigint,text,text,smallint,timestamptz,bigint,text,boolean,boolean)',
    'public.work_gan_nguoi(text,bigint,uuid,text)',
    'public.work_bo_nguoi(text,bigint,uuid)',
    'public.work_them_binh_luan(text,bigint,text)'
  ] loop
    execute format('revoke execute on function %s from public;', f);
    execute format('grant execute on function %s to service_role;', f);
  end loop;
end $$;
