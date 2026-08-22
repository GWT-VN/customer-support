-- ============================================================================
-- work_10_chip_don_va_ticket.sql — CEO báo 22/08 (2026-08-22)
--
-- BA việc, đều là lỗi thật của work_07:
--
-- 1. "Chip đơn không tìm được đơn nào". Nguyên nhân: tôi tìm trong
--    `public.sales_orders` — bảng đó chỉ chứa đơn TẠO TỪ APP và trên production
--    đang RỖNG (0 dòng). Đơn thật nằm ở `sales_order_lines` (mirror Google
--    Sheet, 428 mã) và `customer_purchases` (đơn tặng, 439 mã). Đây là lỗi tôi
--    chọn bảng theo tên nghe hợp lý thay vì đo xem dữ liệu nằm đâu.
--    (Trang /sales/don/[code] thì ĐÃ xử lý cả ba nguồn, nên link chip vẫn đúng —
--    chỉ mỗi ô tìm sai.)
--
-- 2. "Chọn ticket theo mã/tiêu đề và hiển thị cũng thế". work_07 hiện
--    `ticket_type` làm nhãn, tức là "Khác" / "Rò rỉ nước" — nhìn chip chỉ thấy
--    loại lỗi, không biết là ticket nào. Trang /ticket/[code] lấy CHÍNH
--    `ticket_code` làm thẻ h1, nên mã mới là danh tính. Đổi: nhãn = mã, dòng phụ
--    = loại lỗi + trích mô tả.
--
-- 3. "Đã chọn khách thì chỉ được chọn ticket của khách đó; chọn ticket/đơn thì
--    biết luôn gắn với khách nào." Hai chiều:
--    · work_tim_erp nhận thêm p_task_id → việc đã gắn khách thì LỌC ticket/đơn
--      xuống đúng khách đó.
--    · work_gan_erp gắn ticket/đơn xong thì TỰ GẮN LUÔN khách của nó, nếu việc
--      chưa có chip khách. Hệ thống biết rồi thì đừng bắt người dùng gõ lại.
-- ============================================================================

-- ── Nguồn đơn THẬT, dùng chung cho cả tìm lẫn hiển thị ─────────────────────
-- Gom về một chỗ để ô tìm và chip không bao giờ lệch nhau về "đơn nào có thật".
create or replace view work.v_don as
  select l.order_code,
         max(l.customer_name)                as ten_khach,
         max(l.order_date)                   as ngay,
         count(*)                            as so_dong,
         sum(coalesce(l.amount_vat, 0))      as tien
  from public.sales_order_lines l
  where l.order_code is not null
  group by l.order_code
  union all
  -- Đơn TẶNG chỉ tồn tại ở customer_purchases, không có trong sales_order_lines.
  -- Bỏ qua nhóm này là CEO tìm đơn tặng không ra — đúng lỗi đang sửa.
  select p.order_code,
         max(coalesce(sc.name, cc.full_name)),
         max(p.order_date),
         count(*),
         0
  from public.customer_purchases p
  left join public.customers    sc on sc.customer_code = p.customer_code
  left join public.cs_customers cc on cc.customer_code = p.customer_code
  where p.order_code is not null
    and not exists (select 1 from public.sales_order_lines l where l.order_code = p.order_code)
  group by p.order_code;

comment on view work.v_don is
  'Đơn THẬT: mirror Google Sheet (sales_order_lines) + đơn tặng (customer_purchases). '
  'public.sales_orders chỉ chứa đơn tạo từ app và đang rỗng — đừng tìm ở đó.';

-- ── Khách của một ticket / một đơn ─────────────────────────────────────────
create or replace function work.khach_cua_ticket(p_code text)
returns table(ma text, id uuid)
language sql stable security definer set search_path = '' as $$
  select cc.customer_code, cc.id
  from public.tickets t join public.cs_customers cc on cc.id = t.customer_id
  where t.ticket_code = p_code
  limit 1;
$$;

