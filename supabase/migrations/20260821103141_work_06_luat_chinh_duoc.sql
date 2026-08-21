-- ============================================================================
-- work_06_luat_chinh_duoc.sql — luật tự sinh chỉnh được từ giao diện (2026-08-20)
--
-- Bản trước: mỗi luật có priority / han_ngay / max_moi_lan chỉnh được, nhưng
-- NGƯỠNG THỜI GIAN thì nằm cứng trong code hàm quét:
--   • ticket_khong_nguoi: "quá 4 giờ" viết cứng
--   • bao_tri_toi_han:    "cửa sổ ±7 ngày" viết cứng
-- CEO muốn chỉnh được cả hai. Đưa ra cột để đổi bằng giao diện, không phải sửa
-- code rồi deploy lại.
--
-- Thêm `nguong_gio` và `cua_so_ngay`, giữ mặc định đúng bằng số đang chạy nên
-- hành vi không đổi cho tới khi ai đó chỉnh thật.
-- ============================================================================

alter table work.auto_rule add column if not exists nguong_gio  int;
alter table work.auto_rule add column if not exists cua_so_ngay int;

comment on column work.auto_rule.nguong_gio  is
  'Sự kiện phải cũ hơn bao nhiêu GIỜ mới sinh việc. NULL = không xét. Dùng cho luật ticket.';
comment on column work.auto_rule.cua_so_ngay is
  'Chỉ nhìn sự kiện có hạn trong ±n NGÀY quanh hôm nay. NULL = không xét. Dùng cho luật bảo trì.';

update work.auto_rule set nguong_gio  = 4 where key = 'ticket_khong_nguoi' and nguong_gio  is null;
update work.auto_rule set cua_so_ngay = 7 where key = 'bao_tri_toi_han'    and cua_so_ngay is null;

-- ── Bộ quét đọc tham số từ bảng, không còn số cứng ─────────────────────────
create or replace function work.sinh_viec_tu_erp()
returns table(luat text, da_tao int)
language plpgsql security definer set search_path = '' as $$
declare r work.auto_rule; n int; v_nguoi uuid; rec record;
begin
  perform work.dong_bo_team_member();

  for r in select * from work.auto_rule where active order by key loop
    n := 0;
    v_nguoi := coalesce(r.nguoi_nhan, work.nguoi_nhan_mac_dinh());

    if r.key = 'bh_cho_kich_hoat' then
      for rec in
        select ib.serial, coalesce(c.full_name, ib.install_address, '—') as khach
        from public.installed_base ib
        left join public.warranty w on w.serial = ib.serial
        left join public.cs_customers c on c.id = ib.customer_id
        where ib.status = 'active' and (w.serial is null or not w.activated)
          -- lắp trong bao nhiêu ngày gần đây (NULL = không giới hạn)
          and (r.cua_so_ngay is null or ib.install_date is null
               or ib.install_date >= current_date - r.cua_so_ngay)
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

    elsif r.key = 'ticket_khong_nguoi' then
      for rec in
        select t.ticket_code, coalesce(nullif(btrim(t.description),''), t.ticket_type, 'không có mô tả') as mo_ta
        from public.tickets t
        where t.state = 'Open' and t.cs_phu_trach is null
          and t.created_at < now() - make_interval(hours => coalesce(r.nguong_gio, 4))
          and not exists (select 1 from work.task w
                          where w.origin = 'auto_erp' and w.origin_ref = 'ticket:'||t.ticket_code)
        order by t.created_at
        limit r.max_moi_lan
      loop
        if work.tao_viec_auto('ticket:'||rec.ticket_code,
             'Phân người cho ticket ' || rec.ticket_code,
             'Ticket mở quá ' || coalesce(r.nguong_gio,4) || ' giờ chưa ai nhận: ' || left(rec.mo_ta, 200),
             r, now() + make_interval(days => r.han_ngay), v_nguoi) is not null
        then n := n + 1; end if;
      end loop;

    elsif r.key = 'bao_tri_toi_han' then
      for rec in
        select mv.id, mv.lan_thu, mv.due_date,
               coalesce(p.ten_kd, p.source_customer_name, mv.ten_task, '—') as khach
        from public.maintenance_visit mv
        left join public.maintenance_plan p on p.id = mv.plan_id
        where mv.completed_at is null
          and mv.due_date between current_date - coalesce(r.cua_so_ngay, 7)
                              and current_date + coalesce(r.cua_so_ngay, 7)
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

