-- ============================================================================
-- work_08_chip_treo.sql — chip sống sót khi mã khách bị khai tử (2026-08-22)
--
-- Phiên Sales báo 22/08: gộp khách KHÔNG phải thao tác thủ công có nút bấm. Mỗi
-- lần CEO dựng lại DM_KHACH trên Google Sheet, hai dòng cùng SĐT (sau chuẩn hoá)
-- gộp làm một và MỘT MÃ BỊ KHAI TỬ — `byPhone[sdt] = rec`, ghi sau đè ghi trước.
-- Không ai bấm xoá, không nhật ký, không phiên nào báo. Chuyện này sẽ còn chạy
-- đều đặn, mỗi lần một SĐT hỏng được sửa.
--
-- work_07 để chip đọc tên từ bản ghi ĐANG SỐNG. Mã chết ⇒ chip thành ô trống,
-- mất luôn dấu vết việc này từng của ai. Đó là mất dữ liệu thật, không phải lỗi
-- hiển thị: không ai tra ngược được nữa.
--
-- Hai lớp đỡ, cố ý không lớp nào đủ một mình:
--   1. `nhan_luc_gan` — chụp tên NGAY LÚC GẮN. Phủ 100%, kể cả khách chỉ có bên
--      Sales (294/421 mã Sales không có hồ sơ CSKH — đo trên prod 22/08).
--   2. `customer_id` — gắn theo mã thì ĐỒNG THỜI ghi id CSKH nếu có. Mã chết mà
--      hồ sơ CSKH còn thì chip vẫn BẤM ĐƯỢC. Chỉ phủ 127/421, nên nó là phần
--      thêm chứ không thay lớp 1.
--
-- Điểm nhẹ lòng (Sales xác nhận): mã KHÔNG BAO GIỜ dùng lại — `nextSeq = maxSeq
-- + 1`, đơn điệu tăng kể cả với mã đã khai tử. Nên xấu nhất là chip TREO, không
-- bao giờ là chip TRỎ NHẦM sang người khác.
-- ============================================================================

alter table work.task_link add column if not exists nhan_luc_gan text;
comment on column work.task_link.nhan_luc_gan is
  'Tên bản ghi tại thời điểm gắn. Dùng khi mã bị khai tử về sau (gộp khách ở Sheet).';