create or replace function work.khach_cua_don(p_code text)
returns table(ma text, id uuid)
language sql stable security definer set search_path = '' as $$
  select p.customer_code,
         (select c.id from public.cs_customers c where c.customer_code = p.customer_code order by c.id limit 1)
  from public.customer_purchases p
  where p.order_code = p_code and p.customer_code is not null
  limit 1;
$$;

-- ── Tìm để chọn — có lọc theo khách đã gắn ─────────────────────────────────
drop function if exists public.work_tim_erp(text,text,text);
create or replace function public.work_tim_erp(
  p_email text, p_loai text, p_tu_khoa text, p_task_id bigint default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid; v_q text; v_out jsonb; v_kh_ma text; v_kh_id uuid; v_co_khach boolean := false;
begin
  v_me := work.staff_theo_email(p_email);
  if v_me is null then raise exception 'Nhân sự không hợp lệ'; end if;
  if p_loai not in ('khach','ticket','don') then raise exception 'Loại không hợp lệ: %', p_loai; end if;

  v_q := '%' || public.khong_dau(btrim(coalesce(p_tu_khoa,''))) || '%';
  if length(btrim(coalesce(p_tu_khoa,''))) < 2 then return '[]'::jsonb; end if;

  -- Việc đã gắn khách thì thu hẹp ticket/đơn về đúng khách đó. Không chặn cứng
  -- bằng lỗi: người dùng gắn nhầm khách rồi thì vẫn phải gỡ ra chọn lại được.
  if p_task_id is not null and p_loai in ('ticket','don') then
    select customer_code, customer_id into v_kh_ma, v_kh_id
    from work.task_link
    where task_id = p_task_id and link_type = 'khach'
    order by id limit 1;
    v_co_khach := (v_kh_ma is not null or v_kh_id is not null);

    -- Khách CSKH chưa có mã thì lấy mã từ id (nếu có). Đơn chỉ khoá theo mã, nên
    -- không có mã là khách đó KHÔNG THỂ có đơn — phải ra rỗng, không phải ra tất
    -- cả. Bản đầu tôi để `v_kh_ma is null` bỏ qua lọc, thành ra chọn khách xong
    -- vẫn thấy nguyên 428 đơn của mọi người.
    if v_kh_ma is null and v_kh_id is not null then
      select customer_code into v_kh_ma from public.cs_customers where id = v_kh_id;
    end if;
  end if;

  if p_loai = 'khach' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.nhan), '[]'::jsonb) into v_out from (
      select distinct on (ma) ma, nhan, phu from (
        select c.customer_code as ma, c.name as nhan, c.phone as phu
        from public.customers c
        where c.customer_code is not null
          and (public.khong_dau(c.name) ilike v_q or c.customer_code ilike v_q or c.phone ilike v_q)
        union all
        select coalesce(c.customer_code, 'cs:' || c.id::text), c.full_name, c.primary_phone
        from public.cs_customers c
        where (public.khong_dau(c.full_name) ilike v_q
               or coalesce(c.customer_code,'') ilike v_q
               or coalesce(c.primary_phone,'') ilike v_q)
      ) u order by ma, nhan limit 8) x;

  elsif p_loai = 'ticket' then
    -- Nhãn là MÃ ticket (trang chi tiết cũng lấy mã làm tiêu đề), dòng phụ là
    -- loại lỗi + trích mô tả. Tìm khớp cả ba.
    select coalesce(jsonb_agg(to_jsonb(x) order by x.ma desc), '[]'::jsonb) into v_out from (
      select t.ticket_code as ma,
             t.ticket_code as nhan,
             left(concat_ws(' · ',
                    nullif(btrim(coalesce(t.ticket_type,'')),''),
                    nullif(btrim(coalesce(t.description,'')),'')), 80) as phu
      from public.tickets t
      left join public.cs_customers cc on cc.id = t.customer_id
      where ( t.ticket_code ilike v_q
              or public.khong_dau(t.description) ilike v_q
              or public.khong_dau(t.ticket_type)  ilike v_q )
        and ( (v_kh_ma is null and v_kh_id is null)
              or cc.id = v_kh_id
              or (v_kh_ma is not null and cc.customer_code = v_kh_ma) )
      order by t.created_at desc limit 8) x;

  else
    select coalesce(jsonb_agg(to_jsonb(x) - 'sx' order by x.sx desc nulls last), '[]'::jsonb) into v_out from (
      select d.order_code as ma,
             d.order_code as nhan,
             left(concat_ws(' · ',
                    nullif(d.ten_khach,''),
                    to_char(d.ngay,'DD/MM/YYYY'),
                    d.so_dong || ' dòng'), 80) as phu,
             d.ngay as sx
      from work.v_don d
      where ( d.order_code ilike v_q or public.khong_dau(d.ten_khach) ilike v_q )
        and ( not v_co_khach
              or ( v_kh_ma is not null
                   and exists (select 1 from public.customer_purchases p
                                where p.order_code = d.order_code
                                  and p.customer_code = v_kh_ma) ) )
      order by d.ngay desc nulls last limit 8) x;
  end if;

  return v_out;