-- ── Sửa tham số một luật ───────────────────────────────────────────────────
-- Một RPC nhận mọi trường, trường nào NULL thì giữ nguyên — giống work_sua_viec.
create or replace function public.work_sua_luat(
  p_email text, p_key text,
  p_priority smallint default null, p_han_ngay int default null,
  p_max_moi_lan int default null, p_nguong_gio int default null,
  p_cua_so_ngay int default null, p_team_key text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_me uuid; v_quan_ly boolean;
begin
  v_me := work.staff_theo_email(p_email);
  if v_me is null then raise exception 'Nhân sự không hợp lệ'; end if;
  select vai_tro && array['admin','cs_manager','sales_manager']::text[]
    into v_quan_ly from public.staff where id = v_me;
  if not coalesce(v_quan_ly, false) then
    raise exception 'Chỉ cấp quản lý mới sửa được luật';
  end if;

  if p_priority    is not null and p_priority    not between 1 and 4   then raise exception 'Ưu tiên phải từ 1 đến 4'; end if;
  if p_han_ngay    is not null and p_han_ngay    not between 0 and 365 then raise exception 'Hạn phải từ 0 đến 365 ngày'; end if;
  if p_max_moi_lan is not null and p_max_moi_lan not between 1 and 200 then raise exception 'Mỗi lượt phải từ 1 đến 200 việc'; end if;
  if p_nguong_gio  is not null and p_nguong_gio  not between 0 and 720 then raise exception 'Ngưỡng phải từ 0 đến 720 giờ (30 ngày)'; end if;
  if p_cua_so_ngay is not null and p_cua_so_ngay not between 1 and 365 then raise exception 'Cửa sổ phải từ 1 đến 365 ngày'; end if;
  if p_team_key is not null and not exists (select 1 from work.team where key = p_team_key) then
    raise exception 'Không có team: %', p_team_key;
  end if;

  update work.auto_rule set
    priority    = coalesce(p_priority, priority),
    han_ngay    = coalesce(p_han_ngay, han_ngay),
    max_moi_lan = coalesce(p_max_moi_lan, max_moi_lan),
    nguong_gio  = coalesce(p_nguong_gio, nguong_gio),
    cua_so_ngay = coalesce(p_cua_so_ngay, cua_so_ngay),
    team_key    = coalesce(p_team_key, team_key)
  where key = p_key;
  if not found then raise exception 'Không có luật: %', p_key; end if;
end $$;

revoke execute on function public.work_sua_luat(text,text,smallint,int,int,int,int,text) from public;
grant  execute on function public.work_sua_luat(text,text,smallint,int,int,int,int,text) to service_role;

-- ── Chạy thử MỘT luật, xem nó sẽ sinh gì (không ghi) ───────────────────────
-- Để CEO chỉnh tham số rồi xem trước, thay vì chỉnh xong bấm Chạy rồi mới biết.
create or replace function public.work_thu_luat(p_email text, p_key text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r work.auto_rule; v_me uuid; v_kq jsonb;
begin
  v_me := work.staff_theo_email(p_email);
  if v_me is null then raise exception 'Nhân sự không hợp lệ'; end if;
  select * into r from work.auto_rule where key = p_key;
  if r.key is null then raise exception 'Không có luật: %', p_key; end if;

  if p_key = 'bh_cho_kich_hoat' then
    select jsonb_agg(x) into v_kq from (
      select ib.serial as khoa, coalesce(c.full_name, ib.install_address,'—') as mo_ta,
             ib.install_date::text as moc
      from public.installed_base ib
      left join public.warranty w on w.serial = ib.serial
      left join public.cs_customers c on c.id = ib.customer_id
      where ib.status='active' and (w.serial is null or not w.activated)
        and (r.cua_so_ngay is null or ib.install_date is null
             or ib.install_date >= current_date - r.cua_so_ngay)
        and not exists (select 1 from work.task t where t.origin='auto_erp' and t.origin_ref='serial:'||ib.serial)
      order by ib.install_date desc nulls last limit r.max_moi_lan) x;

  elsif p_key = 'ticket_khong_nguoi' then
    select jsonb_agg(x) into v_kq from (
      select t.ticket_code as khoa,
             left(coalesce(nullif(btrim(t.description),''), t.ticket_type,'—'),120) as mo_ta,
             to_char(t.created_at,'DD/MM HH24:MI') as moc
      from public.tickets t
      where t.state='Open' and t.cs_phu_trach is null
        and t.created_at < now() - make_interval(hours => coalesce(r.nguong_gio,4))
        and not exists (select 1 from work.task w where w.origin='auto_erp' and w.origin_ref='ticket:'||t.ticket_code)
      order by t.created_at limit r.max_moi_lan) x;

  elsif p_key = 'bao_tri_toi_han' then
    select jsonb_agg(x) into v_kq from (
      select mv.id::text as khoa,
             coalesce(p.ten_kd, p.source_customer_name, mv.ten_task,'—') as mo_ta,
             to_char(mv.due_date,'DD/MM/YYYY') as moc
      from public.maintenance_visit mv
      left join public.maintenance_plan p on p.id = mv.plan_id
      where mv.completed_at is null
        and mv.due_date between current_date - coalesce(r.cua_so_ngay,7)
                            and current_date + coalesce(r.cua_so_ngay,7)
        and not exists (select 1 from work.task w where w.origin='auto_erp' and w.origin_ref='visit:'||mv.id::text)
      order by mv.due_date limit r.max_moi_lan) x;
  end if;

  return jsonb_build_object('luat', p_key, 'se_sinh', coalesce(v_kq,'[]'::jsonb));
end $$;

revoke execute on function public.work_thu_luat(text,text) from public;
grant  execute on function public.work_thu_luat(text,text) to service_role;

notify pgrst, 'reload schema';
