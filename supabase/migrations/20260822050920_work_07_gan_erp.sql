-- ============================================================================
-- work_07_gan_erp.sql — gắn việc vào khách / ticket / đơn (2026-08-21)
--
-- `work.task_link` dựng sẵn từ work_00 nhưng chưa từng có dòng nào và chưa có
-- RPC nào đụng tới. Đây là thứ khiến khu Việc khác một app to-do: bấm từ việc
-- sang thẳng hồ sơ khách / ticket / đơn.
--
-- Đợt này CHỈ ba loại: khách, ticket, đơn. Máy (serial) và kế hoạch bảo trì để
-- đợt sau — cột đã có sẵn, không phải sửa bảng nữa.
--
-- SOFT REF, cố ý: task_link giữ MÃ chứ không FK cứng. Khách bị gộp/xoá thì chip
-- vẫn còn để không mất dấu vết, chỉ là bấm không đi đâu (giao diện tự xử).
-- ============================================================================

-- ── 1. Mở rộng link_type ───────────────────────────────────────────────────
-- Bộ cũ ('sales_quote','cs_install',…) mô tả HOÀN CẢNH liên kết, nhưng thứ giao
-- diện cần là ĐỐI TƯỢNG được gắn. Thêm 3 giá trị đối tượng, GIỮ NGUYÊN bộ cũ
-- cho các loại sẽ làm sau. Bảng đang rỗng nên đổi ràng buộc không ảnh hưởng ai.
alter table work.task_link drop constraint if exists task_link_link_type_check;
alter table work.task_link add constraint task_link_link_type_check
  check (link_type in ('khach','ticket','don',
                       'sales_quote','sales_contract','sales_visit',
                       'cs_install','cs_ticket','cs_maintenance','internal'));

-- Khách CSKH phần lớn KHÔNG có customer_code: theo SYSTEM.md §4 mã đó là "mã CÓ
-- ĐƠN", đo trên local chỉ 124/427 khách có. Nếu chỉ gắn được theo mã thì 303
-- khách còn lại vĩnh viễn không gắn được, và việc tự sinh từ serial mất chip.
-- Nên thêm cột id: khách nào có mã thì giữ mã (dùng chung được với Sales), khách
-- chưa có mã thì bám id.
alter table work.task_link add column if not exists customer_id uuid;
comment on column work.task_link.customer_id is
  'Khách CSKH chưa có customer_code thì bám id. Có mã thì customer_code là chính.';

-- Gắn hai lần cùng một thứ vào cùng một việc là vô nghĩa — chặn ở DB, đừng tin
-- giao diện: hai tab mở song song bấm cùng lúc là lọt.
create unique index if not exists ux_link_task_khach
  on work.task_link(task_id, customer_code) where customer_code is not null;
create unique index if not exists ux_link_task_ticket
  on work.task_link(task_id, ticket_code)   where ticket_code   is not null;
create unique index if not exists ux_link_task_don
  on work.task_link(task_id, order_code)    where order_code    is not null;
create unique index if not exists ux_link_task_khach_id
  on work.task_link(task_id, customer_id)
  where customer_id is not null and customer_code is null;

