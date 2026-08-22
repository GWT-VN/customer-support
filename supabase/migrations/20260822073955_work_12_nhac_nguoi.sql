-- ============================================================================
-- work_12_nhac_nguoi.sql — nhắc người trong bình luận bằng @tên (2026-08-22)
--
-- `work.comment.mentions` (uuid[]) dựng sẵn từ work_00, chưa từng có UI lẫn RPC
-- ghi vào. Backlog Việc: "đây là thứ khiến bình luận thành trao đổi thật chứ
-- không phải ghi chú một chiều".
--
-- VẤN ĐỀ THẬT: nhắc ai đó mà họ không biết thì chỉ là tô chữ cho đẹp. Thông báo
-- Discord là GĐ2 nên chưa có đường đẩy. Nên đợt này dùng CƠ CHẾ SẴN CÓ:
-- nhắc ai thì thêm họ vào việc với vai **Theo dõi** (watcher). `work_viec_cua_toi`
-- vốn đã lấy việc theo `task_assignee`, nên người được nhắc thấy việc đó xuất
-- hiện trong danh sách của mình ngay — không phải dựng hộp thư mới mà rồi không
-- ai mở.
--
-- Khoá chính của task_assignee là (task_id, staff_id) nên `on conflict do nothing`
-- vừa chặn trùng vừa KHÔNG hạ cấp: nhắc tên người đang là Phụ trách thì họ vẫn là
-- Phụ trách, không bị đổi thành Theo dõi.
--
-- Vẫn ghi `work.notification` (kind='mention', chưa gửi) để GĐ2 nối Discord là có
-- sẵn dữ liệu, không phải đi dựng lại lịch sử.
-- ============================================================================

-- Bỏ bản 3 tham số — giao diện gọi bằng tham số CÓ TÊN nên sau khi bỏ nó rơi
-- đúng vào bản 4 tham số với p_mentions mặc định null. Giữ cả hai là Postgres
-- báo "function is not unique".
drop function if exists public.work_them_binh_luan(text,bigint,text);
create or replace function public.work_them_binh_luan(
  p_email text, p_task_id bigint, p_body text, p_mentions uuid[] default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_me uuid; v_body text; v_nhac uuid[]; v_ten text[];
begin
  v_me := work.staff_theo_email(p_email);
  if v_me is null then raise exception 'Nhân sự không hợp lệ'; end if;
  if not exists (select 1 from work.visible_task_ids(v_me) where task_id = p_task_id) then
    raise exception 'Không có quyền xem việc này';
  end if;
  v_body := btrim(coalesce(p_body,''));
  if v_body = '' then raise exception 'Bình luận trống'; end if;

  -- Lọc lại danh sách nhắc ở SERVER: client gửi gì cũng phải là nhân sự đang hoạt
  -- động thật. Bỏ trùng, và bỏ chính mình — tự nhắc mình là vô nghĩa.
  select array_agg(distinct s.id), array_agg(distinct s.ten)
    into v_nhac, v_ten
  from public.staff s
  where s.id = any(coalesce(p_mentions, '{}'::uuid[]))
    and s.hoat_dong and s.id <> v_me;

  insert into work.comment(task_id, author_id, body, mentions)
  values (p_task_id, v_me, v_body, coalesce(v_nhac, '{}'::uuid[]));

  insert into work.activity(task_id, actor_id, verb, payload)
  values (p_task_id, v_me, 'commented',
          jsonb_build_object('len', length(v_body),
                             'nhac', coalesce(array_length(v_nhac,1), 0)));

  if v_nhac is null or array_length(v_nhac,1) is null then return; end if;

  -- Kéo người được nhắc vào việc để họ thấy nó trong "Việc của tôi".
  insert into work.task_assignee(task_id, staff_id, role, assigned_by)
  select p_task_id, x, 'watcher', v_me from unnest(v_nhac) x
  on conflict (task_id, staff_id) do nothing;

  -- Dữ liệu cho GĐ2 (Discord). sent_at để trống = chưa gửi.
  insert into work.notification(staff_id, task_id, channel, kind, payload)
  select x, p_task_id, 'discord', 'mention',
         jsonb_build_object('boi', v_me, 'trich', left(v_body, 140))
  from unnest(v_nhac) x;

  insert into work.activity(task_id, actor_id, verb, payload)
  values (p_task_id, v_me, 'mentioned',
          jsonb_build_object('ten', to_jsonb(v_ten)));
end $$;

revoke execute on function public.work_them_binh_luan(text,bigint,text,uuid[]) from public;
grant  execute on function public.work_them_binh_luan(text,bigint,text,uuid[]) to service_role;

-- ── Chi tiết việc trả kèm tên người được nhắc ──────────────────────────────
-- Trả TÊN chứ không chỉ id: giao diện tô đậm theo tên xuất hiện trong câu, và
-- tô theo dấu @ thì email hay giá "@50k" cũng sáng lên như người thật.
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
    'links', work.link_json(p_task_id),
    'comments', (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', c.id, 'body', c.body, 'ten', s.ten, 'created_at', c.created_at,
                   'nhac_ten', (select coalesce(jsonb_agg(s2.ten), '[]'::jsonb)
                                from public.staff s2 where s2.id = any(c.mentions)))
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

notify pgrst, 'reload schema';