end $$;

-- ── Gắn: kiểm mã trên bảng ĐÚNG, và kéo theo khách ─────────────────────────
create or replace function public.work_gan_erp(p_email text, p_task_id bigint, p_loai text, p_ma text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_me uuid; v_ma text; v_khach_id uuid; v_nhan text; v_co boolean;
        v_kh_ma text; v_kh_id uuid; v_kh_ten text;
begin
  v_me := work.staff_theo_email(p_email);
  if v_me is null then raise exception 'Nhân sự không hợp lệ'; end if;
  if not work.co_the_sua(v_me, p_task_id) then
    raise exception 'Không có quyền sửa việc này';
  end if;
  if p_loai not in ('khach','ticket','don') then raise exception 'Loại không hợp lệ: %', p_loai; end if;

  v_ma := btrim(coalesce(p_ma,''));
  if v_ma = '' then raise exception 'Chưa chọn thứ cần gắn'; end if;

  if p_loai = 'khach' and v_ma like 'cs:%' then
    v_khach_id := substr(v_ma, 4)::uuid;
    select full_name into v_nhan from public.cs_customers where id = v_khach_id;
    if not found then raise exception 'Không có khách này'; end if;
    v_ma := null;

  elsif p_loai = 'khach' then
    select coalesce(sc.name, cc.full_name), cc.id,
           (sc.customer_code is not null or cc.id is not null)
      into v_nhan, v_khach_id, v_co
    from (select 1) _
    left join public.customers sc on sc.customer_code = v_ma
    left join lateral (select c.id, c.full_name from public.cs_customers c
                        where c.customer_code = v_ma order by c.id limit 1) cc on true;
    if not coalesce(v_co, false) then
      raise exception 'Không có khách mã %', v_ma;
    end if;

  elsif p_loai = 'ticket' then
    -- Nhãn chụp lại là MÃ, khớp với thứ hiển thị trên chip.
    select t.ticket_code into v_nhan from public.tickets t where t.ticket_code = v_ma;
    if not found then raise exception 'Không có ticket %', v_ma; end if;
    select k.ma, k.id into v_kh_ma, v_kh_id from work.khach_cua_ticket(v_ma) k;

  else
    select d.order_code into v_nhan from work.v_don d where d.order_code = v_ma;
    if not found then raise exception 'Không có đơn %', v_ma; end if;
    select k.ma, k.id into v_kh_ma, v_kh_id from work.khach_cua_don(v_ma) k;
  end if;

  if p_loai = 'khach' and exists (
       select 1 from work.task_link
       where task_id = p_task_id
         and ( (v_ma is not null and customer_code = v_ma)
            or (v_khach_id is not null and customer_id = v_khach_id) )) then
    return;
  end if;

  insert into work.task_link(task_id, link_type, customer_code, customer_id, ticket_code, order_code, nhan_luc_gan)
  values (p_task_id, p_loai,
          case when p_loai = 'khach'  then v_ma end,
          case when p_loai = 'khach'  then v_khach_id end,
          case when p_loai = 'ticket' then v_ma end,
          case when p_loai = 'don'    then v_ma end,
          v_nhan)
  on conflict do nothing;

  if not found then return; end if;

  insert into work.activity(task_id, actor_id, verb, payload)
  values (p_task_id, v_me, 'linked',
          jsonb_build_object('loai', p_loai, 'ma', coalesce(v_ma, v_khach_id::text)));

  -- Gắn ticket/đơn thì kéo theo khách của nó — nhưng CHỈ khi việc chưa có khách.
  -- Đã có rồi mà đè thêm là tự ý sửa thứ người dùng đã chọn.
  if p_loai in ('ticket','don') and (v_kh_ma is not null or v_kh_id is not null)
     and not exists (select 1 from work.task_link
                      where task_id = p_task_id and link_type = 'khach') then
    select coalesce(sc.name, cc.full_name) into v_kh_ten
    from (select 1) _
    left join public.customers sc on sc.customer_code = v_kh_ma
    left join public.cs_customers cc on cc.id = v_kh_id;

    insert into work.task_link(task_id, link_type, customer_code, customer_id, nhan_luc_gan)
    values (p_task_id, 'khach', v_kh_ma, v_kh_id, v_kh_ten)
    on conflict do nothing;

    if found then
      insert into work.activity(task_id, actor_id, verb, payload)
      values (p_task_id, v_me, 'linked',
              jsonb_build_object('loai','khach','ma', coalesce(v_kh_ma, v_kh_id::text), 'tu_dong', true));
    end if;
  end if;
end $$;

revoke execute on function public.work_tim_erp(text,text,text,bigint) from public;
grant  execute on function public.work_tim_erp(text,text,text,bigint) to service_role;

-- ── Chip: ticket hiện MÃ, đơn đọc từ nguồn thật ────────────────────────────
create or replace function work.link_json(p_task_id bigint)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(j order by j->>'loai', j->>'ma'), '[]'::jsonb)
  from (
    select case
      when l.customer_code is not null or l.customer_id is not null then jsonb_build_object(
        'id', l.id, 'loai', 'khach',
        'ma', coalesce(l.customer_code, l.customer_id::text),
        'nhan', coalesce(sc.name, cc.full_name, ci.full_name),
        'nhan_luc_gan', l.nhan_luc_gan,
        'phu',  coalesce(sc.phone, cc.primary_phone, ci.primary_phone),
        'dich', case when sc.customer_code is not null then 'sales'
                     when coalesce(cc.id, ci.id) is not null then 'cs' end,
        'khach_id', coalesce(cc.id, ci.id))
      when l.ticket_code is not null then jsonb_build_object(
        'id', l.id, 'loai', 'ticket', 'ma', l.ticket_code,
        -- Nhãn = MÃ. `nhan` null nghĩa là ticket không còn -> chip treo.
        'nhan', tk.ticket_code,
        'nhan_luc_gan', l.nhan_luc_gan,
        'phu',  left(concat_ws(' · ',
                  nullif(btrim(coalesce(tk.ticket_type,'')),''),
                  nullif(btrim(coalesce(tk.description,'')),'')), 80),
        'dich', null, 'khach_id', null)
      else jsonb_build_object(
        'id', l.id, 'loai', 'don', 'ma', l.order_code,
        'nhan', dn.order_code,
        'nhan_luc_gan', l.nhan_luc_gan,
        'phu',  left(concat_ws(' · ',
                  nullif(dn.ten_khach,''),
                  to_char(dn.ngay,'DD/MM/YYYY')), 80),
        'dich', null, 'khach_id', null)
    end as j
    from work.task_link l
    left join public.customers sc on sc.customer_code = l.customer_code
    left join lateral (
      select c.id, c.full_name, c.primary_phone
      from public.cs_customers c
      where l.customer_code is not null and c.customer_code = l.customer_code
      order by c.id limit 1
    ) cc on true
    left join public.cs_customers ci on ci.id          = l.customer_id
    left join public.tickets      tk on tk.ticket_code = l.ticket_code
    left join lateral (
      select d.order_code, d.ten_khach, d.ngay
      from work.v_don d where d.order_code = l.order_code limit 1
    ) dn on true
    where l.task_id = p_task_id
      and l.link_type in ('khach','ticket','don')
  ) x;
$$;

notify pgrst, 'reload schema';