-- ── 2. Resolve nhãn cho chip ───────────────────────────────────────────────
-- Nhãn tính ở SQL để giao diện khỏi gọi vòng hai cho từng chip.
-- `dich` cho biết mã khách còn sống ở bảng nào; đường dẫn thì TS dựng
-- (duongDanLink trong lib/work.ts) vì route là chuyện của frontend.
create or replace function work.link_json(p_task_id bigint)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(j order by j->>'loai', j->>'ma'), '[]'::jsonb)
  from (
    select case
      when l.customer_code is not null or l.customer_id is not null then jsonb_build_object(
        'id', l.id, 'loai', 'khach',
        'ma', coalesce(l.customer_code, l.customer_id::text),
        'nhan', coalesce(sc.name, cc.full_name, ci.full_name, l.customer_code, '(khách đã xoá)'),
        'phu',  coalesce(sc.phone, cc.primary_phone, ci.primary_phone),
        'dich', case when sc.customer_code is not null then 'sales'
                     when coalesce(cc.id, ci.id) is not null then 'cs' end,
        'khach_id', coalesce(cc.id, ci.id))
      when l.ticket_code is not null then jsonb_build_object(
        'id', l.id, 'loai', 'ticket', 'ma', l.ticket_code,
        'nhan', coalesce(nullif(btrim(tk.ticket_type),''), l.ticket_code),
        'phu',  left(coalesce(nullif(btrim(tk.description),''), tk.state), 60),
        'dich', null, 'khach_id', null)
      else jsonb_build_object(
        'id', l.id, 'loai', 'don', 'ma', l.order_code,
        'nhan', coalesce(so.customer_name, l.order_code),
        'phu',  nullif(to_char(so.order_date, 'DD/MM/YYYY'), ''),
        'dich', null, 'khach_id', null)
    end as j
    from work.task_link l
    left join public.customers    sc on sc.customer_code = l.customer_code
    left join public.cs_customers cc on cc.customer_code = l.customer_code
    left join public.cs_customers ci on ci.id            = l.customer_id
    left join public.tickets      tk on tk.ticket_code   = l.ticket_code
    left join public.sales_orders so on so.order_code    = l.order_code
    where l.task_id = p_task_id
      and l.link_type in ('khach','ticket','don')
  ) x;
$$;

-- ── 3. Tìm để chọn ─────────────────────────────────────────────────────────
-- RPC riêng của khu Việc, KHÔNG gọi searchCustomers trong app/actions.ts:
-- file đó dùng chung mọi khu, khu Việc nhập vào là tự trói mình vào nó.
create or replace function public.work_tim_erp(p_email text, p_loai text, p_tu_khoa text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid; v_q text; v_out jsonb;
begin
  v_me := work.staff_theo_email(p_email);
  if v_me is null then raise exception 'Nhân sự không hợp lệ'; end if;
  if p_loai not in ('khach','ticket','don') then raise exception 'Loại không hợp lệ: %', p_loai; end if;

  v_q := '%' || public.khong_dau(btrim(coalesce(p_tu_khoa,''))) || '%';
  if length(btrim(coalesce(p_tu_khoa,''))) < 2 then return '[]'::jsonb; end if;

  if p_loai = 'khach' then
    -- Gộp hai bảng khách rồi khử trùng theo mã: cùng một khách có thể nằm cả
    -- hai bên, hiện hai dòng giống nhau là người dùng không biết chọn cái nào.
    select coalesce(jsonb_agg(to_jsonb(x) order by x.nhan), '[]'::jsonb) into v_out from (
      select distinct on (ma) ma, nhan, phu from (
        select c.customer_code as ma, c.name as nhan, c.phone as phu
        from public.customers c
        where c.customer_code is not null
          and (public.khong_dau(c.name) ilike v_q or c.customer_code ilike v_q or c.phone ilike v_q)
        union all
        -- Khách chưa có mã vẫn phải chọn được, nên mã trả về là 'cs:<uuid>'.
        select coalesce(c.customer_code, 'cs:' || c.id::text), c.full_name, c.primary_phone
        from public.cs_customers c
        where (public.khong_dau(c.full_name) ilike v_q
               or coalesce(c.customer_code,'') ilike v_q
               or coalesce(c.primary_phone,'') ilike v_q)
      ) u order by ma, nhan limit 8) x;

  elsif p_loai = 'ticket' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.ma desc), '[]'::jsonb) into v_out from (
      select t.ticket_code as ma,
             coalesce(nullif(btrim(t.ticket_type),''), t.ticket_code) as nhan,
             left(coalesce(nullif(btrim(t.description),''), t.state), 60) as phu
      from public.tickets t
      where t.ticket_code ilike v_q or public.khong_dau(t.description) ilike v_q
      order by t.created_at desc limit 8) x;

  else
    select coalesce(jsonb_agg(to_jsonb(x) order by x.ma desc), '[]'::jsonb) into v_out from (
      select o.order_code as ma,
             coalesce(o.customer_name, o.order_code) as nhan,
             to_char(o.order_date, 'DD/MM/YYYY') as phu
      from public.sales_orders o
      where o.order_code ilike v_q or public.khong_dau(o.customer_name) ilike v_q
      order by o.order_date desc nulls last limit 8) x;
  end if;

  return v_out;
end $$;

