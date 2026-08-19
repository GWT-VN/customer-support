-- ============================================================================
-- work_00_init.sql — GWT Work (quản lý công việc cá nhân + team)
-- Ngày: 2026-08-18 · Trạng thái: bản GĐ0 (chờ apply vào dev/branch trước)
--
-- ĐẶT Ở ĐÂU: schema riêng "work" TRONG project Supabase GWT-SalesTracking
--   (bwzmqfbcgouhvhoslmmm) — chung Postgres với Sales + CSKH để join FK được.
--
-- NGUYÊN TẮC (theo data-contract Sales↔CS đã chốt):
--   • work chỉ ĐỌC bảng Sales/CS. Mọi gắn-kết ERP là SOFT reference (text/uuid),
--     KHÔNG hard-FK vào customers / customer_purchases / sales_order_lines / tickets…
--     vì các bảng mirror này bị XOÁ-GHI-LẠI mỗi lần sync từ Google Sheet.
--   • CHỈ FK cứng vào public.staff (id uuid, bảng ổn định) và trong nội bộ schema work.
--   • RLS bật hết; app đọc/ghi bằng service_role phía server sau requireStaff()
--     (đúng mô hình apps/web). Lọc quyền xem bằng work.visible_task_ids().
-- Idempotent ở mức tạo mới (create if not exists / on conflict).
-- ============================================================================

create schema if not exists work;
comment on schema work is 'GWT Work — task mgmt (personal + team). Owns its tables; reads Sales/CS via soft refs.';

create or replace function work.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ============================================================
-- TEAM (phòng ban) + thành viên (1 người thuộc NHIỀU team)
-- ============================================================
create table if not exists work.team (
  id          bigint generated always as identity primary key,
  key         text unique not null,                 -- 'marketing','sales','cskh','ky_thuat'
  name        text not null,
  color       text,
  sort_order  int default 0,
  created_at  timestamptz default now()
);

create table if not exists work.team_member (
  team_id      bigint not null references work.team(id) on delete cascade,
  staff_id     uuid   not null references public.staff(id) on delete cascade,
  role_in_team text default 'member',               -- 'lead' | 'member'
  primary key (team_id, staff_id)
);

insert into work.team(key,name,color,sort_order) values
  ('marketing','Marketing','#b0518f',1),
  ('sales','Sales','#2f7d8a',2),
  ('cskh','CSKH','#b5642a',3),
  ('ky_thuat','Kỹ thuật','#5560c9',4)
on conflict (key) do nothing;

