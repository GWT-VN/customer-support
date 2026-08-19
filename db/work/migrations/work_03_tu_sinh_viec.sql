-- ============================================================================
-- work_03_tu_sinh_viec.sql — sinh việc tự động từ sự kiện ERP
-- Ngày: 2026-08-19
--
-- ĐÂY LÀ THỨ ASANA KHÔNG LÀM ĐƯỢC: Work nằm cùng một Postgres với CS và Sales,
-- nên "máy lắp xong chưa kích hoạt bảo hành → việc cho CSKH" là một câu SQL,
-- không phải tích hợp API mong manh.
--
-- ── VÌ SAO QUÉT ĐỊNH KỲ, KHÔNG DÙNG TRIGGER ────────────────────────────────
-- Cách hiển nhiên là gắn trigger lên public.tickets / installed_base. Không làm,
-- vì ba lý do:
--   1. Bảng đó do CS/Sales SỞ HỮU. Gắn trigger vào là Work ghi vào vùng của
--      module khác — trái luật §7 SYSTEM.md. Tệ hơn: trigger lỗi thì INSERT của
--      CS cũng vỡ theo, Work làm sập CS.
--   2. Hai trong ba luật vốn PHỤ THUỘC THỜI GIAN ("ticket chưa ai nhận sau 4
--      giờ", "bảo trì tới hạn trong 7 ngày") — không có sự kiện nào để bám vào.
--   3. Bảng mirror từ Sheet bị xoá-nạp lại mỗi lần sync; trigger sẽ bắn lại
--      hàng loạt. Quét + khoá idempotent thì không.
-- Hàm này chỉ ĐỌC bảng CS/Sales, ghi duy nhất vào schema work.
--
-- ── CHỐNG TRÙNG ─────────────────────────────────────────────────────────────
-- Mỗi việc tự sinh mang origin_ref là khoá của sự kiện gốc ('ticket:TK-90',
-- 'serial:GN610-2508-0142', 'visit:<uuid>'). Unique index bên dưới khiến chạy
-- lại bao nhiêu lần cũng không đẻ thêm — chạy được mỗi 15 phút mà vẫn yên tâm.
--
-- ── CHẶN LŨ ─────────────────────────────────────────────────────────────────
-- Lần chạy đầu có 13 máy chờ kích hoạt BH + 39 lượt bảo trì quá hạn + 3 ticket
-- = hơn 50 việc đổ một lúc lên đầu quản lý CSKH, mở app ra là nản và tắt. Nên:
--   • mỗi luật có `max_moi_lan` (mặc định 15) — phần còn lại lần chạy sau lấy tiếp;
--   • luật bảo trì chỉ nhìn cửa sổ [hôm nay - 7 ngày, hôm nay + 7 ngày], không
--     đào lại toàn bộ lịch sử quá hạn.
-- ============================================================================

-- ── Khoá chống trùng ────────────────────────────────────────────────────────
create unique index if not exists ux_task_origin_ref
  on work.task(origin_ref) where origin = 'auto_erp' and origin_ref is not null;

-- ── Bảng luật: bật/tắt và chỉnh tham số mà không phải sửa code ──────────────
create table if not exists work.auto_rule (
  key           text primary key,
  name          text not null,
  mo_ta         text,
  nguon         text not null,                       -- module sinh ra sự kiện
  active        boolean not null default true,
  priority      smallint not null default 3 check (priority between 1 and 4),
  team_key      text,                                -- khớp work.team.key
  han_ngay      int not null default 2,              -- hạn = hôm nay + n ngày
  max_moi_lan   int not null default 15,
  last_run_at   timestamptz,
  last_created  int not null default 0
);

insert into work.auto_rule(key, name, mo_ta, nguon, priority, team_key, han_ngay) values
  ('bh_cho_kich_hoat', 'Máy đã lắp chưa kích hoạt bảo hành',
   'Có bản ghi trong installed_base nhưng warranty chưa activated. Sinh việc cho CSKH kích hoạt.',
   'CSKH', 3, 'cskh', 2),
  ('ticket_khong_nguoi', 'Ticket mở quá 4 giờ chưa ai nhận',
   'tickets.state = Open và cs_phu_trach còn trống. Sinh việc cho quản lý CSKH phân người.',
   'CSKH', 1, 'cskh', 1),
  ('bao_tri_toi_han', 'Lượt bảo trì tới hạn trong 7 ngày',
   'maintenance_visit chưa completed_at, due_date trong cửa sổ ±7 ngày. Sinh việc gọi khách đặt lịch.',
   'CSKH', 2, 'cskh', 3)
on conflict (key) do nothing;

alter table work.auto_rule enable row level security;

-- ── Ai nhận việc tự sinh ────────────────────────────────────────────────────
-- Một định nghĩa duy nhất. Không có quản lý CSKH đang hoạt động thì hàm trả
-- NULL và luật bị BỎ QUA — thà không sinh còn hơn đẻ ra việc mồ côi không ai thấy.
create or replace function work.nguoi_nhan_mac_dinh() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.staff
  where hoat_dong and vai_tro && array['cs_manager']::text[]
  order by id limit 1
$$;

-- ── Tạo một việc tự sinh (idempotent theo origin_ref) ───────────────────────
-- Trả về id nếu tạo mới, NULL nếu đã có (hoặc không xác định được người nhận).
create or replace function work.tao_viec_auto(
  p_ref text, p_title text, p_mo_ta text,
  p_rule work.auto_rule, p_due timestamptz, p_nguoi uuid
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_team bigint;
begin
  if p_nguoi is null then return null; end if;
  select id into v_team from work.team where key = p_rule.team_key;

  insert into work.task(title, description, priority, due_at, team_id,
                        visibility, creator_id, origin, origin_ref)
  values (p_title, p_mo_ta, p_rule.priority, p_due, v_team,
          'team', p_nguoi, 'auto_erp', p_ref)
  on conflict (origin_ref) where origin = 'auto_erp' and origin_ref is not null
  do nothing
  returning id into v_id;

  if v_id is null then return null; end if;   -- đã có từ lần chạy trước

  insert into work.task_assignee(task_id, staff_id, role, assigned_by)
  values (v_id, p_nguoi, 'owner', p_nguoi)
  on conflict (task_id, staff_id) do nothing;

  insert into work.activity(task_id, actor_id, verb, payload)
  values (v_id, null, 'auto_created',
          jsonb_build_object('rule', p_rule.key, 'ref', p_ref));

  return v_id;
end $$;

-- ── Bộ quét chính ───────────────────────────────────────────────────────────
create or replace function work.sinh_viec_tu_erp()
returns table(luat text, da_tao int)
language plpgsql security definer set search_path = '' as $$
declare r work.auto_rule; n int; v_nguoi uuid; rec record;
begin
  v_nguoi := work.nguoi_nhan_mac_dinh();

  for r in select * from work.auto_rule where active order by key loop
    n := 0;

    -- 1. Máy đã lắp mà bảo hành chưa kích hoạt
    if r.key = 'bh_cho_kich_hoat' then
      for rec in
        select ib.serial, coalesce(c.full_name, ib.install_address, '—') as khach
        from public.installed_base ib
        left join public.warranty w on w.serial = ib.serial
        left join public.cs_customers c on c.id = ib.customer_id
        where ib.status = 'active' and (w.serial is null or not w.activated)
          and not exists (select 1 from work.task t
                          where t.origin = 'auto_erp' and t.origin_ref = 'serial:'||ib.serial)
        order by ib.install_date desc nulls last
        limit r.max_moi_lan
      loop
        if work.tao_viec_auto('serial:'||rec.serial,
             'Kích hoạt bảo hành — ' || rec.serial,
             'Máy đã lắp cho ' || rec.khach || ' nhưng bảo hành chưa kích hoạt. Vào /dang-ky-bh để kích hoạt.',
             r, now() + make_interval(days => r.han_ngay), v_nguoi) is not null
        then n := n + 1; end if;
      end loop;

    -- 2. Ticket mở quá 4 giờ chưa ai nhận
    elsif r.key = 'ticket_khong_nguoi' then
      for rec in
        select t.ticket_code, coalesce(nullif(btrim(t.description),''), t.ticket_type, 'không có mô tả') as mo_ta
        from public.tickets t
        where t.state = 'Open' and t.cs_phu_trach is null
          and t.created_at < now() - interval '4 hours'
          and not exists (select 1 from work.task w
                          where w.origin = 'auto_erp' and w.origin_ref = 'ticket:'||t.ticket_code)
        order by t.created_at
        limit r.max_moi_lan
      loop
        if work.tao_viec_auto('ticket:'||rec.ticket_code,
             'Phân người cho ticket ' || rec.ticket_code,
             'Ticket mở quá 4 giờ chưa ai nhận: ' || left(rec.mo_ta, 200),
             r, now() + make_interval(days => r.han_ngay), v_nguoi) is not null
        then n := n + 1; end if;
      end loop;

    -- 3. Lượt bảo trì tới hạn (cửa sổ ±7 ngày, không đào lại quá khứ xa)
    elsif r.key = 'bao_tri_toi_han' then
      for rec in
        select mv.id, mv.lan_thu, mv.due_date,
               coalesce(p.ten_kd, p.source_customer_name, mv.ten_task, '—') as khach
        from public.maintenance_visit mv
        left join public.maintenance_plan p on p.id = mv.plan_id
        where mv.completed_at is null
          and mv.due_date between current_date - 7 and current_date + 7
          and not exists (select 1 from work.task w
                          where w.origin = 'auto_erp' and w.origin_ref = 'visit:'||mv.id::text)
        order by mv.due_date
        limit r.max_moi_lan
      loop
        if work.tao_viec_auto('visit:'||rec.id::text,
             'Gọi khách đặt lịch bảo trì lượt ' || coalesce(rec.lan_thu::text,'?') || ' — ' || rec.khach,
             'Lượt bảo trì tới hạn ' || to_char(rec.due_date,'DD/MM/YYYY') || '. Gọi khách chốt ngày rồi gán kỹ thuật.',
             r, (rec.due_date::timestamptz + interval '17 hours'), v_nguoi) is not null
        then n := n + 1; end if;
      end loop;
    end if;

    update work.auto_rule set last_run_at = now(), last_created = n where key = r.key;
    luat := r.key; da_tao := n; return next;
  end loop;
end $$;

-- ============================================================================
-- RPC cho app (schema public — PostgREST chỉ phục vụ schema được expose)
-- ============================================================================

create or replace function public.work_luat_tu_sinh(p_email text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'luat', (select coalesce(jsonb_agg(to_jsonb(r) order by r.key), '[]'::jsonb)
             from (select key, name, mo_ta, nguon, active, priority, team_key,
                          han_ngay, max_moi_lan, last_run_at, last_created
                   from work.auto_rule) r),
    'la_quan_ly', (select coalesce(s.vai_tro && array['admin','cs_manager','sales_manager']::text[], false)
                   from public.staff s where s.id = work.staff_theo_email(p_email)),
    'gan_day', (select coalesce(jsonb_agg(to_jsonb(v) order by v.id desc), '[]'::jsonb)
                from (select t.id, t.ref, t.title, t.status, t.priority, t.due_at,
                             t.origin_ref, t.created_at, tm.name as team_name,
                             tm.color as team_color, work.assignees_json(t.id) as assignees
                      from work.task t
                      left join work.team tm on tm.id = t.team_id
                      where t.origin = 'auto_erp'
                      order by t.id desc limit 30) v)
  )
$$;

-- Chạy tay. Chỉ quản lý được bấm — người thường bấm sẽ tạo việc cho người khác.
create or replace function public.work_chay_tu_sinh(p_email text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_me uuid; v_quan_ly boolean; v_kq jsonb;
begin
  v_me := work.staff_theo_email(p_email);
  if v_me is null then raise exception 'Nhân sự không hợp lệ'; end if;
  select vai_tro && array['admin','cs_manager','sales_manager']::text[]
    into v_quan_ly from public.staff where id = v_me;
  if not coalesce(v_quan_ly, false) then
    raise exception 'Chỉ cấp quản lý mới chạy được bộ sinh việc';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('luat', luat, 'da_tao', da_tao)), '[]'::jsonb)
    into v_kq from work.sinh_viec_tu_erp();
  return v_kq;
end $$;

create or replace function public.work_bat_tat_luat(p_email text, p_key text, p_active boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_me uuid; v_quan_ly boolean;
begin
  v_me := work.staff_theo_email(p_email);
  if v_me is null then raise exception 'Nhân sự không hợp lệ'; end if;
  select vai_tro && array['admin','cs_manager','sales_manager']::text[]
    into v_quan_ly from public.staff where id = v_me;
  if not coalesce(v_quan_ly, false) then
    raise exception 'Chỉ cấp quản lý mới bật/tắt được luật';
  end if;
  update work.auto_rule set active = p_active where key = p_key;
  if not found then raise exception 'Không có luật: %', p_key; end if;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.work_luat_tu_sinh(text)',
    'public.work_chay_tu_sinh(text)',
    'public.work_bat_tat_luat(text,text,boolean)'
  ] loop
    execute format('revoke execute on function %s from public;', f);
    execute format('grant execute on function %s to service_role;', f);
  end loop;
end $$;

-- Hàm mới ⇒ PostgREST phải nạp lại danh sách, nếu không app gọi vào nhận PGRST202.
notify pgrst, 'reload schema';

-- LỊCH CHẠY + NGƯỜI NHẬN CHỌN ĐƯỢC: xem work_03b_nguoi_nhan_va_cron.sql.