-- ── 4. Gắn ─────────────────────────────────────────────────────────────────
create or replace function public.work_gan_erp(p_email text, p_task_id bigint, p_loai text, p_ma text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_me uuid; v_ma text; v_khach_id uuid;
begin
  v_me := work.staff_theo_email(p_email);
  if v_me is null then raise exception 'Nhân sự không hợp lệ'; end if;
  if not work.co_the_sua(v_me, p_task_id) then
    raise exception 'Không có quyền sửa việc này';
  end if;
  if p_loai not in ('khach','ticket','don') then raise exception 'Loại không hợp lệ: %', p_loai; end if;

  v_ma := btrim(coalesce(p_ma,''));
  if v_ma = '' then raise exception 'Chưa chọn thứ cần gắn'; end if;

  -- Kiểm mã CÓ THẬT trước khi ghi. Gắn nhầm mã thì chip hiện ra trơ trọi không
  -- ai hiểu nó là gì, và không có FK để DB bắt hộ.
  if p_loai = 'khach' and v_ma like 'cs:%' then
    -- khách CSKH chưa có mã: bám id
    v_khach_id := substr(v_ma, 4)::uuid;
    if not exists (select 1 from public.cs_customers where id = v_khach_id) then
      raise exception 'Không có khách này';
    end if;
    v_ma := null;
  elsif p_loai = 'khach' and not exists (
       select 1 from public.customers    where customer_code = v_ma
       union all
       select 1 from public.cs_customers where customer_code = v_ma) then
    raise exception 'Không có khách mã %', v_ma;
  elsif p_loai = 'ticket' and not exists (select 1 from public.tickets where ticket_code = v_ma) then
    raise exception 'Không có ticket %', v_ma;
  elsif p_loai = 'don' and not exists (select 1 from public.sales_orders where order_code = v_ma) then
    raise exception 'Không có đơn %', v_ma;
  end if;

  insert into work.task_link(task_id, link_type, customer_code, customer_id, ticket_code, order_code)
  values (p_task_id, p_loai,
          case when p_loai = 'khach'  then v_ma end,
          case when p_loai = 'khach'  then v_khach_id end,
          case when p_loai = 'ticket' then v_ma end,
          case when p_loai = 'don'    then v_ma end)
  on conflict do nothing;

  if not found then return; end if;   -- đã gắn rồi thì im lặng, không ghi nhật ký trùng

  insert into work.activity(task_id, actor_id, verb, payload)
  values (p_task_id, v_me, 'linked',
          jsonb_build_object('loai', p_loai, 'ma', coalesce(v_ma, v_khach_id::text)));
end $$;

-- ── 5. Gỡ ──────────────────────────────────────────────────────────────────
create or replace function public.work_bo_erp(p_email text, p_link_id bigint)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_me uuid; v_task bigint; v_loai text; v_ma text;
begin
  v_me := work.staff_theo_email(p_email);
  if v_me is null then raise exception 'Nhân sự không hợp lệ'; end if;

  select task_id, link_type, coalesce(customer_code, ticket_code, order_code, customer_id::text)
    into v_task, v_loai, v_ma
  from work.task_link where id = p_link_id;
  if v_task is null then raise exception 'Không có liên kết này'; end if;

  if not work.co_the_sua(v_me, v_task) then
    raise exception 'Không có quyền sửa việc này';
  end if;

  delete from work.task_link where id = p_link_id;

  insert into work.activity(task_id, actor_id, verb, payload)
  values (v_task, v_me, 'unlinked', jsonb_build_object('loai', v_loai, 'ma', v_ma));
end $$;

revoke execute on function public.work_tim_erp(text,text,text) from public;
revoke execute on function public.work_gan_erp(text,bigint,text,text) from public;
revoke execute on function public.work_bo_erp(text,bigint) from public;
grant  execute on function public.work_tim_erp(text,text,text) to service_role;
grant  execute on function public.work_gan_erp(text,bigint,text,text) to service_role;
grant  execute on function public.work_bo_erp(text,bigint) to service_role;

-- ── 6. Việc tự sinh tự có chip ─────────────────────────────────────────────
-- Việc sinh từ ERP đã BIẾT nguồn của nó (origin_ref = 'ticket:…' / 'serial:…' /
-- 'visit:…'). Bắt người dùng gắn tay lại thứ hệ thống đã biết là vô lý.
-- Cả ba đường đều về cs_customers.id -> customer_code.
create or replace function work.gan_link_tu_origin(p_task_id bigint, p_origin_ref text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_loai text; v_ma text; v_khach_id uuid; v_khach_ma text;
begin
  if p_origin_ref is null then return; end if;
  v_loai := split_part(p_origin_ref, ':', 1);
  v_ma   := substr(p_origin_ref, length(v_loai) + 2);
  if v_ma = '' then return; end if;

  if v_loai = 'ticket' then
    insert into work.task_link(task_id, link_type, ticket_code)
    values (p_task_id, 'ticket', v_ma) on conflict do nothing;
    select cc.id, cc.customer_code into v_khach_id, v_khach_ma
    from public.tickets t join public.cs_customers cc on cc.id = t.customer_id
    where t.ticket_code = v_ma;

  elsif v_loai = 'serial' then
    select cc.id, cc.customer_code into v_khach_id, v_khach_ma
    from public.installed_base ib join public.cs_customers cc on cc.id = ib.customer_id
    where ib.serial = v_ma;

  elsif v_loai = 'visit' then
    -- plan_id có thể rỗng (dữ liệu bảo trì mồ côi) — khi đó chịu, không có chip.
    select cc.id, cc.customer_code into v_khach_id, v_khach_ma
    from public.maintenance_visit mv
    join public.maintenance_plan mp on mp.id = mv.plan_id
    join public.cs_customers cc on cc.id = mp.customer_id
    where mv.id = v_ma::uuid;
  end if;

  if v_khach_id is not null then
    insert into work.task_link(task_id, link_type, customer_code, customer_id)
    values (p_task_id, 'khach', v_khach_ma, v_khach_id) on conflict do nothing;
  end if;
exception when others then
  -- Gắn chip là thứ TÔ ĐIỂM. Mã hỏng (visit id không phải uuid, khách đã xoá)
  -- không được phép làm hỏng việc sinh ra task — đó mới là thứ quan trọng.
  return;
end $$;

-- Trigger thay vì sửa work.tao_viec_auto: luật gắn chip là chuyện của task_link,
-- không phải chuyện của bộ quét. Để riêng thì sửa bộ quét sau này không đụng nó.
create or replace function work.trg_link_tu_origin()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.origin = 'auto_erp' then
    perform work.gan_link_tu_origin(new.id, new.origin_ref);
  end if;
  return null;
end $$;

drop trigger if exists tg_task_link_tu_origin on work.task;
create trigger tg_task_link_tu_origin
  after insert on work.task
  for each row execute function work.trg_link_tu_origin();

-- Việc tự sinh ĐÃ CÓ từ trước trigger — gắn bù.
do $$
declare r record;
begin
  for r in select id, origin_ref from work.task
           where origin = 'auto_erp' and origin_ref is not null loop
    perform work.gan_link_tu_origin(r.id, r.origin_ref);
  end loop;
end $$;

-- ── 7. Chi tiết việc trả thêm links ────────────────────────────────────────
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

-- ── 8. Danh sách việc trả kèm chip ─────────────────────────────────────────
-- Chip chỉ nằm trong panel chi tiết thì phải mở từng việc mới thấy — mất hẳn
-- cái lợi "liếc danh sách là biết việc này của khách nào". Hai hàm dưới GIỮ
-- NGUYÊN bản đang chạy, chỉ thêm đúng một cột `links`.
create or replace function public.work_viec_cua_toi(p_email text)
returns jsonb
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
           work.assignees_json(t.id) as assignees,
           work.link_json(t.id) as links
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

create or replace function public.work_bang_team(
  p_email text, p_team_id bigint default null, p_assignee uuid default null,
  p_status text default null, p_q text default null)
returns jsonb
language sql stable security definer set search_path = '' as $$
  with me as (select work.staff_theo_email(p_email) as id)
  select coalesce(jsonb_agg(to_jsonb(v) order by v.priority, v.due_at nulls last, v.id), '[]'::jsonb)
  from (
    select t.id, t.ref, t.title, t.status, t.priority, t.due_at, t.team_id,
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
