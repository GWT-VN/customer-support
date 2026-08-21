-- ============================================================================
-- work_05_dong_bo_team_member_va_loc_quyen.sql — 2026-08-19
--
-- BA LỖI NỐI NHAU, lộ ra khi CEO bấm vào một việc ở /work/tu-sinh:
--
-- 1. work.team_member RỖNG. Cả thiết kế quyền xem dựa vào visibility='team' +
--    bảng thành viên team, nhưng chưa ai từng đổ dữ liệu vào bảng đó. Hệ quả:
--    "team" thực chất chạy như "private" — chỉ người tạo và người làm thấy.
-- 2. 20 việc tự sinh có creator = assignee = một người, nên CHỈ người đó xem
--    được; 9 người còn lại thấy 0 việc.
-- 3. work_luat_tu_sinh vẫn liệt kê ĐỦ 20 việc cho mọi người — bày ra thứ bấm
--    vào là bị từ chối. Danh sách và quyền mở phải cùng MỘT luật.
--
-- ── Vì sao ĐỔ TỪ staff.vai_tro chứ không bắt nhập tay ──────────────────────
-- Ai thuộc team nào đã nằm sẵn ở staff.vai_tro. Bắt nhập lại là tạo nguồn sự
-- thật thứ hai, rồi hai bên lệch nhau.
--
-- ── Vì sao KHÔNG gắn trigger lên public.staff ──────────────────────────────
-- staff là bảng DÙNG CHUNG; trigger của Work gắn vào đó có thể làm vỡ INSERT
-- của CS/Sales — đúng thứ đã tránh ở work_03. Thay vào đó gọi hàm đồng bộ ngay
-- đầu work.sinh_viec_tu_erp(), vốn đã chạy sẵn mỗi 15 phút.
-- ============================================================================

create or replace function work.dong_bo_team_member() returns int
language plpgsql security definer set search_path = '' as $$
declare v_them int;
begin
  with map(vai, team_key) as (values
    ('cs','cskh'), ('cs_manager','cskh'),
    ('sales','sales'), ('sales_manager','sales'),
    ('ky_thuat','ky_thuat'), ('marketing','marketing')
  ),
  can_co as (
    select s.id as staff_id, t.id as team_id
    from public.staff s
    join map m on s.vai_tro && array[m.vai]::text[]
    join work.team t on t.key = m.team_key
    where s.hoat_dong
    union
    -- admin thấy mọi team
    select s.id, t.id
    from public.staff s cross join work.team t
    where s.hoat_dong and s.vai_tro && array['admin']::text[]
  ),
  them as (
    insert into work.team_member(team_id, staff_id)
    select team_id, staff_id from can_co
    on conflict (team_id, staff_id) do nothing
    returning 1
  )
  select count(*) into v_them from them;

  -- nghỉ việc thì rút khỏi team luôn
  delete from work.team_member tm
  where not exists (
    select 1 from public.staff s where s.id = tm.staff_id and s.hoat_dong
  );

  return v_them;
end $$;

select work.dong_bo_team_member();

-- ── Bộ quét: bản CUỐI (thêm bước đồng bộ team_member ở đầu) ────────────────
create or replace function work.sinh_viec_tu_erp()
returns table(luat text, da_tao int)
language plpgsql security definer set search_path = '' as $$
declare r work.auto_rule; n int; v_nguoi uuid; rec record;
begin
  perform work.dong_bo_team_member();   -- nhân sự mới / đổi vai trò tự vào team

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

-- ── Danh sách và quyền mở phải CÙNG một luật ───────────────────────────────
create or replace function public.work_luat_tu_sinh(p_email text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'luat', (select coalesce(jsonb_agg(to_jsonb(r) order by r.key), '[]'::jsonb)
             from (select a.key, a.name, a.mo_ta, a.nguon, a.active, a.priority, a.team_key,
                          a.han_ngay, a.max_moi_lan, a.last_run_at, a.last_created,
                          a.nguoi_nhan, s.ten as nguoi_nhan_ten
                   from work.auto_rule a
                   left join public.staff s on s.id = coalesce(a.nguoi_nhan, work.nguoi_nhan_mac_dinh())) r),
    'la_quan_ly', (select coalesce(s.vai_tro && array['admin','cs_manager','sales_manager']::text[], false)
                   from public.staff s where s.id = work.staff_theo_email(p_email)),
    'nhan_su', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'ten', ten) order by ten), '[]'::jsonb)
                from public.staff where hoat_dong),
    -- CHỈ liệt kê việc người này thực sự mở được, đúng bằng luật của
    -- work_chi_tiet_viec. Bày ra thứ bấm vào bị từ chối là lỗi thiết kế.
    'gan_day', (select coalesce(jsonb_agg(to_jsonb(v) order by v.id desc), '[]'::jsonb)
                from (select t.id, t.ref, t.title, t.status, t.priority, t.due_at,
                             t.origin_ref, t.created_at, tm.name as team_name,
                             tm.color as team_color, work.assignees_json(t.id) as assignees
                      from work.task t
                      left join work.team tm on tm.id = t.team_id
                      where t.origin = 'auto_erp'
                        and t.id in (select task_id
                                     from work.visible_task_ids(work.staff_theo_email(p_email)))
                      order by t.id desc limit 30) v),
    -- Tổng việc auto, để màn hình nói rõ "bạn xem được 8/20, còn lại của team khác"
    'tong_auto', (select count(*) from work.task where origin = 'auto_erp')
  )
$$;

notify pgrst, 'reload schema';