-- ============================================================
-- PROJECT (dự án / sáng kiến) — thuộc 1 team hoặc xuyên team
-- ============================================================
create table if not exists work.project (
  id            bigint generated always as identity primary key,
  key           text unique,                         -- 'APP-WORK','PODCAST-NUOC'
  name          text not null,
  kind          text not null default 'initiative'
                check (kind in ('initiative','customer','internal','personal')),
  team_id       bigint references work.team(id) on delete set null,  -- null = xuyên team
  customer_code text,                                -- soft → public.customers.customer_code
  owner_id      uuid references public.staff(id),
  status        text not null default 'active'
                check (status in ('active','on_hold','done','archived')),
  color         text,
  start_date    date,
  due_date      date,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
drop trigger if exists t_project_touch on work.project;
create trigger t_project_touch before update on work.project
  for each row execute function work.touch_updated_at();
create index if not exists ix_project_team on work.project(team_id);
create index if not exists ix_project_customer on work.project(customer_code);

-- ============================================================
-- TASK — lõi (subtask lồng nhau, follow-up, merge duplicate, nguồn auto)
-- ============================================================
create sequence if not exists work.task_ref_seq start 1000;

create table if not exists work.task (
  id             bigint generated always as identity primary key,
  ref            text unique not null default ('TK-' || nextval('work.task_ref_seq')),
  title          text not null,
  description    text,
  status         text not null default 'todo'
                 check (status in ('todo','doing','blocked','review','done','cancelled')),
  priority       smallint not null default 3 check (priority between 1 and 4),  -- 1 = P1 khẩn
  scope          text not null default 'team' check (scope in ('team','personal')),
  visibility     text not null default 'team' check (visibility in ('private','team','company')),

  team_id        bigint references work.team(id) on delete set null,  -- team "nhà"
  parent_id      bigint references work.task(id) on delete cascade,    -- subtask (lồng nhiều cấp)

  creator_id     uuid references public.staff(id),
  start_at       timestamptz,
  due_at         timestamptz,
  completed_at   timestamptz,
  estimate_min   int,

  origin         text not null default 'manual'
                 check (origin in ('manual','auto_erp','recurring','follow_up')),
  origin_ref     text,                               -- 'ticket:TK-90','order:260815-E001','plan:<uuid>'
  recurring_id   bigint,                             -- FK gắn sau (bảng recurring tạo bên dưới)
  follow_up_from bigint references work.task(id) on delete set null,   -- "create follow-up task"

  duplicate_of   bigint references work.task(id) on delete set null,   -- bản trùng của task nào (merge)
  merged_at      timestamptz,

  sort_order     double precision default 0,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
drop trigger if exists t_task_touch on work.task;
create trigger t_task_touch before update on work.task
  for each row execute function work.touch_updated_at();
create index if not exists ix_task_status  on work.task(status);
create index if not exists ix_task_team    on work.task(team_id);
create index if not exists ix_task_parent  on work.task(parent_id);
create index if not exists ix_task_due     on work.task(due_at);
create index if not exists ix_task_creator on work.task(creator_id);

-- MULTI-HOME: 1 task thuộc NHIỀU project
create table if not exists work.task_project (
  task_id    bigint not null references work.task(id) on delete cascade,
  project_id bigint not null references work.project(id) on delete cascade,
  added_at   timestamptz default now(),
  primary key (task_id, project_id)
);
create index if not exists ix_taskproj_project on work.task_project(project_id);

-- ASSIGNEES (RACI): nhiều người / 1 việc
create table if not exists work.task_assignee (
  task_id     bigint not null references work.task(id) on delete cascade,
  staff_id    uuid   not null references public.staff(id) on delete cascade,
  role        text not null default 'doer' check (role in ('owner','doer','reviewer','watcher')),
  assigned_by uuid references public.staff(id),
  assigned_at timestamptz default now(),
  accepted_at timestamptz,
  done_at     timestamptz,
  primary key (task_id, staff_id, role)
);
create index if not exists ix_assignee_staff on work.task_assignee(staff_id);

-- DEPENDENCIES: task bị chặn bởi task khác (nuôi Timeline view)
create table if not exists work.task_dependency (
  task_id       bigint not null references work.task(id) on delete cascade,  -- việc bị chặn
  blocked_by_id bigint not null references work.task(id) on delete cascade,  -- việc phải xong trước
  type          text not null default 'finish_to_start',
  created_at    timestamptz default now(),
  primary key (task_id, blocked_by_id),
  check (task_id <> blocked_by_id)
);
create index if not exists ix_dep_blockedby on work.task_dependency(blocked_by_id);

-- ERP LINK: gắn task vào khách/ticket/đơn/máy — SOFT ref, KHÔNG hard-FK
create table if not exists work.task_link (
  id                  bigint generated always as identity primary key,
  task_id             bigint not null references work.task(id) on delete cascade,
  link_type           text not null
                      check (link_type in ('sales_quote','sales_contract','sales_visit',
                                           'cs_install','cs_ticket','cs_maintenance','internal')),
  customer_code       text,     -- → public.customers.customer_code
  ticket_code         text,     -- → public.tickets.ticket_code
  order_code          text,     -- → đơn
  serial              text,     -- → installed_base.serial
  maintenance_plan_id uuid,     -- → maintenance_plan.id
  note                text,
  created_at          timestamptz default now()
);
create index if not exists ix_link_task     on work.task_link(task_id);
create index if not exists ix_link_customer on work.task_link(customer_code);
create index if not exists ix_link_ticket   on work.task_link(ticket_code);

-- COMMENTS / ATTACHMENTS (Drive) / ACTIVITY / NOTIFICATION
create table if not exists work.comment (
  id         bigint generated always as identity primary key,
  task_id    bigint not null references work.task(id) on delete cascade,
  author_id  uuid references public.staff(id),
  body       text not null,
  mentions   uuid[] default '{}',                    -- staff được @ → nhắc Discord
  created_at timestamptz default now()
);
create index if not exists ix_comment_task on work.comment(task_id);

create table if not exists work.attachment (
  id            bigint generated always as identity primary key,
  task_id       bigint not null references work.task(id) on delete cascade,
  drive_file_id text not null,
  drive_url     text not null,
  name          text,
  mime          text,
  added_by      uuid references public.staff(id),
  created_at    timestamptz default now()
);
create index if not exists ix_attach_task on work.attachment(task_id);

create table if not exists work.activity (
  id         bigint generated always as identity primary key,
  task_id    bigint references work.task(id) on delete cascade,
  actor_id   uuid references public.staff(id),
  verb       text not null,   -- created|status_changed|assigned|commented|linked|merged|due_soon…
  payload    jsonb default '{}',
  created_at timestamptz default now()
);
create index if not exists ix_activity_task on work.activity(task_id);
create index if not exists ix_activity_time on work.activity(created_at);

create table if not exists work.notification (
  id         bigint generated always as identity primary key,
  staff_id   uuid not null references public.staff(id) on delete cascade,
  task_id    bigint references work.task(id) on delete cascade,
  channel    text not null default 'discord' check (channel in ('discord','email','inapp')),
  kind       text not null,   -- assigned|done_report|due_soon|mention|digest
  payload    jsonb default '{}',
  sent_at    timestamptz,
  read_at    timestamptz,
  created_at timestamptz default now()
);
create index if not exists ix_notif_unread on work.notification(staff_id) where read_at is null;
create unique index if not exists ux_notif_idem
  on work.notification(staff_id, task_id, kind) where sent_at is not null;   -- chống nhắc trùng

-- RECURRING (việc lặp lại) + map Discord của nhân sự
create table if not exists work.recurring (
  id                 bigint generated always as identity primary key,
  title_tmpl         text not null,
  rrule              text not null,             -- iCal RRULE: 'FREQ=MONTHLY;BYMONTHDAY=1'
  team_id            bigint references work.team(id) on delete set null,
  default_project_id bigint references work.project(id) on delete set null,
  default_assignees  jsonb default '[]',        -- [{staff_id, role}]
  link_tmpl          jsonb default '{}',
  active             boolean not null default true,
  last_run_at        timestamptz,
  created_at         timestamptz default now()
);
alter table work.task drop constraint if exists task_recurring_fk;
alter table work.task add constraint task_recurring_fk
  foreign key (recurring_id) references work.recurring(id) on delete set null;

create table if not exists work.staff_channel (
  staff_id      uuid primary key references public.staff(id) on delete cascade,
  discord_id    text,        -- Discord user id → DM + @mention
  discord_dm_id text,
  email_optin   boolean default true,
  updated_at    timestamptz default now()
);

-- ============================================================
-- RLS: bật hết, KHÔNG policy cho anon/authenticated (giống apps/web).
--   App dùng service_role phía server sau requireStaff(); lọc quyền bằng
--   work.visible_task_ids(). Policy chi tiết để migration sau khi chốt auth↔staff.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'team','team_member','project','task','task_project','task_assignee',
    'task_dependency','task_link','comment','attachment','activity',
    'notification','recurring','staff_channel'
  ] loop
    execute format('alter table work.%I enable row level security;', t);
  end loop;
end $$;

-- staff hiện tại theo email trong JWT (nếu sau này bật policy authenticated)
create or replace function work.me() returns uuid
language sql stable as $$
  select s.id from public.staff s
  where s.email = nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'email','')
    and s.hoat_dong
  limit 1
$$;

-- Tập id task 1 staff được xem — 1 ĐỊNH NGHĨA DUY NHẤT, app gọi lại (không viết tay điều kiện ở nhiều nơi)
create or replace function work.visible_task_ids(p_staff uuid)
returns table(task_id bigint)
language sql stable as $$
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

-- ============================================================
-- GHI CHÚ TRIỂN KHAI (làm ở migration sau, KHÔNG nằm trong 00):
--   01 — RPC: work.create_task(), work.set_status(), work.add_assignees()
--   02 — RPC work.merge_tasks(p_keep, p_dup): dời assignee/link/comment/subtask
--         từ p_dup → p_keep, set p_dup.duplicate_of=p_keep, status='cancelled', log activity
--   03 — RPC work.create_follow_up(p_from): task mới origin='follow_up', copy link/assignee
--   04 — Trigger/cron AUTO-SINH từ ERP: tickets→cs_ticket, đơn mới→kích hoạt BH,
--         installed_base→lắp đặt, maintenance_plan tới hạn→bảo trì (idempotent theo origin_ref)
--   05 — Discord: DB webhook trên work.activity → Edge Function đẩy Discord
--   06 — Guard chống chu trình dependency (đồ thị DAG) khi thêm task_dependency
-- ============================================================