-- ── link_json: nhan = tên ĐANG SỐNG, hoặc NULL ─────────────────────────────
-- Cố ý KHÔNG coalesce về mã ở đây nữa. Giao diện phải phân biệt được "còn sống"
-- với "đã chết nhưng đây là tên cũ" để nói cho người dùng biết; SQL trả sẵn một
-- chuỗi thì chỗ đó mất thông tin. Xem nhanChip() trong lib/work.ts.
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
        'nhan', nullif(btrim(coalesce(tk.ticket_type, '')), ''),
        'nhan_luc_gan', l.nhan_luc_gan,
        'phu',  left(coalesce(nullif(btrim(tk.description),''), tk.state), 60),
        'dich', null, 'khach_id', null)
      else jsonb_build_object(
        'id', l.id, 'loai', 'don', 'ma', l.order_code,
        'nhan', so.customer_name,
        'nhan_luc_gan', l.nhan_luc_gan,
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

-- ── Gắn: chụp tên, và bám thêm id CSKH nếu có ──────────────────────────────
create or replace function public.work_gan_erp(p_email text, p_task_id bigint, p_loai text, p_ma text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_me uuid; v_ma text; v_khach_id uuid; v_nhan text; v_co boolean;
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
    -- Gắn theo mã: lấy tên để chụp, VÀ id CSKH nếu khách có hồ sơ bên đó. Mã chết
    -- về sau mà còn id thì chip vẫn bấm được thay vì chỉ còn cái tên.
    -- Kiểm TỒN TẠI riêng, không suy từ tên: khách có thật mà tên rỗng vẫn phải
    -- gắn được. Suy từ tên là chặn nhầm.
    select coalesce(sc.name, cc.full_name), cc.id,
           (sc.customer_code is not null or cc.id is not null)
      into v_nhan, v_khach_id, v_co
    from (select 1) _
    left join public.customers    sc on sc.customer_code = v_ma
    left join public.cs_customers cc on cc.customer_code = v_ma;
    if not coalesce(v_co, false) then
      raise exception 'Không có khách mã %', v_ma;
    end if;

  elsif p_loai = 'ticket' then
    select nullif(btrim(coalesce(ticket_type,'')),'') into v_nhan
    from public.tickets where ticket_code = v_ma;
    if not found then raise exception 'Không có ticket %', v_ma; end if;

  else
    select customer_name into v_nhan from public.sales_orders where order_code = v_ma;
    if not found then raise exception 'Không có đơn %', v_ma; end if;
  end if;

  -- Cùng một khách gắn hai kiểu (một lần theo mã, một lần theo id) thì hai unique
  -- index không bắt được vì chúng canh hai cột khác nhau. Chặn ở đây.
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
end $$;

-- ── Việc tự sinh: chụp tên luôn ────────────────────────────────────────────
create or replace function work.gan_link_tu_origin(p_task_id bigint, p_origin_ref text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_loai text; v_ma text; v_khach_id uuid; v_khach_ma text; v_khach_ten text; v_tk_ten text;
begin
  if p_origin_ref is null then return; end if;
  v_loai := split_part(p_origin_ref, ':', 1);
  v_ma   := substr(p_origin_ref, length(v_loai) + 2);
  if v_ma = '' then return; end if;

  if v_loai = 'ticket' then
    select nullif(btrim(coalesce(t.ticket_type,'')),'') into v_tk_ten
    from public.tickets t where t.ticket_code = v_ma;
    insert into work.task_link(task_id, link_type, ticket_code, nhan_luc_gan)
    values (p_task_id, 'ticket', v_ma, v_tk_ten) on conflict do nothing;

    select cc.id, cc.customer_code, cc.full_name into v_khach_id, v_khach_ma, v_khach_ten
    from public.tickets t join public.cs_customers cc on cc.id = t.customer_id
    where t.ticket_code = v_ma;

  elsif v_loai = 'serial' then
    select cc.id, cc.customer_code, cc.full_name into v_khach_id, v_khach_ma, v_khach_ten
    from public.installed_base ib join public.cs_customers cc on cc.id = ib.customer_id
    where ib.serial = v_ma;

  elsif v_loai = 'visit' then
    select cc.id, cc.customer_code, cc.full_name into v_khach_id, v_khach_ma, v_khach_ten
    from public.maintenance_visit mv
    join public.maintenance_plan mp on mp.id = mv.plan_id
    join public.cs_customers cc on cc.id = mp.customer_id
    where mv.id = v_ma::uuid;
  end if;

  if v_khach_id is not null then
    insert into work.task_link(task_id, link_type, customer_code, customer_id, nhan_luc_gan)
    values (p_task_id, 'khach', v_khach_ma, v_khach_id, v_khach_ten) on conflict do nothing;
  end if;
exception when others then
  return;
end $$;

-- ── Gắn bù cho dòng đã có ──────────────────────────────────────────────────
-- Chụp tên tại thời điểm CHẠY migration. Không lý tưởng (đúng ra phải là tên lúc
-- gắn) nhưng còn hơn để trống — và các dòng này đều vừa sinh hôm nay.
-- `limit 1` không thừa: mã khách ĐÃ từng trùng ở bảng Sales (Sheet sinh đôi dòng).
-- Truy vấn con vô hướng gặp 2 dòng là ném lỗi và cả migration đổ.
update work.task_link l set nhan_luc_gan = coalesce(
    (select sc.name      from public.customers    sc where sc.customer_code = l.customer_code limit 1),
    (select cc.full_name from public.cs_customers cc where cc.customer_code = l.customer_code limit 1),
    (select ci.full_name from public.cs_customers ci where ci.id            = l.customer_id   limit 1),
    (select nullif(btrim(coalesce(tk.ticket_type,'')),'') from public.tickets tk where tk.ticket_code = l.ticket_code limit 1),
    (select so.customer_name from public.sales_orders so where so.order_code = l.order_code limit 1))
where l.nhan_luc_gan is null
  and l.link_type in ('khach','ticket','don');

-- Dòng gắn theo mã mà khách CÓ hồ sơ CSKH: bù thêm id để mã chết vẫn bấm được.
update work.task_link l set customer_id = (
    select cc.id from public.cs_customers cc where cc.customer_code = l.customer_code limit 1)
where l.customer_code is not null and l.customer_id is null
  and exists (select 1 from public.cs_customers cc where cc.customer_code = l.customer_code);

notify pgrst, 'reload schema';
