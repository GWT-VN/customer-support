-- ============================================================================
-- work_11_keo_tha_kanban.sql — kéo thả trên bảng kanban (2026-08-22)
--
-- Lỗi CEO báo 20/08 (backlog Việc #17): bảng kanban mới chỉ để XEM; muốn đổi
-- trạng thái vẫn phải mở ô select hoặc chọn hàng loạt. Kéo thẻ sang cột khác là
-- thao tác tự nhiên nhất của kanban, thiếu nó thì cái bảng chỉ là hình trang trí.
--
-- MỘT RPC cho cả hai thứ (trạng thái + vị trí) thay vì hai lệnh gọi: kéo một
-- phát mà nửa đường gãy thì thẻ nằm sai cột với thứ tự của cột cũ, người dùng
-- không hiểu vì sao.
--
-- `sort_order` là `double precision` nên chèn bằng trung điểm — xem thuTuMoi()
-- trong lib/work.ts. Không đánh số lại cả cột: đó là hàng chục lượt ghi cho một
-- thao tác kéo, và hai người kéo cùng lúc là đè nhau.
--
-- Quyền: dùng work.co_the_sua, ĐÚNG BẰNG rào của work_doi_trang_thai (người tạo
-- hoặc người được giao). Kéo thả mà lỏng hơn ô select là mở cửa sau.
-- ============================================================================

create or replace function public.work_keo_tha(
  p_email text, p_task_id bigint, p_status text, p_sort_order double precision)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_me uuid; v_cu text;
begin
  if p_status not in ('todo','doing','blocked','review','done','cancelled') then
    raise exception 'Trạng thái không hợp lệ: %', p_status;
  end if;
  v_me := work.staff_theo_email(p_email);
  if v_me is null then raise exception 'Nhân sự không hợp lệ'; end if;
  if not work.co_the_sua(v_me, p_task_id) then
    raise exception 'Không có quyền với việc này';
  end if;

  select status into v_cu from work.task where id = p_task_id;
  if v_cu is null then raise exception 'Không có việc này'; end if;

  update work.task
     set status       = p_status,
         sort_order   = p_sort_order,
         completed_at = case when p_status = 'done' then now() else null end
   where id = p_task_id;

  -- CHỈ ghi nhật ký khi trạng thái thật sự đổi. Kéo đổi chỗ trong cùng một cột
  -- là chuyện sắp xếp cá nhân; ghi lại thì nhật ký ngập và che mất việc thật.
  if v_cu is distinct from p_status then
    insert into work.activity(task_id, actor_id, verb, payload)
    values (p_task_id, v_me, 'status_changed',
            jsonb_build_object('status', p_status, 'keo_tha', true));
  end if;
end $$;

revoke execute on function public.work_keo_tha(text,bigint,text,double precision) from public;
grant  execute on function public.work_keo_tha(text,bigint,text,double precision) to service_role;

-- ── Bảng team trả thêm sort_order ──────────────────────────────────────────
-- Chỉ THÊM một cột; ORDER BY giữ nguyên vì chế độ Danh sách đang dựa vào nó.
-- Kanban tự sắp theo sort_order ở phía giao diện.
create or replace function public.work_bang_team(
  p_email text, p_team_id bigint default null, p_assignee uuid default null,
  p_status text default null, p_q text default null)
returns jsonb
language sql stable security definer set search_path = '' as $$
  with me as (select work.staff_theo_email(p_email) as id)
  select coalesce(jsonb_agg(to_jsonb(v) order by v.priority, v.due_at nulls last, v.id), '[]'::jsonb)
  from (
    select t.id, t.ref, t.title, t.status, t.priority, t.due_at, t.team_id,
           t.sort_order,
           tm.name as team_name, tm.color as team_color,
           s.ten as creator_ten,
           (select count(*) from work.task c
             where c.parent_id = t.id and c.status <> 'cancelled') as sub_n,
           work.assignees_json(t.id) as assignees,
           work.link_json(t.id) as links
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

notify pgrst, 'reload schema';
